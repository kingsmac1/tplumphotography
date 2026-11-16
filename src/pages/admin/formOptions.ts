// Shared dropdown options for the admin manual-entry forms.
// Mirrors the public-facing Booking form (src/pages/Booking.tsx) so the data
// the admin enters matches what the public forms would write.

export const shootTypes = [
  "Wedding",
  "Engagement",
  "Portrait",
  "Maternity",
  "Proposal",
  "Family",
  "Vow Renewal",
  "Studio Portrait",
  "Corporate Event",
  "Event",
];

export const genderOptions = ["Male", "Female", "Prefer not to say"];

// No branch/location list in Tplum (DMI had Lagos/Abuja/Uyo). The booking keeps a free-text venue/city instead.
export const locationOptions: string[] = [];

export const settingOptions = ["Indoor", "Outdoor"];

export const platformOptions = [
  "Instagram",
  "Twitter",
  "TikTok",
  "Facebook",
  "YouTube",
  "LinkedIn",
];

// Service names used in the rate card (Dashboard -> Prices). Other lets the admin type a custom one.
export const serviceOptions = [
  "Studio Portrait · Individual",
  "Studio Portrait · Couple",
  "Maternity · Studio",
  "Family & Group",
  "Engagement Session",
  "Portrait · On Location",
  "Maternity · On Location",
  "Proposal Coverage",
  "Wedding",
  "Other",
];

// Session extras (match the public booking form).
export const extrasOptions = [
  "Extra Edited Picture",
  "Extra Outfit",
  "30-second Reel",
  "All Unedited Photos",
  "Rush Delivery",
];

export const paymentStatusOptions = ["Not Paid", "Part Payment", "Paid"];


// Helper: format Canadian dollars
export const formatMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: Number.isInteger(n || 0) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n || 0);