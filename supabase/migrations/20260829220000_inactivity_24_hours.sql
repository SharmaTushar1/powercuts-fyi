begin;

create or replace function public.mark_inactive_incidents(
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
    and i.last_activity_at <= p_as_of - interval '24 hours';

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

commit;
