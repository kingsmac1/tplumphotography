import { supabase } from "@/lib/supabaseClient";

// Same Apps Script deployment the main booking form uses — it branches on `source`
// to email the right people without touching the "Bookings" sheet.
const SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxQjqTviqytGOdSefqOcClugv2WHnlL94gxm2HctyNEtG3jlzBZhulfYfmPUICATXUWkA/exec";

export type StudioSpacePayload = {
  full_name: string;
  phone: string;
  email: string;
  rental_date: string;
  rental_time: string;
  space_name: string;
  space_price: string;
  duration_minutes: string;
  selected_extras: string;
  extras_total: string;
  space_total: string;
  grand_total: string;
  notes: string;
  source: string;
};

/** Posts to the Apps Script web app, which emails the client and the studio owner(s). */
export const logStudioSpaceToSheet = async (payload: StudioSpacePayload) => {
  const data = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => data.append(key, String(value)));
  try {
    await fetch(SHEET_WEB_APP_URL, { method: "POST", mode: "no-cors", body: data });
  } catch (err) {
    console.error("Studio space sheet log failed:", err);
  }
};

/** Writes the rental request into Supabase, powering the admin dashboard and Revenue page. */
export const logStudioSpaceToSupabase = async (payload: StudioSpacePayload) => {
  const { error } = await supabase.from("studio_bookings").insert({
    full_name: payload.full_name,
    phone: payload.phone,
    email: payload.email || null,
    rental_date: payload.rental_date || null,
    rental_time: payload.rental_time || null,
    space_name: payload.space_name,
    space_price: Number(payload.space_price) || 0,
    duration_minutes: Number(payload.duration_minutes) || 30,
    selected_extras: payload.selected_extras,
    extras_total: Number(payload.extras_total) || 0,
    space_total: Number(payload.space_total) || 0,
    grand_total: Number(payload.grand_total) || 0,
    notes: payload.notes,
    payment_status: "Not Paid",
    source: payload.source,
  });
  if (error) console.error("Supabase studio space insert failed:", error);
};
