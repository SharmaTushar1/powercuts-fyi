begin;

create or replace function public.get_public_incidents_filtered(
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
  ),
  counted as (
    select pg_catalog.count(*)::bigint as total_count from filtered
  ),
  page as (
    select filtered.*
    from filtered
    order by filtered.last_activity_at desc, filtered.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    page.id,
    page.slug,
    page.normalized_state,
    page.normalized_city,
    page.normalized_locality,
    page.normalized_sector,
    page.state_label,
    page.city_label,
    page.locality_label,
    page.sector_label,
    page.pincode,
    page.latitude,
    page.longitude,
    page.outage_type,
    page.consensus_status,
    page.participant_count,
    page.out_count,
    page.back_count,
    page.out_percentage,
    page.back_percentage,
    page.created_at,
    page.updated_at,
    page.last_activity_at,
    page.inactive_at,
    counted.total_count
  from counted
  left join page on true;
$$;

create or replace function public.get_public_location_aggregates(
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
  ),
  counted as (
    select pg_catalog.count(*)::bigint as total_count from grouped
  ),
  page as (
    select grouped.*
    from grouped
    order by
      grouped.active_incident_count desc,
      grouped.incident_count desc,
      grouped.state_label,
      grouped.city_label,
      grouped.locality_label,
      grouped.sector_label nulls first
    limit least(greatest(coalesce(p_limit, 500), 1), 500)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    page.normalized_state,
    page.normalized_city,
    page.normalized_locality,
    page.normalized_sector,
    page.state_label,
    page.city_label,
    page.locality_label,
    page.sector_label,
    page.incident_count,
    page.active_incident_count,
    counted.total_count
  from counted
  left join page on true;
$$;

commit;
