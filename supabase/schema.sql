-- UCB LMS Database Schema
-- Run this in your Supabase SQL editor

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  manager_id uuid references profiles(id),
  department text,
  company text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Training modules
create table modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'general',
  thumbnail_color text default '#1e40af',
  is_published boolean default false,
  created_by uuid references profiles(id),
  estimated_minutes int default 30,
  auto_assign_all boolean not null default false,
  -- Distinguishes a normal multi-step training (text/video/quiz) from a
  -- module that's really just a set of documents to review and sign off on
  -- (e.g. "New Hire Packet") — lets the UI use the right terminology
  -- ("Complete Checklist" vs "Complete Training", etc.).
  module_type text not null default 'training' check (module_type in ('training', 'checklist')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Groups: optional mid-level "folder" to organize related sections within a module
create table groups (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade not null,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz default now()
);

-- Sections within a module (a "training"). May optionally belong to a group.
create table sections (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade not null,
  group_id uuid references groups(id) on delete set null,
  title text not null,
  order_index int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

-- Content blocks within sections (text, video, or quiz)
create table content_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade not null,
  type text not null check (type in ('text', 'video', 'quiz', 'slides', 'document')),
  order_index int not null default 0,
  title text,
  content jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Training assignments. section_id null = whole module assigned; section_id
-- set = just that one training within the module is assigned. Two partial
-- unique indexes (below, near the other assignment indexes) enforce
-- "one module-level row" vs "one row per assigned section" respectively,
-- since a single plain unique constraint can't express both.
create table assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  section_id uuid references sections(id) on delete cascade,
  assigned_by uuid references profiles(id) not null,
  assigned_at timestamptz default now(),
  due_date date
);

create unique index assignments_module_level_uniq on assignments (user_id, module_id) where section_id is null;
create unique index assignments_section_level_uniq on assignments (user_id, module_id, section_id) where section_id is not null;

-- Auto-assign modules flagged auto_assign_all to every newly created profile
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
  on conflict (user_id, module_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auto_assign_required_modules on profiles;
create trigger trg_auto_assign_required_modules
  after insert on profiles
  for each row
  execute function auto_assign_required_modules();

-- Section completion tracking
create table section_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  section_id uuid references sections(id) on delete cascade not null,
  completed_at timestamptz default now(),
  unique(user_id, section_id)
);

-- Quiz attempts
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  content_block_id uuid references content_blocks(id) on delete cascade not null,
  score int not null,
  max_score int not null,
  answers jsonb not null,
  completed_at timestamptz default now()
);

-- Tracks an employee's uploaded signed/completed copy of a "document"
-- content block that has require_signed_upload set in its content jsonb.
-- One row per (user, content_block); re-uploading replaces both the row
-- and the underlying storage object (see the signed-documents bucket
-- policies further down).
create table document_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  content_block_id uuid references content_blocks(id) on delete cascade not null,
  storage_path text not null,
  file_name text not null,
  uploaded_at timestamptz default now(),
  unique(user_id, content_block_id)
);

-- Persistent record of every completion certificate issued. Snapshots the
-- employee/company/module names and score at the moment of issuance, so a
-- certificate stays accurate even if the person is later renamed, moved to
-- a different company, or the module is edited/deleted afterward.
create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  module_id uuid references modules(id) on delete set null,
  employee_name text not null,
  company text,
  module_title text not null,
  score int,
  max_score int,
  completed_at timestamptz not null,
  issued_at timestamptz not null default now(),
  unique(user_id, module_id)
);

-- Auto-issues a certificate the moment a user finishes every section they
-- were actually assigned in a module (which, per the training player's own
-- gating, means any quiz in those sections was already passed) — fires on
-- every section_progress insert and checks completion for that section's
-- module. What counts as "every section" depends on the assignment: a
-- whole-module assignment (or no assignment row at all, e.g. an admin
-- previewing) requires every active section; a partial/per-section
-- assignment requires only the sections actually assigned — otherwise an
-- employee assigned just one section of a multi-section module could never
-- get a certificate, since they'd never complete sections they were never
-- shown.
create or replace function issue_certificate_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
  v_has_whole_module boolean;
  v_required_section_ids uuid[];
  v_total_sections int;
  v_completed_sections int;
  v_employee_name text;
  v_company text;
  v_module_title text;
  v_best_score int;
  v_best_max int;
