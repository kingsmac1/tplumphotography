import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type CmsImage = { id: string; section: string; url: string; path: string | null; sort_order: number };
export type CmsGallery = { slug: string; title: string; description: string; sort_order: number };
export type CmsData = { images: CmsImage[]; galleries: CmsGallery[] };

/** Galleries the site had before the CMS existed. Used when the CMS has none yet. */
export const DEFAULT_GALLERIES: CmsGallery[] = [
  { slug: "portrait", title: "PORTRAIT", description: "Editorial portraits with dramatic lighting, luxury styling and magazine-quality craft.", sort_order: 1 },
  { slug: "wedding", title: "WEDDING", description: "Timeless wedding photography that turns vows into heirlooms.", sort_order: 2 },
  { slug: "headshot", title: "HEADSHOT", description: "Polished professional headshots for brands, founders and teams.", sort_order: 3 },
  { slug: "maternity", title: "MATERNITY", description: "Editorial maternity portraits celebrating the glow of new life.", sort_order: 4 },
  { slug: "graduation", title: "GRADUATION", description: "Milestone graduation portraits - proud, joyful and cinematic.", sort_order: 5 },
  { slug: "couple", title: "COUPLE", description: "Intimate couple sessions that bottle the chemistry between two people.", sort_order: 6 },
  { slug: "fine-art", title: "FINE ART", description: "Modern fine art photography with serene minimal aesthetics, clean compositions and artistic vision.", sort_order: 7 },
  { slug: "editorial", title: "EDITORIAL", description: "Confident editorial imagery with bold styling, modern attitude and high-end aesthetics.", sort_order: 8 },
];

const EMPTY: CmsData = { images: [], galleries: [] };
let cache: CmsData | null = null;
let inflight: Promise<CmsData> | null = null;

/** Loads the CMS content once per page load. Never throws: on any problem the site falls back to its built-in images. */
export const loadCms = (): Promise<CmsData> => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const fetchAll = (async () => {
      const [imgs, gals] = await Promise.all([
        supabase.from("cms_images").select("id, section, url, path, sort_order").order("sort_order", { ascending: true }),
        supabase.from("cms_galleries").select("slug, title, description, sort_order").order("sort_order", { ascending: true }),
      ]);
      if (imgs.error || gals.error) return EMPTY;
      const data = { images: (imgs.data as CmsImage[]) ?? [], galleries: (gals.data as CmsGallery[]) ?? [] };
      cache = data;
      return data;
    })().catch(() => EMPTY);
    const timeout = new Promise<CmsData>((resolve) => setTimeout(() => resolve(EMPTY), 3500));
    inflight = Promise.race([fetchAll, timeout]).finally(() => { inflight = null; });
  }
  return inflight;
};

/** Forget the cached content (used by the admin after changes). */
export const resetCmsCache = () => { cache = null; };

export const useCms = () => {
  const [state, setState] = useState<{ loaded: boolean; data: CmsData }>({ loaded: !!cache, data: cache ?? EMPTY });
  useEffect(() => {
    let cancelled = false;
    loadCms().then((data) => { if (!cancelled) setState({ loaded: true, data }); });
    return () => { cancelled = true; };
  }, []);
  return state;
};

/**
 * Image URLs for a section. Until the admin has added ANY CMS image, the site's built-in
 * images (`fallback`) are used, so nothing ever goes blank.
 */
export const cmsImages = (data: CmsData, section: string, fallback: string[]): string[] => {
  if (data.images.length === 0) return fallback;
  return data.images
    .filter((i) => i.section === section)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.url);
};

export const cmsGalleries = (data: CmsData): CmsGallery[] =>
  data.galleries.length > 0 ? [...data.galleries].sort((a, b) => a.sort_order - b.sort_order) : DEFAULT_GALLERIES;
