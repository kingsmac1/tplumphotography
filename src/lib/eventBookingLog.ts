import { supabase } from "@/lib/supabaseClient";

// Same Apps Script deployment the other forms use — it branches on `source` to email the
// right people without touching the photography "Bookings" sheet.
const SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxQjqTviqytGOdSefqOcClugv2WHnlL94gxm2HctyNEtG3jlzBZhulfYfmPUICATXUWkA/exec";

export type EventBookingPayload = {
  full_name: string;
  phone: string;
  email: string;
  event_type: string;
  event_start_date: string;
  event_end_date: string;
  event_time: string;
  venue: string;
  expected_guests: string;
  agreed_amount: string;
  notes: string;
  source: string;
};

/** Posts to the Apps Script web app, which emails the client and the studio owner(s). */
export const logEventBookingToSheet = async (payload: EventBookingPayload) => {
  const data = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => data.append(key, String(value)));
  try {
    await fetch(SHEET_WEB_APP_URL, { method: "POST", mode: "no-cors", body: data });
  } catch (err) {
    console.error("Event booking sheet log failed:", err);
  }
};

/** Writes the event request into Supabase, powering the admin dashboard and Finance page. */
export const logEventBookingToSupabase = async (payload: EventBookingPayload) => {
  const { error } = await supabase.from("event_bookings").insert({
    full_name: payload.full_name,
    phone: payload.phone,
    email: payload.email || null,
    event_type: payload.event_type,
    event_start_date: payload.event_start_date || null,
    event_end_date: payload.event_end_date || null,
    event_time: payload.event_time || null,
    venue: payload.venue || null,
    expected_guests: Number(payload.expected_guests) || null,
    agreed_amount: Number(payload.agreed_amount) || 0,
    notes: payload.notes || null,
    payment_status: "Not Paid",
    source: payload.source,
  });
  if (error) console.error("Supabase event booking insert failed:", error);
};
