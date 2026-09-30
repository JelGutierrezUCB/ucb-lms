-- Programs: a lightweight, named grouping of courses for browsing and
-- reporting (e.g. "Leadership Development"). Unlike a learning path/journey,
-- a program has no order and no role-based auto-enrollment — it's just a
-- curated label admins can put a set of courses under. A course can belong
-- to more than one program.

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#0891b2',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table program_modules (
  program_id uuid not null references programs(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (program_id, module_id)
);

alter table programs enable row level security;
alter table program_modules enable row level security;

create policy programs_select on programs for select using (auth.uid() is not null);
create policy programs_admin_write on programs for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy program_modules_select on program_modules for select using (auth.uid() is not null);
create policy program_modules_admin_write on program_modules for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
