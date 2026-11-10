/**
 * SAMPLE prices (CAD) used only until Supabase is connected; the same rows are seeded into the database
 * (supabase/migrations/..._seed_sample_prices.sql) with sample = true, which shows a "Sample: edit me"
 * badge in Dashboard -> Prices. Nothing here is ever labelled "sample" on the public site.
 * No location/branch dimension (DMI had Lagos/Abuja/Uyo; Tplum has none).
 */
export type PriceRow = {
  id: string;
  setting: string;
  service_id: string;
  name: string;
  description: string;
  price: number;
  pricing_mode: string;
  duration_minutes: number;
  sort_order: number;
  active: boolean;
  sample?: boolean;
};

export type ExtraRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  max_qty: number | null;
  follows_package: boolean;
  sort_order: number;
  active: boolean;
  sample?: boolean;
};

const row = (setting: "indoor" | "outdoor", i: number, service_id: string, name: string, price: number, description: string): PriceRow => ({
  id: `${setting}-${service_id}`, setting, service_id, name, description, price, pricing_mode: "bundle", duration_minutes: 60, sort_order: i, active: true, sample: true,
});

export const DEFAULT_BOOKING_PRICES: PriceRow[] = [
  row("indoor", 1, "portrait-individual", "Studio Portrait · Individual", 250, "1 hour · 1 outfit · 15 edited images"),
  row("indoor", 2, "portrait-couple", "Studio Portrait · Couple", 325, "1 hour · 2 outfits · 20 edited images"),
  row("indoor", 3, "maternity-studio", "Maternity · Studio", 350, "1 hour · 2 outfits · 20 edited images"),
  row("indoor", 4, "family", "Family & Group", 400, "1 hour · up to 6 people · 25 edited images"),
  row("outdoor", 1, "engagement", "Engagement Session", 450, "1 hour on location · 30 edited images"),
  row("outdoor", 2, "portrait-location", "Portrait · On Location", 350, "1 hour · 2 outfits · 20 edited images"),
  row("outdoor", 3, "maternity-location", "Maternity · On Location", 400, "1 hour · 2 outfits · 25 edited images"),
  row("outdoor", 4, "proposal", "Proposal Coverage", 500, "Up to 1 hour · hidden coverage · 40 edited images"),
];

const extra = (i: number, name: string, description: string, price: number, max_qty: number | null = null, follows_package = false): ExtraRow => ({
  id: `extra-${i}`, name, description, price, max_qty, follows_package, sort_order: i, active: true, sample: true,
});

export const DEFAULT_BOOKING_EXTRAS: ExtraRow[] = [
  extra(1, "Extra Edited Picture", "Per additional retouched photo", 25, 20),
  extra(2, "Extra Outfit", "Per additional outfit change", 75, 3),
  extra(3, "30-second Reel", "Short-form video edit for social media", 150),
  extra(4, "All Unedited Photos", "Every unedited image from your session", 200),
  extra(5, "Rush Delivery", "Edited gallery within 72 hours", 100),
];
