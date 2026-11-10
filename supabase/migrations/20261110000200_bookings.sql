-- =====================================================================
-- Bookings (sessions + weddings), event requests, studio rentals, prices, promos,
-- calendar (1-hour slots, closed days), delivery tracking, inspiration images.
-- Ported from DMI. Changes for Tplum:
--   * no location/branch system (DMI's lagos/abuja/uyo columns are gone)
--   * money is CAD with cents: numeric(10,2)
--   * America/Edmonton time zone
--   * website bookings are created ONLY by the `booking-create` Edge Function, which
--     recalculates every price on the server and starts Stripe Checkout. No anonymous inserts.
--   * an unpaid online booking holds its slot for 30 minutes (hold_expires_at)
-- =====================================================================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null default '',
  gender text not null default '',
  shoot_type text not null default '',
  shoot_date date,
  shoot_time time,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 1440),
  phone text not null default '',
  email text not null default '',
  date_of_birth date,
  social_handles text not null default '',
  inspiration_links text not null default '',
  location text not null default '',            -- venue / city typed by the client (weddings), not a branch
  shoot_setting text not null default '',       -- Indoor | Outdoor
  selected_service text not null default '',
  service_price numeric(10,2),
  service_pricing_mode text not null default '',
  outfits integer,
  selected_extras text not null default '',
  extras_detail jsonb not null default '[]'::jsonb,
  extra_edited_count integer,
  service_total numeric(10,2),
  extras_total numeric(10,2),
  discount_total numeric(10,2) not null default 0,
  promo_code text,
  grand_total numeric(10,2),
  deposit_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2),
  payment_status text not null default 'Not Paid' check (payment_status in ('Not Paid', 'Part Payment', 'Paid', 'Refunded')),
  payment_updated_at timestamptz,
  service_summary text not null default '',
  notes text,
  admin_notes text,
  source text not null default 'manual',        -- booking_form | wedding_form | manual
  status text not null default 'confirmed' check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed')),
  hold_expires_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  stripe_session_id text,
  calendar_slot boolean not null default false,
  delivered_at timestamptz,
  delivered_via text check (delivered_via in ('gallery', 'manual')),
  delivered_by text,
  reminder_sent jsonb not null default '{}'::jsonb
);
create index if not exists bookings_shoot_date_idx on public.bookings (shoot_date);
create index if not exists bookings_created_idx on public.bookings (created_at desc);
create index if not exists bookings_email_idx on public.bookings (lower(email));
create index if not exists bookings_status_idx on public.bookings (status, payment_status);
create index if not exists bookings_stripe_idx on public.bookings (stripe_session_id);
-- fast text search on the dashboard list (name, email, phone)
create extension if not exists pg_trgm;
create index if not exists bookings_search_idx on public.bookings using gin ((full_name || ' ' || email || ' ' || phone) gin_trgm_ops);

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

alter table public.bookings enable row level security;
drop policy if exists "bookings staff read" on public.bookings;
create policy "bookings staff read" on public.bookings for select to authenticated using ((select public.is_staff()));
drop policy if exists "bookings staff update" on public.bookings;
create policy "bookings staff update" on public.bookings for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "bookings admin insert" on public.bookings;
create policy "bookings admin insert" on public.bookings for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "bookings admin delete" on public.bookings;
create policy "bookings admin delete" on public.bookings for delete to authenticated using ((select public.is_admin()));

-- ---------- Event requests (DMI "Book an event") ----------
create table if not exists public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null default '',
  email text,
  event_type text not null,
  event_start_date date,
  event_end_date date,
  event_time text,
  venue text,
  expected_guests integer,
  agreed_amount numeric(10,2) not null default 0 check (agreed_amount >= 0),
  notes text,
  payment_status text not null default 'Not Paid',
  amount_paid numeric(10,2),
  payment_updated_at timestamptz,
  source text not null default 'event_form',
  delivered_at timestamptz,
  delivered_via text check (delivered_via in ('gallery', 'manual')),
  delivered_by text
);
create index if not exists event_bookings_date_idx on public.event_bookings (event_start_date);
alter table public.event_bookings enable row level security;
drop policy if exists "event bookings admin all" on public.event_bookings;
create policy "event bookings admin all" on public.event_bookings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "event bookings staff read" on public.event_bookings;
create policy "event bookings staff read" on public.event_bookings for select to authenticated using ((select public.is_staff()));

