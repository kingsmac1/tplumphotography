-- =====================================================================
-- Tplum portrait packages (client price sheet, 2026-11-16), GST on bookings, and add-ons that lengthen a session.
--   Package 1  C$350 + GST · 60 mins · up to 2 outfits · 7 retouched images
--   Package 2  C$450 + GST · 90 mins · up to 3 outfits · 7 retouched images
--   Package 3  C$500 + GST · 120 mins · up to 3 outfits · 9 retouched images
--   Add-ons: Additional Edited Images ($25 each) · Extra 30 Minutes ($50) · no unedited images
-- Everything here is editable in the dashboard (Prices & Packages, Settings); nothing is hard-coded in the site.
-- =====================================================================

-- Add-ons that add time to the session (e.g. "Extra 30 Minutes" = 30 per unit). The booking's calendar slot grows to match.
alter table public.booking_extras add column if not exists extra_minutes integer not null default 0 check (extra_minutes between 0 and 480);

-- Sales tax on website bookings (prices are shown "+ GST"). On by default at 5% GST; can be switched off or renamed (e.g. HST).
alter table public.business_settings add column if not exists booking_tax_enabled boolean not null default true;
alter table public.business_settings add column if not exists booking_tax_name text not null default 'GST';
alter table public.business_settings add column if not exists booking_tax_rate numeric(5,2) not null default 5 check (booking_tax_rate >= 0 and booking_tax_rate <= 30);
-- A short note shown under the add-ons on the Booking page.
alter table public.business_settings add column if not exists session_note text not null default 'No unedited images.';

-- What was charged as tax on each booking (kept with the booking for invoices and reports).
alter table public.bookings add column if not exists tax_total numeric(10,2) not null default 0;
alter table public.bookings add column if not exists tax_name text not null default '';

-- Seed the packages and add-ons the first time (an existing price list is never overwritten).
insert into public.booking_prices (setting, service_id, name, description, price, pricing_mode, duration_minutes, sort_order, active, sample)
select * from (values
  ('indoor', 'package-1', 'Package 1', '60 Mins Studio Session · Up to 2 Outfits · 7 Highly retouched images · Creative Posing Guidance · Online Gallery', 350.00, 'bundle', 60, 1, true, false),
  ('indoor', 'package-2', 'Package 2', '90 Mins Studio Session · Up to 3 Outfits · 7 Highly retouched images · Creative Posing Guidance · Online Gallery', 450.00, 'bundle', 90, 2, true, false),
  ('indoor', 'package-3', 'Package 3', '120 Mins Studio Session · Up to 3 Outfits · 9 Highly retouched images · Creative Posing Guidance · Online Gallery', 500.00, 'bundle', 120, 3, true, false)
) as v(setting, service_id, name, description, price, pricing_mode, duration_minutes, sort_order, active, sample)
where not exists (select 1 from public.booking_prices);

insert into public.booking_extras (name, description, price, max_qty, follows_package, extra_minutes, sort_order, active, sample)
select * from (values
  ('Additional Edited Images', 'Per extra highly retouched image', 25.00, 20, false, 0, 1, true, false),
  ('Extra 30 Minutes', 'Adds 30 minutes to your session', 50.00, 2, false, 30, 2, true, false),
  -- suggestions, not on the price sheet: shown with "Sample: edit me" in the dashboard until confirmed or turned off
  ('Extra Outfit', 'One more outfit change', 50.00, 2, false, 0, 3, true, true),
  ('Rush Delivery', 'Your edited images within 72 hours', 100.00, null::integer, false, 0, 4, true, true)
) as v(name, description, price, max_qty, follows_package, extra_minutes, sort_order, active, sample)
where not exists (select 1 from public.booking_extras);
