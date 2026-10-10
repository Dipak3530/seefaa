
create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.curriculum_versions (
  id text primary key, level int not null, label text not null, is_active boolean not null default true, notes text
);
create table public.subjects (
  id text primary key, version_id text not null references public.curriculum_versions(id),
  name text not null, short_name text not null, sort int not null, est_hours int not null default 30
);
create table public.modules (
  id text primary key, subject_id text not null references public.subjects(id),
  version_id text not null references public.curriculum_versions(id),
  title text not null, sort int not null, needs_verification boolean not null default true
);
create index on public.modules(subject_id);
create table public.los (
  id text primary key, module_id text not null references public.modules(id),
  code text not null, statement text not null, sort int not null default 0, needs_verification boolean not null default true
);
create index on public.los(module_id);
grant select on public.curriculum_versions, public.subjects, public.modules, public.los to anon, authenticated;
grant update on public.modules, public.los to authenticated;
grant insert on public.los to authenticated;
grant all on public.curriculum_versions, public.subjects, public.modules, public.los to service_role;
alter table public.curriculum_versions enable row level security;
alter table public.subjects enable row level security;
alter table public.modules enable row level security;
alter table public.los enable row level security;
create policy "public read" on public.curriculum_versions for select using (true);
create policy "public read" on public.subjects for select using (true);
create policy "public read" on public.modules for select using (true);
create policy "public read" on public.los for select using (true);
create policy "admin update modules" on public.modules for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin update los" on public.los for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin insert los" on public.los for insert to authenticated with check (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  hours_per_day numeric not null default 2,
  study_days int[] not null default '{1,2,3,4,5,6}',
  leaderboard_opt_in boolean not null default false,
  onboarded boolean not null default false,
  active_attempt_id uuid,
  reminders jsonb not null default '{"daily":true,"revisions":true,"weekly":true,"quiet_start":"22:00","quiet_end":"07:00"}',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'CFA Level I',
  version_id text not null references public.curriculum_versions(id),
  exam_date date, start_date date not null default current_date, target_completion_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.subject_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  status text not null default 'not_started',
  position int, confidence text, deadline date,
  unique(attempt_id, subject_id)
);
create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  module_id text not null references public.modules(id),
  status text not null default 'not_started', confidence text, studied_on date, completed_at timestamptz, notes text,
  unique(attempt_id, module_id)
);
create table public.los_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  los_id text not null references public.los(id),
  status text not null default 'not_started', confidence text, completed_at timestamptz,
  unique(attempt_id, los_id)
);
create table public.revision_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  module_id text not null references public.modules(id),
  stage int not null, due_date date not null, completed_at timestamptz, performance int, confidence text, notes text,
  unique(attempt_id, module_id, stage)
);
create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  task_date date not null, kind text not null, subject_id text references public.subjects(id), module_id text references public.modules(id),
  title text not null, minutes int not null default 60, done boolean not null default false, completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.study_tasks(user_id, task_date);
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid references public.exam_attempts(id) on delete set null,
  version_id text references public.curriculum_versions(id),
  subject_id text references public.subjects(id), module_id text references public.modules(id), los_id text references public.los(id),
  question text not null, choices jsonb not null default '[]', selected_answer text, correct_answer text, correct_verified boolean not null default false,
  concept text, notes text, error_category text not null default 'other',
  image_paths text[] not null default '{}', image_hash text,
  mastery text not null default 'new', interval_days int not null default 1, streak int not null default 0,
  attempts_count int not null default 0, correct_count int not null default 0,
  next_review date not null default (current_date + 1),
  source text not null default 'uploaded', parent_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.mistakes(user_id, next_review);