-- ---------- Studio space rental ----------
create table if not exists public.studio_space_prices (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  duration_minutes integer not null default 30,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false
);
create table if not exists public.studio_space_extras (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  max_qty integer,
  follows_package boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false
);
create table if not exists public.studio_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null default '',
  email text,
  rental_date date,
  rental_time text,
  space_name text not null,
  space_price numeric(10,2) not null default 0,
  duration_minutes integer not null default 30,
  selected_extras text not null default '',
  extras_total numeric(10,2) not null default 0,
  space_total numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  promo_code text,
  grand_total numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  notes text,
  payment_status text not null default 'Not Paid',
  amount_paid numeric(10,2),
  payment_updated_at timestamptz,
  status text not null default 'confirmed' check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed')),
  hold_expires_at timestamptz,
  stripe_session_id text,
  source text not null default 'studio_space_form'
);
create index if not exists studio_bookings_date_idx on public.studio_bookings (rental_date);
alter table public.studio_space_prices enable row level security;
alter table public.studio_space_extras enable row level security;
alter table public.studio_bookings enable row level security;
drop policy if exists "studio prices public read" on public.studio_space_prices;
create policy "studio prices public read" on public.studio_space_prices for select to anon, authenticated using (true);
drop policy if exists "studio prices admin write" on public.studio_space_prices;
create policy "studio prices admin write" on public.studio_space_prices for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "studio extras public read" on public.studio_space_extras;
create policy "studio extras public read" on public.studio_space_extras for select to anon, authenticated using (true);
drop policy if exists "studio extras admin write" on public.studio_space_extras;
create policy "studio extras admin write" on public.studio_space_extras for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "studio bookings admin all" on public.studio_bookings;
create policy "studio bookings admin all" on public.studio_bookings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "studio bookings staff read" on public.studio_bookings;
create policy "studio bookings staff read" on public.studio_bookings for select to authenticated using ((select public.is_staff()));

-- ---------- Session prices (DMI booking_prices without locations) ----------
create table if not exists public.booking_prices (
  id uuid primary key default gen_random_uuid(),
  setting text not null default 'indoor' check (setting in ('indoor', 'outdoor')),
  service_id text not null,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  pricing_mode text not null default 'bundle' check (pricing_mode in ('bundle', 'per_outfit')),
  duration_minutes integer not null default 60,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false   -- "Sample: edit me" badge in the dashboard only
);
create table if not exists public.booking_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  max_qty integer,
  follows_package boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false
);
create table if not exists public.wedding_packages (
  id text primary key,
  name text not null,
  tagline text not null default '',
  includes text[] not null default '{}',
  one_event numeric(10,2) not null default 0,
  two_events numeric(10,2),
  featured boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false
);
create table if not exists public.wedding_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  sample boolean not null default false
);
do $$ declare t text; begin
  foreach t in array array['booking_prices','booking_extras','wedding_packages','wedding_extras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (active or (select public.is_admin()))', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- ---------- Promo codes ----------
create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  percent numeric not null check (percent > 0 and percent <= 100),
  label text,
  active boolean not null default true,
  show_on_site boolean not null default false,
  expires_on date,
  created_at timestamptz not null default now()
);
create unique index if not exists promos_code_upper_idx on public.promos (upper(code));
alter table public.promos enable row level security;
drop policy if exists "admin manage promos" on public.promos;
create policy "admin manage promos" on public.promos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.validate_promo(p_code text)
returns table (code text, percent numeric)
language sql stable security definer set search_path = public as $$
  select p.code, p.percent from public.promos p
  where upper(p.code) = upper(trim(p_code)) and p.active
    and (p.expires_on is null or p.expires_on >= (now() at time zone 'America/Edmonton')::date)
  limit 1;
$$;
create or replace function public.get_public_promos()
returns table (code text, percent numeric, label text)
language sql stable security definer set search_path = public as $$
  select p.code, p.percent, p.label from public.promos p
  where p.active and p.show_on_site
    and (p.expires_on is null or p.expires_on >= (now() at time zone 'America/Edmonton')::date);
$$;
grant execute on function public.validate_promo(text) to anon, authenticated;
grant execute on function public.get_public_promos() to anon, authenticated;

create table if not exists public.studio_space_promos (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  percent numeric not null check (percent > 0 and percent <= 100),
  active boolean not null default true,
  expires_on date,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists studio_space_promos_code_upper_idx on public.studio_space_promos (upper(code));
alter table public.studio_space_promos enable row level security;
drop policy if exists "studio space promos admin only" on public.studio_space_promos;
create policy "studio space promos admin only" on public.studio_space_promos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create or replace function public.validate_studio_space_promo(p_code text)
returns table (code text, percent numeric)
language sql stable security definer set search_path = public as $$
  select p.code, p.percent from public.studio_space_promos p
  where upper(p.code) = upper(trim(p_code)) and p.active
    and (p.expires_on is null or p.expires_on >= (now() at time zone 'America/Edmonton')::date)
  limit 1;
$$;
grant execute on function public.validate_studio_space_promo(text) to anon, authenticated;

-- ---------- Calendar: closed days/slots + availability + no double booking ----------
create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  block_date date not null,
  start_time time,
  end_time time,
  reason text
);
create index if not exists blocked_slots_date_idx on public.blocked_slots (block_date);
alter table public.blocked_slots enable row level security;
drop policy if exists "Admins manage blocked slots" on public.blocked_slots;
create policy "Admins manage blocked slots" on public.blocked_slots for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Staff read blocked slots" on public.blocked_slots;
create policy "Staff read blocked slots" on public.blocked_slots for select to authenticated using ((select public.is_staff()));

