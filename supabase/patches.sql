-- ============================================================================
-- UrCare — incremental patches on top of the real, pre-existing schema.
-- Run this once (after schema.sql) in the Supabase SQL Editor.
-- Every statement here is additive or safely re-runnable — nothing here
-- drops or alters existing data.
-- ============================================================================

-- 0. CRITICAL: fix the new-user trigger, which was written against a wrong
--    guess at the profiles schema (id/email/name) instead of the real one
--    (user_id/full_name/onboarding_completed/premium_status/role). As shipped
--    it silently BLOCKS EVERY NEW SIGNUP (the insert inside the trigger fails
--    NOT NULL/column-does-not-exist, which rolls back the whole auth.users
--    insert). Run this before testing any new signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, full_name, onboarding_completed, premium_status, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    false,
    'inactive',
    'user'
  )
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 1. Fix user_id foreign keys to point at auth.users.id (consistent with the
--    rest of the real schema — ai_daily_plans, orders, food_scans, etc. all
--    already do this). These 5 tables were freshly created empty, so this is
--    a zero-data-loss change.
alter table public.daily_logs drop constraint if exists daily_logs_user_id_fkey;
alter table public.daily_logs add constraint daily_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.lab_reports drop constraint if exists lab_reports_user_id_fkey;
alter table public.lab_reports add constraint lab_reports_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.prescriptions drop constraint if exists prescriptions_user_id_fkey;
alter table public.prescriptions add constraint prescriptions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.reviews drop constraint if exists reviews_user_id_fkey;
alter table public.reviews add constraint reviews_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.clinical_feedback drop constraint if exists clinical_feedback_user_id_fkey;
alter table public.clinical_feedback add constraint clinical_feedback_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- 1b. Profile photo — stored as a data URL (same pattern already used for lab
--     report images), so no separate Storage bucket setup is needed.
alter table public.profiles add column if not exists avatar_url text;

-- 2. Additive columns on health_profiles needed to store the plan calculator's
--    inputs and free-form onboarding data (nothing existing is touched).
alter table public.health_profiles add column if not exists target_weight_kg numeric;
alter table public.health_profiles add column if not exists goal text;
alter table public.health_profiles add column if not exists pace text;
alter table public.health_profiles add column if not exists extra_data jsonb default '{}';

-- 3b. Receipt upload fields for UPI-QR orders (payment proof screenshot).
alter table public.orders add column if not exists receipt_image_url text;
alter table public.orders add column if not exists receipt_uploaded_at timestamptz;

-- 3. QR / UPI payment settings — a single admin-editable row (replaces the
--    old hardcoded/in-memory QR settings).
create table if not exists public.qr_settings (
  id text primary key default 'default',
  qr_image_url text,
  upi_id text,
  payee_name text,
  merchant_note text,
  updated_at timestamptz default now()
);
insert into public.qr_settings (id) values ('default') on conflict (id) do nothing;
alter table public.qr_settings enable row level security;
drop policy if exists "public read qr settings" on public.qr_settings;
create policy "public read qr settings" on public.qr_settings for select using (true);
-- Writes go through the server (service_role), so no anon write policy.

-- 4. REVERSAL PLAN SECTIONS — the static, admin-authored 24-hour reversal
--    protocol (no AI). Each row is one step/branch of the plan; the server
--    composes a user's daily plan by filtering these rows against their
--    selected medical conditions and how many days they've been on the
--    program — nothing here is generated, only assembled deterministically.
create table if not exists public.reversal_plan_sections (
  id text primary key,
  part int not null default 1,
  order_index int not null,
  time_label text,
  title text not null,
  body text not null,
  -- Empty = shown to everyone. Otherwise shown if the user has ANY of these
  -- condition tags (see CONDITION_LABEL_TO_TAG in server.ts).
  condition_tags text[] default '{}',
  -- Program-day window this row applies to (1-14). Null on both = every day.
  day_start int,
  day_end int,
  created_at timestamptz default now()
);
alter table public.reversal_plan_sections enable row level security;
drop policy if exists "public read reversal plan sections" on public.reversal_plan_sections;
create policy "public read reversal plan sections" on public.reversal_plan_sections for select using (true);
-- Writes go through the seed script with the service_role key — no anon write policy.

-- Day 1 of each user's reversal program — set once, the first time their
-- plan is fetched (never overwritten by later profile edits), so "program
-- day" (1-14) can be computed as (today - program_started_at).
alter table public.health_profiles add column if not exists program_started_at timestamptz;