create table public.mistake_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, mistake_id uuid not null references public.mistakes(id) on delete cascade,
  answer text, is_correct boolean not null, created_at timestamptz not null default now()
);
create table public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, mistake_id uuid references public.mistakes(id) on delete cascade,
  formula_id uuid, mode text not null, content text not null, created_at timestamptz not null default now()
);
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null, created_at timestamptz not null default now()
);
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid references public.exam_attempts(id) on delete set null,
  subject_id text references public.subjects(id), module_id text references public.modules(id),
  session_date date not null default current_date, total int not null, correct int not null, minutes int, source text, notes text,
  created_at timestamptz not null default now()
);
create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid references public.exam_attempts(id) on delete set null,
  name text not null, exam_date date not null default current_date, score_pct numeric not null,
  subject_scores jsonb not null default '{}', time_notes text, weak_areas text,
  created_at timestamptz not null default now()
);
create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, subject_id text references public.subjects(id), module_id text references public.modules(id),
  name text not null, expression text not null, variables text, conditions text, explanation text, example text,
  calculator text, common_mistakes text, tags text[] not null default '{}', favorite boolean not null default false,
  revision_status text not null default 'new', created_at timestamptz not null default now()
);
create table public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid references public.exam_attempts(id) on delete set null,
  kind text not null check (kind in ('study','revision')),
  subject_id text references public.subjects(id), module_id text references public.modules(id),
  status text not null default 'running',
  started_at timestamptz not null default now(), ended_at timestamptz,
  paused_at timestamptz, paused_seconds int not null default 0, active_seconds int, notes text,
  created_at timestamptz not null default now()
);
create unique index one_open_timer on public.timer_sessions(user_id) where status <> 'finished';
create table public.xp_config (key text primary key, amount int not null, description text);
create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, attempt_id uuid, source text not null, source_key text not null, amount int not null,
  created_at timestamptz not null default now(),
  unique(user_id, source_key)
);

