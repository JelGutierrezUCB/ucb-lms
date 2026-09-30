-- Skills & competency system: Employee -> Job Role -> Skills -> Training ->
-- Assessment -> Learning Path.
--
-- skills: the taxonomy (admin-managed).
-- job_role_skills: required proficiency level per skill, per job role.
-- module_skills: which skills a training module builds — the link used for
--   "recommend training for this skill gap".
-- employee_skill_assessments: an append-only history of proficiency
--   assessments (self or supervisor) — the *current* level for a person+skill
--   is simply their most recent row, which also gives "tracked over time" for
--   free without a separate snapshot table.

create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table job_role_skills (
  job_role_id uuid not null references job_roles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  required_level smallint not null default 3 check (required_level between 1 and 5),
  primary key (job_role_id, skill_id)
);

create table module_skills (
  module_id uuid not null references modules(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  primary key (module_id, skill_id)
);

create table employee_skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  proficiency_level smallint not null check (proficiency_level between 1 and 5),
  source text not null default 'self' check (source in ('self','supervisor')),
  assessed_by uuid references profiles(id),
  assessed_at timestamptz not null default now(),
  notes text
);
create index employee_skill_assessments_user_skill_idx on employee_skill_assessments (user_id, skill_id, assessed_at desc);

alter table skills enable row level security;
alter table job_role_skills enable row level security;
alter table module_skills enable row level security;
alter table employee_skill_assessments enable row level security;

create policy skills_select on skills for select using (auth.uid() is not null);
create policy skills_admin_write on skills for all
  using (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'))
  with check (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'));

create policy job_role_skills_select on job_role_skills for select using (auth.uid() is not null);
create policy job_role_skills_admin_write on job_role_skills for all
  using (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'))
  with check (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'));

create policy module_skills_select on module_skills for select using (auth.uid() is not null);
create policy module_skills_admin_write on module_skills for all
  using (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'))
  with check (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'));

-- Visible to: the employee themselves, any admin, or that employee's direct manager.
create policy employee_skill_assessments_select on employee_skill_assessments for select using (
  user_id = auth.uid()
  or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
  or exists (select 1 from profiles me where me.id=auth.uid() and me.role='manager' and me.id = (select p2.manager_id from profiles p2 where p2.id = employee_skill_assessments.user_id))
);

-- Insertable by: the employee themselves (self-assessment only), any admin,
-- or that employee's direct manager (supervisor assessment).
create policy employee_skill_assessments_insert on employee_skill_assessments for insert with check (
  assessed_by = auth.uid() and (
    (user_id = auth.uid() and source = 'self')
    or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
    or exists (select 1 from profiles me where me.id=auth.uid() and me.role='manager' and me.id = (select p2.manager_id from profiles p2 where p2.id = employee_skill_assessments.user_id))
  )
);

create policy employee_skill_assessments_admin_delete on employee_skill_assessments for delete using (
  exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
);
