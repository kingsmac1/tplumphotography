-- =====================================================================
-- Payments ledger (Stripe + manual), invoices (DMI invoice generator, extended),
-- contracts with e-signing (new for Tplum; DMI has none).
-- =====================================================================

-- ---------- Payments: every payment, however it arrived ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  paid_at timestamptz not null default now(),
  booking_table text check (booking_table in ('bookings', 'studio_bookings', 'event_bookings')),
  booking_id uuid,
  invoice_id uuid,
  amount numeric(10,2) not null check (amount <> 0),          -- negative = refund
  currency text not null default 'CAD',
  method text not null default 'other' check (method in ('stripe', 'etransfer', 'cash', 'card', 'cheque', 'other')),
  kind text not null default 'payment' check (kind in ('deposit', 'balance', 'payment', 'refund')),
  stripe_session_id text,
  stripe_payment_intent text,
  note text,
  recorded_by uuid references auth.users(id) on delete set null
);
create unique index if not exists payments_stripe_pi_uq on public.payments (stripe_payment_intent) where stripe_payment_intent is not null;
create index if not exists payments_booking_idx on public.payments (booking_table, booking_id);
create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_paid_idx on public.payments (paid_at desc);
alter table public.payments enable row level security;
drop policy if exists "payments admin all" on public.payments;
create policy "payments admin all" on public.payments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Recalculate a booking's amount_paid / payment_status from its payments.
create or replace function public.recalc_booking_payment(p_table text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare paid numeric; total numeric; st text;
begin
  if p_table is null or p_id is null then return; end if;
  select coalesce(sum(amount), 0) into paid from public.payments where booking_table = p_table and booking_id = p_id;
  if p_table = 'event_bookings' then
    select agreed_amount into total from public.event_bookings where id = p_id;
  else
    execute format('select grand_total from public.%I where id = $1', p_table) into total using p_id;
  end if;
  st := case when paid <= 0 then 'Not Paid' when total is not null and paid >= total then 'Paid' else 'Part Payment' end;
  execute format('update public.%I set amount_paid = $1, payment_status = $2, payment_updated_at = now() where id = $3', p_table)
    using paid, st, p_id;
  -- a paid deposit confirms an online booking
  if p_table in ('bookings', 'studio_bookings') and paid > 0 then
    execute format('update public.%I set status = ''confirmed'', hold_expires_at = null where id = $1 and status = ''pending_payment''', p_table) using p_id;
  end if;
end $$;
revoke all on function public.recalc_booking_payment(text, uuid) from public, anon;

-- ---------- Invoices (DMI's generator; doc jsonb holds the editable invoice) ----------
create sequence if not exists public.invoice_number_seq start 1;
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  number text not null unique,
  booking_table text check (booking_table in ('bookings', 'studio_bookings', 'event_bookings')),
  booking_id uuid,
  doc jsonb not null default '{}'::jsonb,
  -- denormalised from doc on every save (fast lists, filters, the public page and Stripe)
  status text not null default 'draft' check (status in ('draft', 'sent', 'part_paid', 'paid', 'overdue', 'void')),
  client_name text not null default '',
  client_email text not null default '',
  invoice_date date,
  due_date date,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  paid numeric(10,2) not null default 0,
  balance numeric(10,2) not null default 0,
  public_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  sent_at timestamptz,
  sent_to text,
  sent_stage text check (sent_stage in ('before', 'part', 'paid')),
  sent_count integer not null default 0,
  viewed_at timestamptz,
  paid_at timestamptz
);
create index if not exists invoices_booking_idx on public.invoices (booking_table, booking_id);
create index if not exists invoices_created_idx on public.invoices (created_at desc);
create index if not exists invoices_status_idx on public.invoices (status, due_date);
drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

-- TPL-0001, TPL-0002 … (prefix editable in invoice settings; the counter never reuses a number)
create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path = public as $$
declare prefix text; n bigint;
begin
  if not public.is_admin() and current_user not in ('service_role', 'postgres') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select coalesce(value ->> 'prefix', 'TPL-') into prefix from public.invoice_settings where key = 'numbering';
  prefix := coalesce(prefix, 'TPL-');
  loop
    n := nextval('public.invoice_number_seq');
    exit when not exists (select 1 from public.invoices where number = prefix || lpad(n::text, 4, '0'));
  end loop;
  return prefix || lpad(n::text, 4, '0');
end $$;
revoke all on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated;

create table if not exists public.invoice_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
alter table public.invoice_settings enable row level security;
drop policy if exists "invoices admin all" on public.invoices;
create policy "invoices admin all" on public.invoices for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "invoice settings admin all" on public.invoice_settings;
create policy "invoice settings admin all" on public.invoice_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.invoices, public.invoice_settings from anon;

-- Overdue: sent, money still owed, past the due date (run daily by process-emails, and on every list load)
create or replace function public.mark_overdue_invoices() returns integer
language sql security definer set search_path = public as $$
  with u as (
    update public.invoices set status = 'overdue'
    where status in ('sent', 'part_paid') and balance > 0 and due_date is not null
      and due_date < (now() at time zone 'America/Edmonton')::date
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.mark_overdue_invoices() from public, anon;
grant execute on function public.mark_overdue_invoices() to authenticated;

-- What the client's invoice page (/invoice/<token>) may read. No login; the token is the key.
create or replace function public.invoice_by_token(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.invoices;
begin
  select * into r from public.invoices where public_token = p_token and status <> 'draft' and status <> 'void';
  if not found then return null; end if;
  update public.invoices set viewed_at = coalesce(viewed_at, now()) where id = r.id;
  return jsonb_build_object('id', r.id, 'number', r.number, 'doc', r.doc, 'status', r.status, 'total', r.total, 'paid', r.paid,
    'balance', r.balance, 'due_date', r.due_date, 'online_payments', (select online_payments_enabled from public.business_settings where id = 1));
end $$;
revoke all on function public.invoice_by_token(text) from public;
grant execute on function public.invoice_by_token(text) to anon, authenticated;

-- ---------- Contracts + e-signing ----------
create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  body text not null default '',           -- HTML with {{placeholders}}
  sample boolean not null default false,
  active boolean not null default true
);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  number text not null unique default ('CT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  template_id uuid references public.contract_templates(id) on delete set null,
  booking_table text check (booking_table in ('bookings', 'studio_bookings', 'event_bookings')),
  booking_id uuid,
  title text not null default 'Photography Agreement',
  client_name text not null default '',
  client_email text not null default '',
  body text not null default '',            -- the final text the client signs (placeholders filled in)
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'signed', 'countersigned', 'void')),
  public_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  body_hash text,                           -- sha256 of body at the moment of signing
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_email text,
  signature_data text,                      -- PNG data URL drawn by the client (or typed-name rendering)
  signer_ip text,
  signer_user_agent text,
  studio_signed_at timestamptz,
  studio_signer_name text,
  studio_signature_data text
);
create index if not exists contracts_booking_idx on public.contracts (booking_table, booking_id);
create index if not exists contracts_status_idx on public.contracts (status, created_at desc);
drop trigger if exists contracts_touch on public.contracts;
create trigger contracts_touch before update on public.contracts for each row execute function public.touch_updated_at();
drop trigger if exists contract_templates_touch on public.contract_templates;
create trigger contract_templates_touch before update on public.contract_templates for each row execute function public.touch_updated_at();
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
drop policy if exists "contract templates admin" on public.contract_templates;
create policy "contract templates admin" on public.contract_templates for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "contracts admin" on public.contracts;
create policy "contracts admin" on public.contracts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- A signed contract can't be edited any more (only voided by an admin).
create or replace function public.contracts_lock_signed() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status in ('signed', 'countersigned') and (new.body is distinct from old.body or new.signature_data is distinct from old.signature_data
      or new.signer_name is distinct from old.signer_name or new.signed_at is distinct from old.signed_at) then
    raise exception 'A signed contract can''t be changed. Void it and send a new one instead.';
  end if;
  return new;
end $$;
drop trigger if exists contracts_lock_signed on public.contracts;
create trigger contracts_lock_signed before update on public.contracts for each row execute function public.contracts_lock_signed();

-- What the client's contract page (/contract/<token>) may read.
create or replace function public.contract_by_token(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.contracts;
begin
  select * into r from public.contracts where public_token = p_token and status not in ('draft', 'void');
  if not found then return null; end if;
  if r.status = 'sent' then update public.contracts set status = 'viewed', viewed_at = now() where id = r.id; r.status := 'viewed'; end if;
  return jsonb_build_object('number', r.number, 'title', r.title, 'client_name', r.client_name, 'body', r.body, 'status', r.status,
    'signed_at', r.signed_at, 'signer_name', r.signer_name, 'signature_data', r.signature_data,
    'studio_signed_at', r.studio_signed_at, 'studio_signer_name', r.studio_signer_name, 'studio_signature_data', r.studio_signature_data);
end $$;
revoke all on function public.contract_by_token(text) from public;
grant execute on function public.contract_by_token(text) to anon, authenticated;
-- (Signing goes through the contract-sign Edge Function, which records IP, user agent and a hash of the text.)
