-- Introductory Reviews (7 / 30 / 60 / 90 business-day reviews for new hires).
-- Applied as a migration; kept here as the reference copy (schema.sql points to it).

-- ── Profile fields the review scheduling needs ───────────────────────────────
alter table profiles
  add column if not exists start_date date,            -- "First Day"
  add column if not exists job_title text,
  add column if not exists timezone text,              -- IANA name, e.g. America/Chicago, Asia/Manila
  add column if not exists holiday_region text check (holiday_region in ('US', 'PH')),
  add column if not exists work_schedule jsonb;        -- { mon: {start:"09:00", end:"17:00"} | null, ... }

-- ── Holidays (per region) — business-day math skips weekends + these ─────────
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('US', 'PH')),
  holiday_date date not null,
  name text not null,
  unique (region, holiday_date)
);

-- ── The reviews themselves: one row per (employee, review day) ───────────────
create table if not exists intro_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,       -- reviewee
  review_day int not null check (review_day in (7, 30, 60, 90)),
  due_date date not null,                                                -- Nth business day counting First Day as day 1
  supervisor_id uuid references profiles(id) on delete set null,
  evaluator_id uuid references profiles(id) on delete set null,          -- usually the same person as supervisor
  status text not null default 'awaiting_self'
    check (status in ('awaiting_self', 'awaiting_evaluator', 'awaiting_signatures', 'completed', 'cancelled')),

  -- Call scheduling. times are UTC; each person's timezone lives on their profile.
  call_at timestamptz,
  call_duration_min int not null default 30,
  call_link text,
  call_sequence int not null default 0,                                  -- calendar-invite SEQUENCE (bumped on every change)
  slots jsonb not null default '[]',                                     -- proposed ISO times the reviewee can pick from
  slots_proposed_at timestamptz,
  slots_note text,

  -- Frozen copy of the questions/rating items used, so a signed review never changes
  template_snapshot jsonb not null,
  self_answers jsonb,
  self_submitted_at timestamptz,
  evaluator_answers jsonb,
  evaluator_submitted_at timestamptz,
  completed_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, review_day)
);

create index if not exists intro_reviews_supervisor_idx on intro_reviews (supervisor_id);
create index if not exists intro_reviews_evaluator_idx on intro_reviews (evaluator_id);
create index if not exists intro_reviews_due_idx on intro_reviews (due_date);

-- ── E-signatures: one per required signer per review, with an audit trail ────
create table if not exists intro_review_signatures (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references intro_reviews(id) on delete cascade not null,
  signer_id uuid references profiles(id) on delete set null,
  role text not null check (role in ('reviewee', 'supervisor', 'evaluator')),
  signer_name text not null,
  signature_type text not null check (signature_type in ('typed', 'drawn')),
  signature_text text,
  signature_image text,                                                  -- small PNG data URL when drawn
  consent_text text not null,                                            -- the exact acknowledgment they agreed to
  content_hash text not null,                                            -- sha256 of the locked review content at signing time
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  unique (review_id, role)
);

-- ── Unsubmitted work-in-progress (kept separate so a draft is never visible to the other party)
create table if not exists intro_review_drafts (
  review_id uuid references intro_reviews(id) on delete cascade not null,
  role text not null check (role in ('reviewee', 'evaluator')),
  answers jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (review_id, role)
);

-- ── Reminder log: stops the daily job from sending the same reminder twice ──
create table if not exists intro_review_reminders (
  review_id uuid references intro_reviews(id) on delete cascade not null,
  kind text not null,
  sent_at timestamptz default now(),
  primary key (review_id, kind)
);

-- ── Row level security ───────────────────────────────────────────────────────
-- Every write goes through the app's API routes (service role, with explicit
-- checks) — so clients only ever need SELECT.
alter table holidays enable row level security;
alter table intro_reviews enable row level security;
alter table intro_review_signatures enable row level security;
alter table intro_review_drafts enable row level security;
alter table intro_review_reminders enable row level security;

