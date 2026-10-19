-- Run this once in the Supabase SQL Editor after supabase-schema.sql.
-- It adds private circles, shareable invite codes, and secure circle rankings.

create or replace function public.generate_circle_invite_code()
returns text
language sql
volatile
as $$
  select lower(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
$$;

alter table public.circles
  add column if not exists invite_code text;

update public.circles
set invite_code = public.generate_circle_invite_code()
where invite_code is null;

alter table public.circles
  alter column invite_code set default public.generate_circle_invite_code(),
  alter column invite_code set not null;

create unique index if not exists circles_invite_code_key
  on public.circles (invite_code);

-- Existing circle creators become their first member.
insert into public.circle_members (circle_id, user_id)
select id, created_by from public.circles
on conflict do nothing;

create or replace function public.add_circle_creator_as_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.circle_members (circle_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_circle_created on public.circles;
create trigger on_circle_created
  after insert on public.circles
  for each row execute procedure public.add_circle_creator_as_member();

-- A signed-in user can join one circle using its invite code. The function
-- bypasses table RLS, but only adds the caller's own user id.
create or replace function public.join_circle_by_code(p_invite_code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_circle_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a circle';
  end if;

  select id into target_circle_id
  from public.circles
  where invite_code = lower(trim(p_invite_code));

  if target_circle_id is null then
    raise exception 'That invite code is not valid';
  end if;

  insert into public.circle_members (circle_id, user_id)
  values (target_circle_id, auth.uid())
  on conflict do nothing;
end;
$$;

revoke all on function public.join_circle_by_code(text) from public;
grant execute on function public.join_circle_by_code(text) to authenticated;

-- Let members see the identities, goals, and completed check-ins of people
-- in their own circles. They can still modify only their own data.
create or replace function public.is_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = target_circle_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_circle_member(uuid) from public;
grant execute on function public.is_circle_member(uuid) to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users view their own or circle profiles" on public.profiles for select
  using (
    (select auth.uid()) = id
    or exists (
      select 1
      from public.circle_members theirs
      where theirs.user_id = profiles.id
        and public.is_circle_member(theirs.circle_id)
    )
  );

create policy "Circle members view shared goals" on public.goals for select
  using (
    exists (
      select 1
      from public.circle_members theirs
      where theirs.user_id = goals.user_id
        and public.is_circle_member(theirs.circle_id)
    )
  );

create policy "Circle members view shared check-ins" on public.goal_checkins for select
  using (
    exists (
      select 1
      from public.goals shared_goal
      join public.circle_members theirs on theirs.user_id = shared_goal.user_id
      where shared_goal.id = goal_checkins.goal_id
        and public.is_circle_member(theirs.circle_id)
    )
  );

drop policy if exists "Creators manage their circles" on public.circles;
create policy "Members view their circles" on public.circles for select
  using (public.is_circle_member(circles.id));
create policy "Users create circles" on public.circles for insert
  with check ((select auth.uid()) = created_by);
create policy "Creators update circles" on public.circles for update
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
create policy "Creators delete circles" on public.circles for delete
  using ((select auth.uid()) = created_by);

drop policy if exists "Circle creators manage membership" on public.circle_members;
create policy "Members view circle membership" on public.circle_members for select
  using (public.is_circle_member(circle_members.circle_id));
create policy "Creators add circle members" on public.circle_members for insert
  with check (exists (
    select 1 from public.circles
    where circles.id = circle_members.circle_id
      and circles.created_by = (select auth.uid())
  ));
create policy "Creators remove circle members" on public.circle_members for delete
  using (exists (
    select 1 from public.circles
    where circles.id = circle_members.circle_id
      and circles.created_by = (select auth.uid())
  ));
create policy "Users leave circles" on public.circle_members for delete
  using (user_id = (select auth.uid()));
