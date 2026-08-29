begin;

create extension if not exists pgcrypto with schema extensions;

create type public.outage_type as enum ('planned', 'unexpected');
create type public.consensus_status as enum ('ongoing', 'resolved');
create type public.observation_state as enum ('out', 'back');

create function public.normalize_location_component(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(value), '[[:space:]]+', ' ', 'g')
  );
$$;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  normalized_state text not null,
  normalized_city text not null,
  normalized_locality text not null,
  normalized_sector text,
  state_label text not null,
  city_label text not null,
  locality_label text not null,
  sector_label text,
  pincode text,
  latitude double precision not null,
  longitude double precision not null,
  outage_type public.outage_type not null,
  consensus_status public.consensus_status not null default 'ongoing',
  created_at timestamp with time zone not null default clock_timestamp(),
  updated_at timestamp with time zone not null default clock_timestamp(),
  last_activity_at timestamp with time zone not null default clock_timestamp(),
  last_out_observed_at timestamp with time zone,
  inactive_at timestamp with time zone,
  constraint incidents_slug_format check (
    slug ~ '^pc-[a-f0-9]{32}$'
  ),
  constraint incidents_normalized_state check (
    pg_catalog.char_length(normalized_state) between 1 and 100
    and normalized_state !~ '[[:cntrl:]]'
    and normalized_state = public.normalize_location_component(normalized_state)
  ),
  constraint incidents_normalized_city check (
    pg_catalog.char_length(normalized_city) between 1 and 100
    and normalized_city !~ '[[:cntrl:]]'
    and normalized_city = public.normalize_location_component(normalized_city)
  ),
  constraint incidents_normalized_locality check (
    pg_catalog.char_length(normalized_locality) between 1 and 100
    and normalized_locality !~ '[[:cntrl:]]'
    and normalized_locality = public.normalize_location_component(normalized_locality)
  ),
  constraint incidents_normalized_sector check (
    normalized_sector is null
    or (
      pg_catalog.char_length(normalized_sector) between 1 and 100
      and normalized_sector !~ '[[:cntrl:]]'
      and normalized_sector = public.normalize_location_component(normalized_sector)
    )
  ),
  constraint incidents_state_label check (
    state_label = pg_catalog.btrim(state_label)
    and pg_catalog.char_length(state_label) between 1 and 100
    and state_label !~ '[[:cntrl:]]'
  ),
  constraint incidents_city_label check (
    city_label = pg_catalog.btrim(city_label)
    and pg_catalog.char_length(city_label) between 1 and 100
    and city_label !~ '[[:cntrl:]]'
  ),
  constraint incidents_locality_label check (
    locality_label = pg_catalog.btrim(locality_label)
    and pg_catalog.char_length(locality_label) between 1 and 100
    and locality_label !~ '[[:cntrl:]]'
  ),
  constraint incidents_sector_label check (
    sector_label is null
    or (
      sector_label = pg_catalog.btrim(sector_label)
      and pg_catalog.char_length(sector_label) between 1 and 100
      and sector_label !~ '[[:cntrl:]]'
    )
  ),
  constraint incidents_pincode check (
    pincode is null or pincode ~ '^[0-9]{6}$'
  ),
  constraint incidents_latitude check (latitude between -90 and 90),
  constraint incidents_longitude check (longitude between -180 and 180),
  constraint incidents_timestamp_order check (
    updated_at >= created_at
    and last_activity_at >= created_at
    and (last_out_observed_at is null or last_out_observed_at >= created_at)
    and (inactive_at is null or inactive_at >= created_at)
  )
);

create unique index incidents_one_active_locality_idx
  on public.incidents (
    normalized_state,
    normalized_city,
    normalized_locality,
    coalesce(normalized_sector, '')
  )
  where inactive_at is null;

create index incidents_active_activity_idx
  on public.incidents (last_activity_at desc)
  where inactive_at is null;

create index incidents_location_idx
  on public.incidents (
    normalized_state,
    normalized_city,
    normalized_locality,
    normalized_sector
  );

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete restrict,
  participant_hash text not null,
  state public.observation_state not null,
  observed_at timestamp with time zone not null default clock_timestamp(),
  constraint observations_participant_hash check (
    participant_hash ~ '^[a-f0-9]{64}$'
  )
);

create index observations_incident_recent_idx
  on public.observations (incident_id, observed_at desc);

