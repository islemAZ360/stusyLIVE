-- ============================================================
-- Study Live — Supabase schema (v2 — full user data)
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ------------------------------------------------------------
-- RESET: drop old app tables from previous schema versions.
-- ⚠️ This erases any existing cloud data for these tables.
-- It is safe NOW because cloud sync has never run yet.
-- (Remove this block before re-running later, once data exists!)
-- ------------------------------------------------------------
drop table if exists public.profiles cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.academic_structures cascade;
drop table if exists public.standing_logs cascade;
drop table if exists public.vault_entries cascade;
drop table if exists public.subjects cascade;
drop table if exists public.tasks cascade;
drop table if exists public.notes cascade;
drop table if exists public.teachers cascade;
drop table if exists public.contacts cascade;
drop table if exists public.places cascade;

-- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text, full_name text, avatar_url text,
  degree text, specialty text,
  group_name text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- app_settings
create table if not exists public.app_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- academic_structures
create table if not exists public.academic_structures (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- standing_logs
create table if not exists public.standing_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null, value integer not null, date text not null,
  created_at timestamptz default now()
);

-- vault_entries
create table if not exists public.vault_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null, username text, url text,
  password text not null, description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.subjects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  semester_id text,
  semester_label text,
  teacher_name text,
  teacher_id text,
  standing integer,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  date text,
  difficulty text,
  subject_id text,
  done boolean default false,
  progress_enabled boolean default false,
  progress integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  body text,
  subject_id text,
  images jsonb default '[]'::jsonb,
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.teachers (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  subject_name text,
  photo text,
  ratings jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  org text,
  phones jsonb default '[]'::jsonb,
  emails jsonb default '[]'::jsonb,
  photo text,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.places (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  descr text,
  lat double precision,
  lng double precision,
  color text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.academic_structures enable row level security;
alter table public.standing_logs enable row level security;
alter table public.vault_entries enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.teachers enable row level security;
alter table public.contacts enable row level security;
alter table public.places enable row level security;

drop policy if exists "own_profile" on public.profiles;
drop policy if exists "own_subjects" on public.subjects;
drop policy if exists "own_tasks" on public.tasks;
drop policy if exists "own_notes" on public.notes;
drop policy if exists "own_teachers" on public.teachers;
drop policy if exists "own_contacts" on public.contacts;
drop policy if exists "own_places" on public.places;

create policy "own_profile" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_app_settings" on public.app_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_academic" on public.academic_structures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_standing" on public.standing_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_vault" on public.vault_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_subjects" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_teachers" on public.teachers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_contacts" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_places" on public.places for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Performance indexes
create index if not exists idx_standing_user on public.standing_logs(user_id);
create index if not exists idx_vault_user on public.vault_entries(user_id);
create index if not exists idx_subjects_user on public.subjects(user_id);
create index if not exists idx_tasks_user on public.tasks(user_id);
create index if not exists idx_notes_user on public.notes(user_id);
create index if not exists idx_teachers_user on public.teachers(user_id);
create index if not exists idx_contacts_user on public.contacts(user_id);
create index if not exists idx_places_user on public.places(user_id);