-- What the public calendar may see: taken and closed times only, never who booked them.
create or replace function public.booking_availability(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'booked', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', shoot_date,
        'start', to_char(shoot_time, 'HH24:MI'),
        'end', to_char(least(shoot_time + duration_minutes * interval '1 minute', time '23:59'), 'HH24:MI')))
      from bookings b
      where shoot_date between p_from and p_to and shoot_time is not null and b.status <> 'cancelled'
        and (b.status <> 'pending_payment' or b.hold_expires_at is null or b.hold_expires_at > now())
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('date', block_date, 'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI')))
      from blocked_slots where block_date between p_from and p_to
    ), '[]'::jsonb)
  )
  where p_to - p_from <= 62;
$$;
revoke all on function public.booking_availability(date, date) from public;
grant execute on function public.booking_availability(date, date) to anon, authenticated;

-- Refuse website bookings for taken or closed times (errcode 23P01, same as DMI).
-- A per-day advisory lock makes two simultaneous submissions for the same slot impossible.
create or replace function public.bookings_slot_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare s timestamp; e timestamp;
begin
  if new.source not in ('booking_form') or new.shoot_date is null or new.shoot_time is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.shoot_date is not distinct from old.shoot_date and new.shoot_time is not distinct from old.shoot_time
     and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'cancelled' then return new; end if;
  perform pg_advisory_xact_lock(hashtext('slot:' || new.shoot_date::text));
  new.calendar_slot := true;
  s := new.shoot_date + new.shoot_time;
  e := s + make_interval(mins => new.duration_minutes);
  if exists (select 1 from blocked_slots b where b.block_date = new.shoot_date
               and (b.start_time is null or (new.shoot_date + b.start_time < e and s < new.shoot_date + coalesce(b.end_time, b.start_time))))
     or exists (select 1 from bookings x where x.id <> new.id and x.shoot_date = new.shoot_date and x.shoot_time is not null
               and x.status <> 'cancelled' and (x.status <> 'pending_payment' or x.hold_expires_at is null or x.hold_expires_at > now())
               and tsrange(x.shoot_date + x.shoot_time, x.shoot_date + x.shoot_time + make_interval(mins => x.duration_minutes)) && tsrange(s, e)) then
    raise exception 'That time has just been taken. Please pick another slot.' using errcode = '23P01';
  end if;
  return new;
end $$;
drop trigger if exists bookings_slot_guard on public.bookings;
create trigger bookings_slot_guard before insert or update on public.bookings
  for each row execute function public.bookings_slot_guard();

-- ---------- Booking inspiration images (uploaded by clients with the booking; private R2) ----------
create table if not exists public.booking_inspiration_images (
  key text primary key,
  ip_hash text not null,
  bytes integer not null default 0,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists booking_inspiration_booking_idx on public.booking_inspiration_images (booking_id);
create index if not exists booking_inspiration_ip_idx on public.booking_inspiration_images (ip_hash, created_at desc);
alter table public.booking_inspiration_images enable row level security;
revoke all on public.booking_inspiration_images from anon, authenticated;
grant all on public.booking_inspiration_images to service_role;

-- ---------- Delivery promise (DMI: shoots 48–72 h; Tplum default: sessions 7 days, weddings 4 weeks) ----------
create table if not exists public.delivery_settings (
  id smallint primary key default 1 check (id = 1),
  track_from date not null default current_date,
  due_hours integer not null default 120 check (due_hours between 1 and 2160),
  late_hours integer not null default 168 check (late_hours between 1 and 2160),
  event_due_hours integer not null default 672 check (event_due_hours between 1 and 2160),
  event_late_hours integer not null default 840 check (event_late_hours between 1 and 2160),
  updated_at timestamptz not null default now(),
  check (late_hours >= due_hours),
  check (event_late_hours >= event_due_hours)
);
insert into public.delivery_settings (id) values (1) on conflict (id) do nothing;
alter table public.delivery_settings enable row level security;
drop policy if exists "delivery settings admin all" on public.delivery_settings;
create policy "delivery settings admin all" on public.delivery_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
