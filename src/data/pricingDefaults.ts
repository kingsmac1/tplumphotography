/**
 * Session prices (CAD, before GST) used until Supabase is connected; the same rows are seeded into the database
 * (supabase/migrations/20261116000100_portrait_packages.sql). Rows with sample = true show a "Sample: edit me"
 * badge in Dashboard -> Prices only. Nothing here is ever labelled "sample" on the public site.
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
  /** Minutes this extra adds to the session per unit (e.g. "Extra 30 Minutes" = 30). */
  extra_minutes?: number;
  sort_order: number;
  active: boolean;
  sample?: boolean;
};

const pkg = (i: number, service_id: string, name: string, price: number, duration_minutes: number, description: string): PriceRow => ({
  id: `indoor-${service_id}`, setting: "indoor", service_id, name, description, price, pricing_mode: "bundle", duration_minutes, sort_order: i, active: true, sample: false,
});

/** Tplum's portrait packages (client price sheet, 2026-11-16). Prices are before GST; GST is added at checkout. */
export const DEFAULT_BOOKING_PRICES: PriceRow[] = [
  pkg(1, "package-1", "Package 1", 350, 60, "60 Mins Studio Session · Up to 2 Outfits · 7 Highly retouched images · Creative Posing Guidance · Online Gallery"),
  pkg(2, "package-2", "Package 2", 450, 90, "90 Mins Studio Session · Up to 3 Outfits · 7 Highly retouched images · Creative Posing Guidance · Online Gallery"),
  pkg(3, "package-3", "Package 3", 500, 120, "120 Mins Studio Session · Up to 3 Outfits · 9 Highly retouched images · Creative Posing Guidance · Online Gallery"),
];

const extra = (i: number, name: string, description: string, price: number, max_qty: number | null, extra_minutes: number, sample: boolean): ExtraRow => ({
  id: `extra-${i}`, name, description, price, max_qty, follows_package: false, extra_minutes, sort_order: i, active: true, sample,
});

/**
 * Add-ons. The first two are from Tplum's price sheet; "Extra Outfit" and "Rush Delivery" are suggestions, seeded as
 * samples ("Sample: edit me" in the dashboard) until the photographer confirms or turns them off.
 * Unedited images are not offered (price sheet: "No unedited images").
 */
export const DEFAULT_BOOKING_EXTRAS: ExtraRow[] = [
  extra(1, "Additional Edited Images", "Per extra highly retouched image", 25, 20, 0, false),
  extra(2, "Extra 30 Minutes", "Adds 30 minutes to your session", 50, 2, 30, false),
  extra(3, "Extra Outfit", "One more outfit change", 50, 2, 0, true),
  extra(4, "Rush Delivery", "Your edited images within 72 hours", 100, null, 0, true),
];