do $$
declare t text;
begin
  foreach t in array array['exam_attempts','subject_plans','module_progress','los_progress','revision_checkpoints','study_tasks','mistakes','mistake_attempts','ai_explanations','practice_sessions','mock_exams','formulas','timer_sessions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
grant select, insert on public.ai_usage to authenticated; grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "own usage read" on public.ai_usage for select to authenticated using (auth.uid() = user_id);
create policy "own usage insert" on public.ai_usage for insert to authenticated with check (auth.uid() = user_id);
grant select on public.xp_ledger to authenticated; grant all on public.xp_ledger to service_role;
alter table public.xp_ledger enable row level security;
create policy "own xp read" on public.xp_ledger for select to authenticated using (auth.uid() = user_id);
grant select on public.xp_config to anon, authenticated; grant all on public.xp_config to service_role;
alter table public.xp_config enable row level security;
create policy "public read" on public.xp_config for select using (true);

insert into public.xp_config values
 ('los_complete',10,'First verified completion of an LOS'),
 ('module_complete',10,'First completion of a module'),
 ('revision_checkpoint',5,'Completing a scheduled revision checkpoint'),
 ('practice_session',5,'Completing a practice session (max 3 per day)'),
 ('mistake_corrected',5,'Correctly answering a previously missed question (once per question per day)'),
 ('mock_exam',20,'Completing a mock examination');

create or replace function public.award_xp(_user uuid, _attempt uuid, _source text, _key text)
returns void language plpgsql security definer set search_path = public as $$
declare amt int;
begin
  select amount into amt from public.xp_config where key = _source;
  if amt is null then return; end if;
  insert into public.xp_ledger(user_id, attempt_id, source, source_key, amount) values (_user, _attempt, _source, _key, amt)
  on conflict (user_id, source_key) do nothing;
end $$;
revoke execute on function public.award_xp(uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.on_module_progress() returns trigger language plpgsql security definer set search_path = public as $$
declare d date; intervals int[] := array[1,3,7,14,30]; i int;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    if new.completed_at is null then new.completed_at := now(); end if;
    perform public.award_xp(new.user_id, new.attempt_id, 'module_complete', 'module:'||new.attempt_id||':'||new.module_id);
    d := coalesce(new.studied_on, current_date);
    for i in 1..5 loop
      insert into public.revision_checkpoints(user_id, attempt_id, module_id, stage, due_date)
      values (new.user_id, new.attempt_id, new.module_id, i, d + intervals[i]) on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;
create trigger trg_module_progress before insert or update on public.module_progress for each row execute function public.on_module_progress();

create or replace function public.on_los_progress() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    if new.completed_at is null then new.completed_at := now(); end if;
    perform public.award_xp(new.user_id, new.attempt_id, 'los_complete', 'los:'||new.attempt_id||':'||new.los_id);
  end if;
  return new;
end $$;
create trigger trg_los_progress before insert or update on public.los_progress for each row execute function public.on_los_progress();

create or replace function public.on_checkpoint() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    perform public.award_xp(new.user_id, new.attempt_id, 'revision_checkpoint', 'rev:'||new.id);
    if coalesce(new.performance, 100) < 60 then
      update public.revision_checkpoints set due_date = least(due_date, current_date + (stage - new.stage) * 2)
      where attempt_id = new.attempt_id and module_id = new.module_id and stage > new.stage and completed_at is null;
    end if;
  end if;
  return new;
end $$;
create trigger trg_checkpoint after update on public.revision_checkpoints for each row execute function public.on_checkpoint();

create or replace function public.on_practice() returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.xp_ledger where user_id = new.user_id and source = 'practice_session' and created_at::date = current_date;
  if n < 3 then perform public.award_xp(new.user_id, new.attempt_id, 'practice_session', 'practice:'||new.id); end if;
  return new;
end $$;
create trigger trg_practice after insert on public.practice_sessions for each row execute function public.on_practice();

create or replace function public.on_mock() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.award_xp(new.user_id, new.attempt_id, 'mock_exam', 'mock:'||new.id); return new; end $$;
create trigger trg_mock after insert on public.mock_exams for each row execute function public.on_mock();

create or replace function public.on_mistake_attempt() returns trigger language plpgsql security definer set search_path = public as $$
declare m public.mistakes; newint int;
begin
  select * into m from public.mistakes where id = new.mistake_id and user_id = new.user_id;
  if not found then raise exception 'mistake not found'; end if;
  if new.is_correct then
    newint := least(60, greatest(2, round(m.interval_days * 2.5)::int));
    update public.mistakes set attempts_count = attempts_count + 1, correct_count = correct_count + 1,
      streak = streak + 1, interval_days = newint, next_review = current_date + newint,
      mastery = case when streak + 1 >= 3 then 'mastered' else 'learning' end, updated_at = now()
    where id = m.id;
    perform public.award_xp(new.user_id, m.attempt_id, 'mistake_corrected', 'mfix:'||m.id||':'||current_date);
  else
    update public.mistakes set attempts_count = attempts_count + 1, streak = 0, interval_days = 1,
      next_review = current_date + 1, mastery = 'learning', updated_at = now() where id = m.id;
  end if;
  return new;
end $$;
create trigger trg_mistake_attempt after insert on public.mistake_attempts for each row execute function public.on_mistake_attempt();

create or replace function public.leaderboard(_days int default 7)
returns table(display_name text, xp bigint, is_me boolean) language sql stable security definer set search_path = public as $$
  select p.display_name, coalesce(sum(x.amount),0) as xp, p.id = auth.uid()
  from public.profiles p left join public.xp_ledger x on x.user_id = p.id and (_days = 0 or x.created_at > now() - make_interval(days => _days))
  where p.leaderboard_opt_in
  group by p.id, p.display_name order by xp desc limit 50
$$;
grant execute on function public.leaderboard(int) to authenticated;

create policy "own images read" on storage.objects for select to authenticated using (bucket_id = 'mistake-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images insert" on storage.objects for insert to authenticated with check (bucket_id = 'mistake-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images delete" on storage.objects for delete to authenticated using (bucket_id = 'mistake-images' and (storage.foldername(name))[1] = auth.uid()::text);