create policy "holidays_select" on holidays for select using (true);
create policy "holidays_admin_write" on holidays for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Performance reviews are sensitive: only the reviewee, their supervisor/evaluator, and HR admins.
create policy "intro_reviews_select" on intro_reviews for select using (
  user_id = auth.uid()
  or supervisor_id = auth.uid()
  or evaluator_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "intro_review_signatures_select" on intro_review_signatures for select using (
  exists (
    select 1 from intro_reviews r
    where r.id = intro_review_signatures.review_id
      and (
        r.user_id = auth.uid()
        or r.supervisor_id = auth.uid()
        or r.evaluator_id = auth.uid()
        or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
      )
  )
);

-- Drafts stay private to whoever is writing them — not even HR admins read them.
create policy "intro_review_drafts_select" on intro_review_drafts for select using (
  exists (
    select 1 from intro_reviews r
    where r.id = intro_review_drafts.review_id
      and (
        (intro_review_drafts.role = 'reviewee' and r.user_id = auth.uid())
        or (intro_review_drafts.role = 'evaluator' and (r.evaluator_id = auth.uid() or r.supervisor_id = auth.uid()))
      )
  )
);
-- intro_review_reminders: RLS on, no policies → only the service role can touch it.

-- ── Seed holidays 2026–2027 (admins can edit these in the app) ───────────────
-- US: federal holidays, with the observed weekday when one falls on a weekend.
-- PH: fixed-date regular + special non-working days. Holidays set by annual
-- proclamation (e.g. Eid'l Fitr, Eid'l Adha) are NOT included — add them when announced.
insert into holidays (region, holiday_date, name) values
  ('US', '2026-01-01', 'New Year''s Day'),
  ('US', '2026-01-19', 'Martin Luther King Jr. Day'),
  ('US', '2026-02-16', 'Presidents'' Day'),
  ('US', '2026-05-25', 'Memorial Day'),
  ('US', '2026-06-19', 'Juneteenth'),
  ('US', '2026-07-03', 'Independence Day (observed)'),
  ('US', '2026-09-07', 'Labor Day'),
  ('US', '2026-10-12', 'Columbus Day'),
  ('US', '2026-11-11', 'Veterans Day'),
  ('US', '2026-11-26', 'Thanksgiving Day'),
  ('US', '2026-12-25', 'Christmas Day'),
  ('US', '2027-01-01', 'New Year''s Day'),
  ('US', '2027-01-18', 'Martin Luther King Jr. Day'),
  ('US', '2027-02-15', 'Presidents'' Day'),
  ('US', '2027-05-31', 'Memorial Day'),
  ('US', '2027-06-18', 'Juneteenth (observed)'),
  ('US', '2027-07-05', 'Independence Day (observed)'),
  ('US', '2027-09-06', 'Labor Day'),
  ('US', '2027-10-11', 'Columbus Day'),
  ('US', '2027-11-11', 'Veterans Day'),
  ('US', '2027-11-25', 'Thanksgiving Day'),
  ('US', '2027-12-24', 'Christmas Day (observed)'),
  ('US', '2027-12-31', 'New Year''s Day (observed)'),

  ('PH', '2026-01-01', 'New Year''s Day'),
  ('PH', '2026-02-17', 'Chinese New Year'),
  ('PH', '2026-04-02', 'Maundy Thursday'),
  ('PH', '2026-04-03', 'Good Friday'),
  ('PH', '2026-04-09', 'Araw ng Kagitingan'),
  ('PH', '2026-05-01', 'Labor Day'),
  ('PH', '2026-06-12', 'Independence Day'),
  ('PH', '2026-08-21', 'Ninoy Aquino Day'),
  ('PH', '2026-08-31', 'National Heroes Day'),
  ('PH', '2026-11-02', 'All Souls'' Day'),
  ('PH', '2026-11-30', 'Bonifacio Day'),
  ('PH', '2026-12-08', 'Feast of the Immaculate Conception'),
  ('PH', '2026-12-24', 'Christmas Eve'),
  ('PH', '2026-12-25', 'Christmas Day'),
  ('PH', '2026-12-30', 'Rizal Day'),
  ('PH', '2026-12-31', 'Last Day of the Year'),
  ('PH', '2027-01-01', 'New Year''s Day'),
  ('PH', '2027-03-25', 'Maundy Thursday'),
  ('PH', '2027-03-26', 'Good Friday'),
  ('PH', '2027-04-09', 'Araw ng Kagitingan'),
  ('PH', '2027-08-30', 'National Heroes Day'),
  ('PH', '2027-11-01', 'All Saints'' Day'),
  ('PH', '2027-11-02', 'All Souls'' Day'),
  ('PH', '2027-11-30', 'Bonifacio Day'),
  ('PH', '2027-12-08', 'Feast of the Immaculate Conception'),
  ('PH', '2027-12-24', 'Christmas Eve'),
  ('PH', '2027-12-30', 'Rizal Day'),
  ('PH', '2027-12-31', 'Last Day of the Year')
on conflict (region, holiday_date) do nothing;
