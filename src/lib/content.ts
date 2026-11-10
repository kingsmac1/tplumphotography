import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { blogPosts as defaultBlogPosts, type BlogPost } from "@/data/blogPosts";
import { DEFAULT_PRODUCTS, type Product } from "@/data/storeDefaults";
import { BOOKING_LOCATIONS, DEFAULT_BOOKING_EXTRAS, DEFAULT_BOOKING_PRICES, type ExtraRow, type PriceRow } from "@/data/pricingDefaults";
import { DEFAULT_TESTIMONIALS, type Testimonial } from "@/data/testimonialDefaults";
import { DEFAULT_WEDDING_EXTRAS, DEFAULT_WEDDING_PACKAGES, type WeddingExtra, type WeddingPackage } from "@/data/weddingDefaults";
import { DEFAULT_STUDIO_SPACE_EXTRAS, DEFAULT_STUDIO_SPACE_PRICES, type StudioSpaceExtra, type StudioSpaceOption } from "@/data/studioSpaceDefaults";
import { DEFAULT_ACADEMY_PLANS, type AcademyPlan } from "@/data/academyDefaults";

/**
 * Content that the admin manages from the dashboard (blog, store, prices).
 * Until a section has been "managed" (loaded into the dashboard), the site keeps showing its built-in content.
 * While loading, hooks report loaded = false so pages can show a blank state instead of a wrong price.
 */
const cache = new Map<string, unknown>();

export const resetContentCache = () => cache.clear();

/** Marks a section as dashboard-managed so the website stops using the built-in content for it. */
export const markManaged = async (key: string) => {
  await supabase.from("content_flags").upsert({ key, managed: true }, { onConflict: "key" });
  cache.clear();
};

const loadManaged = async <T,>(key: string, fetcher: () => Promise<T | null>, fallback: T): Promise<T> => {
  if (cache.has(key)) return cache.get(key) as T;
  const work = (async () => {
    const [flag, data] = await Promise.all([
      supabase.from("content_flags").select("managed").eq("key", key).maybeSingle(),
      fetcher().catch(() => null),
    ]);
    if (flag.error || !flag.data?.managed || data === null) return fallback;
    cache.set(key, data);
    return data;
  })().catch(() => fallback);
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 3500));
  return Promise.race([work, timeout]);
};

const useManaged = <T,>(key: string, fetcher: () => Promise<T | null>, fallback: T) => {
  const [state, setState] = useState<{ loaded: boolean; data: T }>({
    loaded: cache.has(key),
    data: (cache.get(key) as T | undefined) ?? fallback,
  });
  useEffect(() => {
    let cancelled = false;
    loadManaged(key, fetcher, fallback).then((data) => { if (!cancelled) setState({ loaded: true, data }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
};

/* ---------------- Blog ---------------- */
export const useBlogPosts = () => {
  const { loaded, data } = useManaged<BlogPost[]>(
    "blog",
    async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").eq("published", true).order("published_date", { ascending: false });
      if (error) return null;
      return (data ?? []).map((r) => ({
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        content: r.content,
        date: r.published_date,
        category: r.category,
        readTime: r.read_time,
        image: r.image_url,
      }));
    },
    defaultBlogPosts,
  );
  return { loaded, posts: data };
};

/* ---------------- Store ---------------- */
export const useStoreProducts = () => {
  const { loaded, data } = useManaged<Product[]>(
    "store",
    async () => {
      const { data, error } = await supabase.from("store_products").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) return null;
      return (data ?? []).map((r) => ({
        id: r.id, title: r.title, tagline: r.tagline, description: r.description, price: r.price, format: r.format, image: r.image_url,
      }));
    },
    DEFAULT_PRODUCTS,
  );
  return { loaded, products: data };
};

/* ---------------- Booking prices ---------------- */
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

/* ---------------- Wedding prices ---------------- */
type WeddingPricing = { packages: WeddingPackage[]; extras: WeddingExtra[]; configuredLocations: string[] };
const WEDDING_LOCATION_IDS = BOOKING_LOCATIONS.map((l) => l.id);
// Until the prices are imported into the dashboard, every location shows the same default price list.
const DEFAULT_WEDDING_PRICING: WeddingPricing = {
  packages: WEDDING_LOCATION_IDS.flatMap((loc) => DEFAULT_WEDDING_PACKAGES.map((p) => ({ ...p, location: loc }))),
  extras: WEDDING_LOCATION_IDS.flatMap((loc) => DEFAULT_WEDDING_EXTRAS.map((e) => ({ ...e, location: loc }))),
  configuredLocations: WEDDING_LOCATION_IDS,
};
export const useWeddingPricing = () => {
  const { loaded, data } = useManaged<WeddingPricing>(
    "wedding_prices",
    async () => {
      const [p, e] = await Promise.all([
        supabase.from("wedding_packages").select("*").order("sort_order", { ascending: true }),
        supabase.from("wedding_extras").select("*").order("sort_order", { ascending: true }),
      ]);
      if (p.error || e.error) return null;
      const pkgRows = p.data ?? [];
      const extraRows = e.data ?? [];
      // Rows saved before locations existed have no location; they belong to Uyo.
      const loc = (r: { location?: string | null }) => r.location || "uyo";
      return {
        packages: pkgRows
          .filter((r) => r.active)
          .map((r) => ({
            id: r.id,
            name: r.name,
            tagline: r.tagline,
            includes: r.includes ?? [],
            oneEvent: r.one_event,
            twoEvents: r.two_events ?? undefined,
            singlePrice: r.two_events == null ? r.one_event : undefined,
            featured: r.featured,
            location: loc(r),
          })),
        extras: extraRows.filter((r) => r.active).map((r) => ({ name: r.name, price: r.price, location: loc(r) })),
        // Locations that have any rows at all (even switched off), so an empty location can fall back to Uyo.
        configuredLocations: Array.from(new Set([...pkgRows, ...extraRows].map(loc))),
      };
    },
    DEFAULT_WEDDING_PRICING,
  );
  return { loaded, ...data };
};

/* ---------------- Studio space rental prices ---------------- */
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
        spaces: (s.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description, price: r.price, duration_minutes: r.duration_minutes })),
        extras: (e.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description, price: r.price, max_qty: r.max_qty, followsSpace: r.follows_package })),
      };
    },
    { spaces: DEFAULT_STUDIO_SPACE_PRICES, extras: DEFAULT_STUDIO_SPACE_EXTRAS },
  );
  return { loaded, ...data };
};

