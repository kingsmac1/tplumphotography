import seed from "./seed.json";

/** An image as stored in the CMS. `srcset` lists optimised widths; `focal` (0–100) sets the crop centre. */
export type CmsImage = { src: string; srcset?: string; width?: number; height?: number; alt: string; focal?: { x: number; y: number } };
export type CmsLink = { label: string; href: string };

export type SiteContent = typeof seed.site;
export type HomeContent = typeof seed.home;
export type PortfolioContent = typeof seed.portfolio;
export type AboutContent = typeof seed.about;
export type ContactContent = typeof seed.contact;
export type SignatureContent = (typeof seed)["the-tplum-signature"];
export type FaqContent = typeof seed.faq;
export type ComingSoonContent = (typeof seed)["coming-soon"];
export type BookContent = typeof seed.book;
export type VideosContent = typeof seed.videos;
export type StoriesContent = (typeof seed)["wedding-stories"];
export type Album = StoriesContent["albums"][number];

/** "Juwon & Femi" → "juwon-and-femi" (the album's address under /wedding-stories/). */
export const albumSlug = (name: string) =>
  name.toLowerCase().replace(/&/g, " and ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "couple";
export type SeoContent = HomeContent["seo"];

export type PageKey = "home" | "portfolio" | "about" | "contact" | "the-tplum-signature" | "faq" | "coming-soon" | "book" | "videos" | "wedding-stories";
export type DocKey = PageKey | "site";

export type PageContentMap = {
  site: SiteContent;
  home: HomeContent;
  portfolio: PortfolioContent;
  about: AboutContent;
  contact: ContactContent;
  "the-tplum-signature": SignatureContent;
  faq: FaqContent;
  "coming-soon": ComingSoonContent;
  book: BookContent;
  videos: VideosContent;
  "wedding-stories": StoriesContent;
};

export const SEED = seed as unknown as PageContentMap;

/** Published content laid over the seed: objects merge key by key, lists and values replace. Missing keys keep the seed. */
export function mergeContent<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || Array.isArray(over)) return (Array.isArray(over) ? over : base) as T;
  if (typeof base === "object" && base !== null && typeof over === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) out[k] = mergeContent((base as Record<string, unknown>)[k], v);
    return out as T;
  }
  return (typeof over === typeof base || base === null ? over : base) as T;
}
