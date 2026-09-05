-- ============================================================================
-- UrCare — Supabase schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query
-- -> paste this whole file -> Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE everywhere).
-- ============================================================================

-- Drop any pre-existing "products"/"reviews" tables from a starter template
-- (they usually have a uuid id, which conflicts with the text ids this app
-- uses, e.g. 'prod_whey_iso'). Safe — this schema recreates both immediately
-- below with the correct columns.
drop table if exists public.reviews cascade;
drop table if exists public.products cascade;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — this table ALREADY EXISTED in this project with real users
--    and a different shape than originally assumed here (id uuid surrogate
--    key, user_id -> auth.users.id, full_name, onboarding_completed,
--    premium_status, role, etc.) — this block is a no-op on that real table
--    (kept only so a truly fresh project still gets a working profiles table).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  onboarding_completed boolean default false,
  premium_status text default 'inactive',
  premium_started_at timestamptz,
  premium_expires_at timestamptz,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile row the moment someone signs up (Google or email) —
-- matches the REAL profiles schema (user_id + full_name), not a guessed one.
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

-- ---------------------------------------------------------------------------
-- 2. DAILY LOGS — what the user actually ate/did on a given date
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  meals jsonb default '[]',
  water_ml int default 0,
  burned_activities jsonb default '[]',
  medications jsonb default '[]',
  task_completion jsonb default '{}',
  notes text,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- 3. DAILY PLANS — the personalized eat/avoid/exercise plan generated FOR that date
--    (so the plan actually differs day to day and history can be browsed)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_plans (
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  target_calories int,
  target_protein int,
  target_carbs int,
  target_fats int,
  eat_list jsonb default '[]',
  avoid_list jsonb default '[]',
  exercise_do_list jsonb default '[]',
  exercise_avoid_list jsonb default '[]',
  generated_at timestamptz default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- 4. LAB REPORTS — uploaded diagnostic reports + AI analysis
-- ---------------------------------------------------------------------------
create table if not exists public.lab_reports (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  report_name text,
  uploaded_at timestamptz default now(),
  image_url text,
  report_text text,
  summary text,
  biomarkers jsonb default '[]',
  identified_risks jsonb default '[]',
  dietary_recommendations jsonb default '[]',
  macro_adjustments jsonb default '{}',
  admin_reviewed boolean default false,
  admin_notes text
);

-- ---------------------------------------------------------------------------
-- 5. PRESCRIPTIONS — doctor-issued, written by admin/doctor for a user
-- ---------------------------------------------------------------------------
create table if not exists public.prescriptions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  report_id text references public.lab_reports(id) on delete set null,
  doctor_name text,
  doctor_phone text,
  date date default current_date,
  diagnosis text,
  medicines jsonb default '[]',
  recommended_supplements jsonb default '[]',
  dietary_adjustments jsonb default '[]',
  notes text
);

-- ---------------------------------------------------------------------------
-- 6. DOCTORS — admin-managed clinical doctor directory (Consult a Doctor)
-- ---------------------------------------------------------------------------
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qualification text,
  specialization text,
  registration_number text,
  phone text,
  direct_dial_number text,
  availability text,
  hospital_affiliation text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 7. PRODUCTS — store catalog (admin-managed)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text,
  price numeric,
  discount_price numeric,
  image text,
  description text,
  benefits jsonb default '[]',
  nutrition_info jsonb,
  in_stock boolean default true,
  featured boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 8. REVIEWS — real user product reviews (drives each product's rating/count)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  product_id text references public.products(id) on delete cascade,
  product_name text,
  rating int check (rating between 1 and 5),
  comment text,
  verified boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 9. ORDERS — store orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  items jsonb default '[]',
  shipping_address jsonb,
  subtotal numeric,
  discount numeric,
  total numeric,
  payment_method text,
  payment_status text,
  order_status text default 'confirmed',
  transaction_id text,
  receipt_image_url text,
  receipt_uploaded_at timestamptz,
  created_at timestamptz default now(),
  estimated_delivery date
);

-- ---------------------------------------------------------------------------
-- 10. CLINICAL FEEDBACK — periodic adherence check-ins
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_feedback (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  day_cycle_number int,
  energy_rating int,
  digestion_rating int,
  adherence_percentage int,
  satiety_level text,
  improvement_suggestions text,
  created_at timestamptz default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Users can only ever read/write their OWN rows via the anon/browser client.
-- The admin dashboard never uses this client-side path — it goes through the
-- server, which uses the service_role key (bypasses RLS) after checking
-- profiles.is_admin for the logged-in admin. So there is no "admin" RLS policy
-- below on purpose.
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.daily_plans enable row level security;
alter table public.lab_reports enable row level security;
alter table public.prescriptions enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.clinical_feedback enable row level security;
alter table public.doctors enable row level security;
alter table public.products enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own daily logs" on public.daily_logs;
create policy "own daily logs" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own daily plans" on public.daily_plans;
create policy "own daily plans" on public.daily_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own lab reports" on public.lab_reports;
create policy "own lab reports" on public.lab_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prescriptions are written by the admin (server, service_role) but the
-- patient they belong to must be able to read their own.
drop policy if exists "read own prescriptions" on public.prescriptions;
create policy "read own prescriptions" on public.prescriptions
  for select using (auth.uid() = user_id);

-- Reviews: anyone can read (public social proof on the store), only the
-- author can write/edit their own.
drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
  for select using (true);
drop policy if exists "own reviews write" on public.reviews;
create policy "own reviews write" on public.reviews
  for insert with check (auth.uid() = user_id);
drop policy if exists "own reviews update" on public.reviews;
create policy "own reviews update" on public.reviews
  for update using (auth.uid() = user_id);

drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own feedback" on public.clinical_feedback;
create policy "own feedback" on public.clinical_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Doctors & products: public catalog, readable by anyone (even signed out
-- visitors browsing the store), writable only by admin (service_role, no
-- anon-key policy needed for writes).
drop policy if exists "public read doctors" on public.doctors;
create policy "public read doctors" on public.doctors
  for select using (active = true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select using (true);

-- ============================================================================
-- DONE. Next steps:
-- 1. Authentication -> Providers -> Google -> paste your Client ID/Secret.
-- 2. Authentication -> URL Configuration -> add your dev + prod URLs to
--    "Redirect URLs" (e.g. http://localhost:3000, https://yourdomain.com).
-- 3. Table editor -> profiles -> find your own row -> set is_admin = true
--    (do this AFTER you've signed in at least once, so your row exists).
-- 4. Send me: Project URL, anon public key, and the service_role key
--    (Project Settings -> API). The service_role key goes ONLY in the
--    server's .env — it must never reach the browser.
-- ============================================================================
