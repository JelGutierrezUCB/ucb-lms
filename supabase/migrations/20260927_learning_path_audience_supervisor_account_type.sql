-- Learning path audiences can also target a supervisor's team and an account
-- type (employee / manager / admin), so every detail on the user record
-- (company, department, job role, supervisor, account type) stays in sync with
-- learning paths. Editing any of those on a user enrolls them in the published
-- paths they now match.
--
-- Safe to re-run.

alter table learning_path_targets drop constraint if exists learning_path_targets_kind_check;
alter table learning_path_targets add constraint learning_path_targets_kind_check
  check (kind in ('company', 'department', 'job_role', 'supervisor', 'account_role'));

-- value is: company name | department name | job_roles.id | supervisor's profiles.id | 'employee'/'manager'/'admin'

-- A path with a filter of this kind requires the person to hold one of its values.
create or replace function _path_kind_ok(p_path uuid, p_kind text, p_value text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = p_kind)
    or exists (select 1 from learning_path_targets t where t.path_id = p_path and t.kind = p_kind and t.value = p_value);
$$;

create or replace function profile_matches_path(
  p_path uuid, p_company text, p_department text, p_job_role uuid, p_manager uuid, p_account_role text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (select 1 from learning_path_targets t where t.path_id = p_path)
    and _path_kind_ok(p_path, 'company', p_company)
    and _path_kind_ok(p_path, 'department', p_department)
    and _path_kind_ok(p_path, 'job_role', p_job_role::text)
    and _path_kind_ok(p_path, 'supervisor', p_manager::text)
    and _path_kind_ok(p_path, 'account_role', p_account_role);
$$;

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
      or profile_matches_path(p.id, new.company, new.department, new.job_role_id, new.manager_id, new.role)
    );
  return new;
end;
$$;

create or replace function enroll_profile_on_audience_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company is distinct from old.company
     or new.department is distinct from old.department
     or new.job_role_id is distinct from old.job_role_id
     or new.manager_id is distinct from old.manager_id
     or new.role is distinct from old.role then
    perform _enroll_user_in_path(p.id, new.id, null, null, 'audience')
    from learning_paths p
    where p.is_published
      and profile_matches_path(p.id, new.company, new.department, new.job_role_id, new.manager_id, new.role);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enroll_profile_on_audience_change on profiles;
create trigger trg_enroll_profile_on_audience_change
  after update of company, department, job_role_id, manager_id, role on profiles
  for each row
  execute function enroll_profile_on_audience_change();

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
      and profile_matches_path(p_path, pr.company, pr.department, pr.job_role_id, pr.manager_id, pr.role)
  loop
    perform _enroll_user_in_path(p_path, v_user, auth.uid(), null, 'audience');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function sync_learning_path(uuid) from public, anon;
grant execute on function sync_learning_path(uuid) to authenticated;

-- The old 4-argument matcher is no longer used.
drop function if exists profile_matches_path(uuid, text, text, uuid);