/* ---------------- Academy tuition plans ---------------- */
export const useAcademyPlans = () => {
  const { loaded, data } = useManaged<AcademyPlan[]>(
    "academy_plans",
    async () => {
      const { data, error } = await supabase.from("academy_plans").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) return null;
      return (data ?? []).map((r) => ({ id: r.id, name: r.name, amount: r.amount, description: r.description, isFullPayment: r.is_full_payment }));
    },
    DEFAULT_ACADEMY_PLANS,
  );
  return { loaded, plans: data };
};

/**
 * The real amount an academy application should show once a payment status is set, taken from
 * the academy's actual plan prices (the same ones shown on the Academy page):
 *  - "Full Payment" -> the plan marked as the full tuition total (e.g. $200,000), regardless of
 *    which plan the student originally signed up under — reaching "Full Payment" means the whole
 *    tuition is in.
 *  - "Part Payment" -> the (first) installment plan's amount (e.g. $100,000).
 *  - "Not Paid" -> null, meaning "leave the amount as it is" (nothing has been received yet).
 * Used when an admin changes payment status from the dashboard, so the amount that feeds the
 * Finance page always matches the studio's real prices instead of going stale.
 */
export const getAcademyAmountForStatus = async (status: string): Promise<number | null> => {
  if (status === "Not Paid") return null;
  const { data, error } = await supabase.from("academy_plans").select("amount, is_full_payment").eq("active", true);
  const rows = !error && data && data.length > 0 ? data : DEFAULT_ACADEMY_PLANS.map((p) => ({ amount: p.amount, is_full_payment: p.isFullPayment }));
  const match = status === "Full Payment" ? rows.find((r) => r.is_full_payment) : rows.find((r) => !r.is_full_payment);
  return match ? match.amount : null;
};

/* ---------------- Homepage testimonials (the best approved reviews) ---------------- */
export const useHomeTestimonials = () => {
  const { loaded, data } = useManaged<Testimonial[]>(
    "reviews",
    async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("author_name, location, comment, rating, author_photo_url, posted_at")
        .eq("status", "approved")
        .gte("rating", 4)
        .neq("comment", "")
        .order("posted_at", { ascending: false })
        .limit(6);
      if (error) return null;
      return (data ?? []).map((r) => ({
        quote: r.comment,
        author: String(r.author_name).toUpperCase(),
        location: r.location ?? "",
        img: r.author_photo_url ?? "",
        rating: r.rating,
      }));
    },
    DEFAULT_TESTIMONIALS,
  );
  return { loaded, testimonials: data };
};
