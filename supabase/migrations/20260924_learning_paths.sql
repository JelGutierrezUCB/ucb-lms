-- Phase 2: job roles + learning paths (including new-hire onboarding paths)
--
-- Run this once in the Supabase SQL editor. It is safe to re-run.
--
-- Model: a learning path is an ordered list of modules. Enrolling someone in a
-- path creates ordinary whole-module rows in `assignments` for each module, so
-- due dates, reminders, reports, notifications and certificates all keep
-- working unchanged. The path adds the ordering, the grouping, and the
-- automatic enrollment rules (by job role, or for every new hire).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists job_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

alter table profiles add column if not exists job_role_id uuid references job_roles(id) on delete set null;

create table if not exists learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- 'onboarding' paths are labelled as new-hire paths in the UI
  kind text not null default 'learning' check (kind in ('learning', 'onboarding')),
  -- everyone with this job role is enrolled automatically (and on role change)
  job_role_id uuid references job_roles(id) on delete set null,
  -- every newly created profile is enrolled automatically
  auto_enroll_new_hires boolean not null default false,
  is_published boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists learning_path_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid references learning_paths(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  order_index int not null default 0,
  unique (path_id, module_id)
);
create index if not exists learning_path_items_path_idx on learning_path_items (path_id, order_index);

