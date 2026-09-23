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
