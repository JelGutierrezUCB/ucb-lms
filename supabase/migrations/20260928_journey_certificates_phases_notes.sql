-- Journey roadmap details + a completion certificate for the whole journey.
--
-- 1. learning_path_items gets an optional `phase` (a signpost label such as
--    "Listen and Learn" shown when a new phase starts on the roadmap) and an
--    optional `note` (short text shown beside the course on the roadmap).
-- 2. journey_certificates: when a person has earned the certificate for EVERY
--    course in a journey they're enrolled in, one certificate for the whole
--    journey (e.g. "onboarding complete") is issued automatically. It builds
--    on the per-course certificates that are already issued on completion.
--
-- Safe to re-run.

alter table learning_path_items add column if not exists phase text;
alter table learning_path_items add column if not exists note text;

create table if not exists journey_certificates (
  id uuid primary key default gen_random_uuid(),
  -- kept (set null) if the journey is later deleted, so issued certificates survive
  path_id uuid references learning_paths(id) on delete set null,
  user_id uuid references profiles(id) on delete cascade not null,
  employee_name text not null,
  company text,
  journey_title text not null,
  courses_count int not null,
  completed_at timestamptz not null,
  issued_at timestamptz not null default now(),
  unique (path_id, user_id)
);
create index if not exists journey_certificates_user_idx on journey_certificates (user_id);

-- Internal: issue the journey certificate if this person has finished every
-- course in the (published) journey. Does nothing otherwise, or if already issued.
create or replace function issue_journey_certificate(p_user uuid, p_path uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_total int;
  v_done int;
  v_completed timestamptz;
  v_name text;
  v_company text;
begin
  select title into v_title from learning_paths where id = p_path and is_published;
  if v_title is null then return; end if;

  if exists (select 1 from journey_certificates where path_id = p_path and user_id = p_user) then return; end if;

  select count(*) into v_total from learning_path_items where path_id = p_path;
  if v_total = 0 then return; end if;

  select count(distinct i.module_id), max(c.completed_at)
    into v_done, v_completed
  from learning_path_items i
  join certificates c on c.module_id = i.module_id and c.user_id = p_user
  where i.path_id = p_path;

  if v_done < v_total then return; end if;

  select full_name, company into v_name, v_company from profiles where id = p_user;

  insert into journey_certificates (path_id, user_id, employee_name, company, journey_title, courses_count, completed_at)
  values (p_path, p_user, coalesce(v_name, 'Unknown'), v_company, v_title, v_total, coalesce(v_completed, now()))
  on conflict (path_id, user_id) do nothing;
end;
$$;
revoke all on function issue_journey_certificate(uuid, uuid) from public, anon, authenticated;

-- A course certificate was just issued: check every journey this person is
-- enrolled in that contains that course.
create or replace function issue_journey_certs_on_course_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or new.module_id is null then return new; end if;

  perform issue_journey_certificate(new.user_id, e.path_id)
  from learning_path_enrollments e
  join learning_path_items i on i.path_id = e.path_id and i.module_id = new.module_id
  where e.user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_issue_journey_certs_on_course_certificate on certificates;
create trigger trg_issue_journey_certs_on_course_certificate
  after insert on certificates
  for each row
  execute function issue_journey_certs_on_course_certificate();

-- Enrolling someone who has already finished all the courses should issue the
-- certificate straight away. Same as before, plus the check at the end.
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

  perform issue_journey_certificate(p_user, p_path);
end;
$$;

-- Catch up anyone already enrolled who has in fact finished everything.
do $$
declare r record;
begin
  for r in select user_id, path_id from learning_path_enrollments loop
    perform issue_journey_certificate(r.user_id, r.path_id);
  end loop;
end $$;

-- Row level security: people see their own; admins see all; a manager sees their reports'.
alter table journey_certificates enable row level security;

drop policy if exists "journey_certificates_select" on journey_certificates;
create policy "journey_certificates_select" on journey_certificates for select using (
  user_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (
    select 1 from profiles me
    where me.id = auth.uid() and me.role = 'manager'
      and me.id = (select p2.manager_id from profiles p2 where p2.id = journey_certificates.user_id)
  )
);
