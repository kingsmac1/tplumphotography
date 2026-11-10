import { callFunction } from "@/lib/functions";

/**
 * Client side of the booking flow. DMI wrote bookings straight into the table (and to a Google Sheet);
 * Tplum sends the client's choices to the `booking-create` Edge Function instead, which:
 *   1. validates every field (same rules as the form),
 *   2. recalculates the price from the database (never trusts the browser),
 *   3. inserts the booking (the database refuses a taken slot, errcode 23P01 -> "slot_taken"),
 *   4. starts Stripe Checkout for the deposit (when online payments are on) and returns its URL,
 *   5. emails the client and the studio.
 */

/** Flat booking record (DMI's BookingPayload, WhatsApp number renamed to phone). */
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
  notes?: string;
};

export type CreateBookingRequest =
  | { kind: "session"; serviceId: string; setting: string; outfits: number; extras: { name: string; qty: number }[]; promoCode: string; client: BookingPayload; returnUrl: string }
  | { kind: "wedding"; packageId: string; days: "one" | "two"; extras: string[]; promoCode?: string; client: BookingPayload; returnUrl: string }
  | { kind: "studio"; spaceId: string; extras: { id: string; qty: number }[]; promoCode: string; client: { full_name: string; phone: string; email: string; rental_date: string; rental_time: string; notes: string }; returnUrl: string };

export type CreateBookingResult =
  | { ok: true; bookingId: string; reference: string; total: number; deposit: number; checkoutUrl: string | null }
  | { ok: false; error: string; code?: string };

export async function createBooking(req: CreateBookingRequest): Promise<CreateBookingResult> {
  const res = await callFunction<{ bookingId: string; reference: string; total: number; deposit: number; checkoutUrl: string | null; code?: string }>("booking-create", req);
  if (!res.ok) return { ok: false, error: res.error, code: /taken|23P01/i.test(res.error) ? "slot_taken" : undefined };
  return { ok: true, ...res.data };
}