-- 5. CUSTOM DAILY PLAN — a user's own uploaded daily schedule (photo/PDF,
--    e.g. one their own doctor gave them), extracted by Claude into the same
--    {timeLabel, title, body} shape as the built-in reversal plan. When a
--    row exists here and hasn't expired yet, /api/daily-plan returns THESE
--    sections instead of the built-in program. One active plan per user —
--    a new upload replaces the old one — valid for 35 days from upload.
create table if not exists public.custom_daily_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  uploaded_at timestamptz default now(),
  expires_at timestamptz not null,
  source_image_url text,
  sections jsonb not null default '[]'
);
alter table public.custom_daily_plans enable row level security;
drop policy if exists "own custom daily plan" on public.custom_daily_plans;
create policy "own custom daily plan" on public.custom_daily_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. NOTIFICATIONS — the Home header's bell was purely decorative (no
--    backend at all); this makes it real. Rows are only ever created
--    server-side (service_role) when something real actually happens to a
--    user — a prescription issued, a report reviewed, an order's
--    status/payment updated — never client-side, and never fabricated.
create table if not exists public.notifications (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'prescription' | 'report' | 'order' | 'system'
  title text not null,
  body text,
  data jsonb default '{}',
  read boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications select" on public.notifications;
create policy "own notifications select" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Inserts go through the server (service_role) only — no anon/user insert policy.

-- 7. ACTIVITY LOG — "My Timeline" on Home: a GitHub-commit-style history of
--    real things that actually happened to this user's own data (a report
--    uploaded/edited/deleted, a plan uploaded, a health-profile or nutrition
--    target changed, a prescription issued, an order placed/updated, an
--    assessment completed). Unlike notifications (server-only insert, an
--    alert), this is the user's OWN audit trail of their OWN actions, so —
--    same as daily_logs — their own client is allowed to insert it directly.
--    No update/delete policy: an audit trail a user could edit or erase
--    wouldn't be trustworthy as one, same as a real commit history.
create table if not exists public.activity_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, -- 'created' | 'uploaded' | 'updated' | 'deleted'
  category text not null, -- 'report' | 'plan' | 'profile' | 'target' | 'prescription' | 'order' | 'assessment' | 'meal'
  title text not null,
  detail text,
  data jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists activity_log_user_id_created_at_idx on public.activity_log (user_id, created_at desc);
alter table public.activity_log enable row level security;
drop policy if exists "own activity select" on public.activity_log;
create policy "own activity select" on public.activity_log for select using (auth.uid() = user_id);
drop policy if exists "own activity insert" on public.activity_log;
create policy "own activity insert" on public.activity_log for insert with check (auth.uid() = user_id);
-- Admin-driven entries (prescription issued, order updated) are written by
-- the server with service_role, which bypasses RLS — no separate policy
-- needed for that.

-- 8. CUSTOM PLAN STEPS — a user's own additions to their Daily Plan timeline
--    (Plan tab → Edit → Add). Each one is checked once, at creation, against
--    this user's REAL medical conditions and lab-report findings by the
--    server (Groq call, using health_profiles.existing_concerns + their most
--    recent lab_reports biomarkers) and stamped with a verdict — 'yellow'
--    (fits their profile) or 'red' (conflicts with it) — shown as a colored
--    indicator in the timeline. Recurs every day (no date column), same as
--    the built-in reversal_plan_sections. Insert/update only via the server
--    (needs the service-role client to call Groq) — the user's own client
--    can read and delete its own rows directly, same as a note they wrote.
create table if not exists public.custom_plan_steps (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time_label text not null,
  title text not null,
  body text,
  verdict text not null default 'yellow', -- 'yellow' | 'red'
  verdict_reason text,
  created_at timestamptz default now()
);
create index if not exists custom_plan_steps_user_id_idx on public.custom_plan_steps (user_id);
alter table public.custom_plan_steps enable row level security;
drop policy if exists "own custom plan steps select" on public.custom_plan_steps;
create policy "own custom plan steps select" on public.custom_plan_steps for select using (auth.uid() = user_id);
drop policy if exists "own custom plan steps delete" on public.custom_plan_steps;
create policy "own custom plan steps delete" on public.custom_plan_steps for delete using (auth.uid() = user_id);
-- No insert/update policy — those go through the server (service_role) only,
-- since creating a row requires the server's Groq call to set the verdict.

-- 9. REPORT → PLAN IMPACT — a real, honest breakdown of what a report did to
--    this user's Daily Plan focus, shown point-wise on the report itself
--    (see ReportPhotoViewer). All three are deterministic, computed once at
--    upload time from THIS report's own abnormal biomarkers (see
--    deriveConditionTagsFromReport in server.ts) — never recomputed
--    differently later, so the report always tells the same true story of
--    what happened when it was uploaded:
--    - recommended_conditions: every condition this report's own abnormal
--      findings imply (regardless of whether it was already on file).
--    - pre_existing_conditions: a snapshot of health_profiles.existing_concerns
--      as it stood the moment BEFORE this report was processed.
--    - added_conditions: the subset of recommended_conditions that was
--      actually NEW at that moment (recommended_conditions minus
--      pre_existing_conditions) — what this report really added.
alter table public.lab_reports add column if not exists recommended_conditions text[] default '{}';
alter table public.lab_reports add column if not exists pre_existing_conditions text[] default '{}';
alter table public.lab_reports add column if not exists added_conditions text[] default '{}';

