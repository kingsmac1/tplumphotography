// Shared dropdown options for the admin manual-entry forms.
// Mirrors the public-facing Booking form (src/pages/Booking.tsx) so the data
// the admin enters matches what the public forms would write.

export const shootTypes = [
  "Portrait",
  "Wedding",
  "Pre-Wedding",
  "Birthday",
  "Graduation",
  "Fashion/Editorial",
  "Product",
  "Event",
  "Corporate",
  "Family",
];

export const genderOptions = ["Male", "Female", "Prefer not to say"];

export const locationOptions = ["Lagos", "Abuja", "Uyo", "Other"];

export const settingOptions = ["Indoor", "Outdoor"];

export const platformOptions = [
  "Instagram",
  "Twitter",
  "TikTok",
  "Facebook",
  "YouTube",
  "LinkedIn",
];

// Service bundles differ by location; these are the service names used in the
// rate card. Other is included so the admin can type a custom one.
export const serviceOptions = [
  "Individual",
  "Couple",
  "Group/Family",
  "Other",
];

// Per-location extras. Matches what the public form surfaces.
export const extrasOptions = [
  "30-second Reel",
  "Extra Edited Picture",
  "All Unedited Photos",
];

export const paymentStatusOptions = ["Not Paid", "Part Payment", "Paid"];

// Academy payment is tracked more finely than a plain paid/not-paid, since students often
// pay in two installments — "Part Payment" and "Full Payment" both count as revenue received.
export const academyPaymentStatusOptions = ["Not Paid", "Part Payment", "Full Payment"];

// Academy form options
export const trainedBeforeOptions = ["yes", "no"];
export const ownsGearOptions = ["yes", "no"];
export const hasInterestAreaOptions = ["yes", "no"];
export const acceptOptions = ["yes", "no", "pending"];

// Helper: format Naira
export const formatMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
  }).format(n || 0);