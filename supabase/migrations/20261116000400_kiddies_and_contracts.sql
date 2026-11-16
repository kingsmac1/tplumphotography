-- =====================================================================
-- Tplum Kiddies (client price sheet + terms, 2026-11-16) and the contract templates (from Tplum's signed wedding contract).
--   tplumkiddies 1  C$350 · 60 mins · 6 edited high-resolution images · 1–2 outfits · all props except outfits
--   tplumkiddies 2  C$500 · 90 mins · 8 edited high-resolution images · 1–3 outfits incl. family photos if time permits
-- Kiddies is a fourth booking category next to Weddings, Portrait & Family and Events. It shares the session
-- calendar with portraits (one studio, one photographer), has its own packages and its own terms, which are shown
-- on the booking page, printed on invoices for kiddies bookings and filled into the Kiddies contract.
-- Everything is editable in the dashboard (Prices & Packages, Settings, Contracts → Templates).
-- =====================================================================

-- Packages: a third "setting" next to studio / on location.
alter table public.booking_prices drop constraint if exists booking_prices_setting_check;
alter table public.booking_prices add constraint booking_prices_setting_check check (setting in ('indoor', 'outdoor', 'kiddies'));

-- Add-ons belong to portrait sessions, kiddies sessions or both. Existing add-ons stay portrait-only.
alter table public.booking_extras add column if not exists category text not null default 'portrait';
alter table public.booking_extras drop constraint if exists booking_extras_category_check;
alter table public.booking_extras add constraint booking_extras_category_check check (category in ('portrait', 'kiddies', 'all'));

-- The kiddies terms (one point per line starting with •), edited in Dashboard → Settings.
alter table public.business_settings add column if not exists kiddies_terms text not null default '';
update public.business_settings set kiddies_terms = $terms$• For the best experience and quality photos, parents agree that the baby is well-fed, rested and has taken a nap before the photoshoot. Let us know the time that works best for your baby's happiest moments.
• If you would like your baby's hair styled for the session, please ensure it is done before arriving for the shoot, or arrive 30 minutes before the shoot to do this, as it could impact the shoot hour you've booked. The shoot starts promptly at the hour booked.
• The full payment for the booked hour(s) is required, regardless of the number of outfits photographed.
• It is important that pictures of your baby's outfits are sent to us at least three weeks before the shoot to allow time for planning and, if necessary, customizing props.
• We recommend that you arrive 30 minutes prior to your scheduled shoot time to allow your child to acclimate to the environment and to prepare for the session. The shoot will begin promptly at the scheduled time.
• We recommend that both parents, or another accompanying individual, be present during the shoot to support and comfort the baby, as well as to ensure the baby's safety throughout the session.
• A non-refundable retainer of $150 is required to confirm your booking. The remaining balance is due on the day of the photo shoot.
• The images selected by the client for editing will be delivered within 5 to 7 days.
• All images will be delivered via Google Drive. It is the client's responsibility to download and securely save the pictures within two weeks. After this period, the link will expire, and we will be unable to resend the images.
• tplumkiddies reserves the right to use photos taken during the session to showcase our work on our website and social media channels. We appreciate your understanding and support.

Please be advised that your non-refundable retainer of $150 signifies your consent and agreement to the above information.
Interac e-Transfer for bookings: tplumenterprises@gmail.com$terms$
where id = 1 and kiddies_terms = '';

insert into public.booking_prices (setting, service_id, name, description, price, pricing_mode, duration_minutes, sort_order, active, sample)
select v.* from (values
  ('kiddies', 'kiddies-1', 'tplumkiddies 1', '60 Minutes Session · 6 edited high resolution images · 1–2 outfits · All props provided except outfits', 350.00, 'bundle', 60, 1, true, false),
  ('kiddies', 'kiddies-2', 'tplumkiddies 2', '90 Minutes Session · 8 edited high resolution images · 1–3 outfits, including family photos if time permits · All props provided except outfits', 500.00, 'bundle', 90, 2, true, false)
) as v(setting, service_id, name, description, price, pricing_mode, duration_minutes, sort_order, active, sample)
where not exists (select 1 from public.booking_prices where setting = 'kiddies');

-- ---------- Contract templates ----------
-- Body format (see ContractText): "Label:: value" lines = the details block, "## " = section, "### " = sub-heading,
-- "- " or "• " = bullet, **bold**. {{placeholders}} are filled from the booking when a contract is created.
insert into public.contract_templates (name, body, sample, active)
select 'Wedding Photography Contract', $body$Couple:: {{client_name}}
Wedding date:: {{event_date}}
Location:: {{venue}}

This contract is designed to outline the terms and conditions governing the documentation of your wedding and the delivery of high-quality pictures. Should you have any questions, concerns, or requests for amendments, please contact us prior to signing this agreement.

## Description (Photography)

{{package_details}}

## Payment and Retainer

### Contract activation
The contract becomes effective only after the client pays a non-refundable, non-transferable retainer fee.

### Total fee
- Wedding coverage: **{{coverage}}**
- {{tax_label}}: {{tax}}
- Total amount: **{{total}}**

The retainer fee is 20% of the total amount, which in this case is **{{retainer}}**.

### Reservation commitment
Once this contract is in effect and the retainer has been received, **Tplum Photography** will reserve the agreed date and time exclusively and will not accept any other bookings for that date.

### Payment schedule
- **Second payment:** 30% (**{{second_payment}}**) due by {{second_payment_due}}.
- **Final payment:** the remaining 50% (**{{final_payment}}**) due by {{final_payment_due}}.

### Cancellation terms
In the event of cancellation by the Client for any reason, all payments made will be retained by **Tplum Photography** as compensation for the reserved date and potential loss of business.

However, if a replacement booking for the same date is secured by **Tplum Photography**, a partial or full refund may be issued at our discretion, depending on the value of the replacement booking.

We kindly request that the Client provide as much advance notice as possible for any cancellations or requests to reschedule, so that we may have the opportunity to accommodate other clients.

### Payment information
- Interac e-Transfer: **tplumenterprises@gmail.com**

## Terms and Conditions

### Event information
The Client agrees to provide a brief overview of the wedding schedule and expectations prior to the event to allow the Photographer to prepare accordingly.

### Photography team
The Client acknowledges and agrees that Tplum Photography operates as a professional photography team. Services will be delivered by the lead photographer, along with designated team members as required.

### Portrait session location
The Client agrees to provide an appropriate and aesthetically pleasing location (such as a hotel, residence, or apartment) for the portrait session. A suitable environment significantly contributes to the overall quality of the photographs.

### Time allocation for portraits
The Photographer shall not be held liable for failure to capture portraits of the couple if sufficient time is not allocated for the portrait session. It is strongly recommended that the Client allocate a minimum of 1 hour and 45 minutes for the portrait session and key moments such as the First Look before the main event begins.

### Guest interference
The Photographer shall not be held responsible for compromised photos caused by interference from guests during key moments such as entrances or the first dance. The Client is encouraged to coordinate with the Master of Ceremonies (MC) to prevent such interference.

### Venue restrictions
The Client acknowledges that the Photographer may be subject to restrictions imposed by the venue, including places of worship such as churches or mosques. The Photographer shall not be held liable for missed shots caused by such restrictions.

### Photo schedule and organization
The Client agrees to include key photo sessions, including family and friends' group portraits with the couple, in the wedding timeline, particularly after the church ceremony or during the reception. The Photographer shall not be liable for any missed photos due to scheduling delays, poor coordination, or unavailability of individuals.

### Accommodation
The Client agrees to provide accommodation for the team if the event is outside Calgary or requires travel.

### Meals for the Photographer
If coverage exceeds four (4) hours, the Client agrees to provide a meal for the Photographer during the event.

### Copyright and personal use
Upon delivery, the Client receives personal usage rights to the photographs, allowing them to share, print, and use the materials for personal purposes.

Copyright ownership remains with Tplum Photography, which reserves the right to use images and videos for portfolio, website, and promotional purposes.

### Photography delivery timeline
Final edited photographs will be delivered within four (4) weeks after the event. Upon request, up to ten (10) images may be edited and delivered within a few days for social media sharing.

## Agreement

Please remember to submit the **retainer fee** to confirm and secure your booking.

By signing below, the Client and Tplum Photography agree to this Photography Contract, effective from the date it is signed by both parties.

Thank you for your business.$body$, false, true
where not exists (select 1 from public.contract_templates where name = 'Wedding Photography Contract');

insert into public.contract_templates (name, body, sample, active)
select 'Tplum Kiddies Session Agreement', $body$Parent / guardian:: {{client_name}}
Session date:: {{event_date}}
Session time:: {{event_time}}
Package:: {{package}}

Capturing the innocence, preserving the moments. This agreement sets out what is included in your Tplum Kiddies session and the terms that apply to it. Please read it well, and contact us before signing if you have any questions.

## Your session

{{package_details}}

## Fees

- Session: **{{coverage}}**
- {{tax_label}}: {{tax}}
- Total: **{{total}}**

A non-refundable retainer of **$150** is required to confirm your booking. The remaining balance of **{{kiddies_balance}}** is due on the day of the photo shoot.

### Payment information
- Interac e-Transfer: **tplumenterprises@gmail.com**

## Terms and Conditions

{{kiddies_terms}}

## Agreement

By signing below, the parent or guardian agrees to the terms above.

We are empathetic and deeply care about our clients, striving to create exceptional images with customized props.$body$, false, true
where not exists (select 1 from public.contract_templates where name = 'Tplum Kiddies Session Agreement');

-- Kiddies and portrait sessions share one calendar: the double-booking guard covers both kinds of website booking.
create or replace function public.bookings_slot_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare s timestamp; e timestamp;
begin
  if new.source not in ('booking_form', 'kiddies_form') or new.shoot_date is null or new.shoot_time is null then
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
-- keep it out of the public API (as hardened in 20261116000300)
revoke execute on function public.bookings_slot_guard() from public, anon, authenticated;
grant execute on function public.bookings_slot_guard() to service_role;
