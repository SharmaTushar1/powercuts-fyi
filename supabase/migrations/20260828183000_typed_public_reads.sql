begin;

create index if not exists incidents_active_coordinates_idx
  on public.incidents (latitude, longitude)
  where inactive_at is null;

create function public.get_public_incidents_filtered(
  p_state text default null,
  p_city text default null,
  p_locality text default null,
  p_sector text default null,
  p_outage_type public.outage_type default null,
  p_consensus_status public.consensus_status default null,
  p_active_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  normalized_state text,
  normalized_city text,
  normalized_locality text,
  normalized_sector text,
  state_label text,
  city_label text,
  locality_label text,
  sector_label text,
  pincode text,
  latitude double precision,
  longitude double precision,
  outage_type public.outage_type,
  consensus_status public.consensus_status,
  participant_count bigint,
  out_count bigint,
  back_count bigint,
  out_percentage numeric(5, 2),
  back_percentage numeric(5, 2),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  inactive_at timestamp with time zone,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with normalized_filters as (
    select
      nullif(
        public.normalize_location_component(coalesce(p_state, '')),
        ''
      ) as state,
      nullif(
        public.normalize_location_component(coalesce(p_city, '')),
        ''
      ) as city,
      nullif(
        public.normalize_location_component(coalesce(p_locality, '')),
        ''
      ) as locality,
      nullif(
        public.normalize_location_component(coalesce(p_sector, '')),
        ''
      ) as sector
  ),
  filtered as (
    select consensus.*
    from public.incident_consensus as consensus
    cross join normalized_filters as filters
    where (
      consensus.inactive_at is null
      or consensus.inactive_at >= current_timestamp - interval '30 days'
    )
      and (
        not coalesce(p_active_only, false)
        or (
          consensus.inactive_at is null
          and consensus.consensus_status = 'ongoing'
        )
      )
      and (
        filters.state is null
        or consensus.normalized_state = filters.state
      )
      and (
        filters.city is null
        or consensus.normalized_city = filters.city
      )
      and (
        filters.locality is null
        or consensus.normalized_locality = filters.locality
      )
      and (
        filters.sector is null
        or consensus.normalized_sector = filters.sector
      )
      and (
        p_outage_type is null
        or consensus.outage_type = p_outage_type
      )
      and (
        p_consensus_status is null
        or consensus.consensus_status = p_consensus_status
      )
  )
  select
    filtered.*,
    pg_catalog.count(*) over () as total_count
  from filtered
  order by filtered.last_activity_at desc, filtered.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

create function public.get_public_incident_stats()
returns table (
  incidents_last_10_minutes bigint,
  active_incident_count bigint,
  affected_state_count bigint,
  bengaluru_active_count bigint,
  generated_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pg_catalog.count(*) filter (
      where consensus.created_at >= current_timestamp - interval '10 minutes'
    ) as incidents_last_10_minutes,
    pg_catalog.count(*) filter (
      where consensus.inactive_at is null
        and consensus.consensus_status = 'ongoing'
    ) as active_incident_count,
    pg_catalog.count(distinct consensus.normalized_state) filter (
      where consensus.inactive_at is null
        and consensus.consensus_status = 'ongoing'
    ) as affected_state_count,
    pg_catalog.count(*) filter (
      where consensus.inactive_at is null
        and consensus.consensus_status = 'ongoing'
        and consensus.normalized_city = 'bengaluru'
    ) as bengaluru_active_count,
    statement_timestamp() as generated_at
  from public.incident_consensus as consensus
  where consensus.inactive_at is null
    or consensus.inactive_at >= current_timestamp - interval '30 days';
$$;

create function public.get_public_location_aggregates(
  p_state text default null,
  p_city text default null,
  p_active_only boolean default false,
  p_since timestamp with time zone default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  normalized_state text,
  normalized_city text,
  normalized_locality text,
  normalized_sector text,
  state_label text,
  city_label text,
  locality_label text,
  sector_label text,
  incident_count bigint,
  active_incident_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with normalized_filters as (
    select
      nullif(
        public.normalize_location_component(coalesce(p_state, '')),
        ''
      ) as state,
      nullif(
        public.normalize_location_component(coalesce(p_city, '')),
        ''
      ) as city
  ),
  filtered as (
    select consensus.*
    from public.incident_consensus as consensus
    cross join normalized_filters as filters
    where (
      consensus.inactive_at is null
      or consensus.inactive_at >= current_timestamp - interval '30 days'
    )
      and (
        not coalesce(p_active_only, false)
        or (
          consensus.inactive_at is null
          and consensus.consensus_status = 'ongoing'
        )
      )
      and (
        filters.state is null
        or consensus.normalized_state = filters.state
      )
      and (
        filters.city is null
        or consensus.normalized_city = filters.city
      )
      and (p_since is null or consensus.created_at >= p_since)
  ),
  grouped as (
    select
      filtered.normalized_state,
      filtered.normalized_city,
      filtered.normalized_locality,
      filtered.normalized_sector,
      pg_catalog.max(filtered.state_label) as state_label,
      pg_catalog.max(filtered.city_label) as city_label,
      pg_catalog.max(filtered.locality_label) as locality_label,
      pg_catalog.max(filtered.sector_label) as sector_label,
      pg_catalog.count(*) as incident_count,
      pg_catalog.count(*) filter (
        where filtered.inactive_at is null
          and filtered.consensus_status = 'ongoing'
      ) as active_incident_count
    from filtered
    group by
      filtered.normalized_state,
      filtered.normalized_city,
      filtered.normalized_locality,
      filtered.normalized_sector
  )
  select
    grouped.*,
    pg_catalog.count(*) over () as total_count
  from grouped
  order by
    grouped.active_incident_count desc,
    grouped.incident_count desc,
    grouped.state_label,
    grouped.city_label,
    grouped.locality_label,
    grouped.sector_label nulls first
  limit least(greatest(coalesce(p_limit, 500), 1), 500)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

create function public.get_nearby_public_incidents(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 25,
  p_limit integer default 10,
  p_exclude_incident_id uuid default null
)
returns table (
  id uuid,
  slug text,
  normalized_state text,
  normalized_city text,
  normalized_locality text,
  normalized_sector text,
  state_label text,
  city_label text,
  locality_label text,
  sector_label text,
  pincode text,
  latitude double precision,
  longitude double precision,
  outage_type public.outage_type,
  consensus_status public.consensus_status,
  participant_count bigint,
  out_count bigint,
  back_count bigint,
  out_percentage numeric(5, 2),
  back_percentage numeric(5, 2),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  inactive_at timestamp with time zone,
  distance_km double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_radius_km double precision :=
    least(greatest(coalesce(p_radius_km, 25), 0.1), 200);
  v_latitude_delta double precision := v_radius_km / 111.045;
  v_longitude_delta double precision;
begin
  if p_latitude is null
    or p_latitude not between -90 and 90
    or p_longitude is null
    or p_longitude not between -180 and 180
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid nearby query';
  end if;

  v_longitude_delta := least(
    v_radius_km / (
      111.045
      * greatest(
        pg_catalog.abs(pg_catalog.cos(pg_catalog.radians(p_latitude))),
        0.01
      )
    ),
    180
  );

  return query
  with candidates as (
    select consensus.*
    from public.incident_consensus as consensus
    where consensus.inactive_at is null
      and consensus.consensus_status = 'ongoing'
      and (
        p_exclude_incident_id is null
        or consensus.id <> p_exclude_incident_id
      )
      and consensus.latitude between
        p_latitude - v_latitude_delta
        and p_latitude + v_latitude_delta
      and least(
        pg_catalog.abs(consensus.longitude - p_longitude),
        360 - pg_catalog.abs(consensus.longitude - p_longitude)
      ) <= v_longitude_delta
  ),
  distances as (
    select
      candidates.*,
      2 * 6371.0088 * pg_catalog.asin(
        pg_catalog.sqrt(
          least(
            1,
            greatest(
              0,
              pg_catalog.power(
                pg_catalog.sin(
                  pg_catalog.radians(candidates.latitude - p_latitude) / 2
                ),
                2
              )
              + pg_catalog.cos(pg_catalog.radians(p_latitude))
              * pg_catalog.cos(pg_catalog.radians(candidates.latitude))
              * pg_catalog.power(
                pg_catalog.sin(
                  pg_catalog.radians(candidates.longitude - p_longitude) / 2
                ),
                2
              )
            )
          )
        )
      ) as distance_km
    from candidates
  )
  select distances.*
  from distances
  where distances.distance_km <= v_radius_km
  order by distances.distance_km, distances.last_activity_at desc, distances.id
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
end;
$$;

revoke all on function public.get_public_incidents_filtered(
  text,
  text,
  text,
  text,
  public.outage_type,
  public.consensus_status,
  boolean,
  integer,
  integer
) from public;
revoke all on function public.get_public_incident_stats() from public;
revoke all on function public.get_public_location_aggregates(
  text,
  text,
  boolean,
  timestamp with time zone,
  integer,
  integer
) from public;
revoke all on function public.get_nearby_public_incidents(
  double precision,
  double precision,
  double precision,
  integer,
  uuid
) from public;

grant execute on function public.get_public_incidents_filtered(
  text,
  text,
  text,
  text,
  public.outage_type,
  public.consensus_status,
  boolean,
  integer,
  integer
) to anon, authenticated, service_role;
grant execute on function public.get_public_incident_stats()
  to anon, authenticated, service_role;
grant execute on function public.get_public_location_aggregates(
  text,
  text,
  boolean,
  timestamp with time zone,
  integer,
  integer
) to anon, authenticated, service_role;
grant execute on function public.get_nearby_public_incidents(
  double precision,
  double precision,
  double precision,
  integer,
  uuid
) to anon, authenticated, service_role;

comment on function public.get_public_incidents_filtered(
  text,
  text,
  text,
  text,
  public.outage_type,
  public.consensus_status,
  boolean,
  integer,
  integer
) is 'Bounded public incident feed with normalized filters and server-side total count.';
comment on function public.get_public_incident_stats()
  is 'Small public aggregate used by the live incident summary.';
comment on function public.get_public_location_aggregates(
  text,
  text,
  boolean,
  timestamp with time zone,
  integer,
  integer
) is 'Bounded server-side state/city/locality/sector aggregate.';
comment on function public.get_nearby_public_incidents(
  double precision,
  double precision,
  double precision,
  integer,
  uuid
) is 'Bounded active-incident proximity query using great-circle distance.';

commit;
