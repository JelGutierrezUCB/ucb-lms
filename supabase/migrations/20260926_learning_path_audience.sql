-- Learning path audiences: target by Company, Department and/or Job role, all
-- taken from the user records (replaces the job-role-only targeting).
--
-- A user matches a path when, for every kind of filter the path has set
-- (company / department / job role), the user has one of the chosen values.
-- A path with no filters matches nobody (manual enrollment only).
--
-- Enrollments are never removed automatically, so the audience is applied in
-- one explicit step (sync_learning_path) after ALL filters have been saved,
-- rather than per filter row — otherwise saving "company = X" then
-- "department = Y" would briefly match everyone in X.
--
-- Safe to re-run.

create table if not exists learning_path_targets (
  path_id uuid references learning_paths(id) on delete cascade not null,
  kind text not null check (kind in ('company', 'department', 'job_role')),
  -- company name, department name, or the job_roles.id (as text)
  value text not null,
  primary key (path_id, kind, value)
);

-- Carry over role targets from the previous table, then retire it.
do $$
begin
  if to_regclass('public.learning_path_roles') is not null then
    insert into learning_path_targets (path_id, kind, value)
    select path_id, 'job_role', job_role_id::text from learning_path_roles
    on conflict do nothing;
  end if;
end $$;

drop trigger if exists trg_backfill_on_path_role_added on learning_path_roles;
drop trigger if exists trg_backfill_on_path_published on learning_paths;
drop function if exists backfill_on_path_role_added();
drop function if exists backfill_on_path_published();
drop table if exists learning_path_roles;

-- Does this person match the path's audience?
create or replace function profile_matches_path(
  p_path uuid, p_company text, p_department text, p_job_role uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (select 1 from learning_path_targets t where t.path_id = p_path)
    and (
      not exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'company')
      or exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'company' and t.value = p_company)
    )
    and (
      not exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'department')
      or exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'department' and t.value = p_department)
    )
    and (
      not exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'job_role')
      or exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = 'job_role' and t.value = p_job_role::text)
    );
$$;

-- New profile: every published new-hire path, plus published paths it matches.
create or replace function enroll_new_profile_in_paths()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _enroll_user_in_path(
    p.id, new.id, null, null,
    case when p.auto_enroll_new_hires then 'new_hire' else 'audience' end
  )
  from learning_paths p
  where p.is_published
    and (
      p.auto_enroll_new_hires
      or profile_matches_path(p.id, new.company, new.department, new.job_role_id)
    );
  return new;
end;
$$;

-- Company / department / job role changed: enroll in the published paths the
-- person now matches. (Existing enrollments are left alone.)
create or replace function enroll_profile_on_audience_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company is distinct from old.company
     or new.department is distinct from old.department
     or new.job_role_id is distinct from old.job_role_id then
    perform _enroll_user_in_path(p.id, new.id, null, null, 'audience')
    from learning_paths p
    where p.is_published
      and profile_matches_path(p.id, new.company, new.department, new.job_role_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enroll_profile_on_role_change on profiles;
drop function if exists enroll_profile_on_role_change();
drop trigger if exists trg_enroll_profile_on_audience_change on profiles;
create trigger trg_enroll_profile_on_audience_change
  after update of company, department, job_role_id on profiles
  for each row
  execute function enroll_profile_on_audience_change();

-- Admin: apply a published path's audience to everyone who matches today.
-- Called by the path editor after it has saved the path, its trainings and
-- its filters. Returns how many people were enrolled/checked.
create or replace function sync_learning_path(p_path uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_user uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can apply a learning path audience';
  end if;

  if not exists (select 1 from learning_paths where id = p_path and is_published) then
    return 0;
  end if;

  for v_user in
    select pr.id from profiles pr
    where coalesce(pr.is_active, true)
      and profile_matches_path(p_path, pr.company, pr.department, pr.job_role_id)
  loop
    perform _enroll_user_in_path(p_path, v_user, auth.uid(), null, 'audience');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function sync_learning_path(uuid) from public, anon;
grant execute on function sync_learning_path(uuid) to authenticated;

-- Row level security (same rules as learning_path_items)
alter table learning_path_targets enable row level security;

drop policy if exists "learning_path_targets_select" on learning_path_targets;
create policy "learning_path_targets_select" on learning_path_targets for select using (
  exists (
    select 1 from learning_paths p
    where p.id = learning_path_targets.path_id
      and (p.is_published = true or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')))
  )
);
drop policy if exists "learning_path_targets_admin_write" on learning_path_targets;
create policy "learning_path_targets_admin_write" on learning_path_targets for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