create table if not exists learning_path_enrollments (
  id uuid primary key default gen_random_uuid(),
  path_id uuid references learning_paths(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz default now(),
  due_date date,
  -- how the enrollment happened: 'manual', 'role', or 'new_hire'
  source text not null default 'manual',
  unique (path_id, user_id)
);
create index if not exists learning_path_enrollments_user_idx on learning_path_enrollments (user_id);

-- ---------------------------------------------------------------------------
-- Enrollment functions
-- ---------------------------------------------------------------------------

-- Internal: enroll one user in one path and give them an assignment for every
-- module in it they don't already have. Not callable from the API — only from
-- the triggers and the checked wrapper below.
create or replace function _enroll_user_in_path(
  p_path uuid, p_user uuid, p_assigned_by uuid, p_due date, p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into learning_path_enrollments (path_id, user_id, assigned_by, due_date, source)
  values (p_path, p_user, p_assigned_by, p_due, p_source)
  on conflict (path_id, user_id) do nothing;

  insert into assignments (user_id, module_id, assigned_by, due_date)
  select p_user, i.module_id, coalesce(p_assigned_by, p_user), p_due
  from learning_path_items i
  where i.path_id = p_path
    and not exists (
      select 1 from assignments a
      where a.user_id = p_user and a.module_id = i.module_id and a.section_id is null
    );
end;
$$;
revoke all on function _enroll_user_in_path(uuid, uuid, uuid, date, text) from public, anon, authenticated;

-- Public: admins and managers enroll a set of users in a path.
create or replace function enroll_users_in_path(p_path uuid, p_users uuid[], p_due date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')) then
    raise exception 'Only admins and managers can enroll users in a learning path';
  end if;

  foreach v_user in array p_users loop
    perform _enroll_user_in_path(p_path, v_user, auth.uid(), p_due, 'manual');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function enroll_users_in_path(uuid, uuid[], date) from public, anon;
grant execute on function enroll_users_in_path(uuid, uuid[], date) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers (automatic enrollment)
-- ---------------------------------------------------------------------------

-- A new profile joins every published new-hire path, plus the published paths
-- for its job role.
create or replace function enroll_new_profile_in_paths()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _enroll_user_in_path(
    p.id, new.id, null, null,
    case when p.auto_enroll_new_hires then 'new_hire' else 'role' end
  )
  from learning_paths p
  where p.is_published
    and (p.auto_enroll_new_hires or (p.job_role_id is not null and p.job_role_id = new.job_role_id));
  return new;
end;
$$;

drop trigger if exists trg_enroll_new_profile_in_paths on profiles;
create trigger trg_enroll_new_profile_in_paths
  after insert on profiles
  for each row
  execute function enroll_new_profile_in_paths();

-- Changing someone's job role enrolls them in that role's published paths.
-- (Existing enrollments and assignments are never removed automatically.)
create or replace function enroll_profile_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_role_id is not null and new.job_role_id is distinct from old.job_role_id then
    perform _enroll_user_in_path(p.id, new.id, null, null, 'role')
    from learning_paths p
    where p.is_published and p.job_role_id = new.job_role_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enroll_profile_on_role_change on profiles;
create trigger trg_enroll_profile_on_role_change
  after update of job_role_id on profiles
  for each row
  execute function enroll_profile_on_role_change();

-- Publishing a role-targeted path (or pointing it at a role) enrolls everyone
-- who already has that role.
create or replace function backfill_role_path_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published and new.job_role_id is not null
     and (tg_op = 'INSERT'
          or old.is_published is distinct from new.is_published
          or old.job_role_id is distinct from new.job_role_id) then
    perform _enroll_user_in_path(new.id, p.id, null, null, 'role')
    from profiles p
    where p.job_role_id = new.job_role_id and coalesce(p.is_active, true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backfill_role_path_enrollments on learning_paths;
create trigger trg_backfill_role_path_enrollments
  after insert or update on learning_paths
  for each row
  execute function backfill_role_path_enrollments();

-- Adding a module to a path gives it to everyone already enrolled.
create or replace function sync_path_item_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into assignments (user_id, module_id, assigned_by, due_date)
  select e.user_id, new.module_id, coalesce(e.assigned_by, e.user_id), e.due_date
  from learning_path_enrollments e
  where e.path_id = new.path_id
    and not exists (
      select 1 from assignments a
      where a.user_id = e.user_id and a.module_id = new.module_id and a.section_id is null
    );
  return new;
end;
$$;

drop trigger if exists trg_sync_path_item_assignments on learning_path_items;
create trigger trg_sync_path_item_assignments
  after insert on learning_path_items
  for each row
  execute function sync_path_item_assignments();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table job_roles enable row level security;
alter table learning_paths enable row level security;
alter table learning_path_items enable row level security;
alter table learning_path_enrollments enable row level security;

drop policy if exists "job_roles_select" on job_roles;
create policy "job_roles_select" on job_roles for select using (auth.uid() is not null);
drop policy if exists "job_roles_admin_write" on job_roles;
create policy "job_roles_admin_write" on job_roles for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "learning_paths_select" on learning_paths;
create policy "learning_paths_select" on learning_paths for select using (
  is_published = true or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
drop policy if exists "learning_paths_admin_write" on learning_paths;
create policy "learning_paths_admin_write" on learning_paths for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "learning_path_items_select" on learning_path_items;
create policy "learning_path_items_select" on learning_path_items for select using (
  exists (
    select 1 from learning_paths p
    where p.id = learning_path_items.path_id
      and (p.is_published = true or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')))
  )
);
drop policy if exists "learning_path_items_admin_write" on learning_path_items;
create policy "learning_path_items_admin_write" on learning_path_items for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Enrollments are created only through the functions above, never directly.
drop policy if exists "learning_path_enrollments_select" on learning_path_enrollments;
create policy "learning_path_enrollments_select" on learning_path_enrollments for select using (
  user_id = auth.uid() or
  assigned_by = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
drop policy if exists "learning_path_enrollments_admin_delete" on learning_path_enrollments;
create policy "learning_path_enrollments_admin_delete" on learning_path_enrollments for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ---------------------------------------------------------------------------
-- Fix: new-user creation (auto_assign_required_modules)
-- ---------------------------------------------------------------------------
-- The original function used `on conflict (user_id, module_id)`, but since the
-- section-level-assignments change `assignments` only has PARTIAL unique
-- indexes, which that ON CONFLICT target can't use. Postgres rejects the
-- statement (42P10), and because this runs as an AFTER INSERT trigger on
-- profiles, every attempt to create a user fails. Same behavior, written with
-- NOT EXISTS instead.
create or replace function auto_assign_required_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into assignments (user_id, module_id, assigned_by)
  select new.id, m.id, new.id
  from modules m
  where m.auto_assign_all = true
    and not exists (
      select 1 from assignments a
      where a.user_id = new.id and a.module_id = m.id and a.section_id is null
    );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hardening: job_role_id is admin-only, like company / department
-- ---------------------------------------------------------------------------
-- Same function as before, plus job_role_id in the protected list — otherwise
-- an employee could give themselves a job role and pull in that role's paths.
create or replace function protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.manager_id is distinct from old.manager_id
    or new.is_active is distinct from old.is_active
    or new.email is distinct from old.email
    or new.company is distinct from old.company
    or new.department is distinct from old.department
    or new.job_role_id is distinct from old.job_role_id
    or new.must_change_password is distinct from old.must_change_password
    or new.password_reset_requested_at is distinct from old.password_reset_requested_at then
    raise exception 'Only admins can change these profile fields';
  end if;
  return new;
end;
$$;
