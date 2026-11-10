// GENERATED from src/lib/pricing.ts by scripts/sync-shared.mjs — do not edit here.
/**
 * Price, deposit and discount rules — ONE implementation shared by:
 *   - the booking pages (what the client sees),
 *   - the booking-create Edge Function (what is actually charged; a copy lives in
 *     supabase/functions/_shared/pricing.ts, kept identical by scripts/sync-shared.mjs),
 *   - the automated tests (tests/pricing.test.ts).
 * Rules come from DMI's booking pages; money is computed in cents to avoid rounding errors.
 */

export const cents = (n: unknown) => Math.round((Number(n) || 0) * 100);
export const dollars = (c: number) => Math.round(c) / 100;

export type CatalogService = { id: string; name: string; price: number; pricing_mode: string; duration_minutes?: number; setting?: string; description?: string };
export type CatalogExtra = { id?: string; name: string; price: number; max_qty: number | null; follows_package: boolean };
export type Line = { label: string; qty: number; unit: number; total: number };

export type Quote = {
  lines: Line[];
  serviceTotal: number;
  extrasTotal: number;
  subtotal: number;
  discount: number;
  total: number;
};

/** Coupon: a percentage off the package/space price only (never off extras), as on DMI. */
export const couponDiscount = (baseTotal: number, percent: number | null | undefined) =>
  percent && percent > 0 ? dollars(Math.round((cents(baseTotal) * Math.min(100, percent)) / 100)) : 0;

/* ------------------------------ Sessions (Booking page) ------------------------------ */
export type SessionSelection = { serviceId: string; outfits?: number; extras: { name: string; qty?: number }[]; promoPercent?: number | null };

export function quoteSession(sel: SessionSelection, services: CatalogService[], extras: CatalogExtra[]): Quote {
  const svc = services.find((s) => s.id === sel.serviceId);
  if (!svc) throw new PricingError("Please choose a package.");
  const outfits = svc.pricing_mode === "per_outfit" ? clampInt(sel.outfits ?? 1, 1, 20) : 1;
  const serviceC = cents(svc.price) * outfits;
  const lines: Line[] = [{ label: svc.pricing_mode === "per_outfit" ? `${svc.name} × ${outfits} outfit${outfits > 1 ? "s" : ""}` : svc.name, qty: outfits, unit: Number(svc.price), total: dollars(serviceC) }];
  let extrasC = 0;
  const seen = new Set<string>();
  for (const pick of sel.extras ?? []) {
    if (seen.has(pick.name)) continue;
    seen.add(pick.name);
    const ex = extras.find((e) => e.name === pick.name);
    if (!ex) throw new PricingError(`“${pick.name}” is no longer available. Please refresh the page.`);
    const unitC = ex.follows_package ? cents(svc.price) : cents(ex.price);
    const qty = ex.max_qty ? clampInt(pick.qty ?? 1, 1, ex.max_qty) : 1;
    extrasC += unitC * qty;
    lines.push({ label: ex.max_qty ? `${ex.name} ×${qty}` : ex.name, qty, unit: dollars(unitC), total: dollars(unitC * qty) });
  }
  return finish(lines, serviceC, extrasC, sel.promoPercent);
}

/* ------------------------------ Weddings ------------------------------ */
export type WeddingCatalogPackage = { id: string; name: string; one_event: number; two_events: number | null };
export type WeddingSelection = { packageId: string; days: "one" | "two"; extras: string[]; promoPercent?: number | null };

