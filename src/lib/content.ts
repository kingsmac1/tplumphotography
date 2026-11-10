import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { DEFAULT_BOOKING_EXTRAS, DEFAULT_BOOKING_PRICES, type ExtraRow, type PriceRow } from "@/data/pricingDefaults";
import { DEFAULT_WEDDING_EXTRAS, DEFAULT_WEDDING_PACKAGES, type WeddingExtra, type WeddingPackage } from "@/data/weddingDefaults";
import { DEFAULT_STUDIO_SPACE_EXTRAS, DEFAULT_STUDIO_SPACE_PRICES, type StudioSpaceExtra, type StudioSpaceOption } from "@/data/studioSpaceDefaults";

/**
 * Prices the photographer manages in Dashboard -> Prices (ported from DMI's lib/content.ts).
 * Always read from the database; the sample defaults are only used before Supabase is connected
 * (Phase A preview) or if the database can't be reached. Prices shown here are for display:
 * every amount charged is recalculated on the server (booking-create Edge Function).
 */
const cache = new Map<string, unknown>();
export const resetContentCache = () => cache.clear();
/** Kept for DMI compatibility: prices are always database-managed in this project. */
export const markManaged = async (_key: string) => { cache.clear(); };

const load = async <T,>(key: string, fetcher: () => Promise<T | null>, fallback: T): Promise<T> => {
  if (cache.has(key)) return cache.get(key) as T;
  if (!isSupabaseConfigured) return fallback;
  const work = fetcher().then((d) => { if (d === null) return fallback; cache.set(key, d); return d; }).catch(() => fallback);
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 5000));
  return Promise.race([work, timeout]);
};

const useManaged = <T,>(key: string, fetcher: () => Promise<T | null>, fallback: T) => {
  const [state, setState] = useState<{ loaded: boolean; data: T }>({ loaded: cache.has(key), data: (cache.get(key) as T | undefined) ?? fallback });
  useEffect(() => {
    let cancelled = false;
    load(key, fetcher, fallback).then((data) => { if (!cancelled) setState({ loaded: true, data }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
};

/* ---------------- Session prices (booking flow) ---------------- */
type BookingPricing = { services: PriceRow[]; extras: ExtraRow[] };
export const useBookingPricing = () => {
  const { loaded, data } = useManaged<BookingPricing>(
    "booking_prices",
    async () => {
      const [s, e] = await Promise.all([
        supabase.from("booking_prices").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("booking_extras").select("*").eq("active", true).order("sort_order", { ascending: true }),
      ]);
      if (s.error || e.error) return null;
      return { services: (s.data ?? []) as PriceRow[], extras: (e.data ?? []) as ExtraRow[] };
    },
    { services: DEFAULT_BOOKING_PRICES, extras: DEFAULT_BOOKING_EXTRAS },
  );
  return { loaded, ...data };
};

/* ---------------- Wedding packages ---------------- */
type WeddingPricing = { packages: WeddingPackage[]; extras: WeddingExtra[] };
export const useWeddingPricing = () => {
  const { loaded, data } = useManaged<WeddingPricing>(
    "wedding_prices",
    async () => {
      const [p, e] = await Promise.all([
        supabase.from("wedding_packages").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("wedding_extras").select("*").eq("active", true).order("sort_order", { ascending: true }),
      ]);
      if (p.error || e.error) return null;
      return {
        packages: (p.data ?? []).map((r) => ({
          id: r.id, name: r.name, tagline: r.tagline, includes: r.includes ?? [], oneEvent: Number(r.one_event),
          twoEvents: r.two_events == null ? undefined : Number(r.two_events), singlePrice: r.two_events == null ? Number(r.one_event) : undefined, featured: r.featured,
        })),
        extras: (e.data ?? []).map((r) => ({ name: r.name, price: Number(r.price) })),
      };
    },
    { packages: DEFAULT_WEDDING_PACKAGES, extras: DEFAULT_WEDDING_EXTRAS },
  );
  return { loaded, ...data };
};

/* ---------------- Studio space rental ---------------- */
type StudioSpacePricing = { spaces: StudioSpaceOption[]; extras: StudioSpaceExtra[] };
export const useStudioSpacePricing = () => {
  const { loaded, data } = useManaged<StudioSpacePricing>(
    "studio_space_prices",
    async () => {
      const [s, e] = await Promise.all([
        supabase.from("studio_space_prices").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("studio_space_extras").select("*").eq("active", true).order("sort_order", { ascending: true }),
      ]);
      if (s.error || e.error) return null;
      return {
        spaces: (s.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description, price: Number(r.price), duration_minutes: r.duration_minutes })),
        extras: (e.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description, price: Number(r.price), max_qty: r.max_qty, followsSpace: r.follows_package })),
      };
    },
    { spaces: DEFAULT_STUDIO_SPACE_PRICES, extras: DEFAULT_STUDIO_SPACE_EXTRAS },
  );
  return { loaded, ...data };
};

/* ---------------- Business settings (deposit rules, terms) ---------------- */
export type BusinessSettings = {
  business_name: string; email: string; phone: string; deposit_mode: "percent" | "fixed" | "full"; deposit_percent: number; deposit_fixed: number;
  balance_due_days_before: number; booking_terms: string; cancellation_policy: string; online_payments_enabled: boolean;
  opening_hours?: Record<string, [string, string] | null>; booking_horizon_days?: number; min_notice_hours?: number;
};
export const DEFAULT_BUSINESS: BusinessSettings = {
  business_name: "Tplum Photography", email: "info@tplumphotography.com", phone: "+14034935511", deposit_mode: "percent", deposit_percent: 30, deposit_fixed: 0,
  balance_due_days_before: 14, booking_terms: "", cancellation_policy: "", online_payments_enabled: true,
};
export const useBusinessSettings = () => {
  const { loaded, data } = useManaged<BusinessSettings>(
    "business_settings",
    async () => {
      const { data, error } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
      if (error || !data) return null;
      return { ...DEFAULT_BUSINESS, ...data, deposit_percent: Number(data.deposit_percent), deposit_fixed: Number(data.deposit_fixed) } as BusinessSettings;
    },
    DEFAULT_BUSINESS,
  );
  return { loaded, settings: data };
};
