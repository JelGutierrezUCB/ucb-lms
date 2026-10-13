-- Learning recommendations ("What should I learn next?").
--
-- modules.is_ai_generated: set when a module is created by the AI generator,
--   so recommendations can label it.
-- learning_resources: curated public courses / lessons / recorded webinars
--   (external links). resource_skills tags them with the skills they build so
--   skill gaps can surface them.
-- resource_completions: an employee marking an external resource as done
--   (so it stops being recommended and counts as "previous training").
-- training_recommendations: a supervisor (or admin) recommending a specific
--   training or resource to an employee, with an optional note.

alter table modules add column is_ai_generated boolean not null default false;

create table learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null check (url ~* '^https?://'),
  provider text,
  resource_type text not null default 'course' check (resource_type in ('course','lesson','webinar','article','video')),
  description text,
  estimated_minutes integer,
  is_published boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table resource_skills (
  resource_id uuid not null references learning_resources(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  primary key (resource_id, skill_id)
);

create table resource_completions (
  user_id uuid not null references profiles(id) on delete cascade,
  resource_id uuid not null references learning_resources(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table training_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  resource_id uuid references learning_resources(id) on delete cascade,
  recommended_by uuid references profiles(id),
  note text,
  status text not null default 'pending' check (status in ('pending','dismissed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(module_id, resource_id) = 1)
);
create index training_recommendations_user_idx on training_recommendations (user_id, status);

alter table learning_resources enable row level security;
alter table resource_skills enable row level security;
alter table resource_completions enable row level security;
alter table training_recommendations enable row level security;

create policy learning_resources_select on learning_resources for select using (
  is_published = true or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
);
create policy learning_resources_admin_write on learning_resources for all
  using (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'))
  with check (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'));

create policy resource_skills_select on resource_skills for select using (auth.uid() is not null);
create policy resource_skills_admin_write on resource_skills for all
  using (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'))
  with check (exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin'));

create policy resource_completions_select on resource_completions for select using (
  user_id = auth.uid()
  or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
  or exists (select 1 from profiles me where me.id=auth.uid() and me.role='manager' and me.id = (select p2.manager_id from profiles p2 where p2.id = resource_completions.user_id))
);
create policy resource_completions_insert on resource_completions for insert with check (user_id = auth.uid());
create policy resource_completions_delete on resource_completions for delete using (user_id = auth.uid());

create policy training_recommendations_select on training_recommendations for select using (
  user_id = auth.uid()
  or recommended_by = auth.uid()
  or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
  or exists (select 1 from profiles me where me.id=auth.uid() and me.role='manager' and me.id = (select p2.manager_id from profiles p2 where p2.id = training_recommendations.user_id))
);
create policy training_recommendations_insert on training_recommendations for insert with check (
  recommended_by = auth.uid() and (
    exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
    or exists (select 1 from profiles me where me.id=auth.uid() and me.role='manager' and me.id = (select p2.manager_id from profiles p2 where p2.id = training_recommendations.user_id))
  )
);
create policy training_recommendations_update on training_recommendations for update using (
  user_id = auth.uid() or recommended_by = auth.uid()
  or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
);
create policy training_recommendations_delete on training_recommendations for delete using (
  recommended_by = auth.uid()
  or exists (select 1 from profiles where profiles.id=auth.uid() and profiles.role='admin')
);
