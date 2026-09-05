-- ============================================================================
-- UrCare — incremental patches on top of the real, pre-existing schema.
-- Run this once (after schema.sql) in the Supabase SQL Editor.
-- Every statement here is additive or safely re-runnable — nothing here
-- drops or alters existing data.
-- ============================================================================

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

-- 2. Additive columns on health_profiles needed to store the plan calculator's
--    inputs and free-form onboarding data (nothing existing is touched).
alter table public.health_profiles add column if not exists target_weight_kg numeric;
alter table public.health_profiles add column if not exists goal text;
alter table public.health_profiles add column if not exists pace text;
alter table public.health_profiles add column if not exists extra_data jsonb default '{}';

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