export function quoteWedding(sel: WeddingSelection, packages: WeddingCatalogPackage[], extras: { name: string; price: number }[]): Quote {
  const pkg = packages.find((p) => p.id === sel.packageId);
  if (!pkg) throw new PricingError("Please choose a wedding package.");
  const two = sel.days === "two" && pkg.two_events != null;
  const baseC = cents(two ? pkg.two_events : pkg.one_event);
  const lines: Line[] = [{ label: `${pkg.name} — ${two ? "two days" : "one day"}`, qty: 1, unit: dollars(baseC), total: dollars(baseC) }];
  let extrasC = 0;
  for (const name of [...new Set(sel.extras ?? [])]) {
    const ex = extras.find((e) => e.name === name);
    if (!ex) throw new PricingError(`“${name}” is no longer available. Please refresh the page.`);
    extrasC += cents(ex.price);
    lines.push({ label: ex.name, qty: 1, unit: Number(ex.price), total: Number(ex.price) });
  }
  return finish(lines, baseC, extrasC, sel.promoPercent);
}

/* ------------------------------ Studio space rental ------------------------------ */
export type StudioCatalogSpace = { id: string; name: string; price: number; duration_minutes: number };
export type StudioCatalogExtra = { id: string; name: string; price: number; max_qty: number | null; follows_package: boolean };
export type StudioSelection = { spaceId: string; extras: { id: string; qty?: number }[]; promoPercent?: number | null };

export function quoteStudio(sel: StudioSelection, spaces: StudioCatalogSpace[], extras: StudioCatalogExtra[]): Quote & { durationMinutes: number } {
  const sp = spaces.find((s) => s.id === sel.spaceId);
  if (!sp) throw new PricingError("Please choose a space.");
  const spaceC = cents(sp.price);
  const lines: Line[] = [{ label: sp.name, qty: 1, unit: dollars(spaceC), total: dollars(spaceC) }];
  let extrasC = 0;
  let duration = sp.duration_minutes;
  const seen = new Set<string>();
  for (const pick of sel.extras ?? []) {
    if (seen.has(pick.id)) continue;
    seen.add(pick.id);
    const ex = extras.find((e) => e.id === pick.id);
    if (!ex) throw new PricingError("One of the extras is no longer available. Please refresh the page.");
    const qty = ex.max_qty ? clampInt(pick.qty ?? 1, 1, ex.max_qty) : 1;
    const unitC = ex.follows_package ? spaceC : cents(ex.price);
    if (ex.follows_package) duration += sp.duration_minutes * qty; // "Extra hour" also lengthens the booking
    extrasC += unitC * qty;
    lines.push({ label: ex.max_qty ? `${ex.name} ×${qty}` : ex.name, qty, unit: dollars(unitC), total: dollars(unitC * qty) });
  }
  return { ...finish(lines, spaceC, extrasC, sel.promoPercent), durationMinutes: duration };
}

/* ------------------------------ Deposit ------------------------------ */
export type DepositRules = { deposit_mode: string; deposit_percent: number; deposit_fixed: number };

/** What the client pays now. Never more than the total, never negative; full = the whole total. */
export function depositFor(total: number, rules: DepositRules): number {
  const t = cents(total);
  if (t <= 0) return 0;
  if (rules.deposit_mode === "full") return dollars(t);
  if (rules.deposit_mode === "fixed") return dollars(Math.min(t, Math.max(0, cents(rules.deposit_fixed))));
  const pct = Math.min(100, Math.max(0, Number(rules.deposit_percent) || 0));
  return dollars(Math.min(t, Math.round((t * pct) / 100)));
}

/** Balance still owed after what has been paid. */
export const balanceDue = (total: number, paid: number) => dollars(Math.max(0, cents(total) - cents(paid)));

/* ------------------------------ helpers ------------------------------ */
export class PricingError extends Error {}

function clampInt(n: unknown, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function finish(lines: Line[], baseC: number, extrasC: number, promoPercent?: number | null): Quote {
  const discountC = cents(couponDiscount(dollars(baseC), promoPercent));
  const subtotalC = baseC + extrasC;
  return {
    lines,
    serviceTotal: dollars(baseC),
    extrasTotal: dollars(extrasC),
    subtotal: dollars(subtotalC),
    discount: dollars(discountC),
    total: dollars(subtotalC - discountC),
  };
}
