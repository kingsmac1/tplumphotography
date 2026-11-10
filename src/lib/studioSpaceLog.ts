/** Record shape for this form (DMI). Submissions go through the Edge Functions (see src/lib/bookingLog.ts). */
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
