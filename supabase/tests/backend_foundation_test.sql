begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon;
grant execute on all functions in schema extensions to anon;

select extensions.plan(25);

insert into public.incidents (
  id,
  slug,
  normalized_state,
  normalized_city,
  normalized_locality,
  state_label,
  city_label,
  locality_label,
  latitude,
  longitude,
  outage_type,
  created_at,
  last_activity_at,
  inactive_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'pc-00000000000000000000000000000001',
    'state-retention',
    'city-retention',
    'active-locality',
    'State Retention',
    'City Retention',
    'Active Locality',
    18.5,
    73.8,
    'unexpected',
    current_timestamp - interval '1 hour',
    current_timestamp - interval '5 minutes',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'pc-00000000000000000000000000000002',
    'state-retention',
    'city-retention',
    'recent-locality',
    'State Retention',
    'City Retention',
    'Recent Locality',
    18.5,
    73.8,
    'unexpected',
    current_timestamp - interval '5 days',
    current_timestamp - interval '2 days',
    current_timestamp - interval '2 days'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'pc-00000000000000000000000000000003',
    'state-retention',
    'city-retention',
    'expired-locality',
    'State Retention',
    'City Retention',
    'Expired Locality',
    18.5,
    73.8,
    'unexpected',
    current_timestamp - interval '40 days',
    current_timestamp - interval '31 days',
    current_timestamp - interval '31 days'
  );

set local role anon;

select extensions.is(
  (select count(*) from public.incidents where slug = 'pc-00000000000000000000000000000001'),
  1::bigint,
  'anon can read an active incident'
);
select extensions.is(
  (select count(*) from public.incidents where slug = 'pc-00000000000000000000000000000002'),
  1::bigint,
  'anon can read a recently inactive incident'
);
select extensions.is(
  (select count(*) from public.incidents where slug = 'pc-00000000000000000000000000000003'),
  0::bigint,
  'RLS hides incidents inactive for more than 30 days'
);
select extensions.is(
  (select count(*) from public.get_incident_by_slug('pc-00000000000000000000000000000001')),
  1::bigint,
  'anon get-by-slug returns an active incident'
);
select extensions.is(
  (select count(*) from public.get_incident_by_slug('pc-00000000000000000000000000000002')),
  1::bigint,
  'anon get-by-slug returns a recently inactive incident'
);
select extensions.is(
  (select count(*) from public.get_incident_by_slug('pc-00000000000000000000000000000003')),
  0::bigint,
  'anon get-by-slug enforces the same 30-day retention boundary'
);
select extensions.throws_ok(
  $sql$
    insert into public.incidents (
      slug,
      normalized_state,
      normalized_city,
      normalized_locality,
      state_label,
      city_label,
      locality_label,
      latitude,
      longitude,
      outage_type
    )
    values (
      'pc-00000000000000000000000000000004',
      'state',
      'city',
      'locality',
      'State',
      'City',
      'Locality',
      0,
      0,
      'unexpected'
    )
  $sql$,
  '42501'
);
select extensions.throws_ok(
  $sql$
    insert into public.observations (incident_id, participant_hash, state)
    values (
      '00000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      'out'
    )
  $sql$,
  '42501'
);
select extensions.throws_ok(
  $sql$
    insert into public.rate_limit_records (
      scope,
      identifier_hash,
      window_start,
      request_count,
      expires_at
    )
    values (
      'test',
      repeat('a', 64),
      current_timestamp,
      1,
      current_timestamp + interval '1 hour'
    )
  $sql$,
  '42501'
);
select extensions.throws_ok(
  $sql$ select * from public.incident_consensus limit 1 $sql$,
  '42501'
);

reset role;

insert into public.observations (
  id,
  incident_id,
  participant_hash,
  state,
  observed_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  repeat('1', 64),
  'out',
  current_timestamp
);

select extensions.throws_ok(
  $sql$
    update public.observations
    set state = 'back'
    where id = '10000000-0000-4000-8000-000000000001'
  $sql$,
  '55000'
);
select extensions.throws_ok(
  $sql$
    delete from public.observations
    where id = '10000000-0000-4000-8000-000000000001'
  $sql$,
  '55000'
);

insert into public.incidents (
  id,
  slug,
  normalized_state,
  normalized_city,
  normalized_locality,
  state_label,
  city_label,
  locality_label,
  latitude,
  longitude,
  outage_type,
  consensus_status
)
values (
  '00000000-0000-4000-8000-000000000010',
  'pc-00000000000000000000000000000010',
  'state-consensus',
  'city-consensus',
  'latest-locality',
  'State Consensus',
  'City Consensus',
  'Latest Locality',
  18.5,
  73.8,
  'unexpected',
  'ongoing'
);

insert into public.observations (
  incident_id,
  participant_hash,
  state,
  observed_at
)
values
  (
    '00000000-0000-4000-8000-000000000010',
    repeat('a', 64),
    'out',
    current_timestamp - interval '30 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000010',
    repeat('a', 64),
    'back',
    current_timestamp - interval '10 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000010',
    repeat('b', 64),
    'out',
    current_timestamp - interval '5 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000010',
    repeat('c', 64),
    'out',
    current_timestamp - interval '61 minutes'
  );

