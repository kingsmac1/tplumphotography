-- =====================================================================
-- Tplum Photography — core: helpers, staff/admin roles, client profiles.
-- Ported from DMI (staff-attendance-promos.sql, client-gallery.sql, staff-portal.sql).
-- Change from DMI: a new sign-up is ALWAYS a client. Staff/admin access is
-- granted from Dashboard -> Team (or by SQL for the first admin, see SETUP-GUIDE.md).
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------- Staff ----------
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  job_title text not null default '',
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid());
$$;

-- Verified email of the signed-in user (null until the email is confirmed).
create or replace function public.current_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.current_email() from public, anon;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.current_email() to authenticated, service_role;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop policy if exists "staff read own or admin" on public.staff;
create policy "staff read own or admin" on public.staff
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admin manage staff" on public.staff;
create policy "admin manage staff" on public.staff
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- The team can never be left without an admin, and an admin can't demote themselves.
create or replace function public.staff_admin_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if old.id = auth.uid() then
      raise exception 'You can''t remove your own admin access. Ask another admin to do it.';
    end if;
    if (select count(*) from public.staff where role = 'admin' and id <> old.id) = 0 then
      raise exception 'Tplum Photography needs at least one admin. Make someone else an admin first.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists staff_admin_guard on public.staff;
create trigger staff_admin_guard before update or delete on public.staff
  for each row execute function public.staff_admin_guard();

-- ---------- Client profiles (every account has one) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.profiles (id, email, full_name, role)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'client')
    on conflict (id) do update set email = excluded.email;
  exception when others then null; -- never block a sign-up because of the profile row
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now() where id = new.id;
  return new;
exception when others then return new;
end $$;
drop trigger if exists on_auth_user_email_profile on auth.users;
create trigger on_auth_user_email_profile after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function public.handle_user_email_change();

create or replace function public.sync_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = case when exists (select 1 from public.staff s where s.id = coalesce(new.id, old.id) and s.role = 'admin') then 'admin' else 'client' end
  where id = coalesce(new.id, old.id);
  return coalesce(new, old);
end $$;
drop trigger if exists staff_profile_role on public.staff;
create trigger staff_profile_role after insert or update or delete on public.staff for each row execute function public.sync_profile_role();

-- Make an existing account the first admin (used once in Phase B, from the service role only).
create or replace function public.grant_admin(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email yet.'; end if;
  insert into public.staff (id, full_name, role) values (uid, split_part(p_email, '@', 1), 'admin')
  on conflict (id) do update set role = 'admin';
end $$;
revoke all on function public.grant_admin(text) from public, anon, authenticated;
grant execute on function public.grant_admin(text) to service_role;

-- ---------- Business settings (one row; everything editable in Dashboard -> Settings) ----------
create table if not exists public.business_settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Tplum Photography',
  legal_name text not null default '',
  email text not null default 'info@tplumphotography.com',
  phone text not null default '+14034935511',
  address text not null default '[Business address — edit in Settings]',
  city text not null default 'Calgary',
  province text not null default 'AB',
  postal_code text not null default '',
  country text not null default 'Canada',
  website text not null default 'https://tplumphotography.com',
  time_zone text not null default 'America/Edmonton',
  currency text not null default 'CAD',
  -- deposit rules (used by the booking flow and invoices; calculated on the server)
  deposit_mode text not null default 'percent' check (deposit_mode in ('percent', 'fixed', 'full')),
  deposit_percent numeric(5,2) not null default 30 check (deposit_percent >= 0 and deposit_percent <= 100),
  deposit_fixed numeric(10,2) not null default 0 check (deposit_fixed >= 0),
  balance_due_days_before integer not null default 14,
  booking_terms text not null default '[Booking terms — edit in Settings] A non-refundable retainer secures your date. The remaining balance is due before your session.',
  cancellation_policy text not null default '[Cancellation policy — edit in Settings]',
  online_payments_enabled boolean not null default true,
  -- booking calendar: opening hours per weekday (0 = Sunday; null = closed) and how far ahead clients can book
  opening_hours jsonb not null default '{"0":null,"1":["10:00","18:00"],"2":["10:00","18:00"],"3":["10:00","18:00"],"4":["10:00","18:00"],"5":["10:00","18:00"],"6":["09:00","17:00"]}'::jsonb,
  booking_horizon_days integer not null default 365 check (booking_horizon_days between 7 and 730),
  min_notice_hours integer not null default 24 check (min_notice_hours between 0 and 720),
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (1) on conflict (id) do nothing;
alter table public.business_settings enable row level security;
drop policy if exists "business settings public read" on public.business_settings;
create policy "business settings public read" on public.business_settings for select to anon, authenticated using (true);
drop policy if exists "business settings admin write" on public.business_settings;
create policy "business settings admin write" on public.business_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop trigger if exists business_settings_touch on public.business_settings;
create trigger business_settings_touch before update on public.business_settings for each row execute function public.touch_updated_at();
