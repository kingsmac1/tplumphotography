-- =====================================================================
-- Staff check-in & attendance, finance (expenses, other income), emails & messaging,
-- Instagram feed cache, contact-form submissions. Ported from DMI (+ Nkopno for Instagram).
-- =====================================================================

-- ---------- Office location (for staff check-in) ----------
create table if not exists public.office_settings (
  id int primary key default 1 check (id = 1),
  office_name text not null default 'Tplum Photography Studio',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  radius_m integer not null default 100 check (radius_m > 0)
);
insert into public.office_settings (id) values (1) on conflict (id) do nothing;
alter table public.office_settings enable row level security;
drop policy if exists "admin manage office" on public.office_settings;
create policy "admin manage office" on public.office_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Attendance ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  check_date date not null,
  checked_in_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  distance_m integer,
  device_id text,
  ip_address text,
  unique (staff_id, check_date)
);
create unique index if not exists attendance_device_day_idx on public.attendance (device_id, check_date) where device_id is not null;
alter table public.attendance enable row level security;
drop policy if exists "attendance read own or admin" on public.attendance;
create policy "attendance read own or admin" on public.attendance for select to authenticated using (staff_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "attendance admin delete" on public.attendance;
create policy "attendance admin delete" on public.attendance for delete to authenticated using ((select public.is_admin()));

create or replace function public.check_in(p_lat double precision, p_lng double precision, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o public.office_settings;
  dist double precision;
  today date := (now() at time zone 'America/Edmonton')::date;
  sname text;
  rec public.attendance;
  hdrs json;
  client_ip text;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if not exists (select 1 from public.staff where id = uid) then raise exception 'This account is not on the team yet. Ask the admin to add you.'; end if;
  if p_device is null or length(p_device) < 16 then raise exception 'This device could not be identified. Refresh the page and try again.'; end if;
  select * into o from public.office_settings where id = 1;
  if not found or (o.latitude = 0 and o.longitude = 0) then
    raise exception 'The studio location has not been set yet. Please tell the admin.';
  end if;
  dist := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - o.latitude) / 2), 2) +
    cos(radians(o.latitude)) * cos(radians(p_lat)) * power(sin(radians(p_lng - o.longitude) / 2), 2)));
  if dist > o.radius_m then
    raise exception 'You are about % m from the studio. Check-in only works within % m.', round(dist), o.radius_m;
  end if;
  select * into rec from public.attendance where staff_id = uid and check_date = today;
  if found then return json_build_object('already', true, 'checked_in_at', rec.checked_in_at, 'distance_m', rec.distance_m); end if;
  if exists (select 1 from public.attendance where device_id = p_device and check_date = today and staff_id <> uid) then
    raise exception 'This phone has already been used to check in another team member today. Each person must check in from their own phone.';
  end if;
  begin hdrs := current_setting('request.headers', true)::json; exception when others then hdrs := null; end;
  client_ip := nullif(trim(split_part(coalesce(hdrs->>'cf-connecting-ip', hdrs->>'x-real-ip', hdrs->>'x-forwarded-for', ''), ',', 1)), '');
  select coalesce(nullif(full_name, ''), (select email from auth.users where id = uid)) into sname from public.staff where id = uid;
  insert into public.attendance (staff_id, full_name, check_date, latitude, longitude, distance_m, device_id, ip_address)
  values (uid, sname, today, p_lat, p_lng, round(dist), p_device, client_ip) returning * into rec;
  return json_build_object('already', false, 'checked_in_at', rec.checked_in_at, 'distance_m', rec.distance_m);
end $$;
revoke all on function public.check_in(double precision, double precision, text) from public, anon;
grant execute on function public.check_in(double precision, double precision, text) to authenticated;

