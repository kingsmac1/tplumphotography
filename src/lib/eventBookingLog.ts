/** Record shape for this form (DMI). Submissions go through the Edge Functions (see src/lib/bookingLog.ts). */
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