create index observations_latest_participant_idx
  on public.observations (incident_id, participant_hash, observed_at desc, id desc);

create table public.rate_limit_records (
  scope text not null,
  identifier_hash text not null,
  window_start timestamp with time zone not null,
  request_count integer not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default clock_timestamp(),
  primary key (scope, identifier_hash, window_start),
  constraint rate_limit_scope check (
    pg_catalog.char_length(scope) between 1 and 80
    and scope ~ '^[a-z0-9:_-]+$'
  ),
  constraint rate_limit_identifier_hash check (
    identifier_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint rate_limit_request_count check (request_count > 0),
  constraint rate_limit_expiration check (expires_at > window_start)
);

create index rate_limit_records_expiration_idx
  on public.rate_limit_records (expires_at);

create function public.set_incident_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger incidents_set_updated_at
before update on public.incidents
for each row
execute function public.set_incident_updated_at();

create function public.reject_observation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Observations are immutable';
end;
$$;

create trigger observations_are_immutable
before update or delete on public.observations
for each row
execute function public.reject_observation_mutation();

create view public.incident_consensus
with (security_barrier = true, security_invoker = true)
as
with ranked_observations as (
  select
    o.incident_id,
    o.participant_hash,
    o.state,
    pg_catalog.row_number() over (
      partition by o.incident_id, o.participant_hash
      order by o.observed_at desc, o.id desc
    ) as observation_rank
  from public.observations as o
  where o.observed_at >= current_timestamp - interval '60 minutes'
),
latest_observations as (
  select incident_id, state
  from ranked_observations
  where observation_rank = 1
),
counts as (
  select
    latest.incident_id,
    pg_catalog.count(*) as participant_count,
    pg_catalog.count(*) filter (where latest.state = 'out') as out_count,
    pg_catalog.count(*) filter (where latest.state = 'back') as back_count
  from latest_observations as latest
  group by latest.incident_id
)
select
  i.id,
  i.slug,
  i.normalized_state,
  i.normalized_city,
  i.normalized_locality,
  i.normalized_sector,
  i.state_label,
  i.city_label,
  i.locality_label,
  i.sector_label,
  i.pincode,
  i.latitude,
  i.longitude,
  i.outage_type,
  case
    when coalesce(c.out_count, 0) > coalesce(c.back_count, 0)
      then 'ongoing'::public.consensus_status
    when coalesce(c.back_count, 0) > coalesce(c.out_count, 0)
      then 'resolved'::public.consensus_status
    else i.consensus_status
  end as consensus_status,
  coalesce(c.participant_count, 0)::bigint as participant_count,
  coalesce(c.out_count, 0)::bigint as out_count,
  coalesce(c.back_count, 0)::bigint as back_count,
  coalesce(
    pg_catalog.round(
      100.0 * c.out_count / nullif(c.participant_count, 0),
      2
    ),
    0
  )::numeric(5, 2) as out_percentage,
  coalesce(
    pg_catalog.round(
      100.0 * c.back_count / nullif(c.participant_count, 0),
      2
    ),
    0
  )::numeric(5, 2) as back_percentage,
  i.created_at,
  i.updated_at,
  i.last_activity_at,
  i.inactive_at
from public.incidents as i
left join counts as c on c.incident_id = i.id;

create function public.record_observation(
  p_incident_id uuid,
  p_participant_hash text,
  p_state public.observation_state
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident public.incidents%rowtype;
  v_now timestamp with time zone := clock_timestamp();
  v_out_count bigint;
  v_back_count bigint;
  v_next_status public.consensus_status;
  v_result jsonb;
begin
  if p_participant_hash is null
    or p_participant_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid participant hash';
  end if;

  select i.*
  into v_incident
  from public.incidents as i
  where i.id = p_incident_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'INCIDENT_NOT_FOUND';
  end if;

  if v_incident.inactive_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'INCIDENT_INACTIVE';
  end if;

  insert into public.observations (
    incident_id,
    participant_hash,
    state,
    observed_at
  )
  values (
    p_incident_id,
    p_participant_hash,
    p_state,
    v_now
  );

  select
    pg_catalog.count(*) filter (where latest.state = 'out'),
    pg_catalog.count(*) filter (where latest.state = 'back')
  into v_out_count, v_back_count
  from (
    select distinct on (o.participant_hash)
      o.participant_hash,
      o.state
    from public.observations as o
    where o.incident_id = p_incident_id
      and o.observed_at >= v_now - interval '60 minutes'
    order by o.participant_hash, o.observed_at desc, o.id desc
  ) as latest;

  v_next_status := case
    when v_out_count > v_back_count then 'ongoing'::public.consensus_status
    when v_back_count > v_out_count then 'resolved'::public.consensus_status
    else v_incident.consensus_status
  end;

  update public.incidents as i
  set
    consensus_status = v_next_status,
    last_activity_at = v_now,
    last_out_observed_at = case
      when p_state = 'out' then v_now
      else i.last_out_observed_at
    end
  where i.id = p_incident_id;

  select pg_catalog.to_jsonb(consensus)
  into v_result
  from public.incident_consensus as consensus
  where consensus.id = p_incident_id;

  return v_result;
end;
$$;

create function public.find_or_create_incident(
  p_normalized_state text,
  p_normalized_city text,
  p_normalized_locality text,
  p_normalized_sector text,
  p_state_label text,
  p_city_label text,
  p_locality_label text,
  p_sector_label text,
  p_pincode text,
  p_latitude double precision,
  p_longitude double precision,
  p_outage_type public.outage_type,
  p_participant_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text := public.normalize_location_component(p_normalized_state);
  v_city text := public.normalize_location_component(p_normalized_city);
  v_locality text := public.normalize_location_component(p_normalized_locality);
  v_sector text := nullif(
    public.normalize_location_component(coalesce(p_normalized_sector, '')),
    ''
  );
  v_lock_key text;
  v_incident_id uuid;
  v_created boolean := false;
  v_result jsonb;
begin
  if v_state = '' or v_city = '' or v_locality = '' then
    raise exception using
      errcode = '22023',
      message = 'State, city, and locality are required';
  end if;

  v_lock_key := pg_catalog.concat_ws(
    chr(31),
    v_state,
    v_city,
    v_locality,
    coalesce(v_sector, '')
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_lock_key, 0)
  );

  select i.id
  into v_incident_id
  from public.incidents as i
  where i.normalized_state = v_state
    and i.normalized_city = v_city
    and i.normalized_locality = v_locality
    and i.normalized_sector is not distinct from v_sector
    and i.inactive_at is null
  for update;

  if not found then
    insert into public.incidents (
      slug,
      normalized_state,
      normalized_city,
      normalized_locality,
      normalized_sector,
      state_label,
      city_label,
      locality_label,
      sector_label,
      pincode,
      latitude,
      longitude,
      outage_type,
      consensus_status
    )
    values (
      'pc-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
      v_state,
      v_city,
      v_locality,
      v_sector,
      p_state_label,
      p_city_label,
      p_locality_label,
      p_sector_label,
      p_pincode,
      p_latitude,
      p_longitude,
      p_outage_type,
      'ongoing'
    )
    returning id into v_incident_id;

    v_created := true;
  end if;

  perform public.record_observation(
    v_incident_id,
    p_participant_hash,
    'out'::public.observation_state
  );

  select
    pg_catalog.to_jsonb(consensus)
      || pg_catalog.jsonb_build_object('was_created', v_created)
  into v_result
  from public.incident_consensus as consensus
  where consensus.id = v_incident_id;

  return v_result;
end;
$$;

create function public.consume_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamp with time zone := clock_timestamp();
  v_window_start timestamp with time zone;
  v_expires_at timestamp with time zone;
  v_request_count integer;
begin
  if p_scope is null
    or pg_catalog.char_length(p_scope) not between 1 and 80
    or p_scope !~ '^[a-z0-9:_-]+$'
    or p_identifier_hash is null
    or p_identifier_hash !~ '^[a-f0-9]{64}$'
    or p_max_requests is null
    or p_max_requests not between 1 and 10000
    or p_window_seconds is null
    or p_window_seconds not between 1 and 86400
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate-limit arguments';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(
      extract(epoch from v_now) / p_window_seconds
    ) * p_window_seconds
  );
  v_expires_at := v_window_start + pg_catalog.make_interval(secs => p_window_seconds);

  insert into public.rate_limit_records as rl (
    scope,
    identifier_hash,
    window_start,
    request_count,
    expires_at
  )
  values (
    p_scope,
    p_identifier_hash,
    v_window_start,
    1,
    v_expires_at
  )
  on conflict (scope, identifier_hash, window_start)
  do update set
    request_count = rl.request_count + 1,
    expires_at = excluded.expires_at
  returning rl.request_count into v_request_count;

  return query
  select
    v_request_count <= p_max_requests,
    greatest(p_max_requests - v_request_count, 0),
    case
      when v_request_count <= p_max_requests then 0
      else greatest(
        pg_catalog.ceil(
          extract(epoch from (v_expires_at - v_now))
        )::integer,
        1
      )
    end;
