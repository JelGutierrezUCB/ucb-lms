-- Assignment rules: assign any course to an audience automatically.
--
-- A rule = one course + an audience + required/optional + a due date policy.
-- The audience uses the same filters as learning journeys (company, department,
-- job role, manager's team, account type) plus individually chosen people.
-- A person matches when they were picked individually, OR every kind of filter
-- the rule has set matches them (any one value within a kind). A rule with no
-- audience and no "new hires" flag matches nobody.
--
-- People are assigned (as ordinary whole-course rows in `assignments`):
--   * when the admin applies the rule (apply_course_rule),
--   * when a new user is created (if the rule matches them, or targets new hires),
--   * when a user's company / department / job role / manager / account type changes,
--   * when the course itself is published.
-- Existing assignments are never overridden. Unpublished courses are skipped.
--
-- Safe to re-run.

alter table assignments add column if not exists required boolean not null default true;
alter table assignments add column if not exists source_rule_id uuid;

create table if not exists course_rules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade not null,
  requirement text not null default 'required' check (requirement in ('required', 'optional')),
  due_mode text not null default 'none' check (due_mode in ('none', 'fixed', 'relative')),
  due_date date,          -- when due_mode = 'fixed'
  due_days int,           -- when due_mode = 'relative': days after the person is assigned
  auto_enroll_new_hires boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists course_rules_module_idx on course_rules (module_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignments_source_rule_fk') then
    alter table assignments
      add constraint assignments_source_rule_fk foreign key (source_rule_id) references course_rules(id) on delete set null;
  end if;
end $$;

create table if not exists course_rule_targets (
  rule_id uuid references course_rules(id) on delete cascade not null,
  kind text not null check (kind in ('company', 'department', 'job_role', 'supervisor', 'account_role', 'person')),
  -- company/department name | job_roles.id | manager's profile id | 'employee'/'manager'/'admin' | profile id
  value text not null,
  primary key (rule_id, kind, value)
);

-- ---------------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------------

create or replace function _rule_kind_ok(p_rule uuid, p_kind text, p_value text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not exists (select 1 from course_rule_targets t where t.rule_id = p_rule and t.kind = p_kind)
    or exists (select 1 from course_rule_targets t where t.rule_id = p_rule and t.kind = p_kind and t.value = p_value);
$$;

create or replace function profile_matches_rule(
  p_rule uuid, p_user uuid, p_company text, p_department text, p_job_role uuid, p_manager uuid, p_account_role text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (select 1 from course_rule_targets t where t.rule_id = p_rule and t.kind = 'person' and t.value = p_user::text)
    or (
      exists (select 1 from course_rule_targets t where t.rule_id = p_rule and t.kind <> 'person')
      and _rule_kind_ok(p_rule, 'company', p_company)
      and _rule_kind_ok(p_rule, 'department', p_department)
      and _rule_kind_ok(p_rule, 'job_role', p_job_role::text)
      and _rule_kind_ok(p_rule, 'supervisor', p_manager::text)
      and _rule_kind_ok(p_rule, 'account_role', p_account_role)
    );
$$;

-- ---------------------------------------------------------------------------
-- Applying a rule
-- ---------------------------------------------------------------------------

-- Internal: give one person the rule's course (whole course). Returns true only
-- if a new assignment was created.
create or replace function _apply_course_rule_to_user(p_rule uuid, p_user uuid, p_assigned_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r course_rules%rowtype;
  v_due date;
begin
  select * into r from course_rules where id = p_rule and is_active;
  if not found then return false; end if;

  if not exists (select 1 from modules where id = r.module_id and is_published) then return false; end if;

  if exists (
    select 1 from assignments a
    where a.user_id = p_user and a.module_id = r.module_id and a.section_id is null
  ) then
    return false;
  end if;

  v_due := case r.due_mode
    when 'fixed' then r.due_date
    when 'relative' then current_date + coalesce(r.due_days, 0)
    else null
  end;

  insert into assignments (user_id, module_id, assigned_by, due_date, required, source_rule_id)
  values (p_user, r.module_id, coalesce(p_assigned_by, p_user), v_due, r.requirement = 'required', r.id);

  return true;
end;
$$;
revoke all on function _apply_course_rule_to_user(uuid, uuid, uuid) from public, anon, authenticated;

-- Internal: apply a rule to everyone who matches today; returns the people newly assigned.
create or replace function _apply_course_rule_to_matching(p_rule uuid, p_assigned_by uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := '{}';
  v_user uuid;
begin
  for v_user in
    select pr.id from profiles pr
    where coalesce(pr.is_active, true)
      and profile_matches_rule(p_rule, pr.id, pr.company, pr.department, pr.job_role_id, pr.manager_id, pr.role)
  loop
    if _apply_course_rule_to_user(p_rule, v_user, p_assigned_by) then
      v_ids := v_ids || v_user;
    end if;
  end loop;
  return v_ids;
end;
$$;
revoke all on function _apply_course_rule_to_matching(uuid, uuid) from public, anon, authenticated;

-- Admin: apply a rule now. Returns the people who were newly assigned.
create or replace function apply_course_rule(p_rule uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can apply assignment rules';
  end if;
  return _apply_course_rule_to_matching(p_rule, auth.uid());
end;
$$;
revoke all on function apply_course_rule(uuid) from public, anon;
grant execute on function apply_course_rule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Automatic triggers
-- ---------------------------------------------------------------------------

-- New user: rules that target new hires, or that already match them.
create or replace function apply_course_rules_to_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule uuid;
begin
  for v_rule in
    select cr.id from course_rules cr
    where cr.is_active
      and (
        cr.auto_enroll_new_hires
        or profile_matches_rule(cr.id, new.id, new.company, new.department, new.job_role_id, new.manager_id, new.role)
      )
  loop
    perform _apply_course_rule_to_user(v_rule, new.id, null);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_apply_course_rules_to_new_profile on profiles;
create trigger trg_apply_course_rules_to_new_profile
  after insert on profiles
  for each row
  execute function apply_course_rules_to_new_profile();

-- Details changed: pick up any rules the person now matches.
create or replace function apply_course_rules_on_audience_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule uuid;
begin
  if new.company is distinct from old.company
     or new.department is distinct from old.department
     or new.job_role_id is distinct from old.job_role_id
     or new.manager_id is distinct from old.manager_id
     or new.role is distinct from old.role then
    for v_rule in
      select cr.id from course_rules cr
      where cr.is_active
        and profile_matches_rule(cr.id, new.id, new.company, new.department, new.job_role_id, new.manager_id, new.role)
    loop
      perform _apply_course_rule_to_user(v_rule, new.id, null);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_course_rules_on_audience_change on profiles;
create trigger trg_apply_course_rules_on_audience_change
  after update of company, department, job_role_id, manager_id, role on profiles
  for each row
  execute function apply_course_rules_on_audience_change();

-- A course is published: rules waiting on it can now assign people.
create or replace function apply_course_rules_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule uuid;
begin
  if new.is_published and not coalesce(old.is_published, false) then
    for v_rule in select id from course_rules where module_id = new.id and is_active loop
      perform _apply_course_rule_to_matching(v_rule, null);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_course_rules_on_publish on modules;
create trigger trg_apply_course_rules_on_publish
  after update of is_published on modules
  for each row
  execute function apply_course_rules_on_publish();

-- ---------------------------------------------------------------------------
-- Row level security (admins only; assignments keep their existing rules)
-- ---------------------------------------------------------------------------

alter table course_rules enable row level security;
alter table course_rule_targets enable row level security;

drop policy if exists "course_rules_admin" on course_rules;
create policy "course_rules_admin" on course_rules for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "course_rule_targets_admin" on course_rule_targets;
create policy "course_rule_targets_admin" on course_rule_targets for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
