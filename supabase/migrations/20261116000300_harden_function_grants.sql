-- =====================================================================
-- Tighten who can call SECURITY DEFINER functions through the API (Supabase security advisor, 2026-11-16).
-- Trigger functions only ever run as triggers, and recalc_booking_payment is called by Edge Functions with the
-- service role, so none of them needs to be callable via /rest/v1/rpc. Triggers keep working without EXECUTE.
-- The public RPCs the site uses (availability, promos, invoice/contract by token, is_admin…) are unchanged.
-- =====================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.booking_delivered_from_gallery()', 'public.bookings_slot_guard()', 'public.gallery_selection_rules()',
    'public.handle_new_user()', 'public.handle_user_email_change()', 'public.log_booking_created()',
    'public.staff_admin_guard()', 'public.sync_profile_role()', 'public.recalc_booking_payment(text, uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
  -- Marking overdue invoices is a dashboard action: signed-in users only, never anonymous visitors.
  if to_regprocedure('public.mark_overdue_invoices()') is not null then
    revoke execute on function public.mark_overdue_invoices() from public, anon;
    grant execute on function public.mark_overdue_invoices() to authenticated, service_role;
  end if;
end $$;