end;
$$;

create function public.mark_inactive_incidents(
  p_as_of timestamp with time zone default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affected integer;
begin
  update public.incidents as i
  set
    inactive_at = p_as_of,
    consensus_status = 'resolved'
  where i.inactive_at is null
    and i.last_activity_at <= p_as_of - interval '6 hours';

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

create function public.prune_rate_limit_records(
  p_as_of timestamp with time zone default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affected integer;
begin
  delete from public.rate_limit_records as rl
  where rl.expires_at < p_as_of;

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

create function public.get_public_incidents(
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.incident_consensus
language sql
stable
security definer
set search_path = ''
as $$
  select consensus.*
  from public.incident_consensus as consensus
  where consensus.inactive_at is null
    or consensus.inactive_at >= current_timestamp - interval '30 days'
  order by consensus.last_activity_at desc, consensus.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

create function public.get_incident_by_slug(p_slug text)
returns setof public.incident_consensus
language sql
stable
security definer
set search_path = ''
as $$
  select consensus.*
  from public.incident_consensus as consensus
  where consensus.slug = p_slug
    and (
      consensus.inactive_at is null
      or consensus.inactive_at >= current_timestamp - interval '30 days'
    )
  limit 1;
$$;

alter table public.incidents enable row level security;
alter table public.observations enable row level security;
alter table public.rate_limit_records enable row level security;

create policy incidents_bounded_public_read
on public.incidents
for select
to anon, authenticated
using (
  inactive_at is null
  or inactive_at >= current_timestamp - interval '30 days'
);

revoke all on table public.incidents from public, anon, authenticated;
revoke all on table public.observations from public, anon, authenticated;
revoke all on table public.rate_limit_records from public, anon, authenticated;
revoke all on table public.incident_consensus from public, anon, authenticated;

grant select on table public.incidents to anon, authenticated;
grant all on table public.incidents to service_role;
grant all on table public.observations to service_role;
grant all on table public.rate_limit_records to service_role;
grant select on table public.incident_consensus to service_role;

revoke all on function public.normalize_location_component(text)
  from public, anon, authenticated;
revoke all on function public.set_incident_updated_at()
  from public, anon, authenticated;
revoke all on function public.reject_observation_mutation()
  from public, anon, authenticated;
revoke all on function public.record_observation(uuid, text, public.observation_state)
  from public, anon, authenticated;
revoke all on function public.find_or_create_incident(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  public.outage_type,
  text
) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.mark_inactive_incidents(timestamp with time zone)
  from public, anon, authenticated;
revoke all on function public.prune_rate_limit_records(timestamp with time zone)
  from public, anon, authenticated;
revoke all on function public.get_public_incidents(integer, integer)
  from public;
revoke all on function public.get_incident_by_slug(text)
  from public;

grant execute on function public.record_observation(
  uuid,
  text,
  public.observation_state
) to service_role;
grant execute on function public.find_or_create_incident(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  public.outage_type,
  text
) to service_role;
grant execute on function public.consume_rate_limit(
  text,
  text,
  integer,
  integer
) to service_role;
grant execute on function public.mark_inactive_incidents(timestamp with time zone)
  to service_role;
grant execute on function public.prune_rate_limit_records(timestamp with time zone)
  to service_role;
grant execute on function public.get_public_incidents(integer, integer)
  to anon, authenticated, service_role;
grant execute on function public.get_incident_by_slug(text)
  to anon, authenticated, service_role;

alter table public.incidents replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incidents'
  )
  then
    alter publication supabase_realtime add table public.incidents;
  end if;
end;
$$;

comment on table public.observations is
  'Immutable outage observations. Consensus uses each participant hash''s latest event in the rolling 60-minute window.';
comment on table public.rate_limit_records is
  'Service-only fixed-window rate-limit counters keyed exclusively by HMAC identifiers.';
comment on view public.incident_consensus is
  'Current rolling 60-minute distinct-participant consensus; ties retain the incident''s prior status.';

commit;