select extensions.is(
  (select participant_count from public.incident_consensus where id = '00000000-0000-4000-8000-000000000010'),
  2::bigint,
  'consensus counts each recent participant once'
);
select extensions.is(
  (select out_count from public.incident_consensus where id = '00000000-0000-4000-8000-000000000010'),
  1::bigint,
  'consensus excludes replaced and expired out observations'
);
select extensions.is(
  (select back_count from public.incident_consensus where id = '00000000-0000-4000-8000-000000000010'),
  1::bigint,
  'consensus uses the latest observation per participant'
);
select extensions.is(
  (select consensus_status from public.incident_consensus where id = '00000000-0000-4000-8000-000000000010'),
  'ongoing'::public.consensus_status,
  'a tie retains the prior ongoing status'
);
select extensions.is(
  (select out_percentage from public.incident_consensus where id = '00000000-0000-4000-8000-000000000010'),
  50.00::numeric,
  'consensus calculates the rolling out percentage'
);

insert into public.incidents (
  id,
  slug,
  normalized_state,
  normalized_city,
  normalized_locality,
  state_label,
  city_label,
  locality_label,
  latitude,
  longitude,
  outage_type,
  consensus_status
)
values (
  '00000000-0000-4000-8000-000000000011',
  'pc-00000000000000000000000000000011',
  'state-tie',
  'city-tie',
  'tie-locality',
  'State Tie',
  'City Tie',
  'Tie Locality',
  18.5,
  73.8,
  'unexpected',
  'ongoing'
);

do $$
begin
  perform public.record_observation(
    '00000000-0000-4000-8000-000000000011',
    repeat('d', 64),
    'out'
  );
  perform public.record_observation(
    '00000000-0000-4000-8000-000000000011',
    repeat('e', 64),
    'back'
  );
end;
$$;
select extensions.is(
  (select consensus_status from public.incidents where id = '00000000-0000-4000-8000-000000000011'),
  'ongoing'::public.consensus_status,
  'recording a tied vote retains ongoing status'
);
do $$
begin
  perform public.record_observation(
    '00000000-0000-4000-8000-000000000011',
    repeat('d', 64),
    'back'
  );
end;
$$;
select extensions.is(
  (select consensus_status from public.incidents where id = '00000000-0000-4000-8000-000000000011'),
  'resolved'::public.consensus_status,
  'a back majority resolves the incident'
);
do $$
begin
  perform public.record_observation(
    '00000000-0000-4000-8000-000000000011',
    repeat('e', 64),
    'out'
  );
end;
$$;
select extensions.is(
  (select consensus_status from public.incidents where id = '00000000-0000-4000-8000-000000000011'),
  'resolved'::public.consensus_status,
  'a later tie retains resolved status'
);

insert into public.incidents (
  id,
  slug,
  normalized_state,
  normalized_city,
  normalized_locality,
  state_label,
  city_label,
  locality_label,
  latitude,
  longitude,
  outage_type,
  created_at,
  last_activity_at,
  last_out_observed_at
)
values
  (
    '00000000-0000-4000-8000-000000000012',
    'pc-00000000000000000000000000000012',
    'state-inactivity',
    'city-inactivity',
    'stale-locality',
    'State Inactivity',
    'City Inactivity',
    'Stale Locality',
    18.5,
    73.8,
    'unexpected',
    current_timestamp - interval '8 hours',
    current_timestamp - interval '7 hours',
    current_timestamp - interval '7 hours'
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    'pc-00000000000000000000000000000013',
    'state-inactivity',
    'city-inactivity',
    'recent-back-locality',
    'State Inactivity',
    'City Inactivity',
    'Recent Back Locality',
    18.5,
    73.8,
    'unexpected',
    current_timestamp - interval '8 hours',
    current_timestamp - interval '1 hour',
    current_timestamp - interval '7 hours'
  );

do $$
begin
  perform public.mark_inactive_incidents(current_timestamp);
end;
$$;
select extensions.ok(
  (select inactive_at is not null from public.incidents where id = '00000000-0000-4000-8000-000000000012'),
  'incidents with no activity for six hours become inactive'
);
select extensions.ok(
  (select inactive_at is null from public.incidents where id = '00000000-0000-4000-8000-000000000013'),
  'recent back activity keeps an incident active'
);

create temporary table active_incident_results (result jsonb) on commit drop;

insert into active_incident_results
select public.find_or_create_incident(
  'state-lock',
  'city-lock',
  'one-locality',
  null,
  'State Lock',
  'City Lock',
  'One Locality',
  null,
  null,
  18.5,
  73.8,
  'unexpected',
  repeat('f', 64)
);
insert into active_incident_results
select public.find_or_create_incident(
  'state-lock',
  'city-lock',
  'one-locality',
  null,
  'State Lock',
  'City Lock',
  'One Locality',
  null,
  null,
  18.5,
  73.8,
  'unexpected',
  repeat('0', 64)
);

select extensions.is(
  (
    select count(*)
    from public.incidents
    where normalized_state = 'state-lock'
      and normalized_city = 'city-lock'
      and normalized_locality = 'one-locality'
      and inactive_at is null
  ),
  1::bigint,
  'find-or-create maintains one active locality incident'
);
select extensions.is(
  (select count(distinct result ->> 'id') from active_incident_results),
  1::bigint,
  'repeated find-or-create calls return the same active incident'
);
select extensions.throws_ok(
  $sql$
    insert into public.incidents (
      slug,
      normalized_state,
      normalized_city,
      normalized_locality,
      state_label,
      city_label,
      locality_label,
      latitude,
      longitude,
      outage_type
    )
    values (
      'pc-ffffffffffffffffffffffffffffffff',
      'state-lock',
      'city-lock',
      'one-locality',
      'State Lock',
      'City Lock',
      'One Locality',
      18.5,
      73.8,
      'unexpected'
    )
  $sql$,
  '23505'
);

select * from extensions.finish();
rollback;