begin
  select module_id into v_module_id from sections where id = new.section_id;
  if v_module_id is null then
    return new;
  end if;

  select exists(
    select 1 from assignments
    where user_id = new.user_id and module_id = v_module_id and section_id is null
  ) into v_has_whole_module;

  if v_has_whole_module then
    select array_agg(id) into v_required_section_ids from sections where module_id = v_module_id and is_archived = false;
  else
    select array_agg(a.section_id) into v_required_section_ids
    from assignments a
    join sections s on s.id = a.section_id
    where a.user_id = new.user_id and a.module_id = v_module_id and s.is_archived = false;

    if v_required_section_ids is null then
      select array_agg(id) into v_required_section_ids from sections where module_id = v_module_id and is_archived = false;
    end if;
  end if;

  v_total_sections := coalesce(array_length(v_required_section_ids, 1), 0);

  select count(*) into v_completed_sections
  from section_progress
  where user_id = new.user_id and section_id = any(v_required_section_ids);

  if v_total_sections = 0 or v_completed_sections < v_total_sections then
    return new;
  end if;

  if exists (select 1 from certificates where user_id = new.user_id and module_id = v_module_id) then
    return new;
  end if;

  select full_name, company into v_employee_name, v_company from profiles where id = new.user_id;
  select title into v_module_title from modules where id = v_module_id;

  select qa.score, qa.max_score into v_best_score, v_best_max
  from quiz_attempts qa
  join content_blocks cb on cb.id = qa.content_block_id
  where qa.user_id = new.user_id and cb.section_id = any(v_required_section_ids) and qa.max_score > 0
  order by (qa.score::float / qa.max_score) desc
  limit 1;

  insert into certificates (user_id, module_id, employee_name, company, module_title, score, max_score, completed_at)
  values (new.user_id, v_module_id, coalesce(v_employee_name, 'Unknown'), v_company, coalesce(v_module_title, 'Untitled'), v_best_score, v_best_max, new.completed_at)
  on conflict (user_id, module_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_issue_certificate_on_completion on section_progress;
create trigger trg_issue_certificate_on_completion
  after insert on section_progress
  for each row
  execute function issue_certificate_on_completion();

-- RLS
alter table profiles enable row level security;
alter table modules enable row level security;
alter table groups enable row level security;
alter table sections enable row level security;
alter table content_blocks enable row level security;
alter table assignments enable row level security;
alter table section_progress enable row level security;
alter table quiz_attempts enable row level security;
alter table document_uploads enable row level security;
alter table certificates enable row level security;

-- Profile policies
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (
  auth.uid() is not null and (
    auth.uid() = id or
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
);
create policy "profiles_update" on profiles for update using (
  id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "profiles_delete" on profiles for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Module policies
create policy "modules_select" on modules for select using (
  is_published = true or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "modules_insert" on modules for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "modules_update" on modules for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "modules_delete" on modules for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Group policies
create policy "groups_select" on groups for select using (
  exists (
    select 1 from modules m
    join profiles p on p.id = auth.uid()
    where m.id = groups.module_id
    and (m.is_published = true or p.role in ('admin', 'manager'))
  )
);
create policy "groups_all_admin" on groups for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Section policies
create policy "sections_select" on sections for select using (
  exists (
    select 1 from modules m
    join profiles p on p.id = auth.uid()
    where m.id = sections.module_id
    and (m.is_published = true or p.role in ('admin', 'manager'))
  )
);
create policy "sections_all_admin" on sections for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Content block policies
create policy "content_blocks_select" on content_blocks for select using (
  exists (
    select 1 from sections s
    join modules m on m.id = s.module_id
    join profiles p on p.id = auth.uid()
    where s.id = content_blocks.section_id
    and (m.is_published = true or p.role in ('admin', 'manager'))
  )
);
create policy "content_blocks_all_admin" on content_blocks for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Assignment policies
create policy "assignments_select" on assignments for select using (
  user_id = auth.uid() or
  assigned_by = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "assignments_insert" on assignments for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "assignments_delete" on assignments for delete using (
  assigned_by = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "assignments_update" on assignments for update using (
  assigned_by = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Certificate policies
create policy "certificates_select" on certificates for select using (
  user_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from profiles where id = auth.uid() and role = 'manager' and id = (select manager_id from profiles p2 where p2.id = certificates.user_id))
);

-- Progress policies
create policy "progress_select" on section_progress for select using (
  user_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "progress_insert" on section_progress for insert with check (true);
create policy "progress_delete" on section_progress for delete using (user_id = auth.uid());

-- Quiz attempt policies
create policy "quiz_select" on quiz_attempts for select using (
  user_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "quiz_insert" on quiz_attempts for insert with check (true);

-- Document upload policies
create policy "document_uploads_select" on document_uploads for select using (
  user_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
-- Permissive insert/update (like progress_insert/quiz_insert) so an
-- admin/manager previewing training "as" an employee (proxy feature) can
-- still record an upload under that employee's user_id.
create policy "document_uploads_insert" on document_uploads for insert with check (true);
create policy "document_uploads_update" on document_uploads for update using (true);
create policy "document_uploads_delete" on document_uploads for delete using (
  user_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Seed initial categories (just for reference)
-- Categories: onboarding, sales, warehouse, ucbzerowaste, general

-- Notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index notifications_user_id_idx on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications_select" on notifications for select using (
  user_id = auth.uid()
);
create policy "notifications_update" on notifications for update using (
  user_id = auth.uid()
);
-- No insert/delete policy for authenticated users: notifications are only
-- created server-side via the service-role client (see src/lib/notifications.ts).

-- Storage bucket for uploaded training videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-videos', 'training-videos', true, 104857600, array['video/mp4','video/webm','video/quicktime','video/x-msvideo']);

create policy "training_videos_select" on storage.objects for select using (
  bucket_id = 'training-videos'
);
create policy "training_videos_insert" on storage.objects for insert with check (
  bucket_id = 'training-videos' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "training_videos_delete" on storage.objects for delete using (
  bucket_id = 'training-videos' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Private bucket to hold documents used by the training system: source
-- files uploaded to the AI Training Generator (downloaded server-side and
-- deleted once generation completes, unless "retain document" is chosen),
-- and files manually attached via a "document" content block in the module
-- editor (kept indefinitely). No mime-type restriction — admins can attach
-- any file type (PDF, Word, or anything else) to a training.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-source-docs',
  'training-source-docs',
  false,
  209715200, -- 200MB
  null
)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "training_source_docs_select" on storage.objects for select using (
  bucket_id = 'training-source-docs' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "training_source_docs_insert" on storage.objects for insert with check (
  bucket_id = 'training-source-docs' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "training_source_docs_delete" on storage.objects for delete using (
  bucket_id = 'training-source-docs' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Public bucket for profile photos, one folder per user (<user_id>/<file>) —
-- RLS lets everyone read, but only write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select" on storage.objects for select using (
  bucket_id = 'avatars'
);
create policy "avatars_insert" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars_update" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars_delete" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Private bucket for employee-uploaded signed documents, one object per
-- user per content block (<user_id>/<content_block_id>, no file extension —
-- content-type comes from the uploaded file itself, not the path). Same
-- admin/manager override as document_uploads' RLS, for the proxy-upload case.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signed-documents', 'signed-documents', false, 52428800, null) -- 50MB
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "signed_documents_select" on storage.objects for select using (
  bucket_id = 'signed-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  )
);
create policy "signed_documents_insert" on storage.objects for insert with check (
  bucket_id = 'signed-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  )
);
create policy "signed_documents_update" on storage.objects for update using (
  bucket_id = 'signed-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  )
);
create policy "signed_documents_delete" on storage.objects for delete using (
  bucket_id = 'signed-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  )
);


-- ============================================================================
-- Phase 2: job roles + learning paths (same as supabase/migrations/20260924_learning_paths.sql)
-- Note: the two functions at the very end also exist in the live database; this
-- is the version to keep.
-- ============================================================================

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


-- ============================================================================
-- Learning paths can target multiple job roles (same as supabase/migrations/20260925_learning_path_multiple_roles.sql)
-- ============================================================================

-- Learning paths can target MANY job roles (previously exactly one).
--
-- Adds a join table, copies existing single-role targets into it, and moves
-- the auto-enrollment triggers onto it. The old learning_paths.job_role_id
-- column is left in place (unused from now on) so this is non-destructive.
-- Safe to re-run.

create table if not exists learning_path_roles (
  path_id uuid references learning_paths(id) on delete cascade not null,
  job_role_id uuid references job_roles(id) on delete cascade not null,
  primary key (path_id, job_role_id)
);
create index if not exists learning_path_roles_role_idx on learning_path_roles (job_role_id);

insert into learning_path_roles (path_id, job_role_id)
select id, job_role_id from learning_paths where job_role_id is not null
on conflict do nothing;

-- New profile: every published new-hire path, plus published paths for its role.
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
    and (
      p.auto_enroll_new_hires
      or (new.job_role_id is not null and exists (
        select 1 from learning_path_roles r where r.path_id = p.id and r.job_role_id = new.job_role_id
      ))
    );
  return new;
end;
$$;

-- Job role changed: enroll in that role's published paths.
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
    where p.is_published
      and exists (select 1 from learning_path_roles r where r.path_id = p.id and r.job_role_id = new.job_role_id);
  end if;
  return new;
end;
$$;

-- Old single-role backfill trigger is replaced by the two below.
drop trigger if exists trg_backfill_role_path_enrollments on learning_paths;
drop function if exists backfill_role_path_enrollments();

-- A role is added to a published path: enroll everyone who already has it.
create or replace function backfill_on_path_role_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from learning_paths p where p.id = new.path_id and p.is_published) then
    perform _enroll_user_in_path(new.path_id, pr.id, null, null, 'role')
    from profiles pr
    where pr.job_role_id = new.job_role_id and coalesce(pr.is_active, true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backfill_on_path_role_added on learning_path_roles;
create trigger trg_backfill_on_path_role_added
  after insert on learning_path_roles
  for each row
  execute function backfill_on_path_role_added();

-- A path with roles is published: enroll everyone who has any of those roles.
create or replace function backfill_on_path_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published and not coalesce(old.is_published, false) then
    perform _enroll_user_in_path(new.id, pr.id, null, null, 'role')
    from profiles pr
    where coalesce(pr.is_active, true)
      and pr.job_role_id in (select r.job_role_id from learning_path_roles r where r.path_id = new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_backfill_on_path_published on learning_paths;
create trigger trg_backfill_on_path_published
  after update of is_published on learning_paths
  for each row
  execute function backfill_on_path_published();

-- Row level security (same rules as learning_path_items)
alter table learning_path_roles enable row level security;

drop policy if exists "learning_path_roles_select" on learning_path_roles;
create policy "learning_path_roles_select" on learning_path_roles for select using (
  exists (
    select 1 from learning_paths p
    where p.id = learning_path_roles.path_id
      and (p.is_published = true or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')))
  )
);
drop policy if exists "learning_path_roles_admin_write" on learning_path_roles;
create policy "learning_path_roles_admin_write" on learning_path_roles for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));


-- ============================================================================
-- Learning path audiences by company / department / job role (same as supabase/migrations/20260926_learning_path_audience.sql)
-- ============================================================================

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