create table if not exists public.attendance_settings (
  id int primary key default 1 check (id = 1),
  grace_minutes int not null default 30
);
insert into public.attendance_settings (id) values (1) on conflict (id) do nothing;
create table if not exists public.attendance_time_overrides (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  resumption_minutes int not null check (resumption_minutes between 0 and 1439),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists attendance_time_overrides_range_idx on public.attendance_time_overrides (start_date, end_date);
create table if not exists public.attendance_days_off (
  day date primary key,
  note text not null default ''
);
do $$ declare t text; begin
  foreach t in array array['attendance_settings','attendance_time_overrides','attendance_days_off'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('drop policy if exists "staff read" on public.%I', t);
    execute format('create policy "staff read" on public.%I for select to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;

-- ---------- Finance ----------
create table if not exists public.expense_categories (
  name text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null default '',
  amount numeric(10,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (expense_date);
create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  income_date date not null default current_date,
  source text not null default '',
  description text not null default '',
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists other_income_date_idx on public.other_income (income_date);
do $$ declare t text; begin
  foreach t in array array['expense_categories','expenses','other_income'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;
insert into public.expense_categories (name, sort_order) values
  ('Equipment', 1), ('Studio rent', 2), ('Utilities', 3), ('Second shooters & assistants', 4), ('Marketing', 5),
  ('Travel', 6), ('Albums & prints', 7), ('Software & subscriptions', 8), ('Other', 9)
on conflict (name) do nothing;

-- ---------- Emails & messaging (DMI) ----------
create table if not exists public.email_templates (
  key text primary key,
  subject text not null,
  body text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.email_settings (
  key text primary key,
  value text not null default ''
);
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dedupe_key text not null unique,
  template_key text not null,
  recipient text not null,
  subject text,
  status text not null,
  error text,
  source_table text,
  source_id text
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_by text,
  subject text not null,
  body text not null,
  recipient_group text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  failed_list text
);
create table if not exists public.email_sections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  blocks jsonb not null
);
do $$ declare t text; begin
  foreach t in array array['email_templates','email_settings','email_log','email_campaigns','email_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;
-- owner_emails is filled from the OWNER_EMAIL secret in Phase B (also editable in Dashboard -> Emails).
insert into public.email_settings (key, value) values ('owner_emails', '') on conflict (key) do nothing;

-- ---------- Contact form submissions (every public form also lands here) ----------
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form text not null default 'contact',
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  service text not null default '',
  event_date text not null default '',
  location text not null default '',
  instagram text not null default '',
  heard_from text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'replied', 'booked', 'archived')),
  ip_hash text
);
create index if not exists contact_submissions_created_idx on public.contact_submissions (created_at desc);
alter table public.contact_submissions enable row level security;
drop policy if exists "contact admin all" on public.contact_submissions;
create policy "contact admin all" on public.contact_submissions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- (Inserted only by the form-submit Edge Function after server-side validation and the honeypot check.)

-- ---------- Instagram feed (Nkopno pattern) ----------
create table if not exists public.instagram_settings (
  id int primary key default 1 check (id = 1),
  access_token text not null default '',
  token_refreshed_at timestamptz,
  token_expires_at timestamptz,
  last_error text
);
insert into public.instagram_settings (id) values (1) on conflict (id) do nothing;
create table if not exists public.instagram_sync (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamptz,
  post_count int not null default 0,
  last_full_at timestamptz
);
insert into public.instagram_sync (id) values (1) on conflict (id) do nothing;
create table if not exists public.instagram_posts (
  id text primary key,
  permalink text not null,
  media_type text,
  caption text,
  posted_at timestamptz,
  image_url text not null,
  hidden boolean not null default false
);
create index if not exists instagram_posts_posted_idx on public.instagram_posts (posted_at desc);
alter table public.instagram_settings enable row level security;
alter table public.instagram_sync enable row level security;
alter table public.instagram_posts enable row level security;
drop policy if exists "instagram settings admin only" on public.instagram_settings;
create policy "instagram settings admin only" on public.instagram_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "instagram sync public read" on public.instagram_sync;
create policy "instagram sync public read" on public.instagram_sync for select to anon, authenticated using (true);
drop policy if exists "instagram posts public read" on public.instagram_posts;
create policy "instagram posts public read" on public.instagram_posts for select to anon, authenticated using (not hidden or (select public.is_admin()));
drop policy if exists "instagram posts admin write" on public.instagram_posts;
create policy "instagram posts admin write" on public.instagram_posts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
