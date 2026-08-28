begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon;
grant execute on all functions in schema extensions to anon;

select extensions.plan(12);

insert into public.incidents (
  id,
  slug,
  normalized_state,
  normalized_city,
  normalized_locality,
  state_label,
  city_label,
  locality_label,
  pincode,
  latitude,
  longitude,
  outage_type,
  consensus_status,
  created_at,
  last_activity_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'pc-20000000000040008000000000000001',
    'karnataka',
    'bengaluru',
    'hsr layout',
    'Karnataka',
    'Bengaluru',
    'HSR Layout',
    '560102',
    12.9121,
    77.6446,
    'unexpected',
    'ongoing',
    current_timestamp - interval '5 minutes',
    current_timestamp - interval '2 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'pc-20000000000040008000000000000002',
    'karnataka',
    'bengaluru',
    'koramangala',
    'Karnataka',
    'Bengaluru',
    'Koramangala',
    '560034',
    12.9352,
    77.6245,
    'planned',
    'ongoing',
    current_timestamp - interval '1 day',
    current_timestamp - interval '10 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'pc-20000000000040008000000000000003',
    'maharashtra',
    'pune',
    'shivaji nagar',
    'Maharashtra',
    'Pune',
    'Shivaji Nagar',
    '411005',
    18.5308,
    73.8475,
    'unexpected',
    'ongoing',
    current_timestamp - interval '2 days',
    current_timestamp - interval '30 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'pc-20000000000040008000000000000004',
    'karnataka',
    'mysuru',
    'vijayanagar',
    'Karnataka',
    'Mysuru',
    'Vijayanagar',
    '570017',
    12.3235,
    76.6143,
    'unexpected',
    'resolved',
    current_timestamp - interval '3 days',
    current_timestamp - interval '1 hour'
  );

set local role anon;

select extensions.is(
  (
    select count(*)
    from public.get_public_incidents_filtered(
      p_state => ' Karnataka ',
      p_outage_type => 'unexpected',
      p_consensus_status => 'ongoing',
      p_active_only => true
    )
  ),
  1::bigint,
  'filtered reads normalize locations and combine literal filters'
);
select extensions.is(
  (
    select max(total_count)
    from public.get_public_incidents_filtered(
      p_state => 'Karnataka',
      p_active_only => true
    )
  ),
  2::bigint,
  'filtered reads expose a server-side total'
);
select extensions.is(
  (
    select count(*)
    from public.get_public_incidents_filtered(
      p_state => 'Karnataka',
      p_active_only => true,
      p_limit => 1
    )
  ),
  1::bigint,
  'filtered reads honor bounded pagination'
);
select extensions.is(
  (select incidents_last_10_minutes from public.get_public_incident_stats()),
  1::bigint,
  'stats count incidents created during the last ten minutes'
);
select extensions.is(
  (select active_incident_count from public.get_public_incident_stats()),
  3::bigint,
  'stats count ongoing non-inactive incidents'
);
select extensions.is(
  (select affected_state_count from public.get_public_incident_stats()),
  2::bigint,
  'stats count distinct states with active incidents'
);
select extensions.is(
  (select bengaluru_active_count from public.get_public_incident_stats()),
  2::bigint,
  'stats include the active Bengaluru count'
);
select extensions.is(
  (
    select count(*)
    from public.get_public_location_aggregates(
      p_state => 'Karnataka',
      p_active_only => true
    )
  ),
  2::bigint,
  'location aggregates are grouped on the server'
);
select extensions.is(
  (
    select max(total_count)
    from public.get_public_location_aggregates(
      p_state => 'Karnataka',
      p_active_only => true
    )
  ),
  2::bigint,
  'location aggregates expose a server-side total'
);
select extensions.is(
  (
    select count(*)
    from public.get_nearby_public_incidents(
      p_latitude => 12.9121,
      p_longitude => 77.6446,
      p_radius_km => 10,
      p_exclude_incident_id => '20000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'nearby reads filter by distance and exclude the current incident'
);
select extensions.ok(
  (
    select distance_km < 10
    from public.get_nearby_public_incidents(
      p_latitude => 12.9121,
      p_longitude => 77.6446,
      p_radius_km => 10,
      p_exclude_incident_id => '20000000-0000-4000-8000-000000000001'
    )
    limit 1
  ),
  'nearby reads return a calculated distance'
);
select extensions.throws_ok(
  $sql$
    select *
    from public.get_nearby_public_incidents(
      p_latitude => 91,
      p_longitude => 77.6446
    )
  $sql$,
  '22023',
  'Invalid nearby query',
  'nearby reads validate coordinates'
);

select * from extensions.finish();
rollback;
