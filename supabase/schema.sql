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
  created_at timestamptz default now()
);

-- Content blocks within sections (text, video, or quiz)
create table content_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade not null,
  type text not null check (type in ('text', 'video', 'quiz')),
  order_index int not null default 0,
  content jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Training assignments
create table assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  assigned_by uuid references profiles(id) not null,
  assigned_at timestamptz default now(),
  due_date date,
  unique(user_id, module_id)
);

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

-- RLS
alter table profiles enable row level security;
alter table modules enable row level security;
alter table groups enable row level security;
alter table sections enable row level security;
alter table content_blocks enable row level security;
alter table assignments enable row level security;
alter table section_progress enable row level security;
alter table quiz_attempts enable row level security;

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
