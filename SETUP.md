# UCB Training Portal — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project (free tier is fine)
- An Anthropic API key (for the AI Training Generator)
- A Vercel account (for deployment)

---

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, open the **SQL Editor** and paste the contents of `supabase/schema.sql` and run it
3. In your project settings → API, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
UCB_AI_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=UCB Training <onboarding@resend.dev>
NEXT_PUBLIC_APP_URL=https://your-deployed-url.vercel.app
CRON_SECRET=any-random-string
```

- `UCB_AI_KEY` — Anthropic API key, powers the AI Training Generator
- `RESEND_API_KEY` — from [resend.com](https://resend.com), sends welcome and notification emails. Without it, emails are skipped (logged to console) but the app still works.
- `RESEND_FROM_EMAIL` — optional, defaults to Resend's shared sandbox sender until you verify your own domain
- `NEXT_PUBLIC_APP_URL` — used to build links inside emails
- `CRON_SECRET` — protects the daily due-date reminder cron endpoint (`/api/cron/due-date-reminders`, configured in `vercel.json`); Vercel sends it automatically as a bearer token when set

---

## 3. Create Your First Admin User

Since there's no sign-up page (all accounts are created by admins), you need to create the first admin manually:

1. In Supabase Dashboard → Authentication → Users → **Add User**
2. Enter an email and password
3. Copy the new user's UUID from the list
4. In SQL Editor, run:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'paste-user-uuid-here',
  'admin@yourcompany.com',
  'Your Name',
  'admin'
);
```

---

## 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin account.

---

## 5. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add all environment variables in the Vercel project settings
4. Deploy!

---

## Features Overview

### User Roles
- **Admin**: Full access — manage users, create/edit training modules, use AI generator
- **Manager**: Manage their assigned employees, assign training, use proxy login
- **Employee**: Take assigned trainings, track progress

### Proxy Login (Warehouse Workers)
Warehouse workers without email access don't need their own login.
1. Manager logs in with their credentials
2. Goes to "My Employees" → finds the employee
3. Clicks **"Start Training"** next to the employee's name
4. The app switches context to that employee
5. Employee completes their training
6. Manager clicks "End Session" in the header banner to return to their own account

### AI Training Generator
1. Go to **AI Generator** in the sidebar
2. Upload a PDF, Word doc, or PowerPoint
3. Select the category and add any context hints
4. Claude AI generates a structured training module
5. Review the preview and save
6. Edit the module further in the Module Editor if needed

### Bulk User Import (CSV)
Admin → Users → **Import CSV**. Columns: `full_name, email, role, department, manager_email`.
Each new user gets a generated password emailed to them via Resend.

### Notifications
Bell icon in the header shows in-app notifications (new assignments, due-date reminders),
with a matching email sent via Resend. A daily cron job (`vercel.json`) checks for
assignments due the next day and reminds anyone who hasn't finished.

### Training Modules
- Each module has **sections**
- Each section can have **text blocks**, **video blocks** (YouTube link or direct file upload), and **quiz blocks**
- Quizzes require a passing score (default 70%) before the section can be marked complete
- Progress is tracked per user per section

---

## Training Categories

| Category | Use for |
|----------|---------|
| Onboarding | New employee orientation |
| Sales | Sales techniques, product knowledge |
| Warehouse | Safety, procedures, equipment |
| UCBZeroWaste | Sustainability, recycling programs |
| General | Company policies, misc trainings |
