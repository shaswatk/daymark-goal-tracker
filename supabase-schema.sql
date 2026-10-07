-- Daymark database schema. Run this once in the Supabase SQL Editor.
-- It creates per-user goals/check-ins and a safe foundation for circles.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_color text not null default '#d9f25b',
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'PERSONAL' check (char_length(category) between 1 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  completed_on date not null default current_date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, completed_on)
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_checkins enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

create policy "Users can view their own profile" on public.profiles for select using ((select auth.uid()) = id);
create policy "Users can edit their own profile" on public.profiles for update using ((select auth.uid()) = id);
create policy "Users can create their own profile" on public.profiles for insert with check ((select auth.uid()) = id);

create policy "Users manage their own goals" on public.goals for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage check-ins for their own goals" on public.goal_checkins for all
  using (exists (select 1 from public.goals where goals.id = goal_checkins.goal_id and goals.user_id = (select auth.uid())))
  with check (exists (select 1 from public.goals where goals.id = goal_checkins.goal_id and goals.user_id = (select auth.uid())));

-- Circle policies are intentionally owner-only initially. Add invitations and
-- member-performance sharing after deciding your preferred privacy rules.
create policy "Creators manage their circles" on public.circles for all
  using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
create policy "Circle creators manage membership" on public.circle_members for all
  using (exists (select 1 from public.circles where circles.id = circle_members.circle_id and circles.created_by = (select auth.uid())))
  with check (exists (select 1 from public.circles where circles.id = circle_members.circle_id and circles.created_by = (select auth.uid())));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();
