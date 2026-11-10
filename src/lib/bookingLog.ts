import { supabase } from "@/lib/supabaseClient";

const SHEET_WEB_APP_URL =
  "" /* DMI Google Sheet removed: Tplum logs bookings in Supabase only */;

/** Flat, string-valued booking record shared by the booking and wedding forms. */
export type BookingPayload = {
  full_name: string;
  gender: string;
  shoot_type: string;
  shoot_date: string;
  shoot_time: string;
  phone: string;
  email: string;
  date_of_birth: string;
  social_handles: string;
  inspiration_links: string;
  location: string;
  shoot_setting: string;
  selected_service: string;
  service_price: string;
  service_pricing_mode: string;
  outfits: string;
  selected_extras: string;
  extra_edited_count: string;
  service_total: string;
  extras_total: string;
  grand_total: string;
  service_summary: string;
  source: string;
};

/**
 * Posts the booking to the Google Apps Script web app, which appends the Sheet row
 * and adds the shoot date to Google Calendar. Emails are sent by Resend from Supabase.
 */
export const logToSheet = async (payload: BookingPayload) => {
  const data = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => data.append(key, String(value)));
  try {
    await fetch(SHEET_WEB_APP_URL, { method: "POST", mode: "no-cors", body: data });
  } catch (err) {
    console.error("Booking sheet log failed:", err);
  }
};

/** Writes the same booking into Supabase, powering the admin dashboard. Returns the error, if any. */
/** `id`: set by the booking form so its inspiration images can be tagged with the booking (the public can't read a row back). */
export const logToSupabase = async (payload: BookingPayload, id?: string) => {
  const { error } = await supabase.from("bookings").insert({
    ...(id ? { id } : {}),
    full_name: payload.full_name,
    gender: payload.gender,
    shoot_type: payload.shoot_type,
    shoot_date: payload.shoot_date || null,
    shoot_time: payload.shoot_time || null,
    phone: payload.phone,
    email: payload.email,
    date_of_birth: payload.date_of_birth || null,
    social_handles: payload.social_handles,
    inspiration_links: payload.inspiration_links,
    location: payload.location,
    shoot_setting: payload.shoot_setting,
    selected_service: payload.selected_service,
    service_price: Number(payload.service_price) || null,
    service_pricing_mode: payload.service_pricing_mode,
    outfits: Number(payload.outfits) || null,
    selected_extras: payload.selected_extras,
    extra_edited_count: Number(payload.extra_edited_count) || null,
    service_total: Number(payload.service_total) || null,
    extras_total: Number(payload.extras_total) || null,
    grand_total: Number(payload.grand_total) || null,
    service_summary: payload.service_summary,
    source: payload.source,
  });
  if (error) console.error("Supabase booking insert failed:", error);
  return error;
};
