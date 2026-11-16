import { useEffect, useState } from "react";
import { mergeContent, SEED, type DocKey, type PageContentMap, type PageKey } from "./types";
import published from "./published.json";

/**
 * Website content for Cloudflare Pages (static site, same set-up as PairMediaPro):
 *  - Build time: scripts/fetch-cms.mjs saves the published CMS content and the latest Instagram posts into
 *    src/cms/published.json, and every page is pre-rendered with it, so search engines get the full words.
 *    The dashboard's Publish button triggers a Pages deploy hook, so the saved pages are rebuilt in a minute or two.
 *  - In the visitor's browser: useLiveContent fetches the current published content once per visit, so an edit shows
 *    straight away, even before the rebuild has finished.
 * Without Supabase (Phase A) both steps fall back to the seed (the exact WordPress content).
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ORIGIN = "https://tplumphotography.com";

export type FeedPost = { image: { src: string; srcset?: string; width?: number; height?: number; alt: string }; caption?: string; url: string };
type Published = { docs: Partial<Record<DocKey, unknown>>; instagram: FeedPost[] };
const BUILT = published as unknown as Published;

function assemble<K extends PageKey>(key: K, docs: Partial<Record<DocKey, unknown>>, instagram: FeedPost[]) {
  const site = mergeContent(SEED.site, docs.site);
  return {
    site,
    page: mergeContent(SEED[key], docs[key]) as PageContentMap[K],
    // Live Instagram posts once the feed is connected; until then the posts captured from the WordPress site.
    posts: (instagram.length >= 4 ? instagram : site.instagramSection.posts) as FeedPost[],
    origin: ORIGIN,
    // Preview addresses are kept out of search by robots.txt (functions/robots.txt.js), so pages are always indexable.
    indexable: true,
  };
}

/** Same call shape as before (route loaders call it). Pure and synchronous underneath: no server needed. */
export const getPageContent = async ({ data: key }: { data: PageKey }) => assemble(key, BUILT.docs, BUILT.instagram);

/** Header/menu/footer content only (booking, client-area and other app pages). */
export const getSiteContent = async () => ({ site: mergeContent(SEED.site, BUILT.docs.site) });

/** Same shape as getPageContent, for the CMS preview (draft content supplied by the editor). */
export function previewContent<K extends PageKey>(key: K, site: unknown, page: unknown) {
  return { site: mergeContent(SEED.site, site), page: mergeContent(SEED[key], page) as PageContentMap[K] };
}

/* ---------- live content in the browser ---------- */

let live: Promise<Published | null> | null = null;
function fetchLive(): Promise<Published | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return Promise.resolve(null);
  if (live) return live;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  live = Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/cms_published?select=key,content`, { headers: h }).then((r) => (r.ok ? r.json() : [])),
    fetch(`${SUPABASE_URL}/rest/v1/instagram_posts?select=permalink,caption,image_url,width,height&hidden=eq.false&order=posted_at.desc&limit=8`, { headers: h }).then((r) => (r.ok ? r.json() : [])),
  ])
    .then(([rows, ig]: [{ key: DocKey; content: unknown }[], { permalink: string; caption: string | null; image_url: string; width: number | null; height: number | null }[]]) => {
      const docs: Partial<Record<DocKey, unknown>> = {};
      for (const r of rows) if (r.content && typeof r.content === "object" && Object.keys(r.content as object).length) docs[r.key] = r.content;
      const instagram = ig.map((r) => ({ image: { src: r.image_url, width: r.width ?? 1080, height: r.height ?? 1350, alt: "" }, caption: r.caption ?? "", url: r.permalink }));
      return { docs, instagram };
    })
    .catch(() => null);
  return live;
}

/** The pre-rendered content, swapped for the current published content once it has loaded (only if it differs). */
export function useLiveContent<T extends { site: unknown }>(key: PageKey | null, initial: T): T {
  const [data, setData] = useState(initial);
  useEffect(() => {
    let off = false;
    fetchLive().then((p) => {
      if (off || !p) return;
      const next = key ? { ...initial, ...assemble(key, p.docs, p.instagram) } : { ...initial, site: mergeContent(SEED.site, p.docs.site) };
      if (JSON.stringify(next) !== JSON.stringify(initial)) setData(next as T);
    });
    return () => { off = true; };
  }, [key, initial]);
  return data;
}
