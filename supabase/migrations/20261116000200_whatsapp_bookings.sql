-- =====================================================================
-- Bookings go to WhatsApp, no online payment (client decision, 2026-11-16).
-- A website booking is saved (and its slot held) as before, then the client's WhatsApp opens with a message to the
-- business phone in Settings, written out with every detail. Tplum confirms and arranges payment there.
-- Online payment can be switched back on in Settings once Stripe is connected.
-- =====================================================================
alter table public.business_settings alter column online_payments_enabled set default false;
update public.business_settings set online_payments_enabled = false where id = 1;
