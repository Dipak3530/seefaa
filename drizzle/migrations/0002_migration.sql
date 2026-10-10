
create or replace function public.timer_action(_id uuid, _action text, _notes text default null)
returns public.timer_sessions language plpgsql security invoker set search_path = public as $$
declare s public.timer_sessions;
begin
  select * into s from public.timer_sessions where id = _id and user_id = auth.uid() for update;
  if not found then raise exception 'session not found'; end if;
  if _action = 'pause' and s.status = 'running' then
    update public.timer_sessions set status = 'paused', paused_at = now() where id = _id returning * into s;
  elsif _action = 'resume' and s.status = 'paused' then
    update public.timer_sessions set status = 'running',
      paused_seconds = paused_seconds + extract(epoch from now() - paused_at)::int, paused_at = null
    where id = _id returning * into s;
  elsif _action = 'finish' and s.status <> 'finished' then
    update public.timer_sessions set
      paused_seconds = paused_seconds + case when status = 'paused' then extract(epoch from now() - paused_at)::int else 0 end,
      ended_at = now(), paused_at = null, status = 'finished', notes = coalesce(_notes, notes)
    where id = _id returning * into s;
    update public.timer_sessions set active_seconds = greatest(0, extract(epoch from ended_at - started_at)::int - paused_seconds)
    where id = _id returning * into s;
  end if;
  return s;
end $$;
grant execute on function public.timer_action(uuid, text, text) to authenticated;
