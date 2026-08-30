begin;

create or replace function public.get_nearby_public_incidents(
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
  -- Was capped at 20, which undercounted "how many active nearby" once a
  -- single radius held more matches than the display list needed. 200 is
  -- still a bound (never truly unlimited), but far past what a locality-
  -- deduplicated radius realistically produces, so counts stop being
  -- silently truncated in practice.
  limit least(greatest(coalesce(p_limit, 10), 1), 200);
end;
$$;

commit;
