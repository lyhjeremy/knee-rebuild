-- Knee Rebuild: Supabase schema. Paste into the SQL Editor and run once.
-- Exercises and session templates live in the app code (js/data.js); these tables hold only your logs.

-- One row per exercise per day.
create table if not exists public.log_entries (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  log_date    date not null,
  exercise_id text not null,
  session_id  text,
  done        boolean,                         -- true = done, false = not done, null = in progress
  sets        jsonb not null default '[]',     -- [{"v": reps|seconds|minutes (left side for L/R moves), "vr": right side, "kg": number|null, "ok": bool}]
  pain        smallint check (pain between 0 and 10),
  notes       text[] not null default '{}',
  weight_kg   numeric,                         -- heaviest completed set, for quick queries
  client_ts   bigint not null,                 -- device clock in ms; newest wins
  server_ts   timestamptz not null default now(),
  primary key (user_id, log_date, exercise_id)
);

-- Which session was done on a day, when it differs from the weekly schedule.
create table if not exists public.day_sessions (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  log_date   date not null,
  session_id text,
  client_ts  bigint not null,
  server_ts  timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table if not exists public.milestones (
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  milestone_id text not null,
  achieved     boolean not null default false,
  achieved_on  date,
  client_ts    bigint not null,
  server_ts    timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

-- Morning check (kind 'daily', keyed by date) and weekly check (kind 'weekly', keyed by the week's Monday).
create table if not exists public.checkins (
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  kind      text not null check (kind in ('daily', 'weekly')),
  log_date  date not null,
  data      jsonb not null default '{}',   -- daily: {stairs, soreness}; weekly: {steps, walkPain, calfL, calfR}
  client_ts bigint not null,
  server_ts timestamptz not null default now(),
  primary key (user_id, kind, log_date)
);

-- Start date, rest times, custom demo links.
create table if not exists public.settings (
  user_id   uuid primary key default auth.uid() references auth.users on delete cascade,
  data      jsonb not null default '{}',
  client_ts bigint not null,
  server_ts timestamptz not null default now()
);

-- Stamp server time on every write, and ignore an update older than what is stored
-- (so a phone that was offline can't overwrite a newer edit from another device).
create or replace function public.kr_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.client_ts < old.client_ts then
    return null;
  end if;
  new.server_ts := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['log_entries', 'day_sessions', 'milestones', 'settings', 'checkins'] loop
    execute format('drop trigger if exists kr_touch on public.%I', t);
    execute format('create trigger kr_touch before insert or update on public.%I for each row execute function public.kr_touch()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

create index if not exists log_entries_server_ts on public.log_entries (user_id, server_ts);
create index if not exists day_sessions_server_ts on public.day_sessions (user_id, server_ts);
create index if not exists milestones_server_ts on public.milestones (user_id, server_ts);
create index if not exists checkins_server_ts on public.checkins (user_id, server_ts);
