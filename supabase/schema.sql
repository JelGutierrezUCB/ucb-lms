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

-- Auto-issues a certificate the moment a user finishes every section of a
-- module (which, per the training player's own gating, means any quiz in
-- those sections was already passed) — fires on every section_progress
-- insert and checks completion for that section's module.
create or replace function issue_certificate_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_id uuid;
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

  -- Archived trainings aren't part of the active curriculum anymore, so
  -- they don't count toward what's required for a certificate.
  select count(*) into v_total_sections from sections where module_id = v_module_id and is_archived = false;

  select count(*) into v_completed_sections
  from section_progress sp
  join sections s on s.id = sp.section_id
  where sp.user_id = new.user_id and s.module_id = v_module_id and s.is_archived = false;

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
  join sections s on s.id = cb.section_id
  where qa.user_id = new.user_id and s.module_id = v_module_id and qa.max_score > 0
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