-- 10. ADMIN-ASSIGNED FILES — a file an admin uploads FOR one specific user
--     (their diagnosis, a lab report, a treatment plan, a diet plan, or any
--     other document). Stored as a data URL, same pattern already used for
--     product photos / avatars / lab report images elsewhere in this schema
--     — no separate Storage bucket needed. Visible ONLY to that one user;
--     every other user's client is blocked by RLS from ever seeing it.
create table if not exists public.admin_user_files (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_type text not null default 'other', -- 'diagnosis' | 'reports' | 'treatment_plan' | 'diet_plan' | 'other'
  title text not null,
  file_url text not null,
  mime_type text,
  uploaded_by text,
  created_at timestamptz default now()
);
create index if not exists admin_user_files_user_id_idx on public.admin_user_files (user_id);
alter table public.admin_user_files enable row level security;
drop policy if exists "own admin files select" on public.admin_user_files;
create policy "own admin files select" on public.admin_user_files for select using (auth.uid() = user_id);
-- Insert/update/delete go through the server (service_role) only — admin-authored.

-- 11. ADMIN-AUTHORED PERSONALIZED PLAN — one full care plan per user
--     (diagnosis, treatment/recovery plan, food plan, daily routine,
--     shopping list, other instructions), written by an admin and shown to
--     that one user only. One row per user — a new save overwrites the
--     previous plan, same as custom_daily_plans above.
create table if not exists public.user_personalized_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  diagnosis text,
  treatment_plan text,
  food_plan text,
  daily_routine text,
  shopping_list text,
  other_instructions text,
  updated_by text,
  updated_at timestamptz default now()
);
alter table public.user_personalized_plans enable row level security;
drop policy if exists "own personalized plan select" on public.user_personalized_plans;
create policy "own personalized plan select" on public.user_personalized_plans for select using (auth.uid() = user_id);
-- Writes go through the server (service_role) only — admin-authored.

-- 12. FAMILY MEMBERS — a dependent profile the primary account manages, with
--     no login of its own. Implemented as a REAL (but login-disabled) auth
--     user under the hood — created server-side via the Supabase admin API
--     with a synthetic, unreachable email and a random password that's
--     never given out — purely so every existing per-user table (
--     health_profiles, custom_daily_plans, program_started_at,
--     admin_user_files, user_personalized_plans) and the Tracker's own
--     localStorage keying can be reused completely unchanged for a
--     dependent, keyed by dependent_user_id exactly like a real account.
--     The primary user can only ever act "as" a dependent they actually own
--     — checked server-side against this table on every request, never
--     trusted from the client alone.
create table if not exists public.family_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  primary_user_id uuid not null references auth.users(id) on delete cascade,
  dependent_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  relation text, -- 'spouse' | 'child' | 'parent' | 'sibling' | 'other'
  age int,
  gender text,
  conditions text[] default '{}',
  created_at timestamptz default now()
);
create index if not exists family_members_primary_user_id_idx on public.family_members (primary_user_id);
alter table public.family_members enable row level security;
drop policy if exists "own family members select" on public.family_members;
create policy "own family members select" on public.family_members for select using (auth.uid() = primary_user_id);
-- Insert/update/delete go through the server (service_role) only, since
-- creating one also creates a shadow auth.users row via the admin API.

-- 13. FAMILY ACCESS TO A DEPENDENT'S OWN TABLES — ADDITIVE policies only
--     (never a drop/replace of whatever pre-existing policy already governs
--     these tables, since several of them — daily_logs especially — were
--     never defined in this repo's tracked SQL to begin with). Postgres
--     combines multiple permissive policies for the same command with OR,
--     so these simply grant an EXTRA path in: "you may also act on this row
--     if you are the verified primary account for the dependent who owns
--     it" — on top of whatever "it's my own row" policy already exists.
--     This is what lets a family member's Daily Plan (task completion,
--     meals/water/macros — all in daily_logs) and their own custom_plan_steps
--     / admin-assigned files / personalized plan work from the primary
--     account's own session, with no login of the dependent's own.
drop policy if exists "family select daily_logs" on public.daily_logs;
create policy "family select daily_logs" on public.daily_logs for select
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = daily_logs.user_id));
drop policy if exists "family insert daily_logs" on public.daily_logs;
create policy "family insert daily_logs" on public.daily_logs for insert
  with check (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = daily_logs.user_id));
drop policy if exists "family update daily_logs" on public.daily_logs;
create policy "family update daily_logs" on public.daily_logs for update
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = daily_logs.user_id))
  with check (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = daily_logs.user_id));

drop policy if exists "family select custom plan steps" on public.custom_plan_steps;
create policy "family select custom plan steps" on public.custom_plan_steps for select
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = custom_plan_steps.user_id));
drop policy if exists "family delete custom plan steps" on public.custom_plan_steps;
create policy "family delete custom plan steps" on public.custom_plan_steps for delete
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = custom_plan_steps.user_id));

drop policy if exists "family select admin files" on public.admin_user_files;
create policy "family select admin files" on public.admin_user_files for select
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = admin_user_files.user_id));

drop policy if exists "family select personalized plan" on public.user_personalized_plans;
create policy "family select personalized plan" on public.user_personalized_plans for select
  using (auth.uid() in (select primary_user_id from public.family_members where dependent_user_id = user_personalized_plans.user_id));
