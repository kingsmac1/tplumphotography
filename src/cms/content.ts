import { createServerFn } from "@tanstack/react-start";
import { mergeContent, SEED, type DocKey, type PageContentMap, type PageKey } from "./types";

/**
 * Published CMS content, read on the server for every page render (so search engines get full HTML)
 * and laid over the seed (the exact WordPress content). Edits appear on the live site within a few
 * seconds of "Publish" — no redeploy. If Supabase is not configured yet (Phase A) or unreachable,
 * the site renders the seed, so it never goes blank.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

type Cached = { at: number; docs: Partial<Record<DocKey, unknown>> };
let cache: Cached | null = null;
const TTL_MS = 5_000;

async function fetchPublished(): Promise<Partial<Record<DocKey, unknown>>> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return {};
  if (cache && Date.now() - cache.at < TTL_MS) return cache.docs;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cms_published?select=key,content`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`CMS ${res.status}`);
    const rows = (await res.json()) as { key: DocKey; content: unknown }[];
    const docs: Partial<Record<DocKey, unknown>> = {};
    for (const r of rows) if (r.content && typeof r.content === "object" && Object.keys(r.content as object).length) docs[r.key] = r.content;
    cache = { at: Date.now(), docs };
    return docs;
  } catch (e) {
    console.error("CMS fetch failed, using seed content", e);
    return cache?.docs ?? {};
  }
}

export type FeedPost = { image: { src: string; srcset?: string; width?: number; height?: number; alt: string }; caption?: string; url: string };

let igCache: { at: number; posts: FeedPost[] } | null = null;
/** Instagram posts saved by the instagram-sync function (copies of the photos live in Supabase Storage). */
async function fetchInstagram(): Promise<FeedPost[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return [];
  if (igCache && Date.now() - igCache.at < 60_000) return igCache.posts;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/instagram_posts?select=id,permalink,caption,image_url,width,height&hidden=eq.false&order=posted_at.desc&limit=8`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`IG ${res.status}`);
    const rows = (await res.json()) as { permalink: string; caption: string | null; image_url: string; width: number | null; height: number | null }[];
    const posts = rows.map((r) => ({ image: { src: r.image_url, width: r.width ?? 1080, height: r.height ?? 1350, alt: "" }, caption: r.caption ?? "", url: r.permalink }));
    igCache = { at: Date.now(), posts };
    return posts;
  } catch {
    return igCache?.posts ?? [];
  }
}

export const getPageContent = createServerFn({ method: "GET" })
  .validator((key: PageKey) => key)
  .handler(async ({ data: key }) => {
    const [docs, live] = await Promise.all([fetchPublished(), fetchInstagram()]);
    const site = mergeContent(SEED.site, docs.site);
    let origin = "https://tplumphotography.com";
    try {
      const { getRequestUrl } = await import("@tanstack/react-start/server");
      origin = new URL(getRequestUrl().toString()).origin;
    } catch { /* not in a request */ }
    const host = new URL(origin).hostname;
    return {
      site,
      page: mergeContent(SEED[key], docs[key]) as PageContentMap[typeof key],
      // Live Instagram posts once the feed is connected; until then the posts captured from the WordPress site.
      posts: (live.length >= 4 ? live : site.instagramSection.posts) as FeedPost[],
      origin,
      // Only the real domain is indexed; preview addresses (*.workers.dev, localhost) are noindex.
      indexable: host === "tplumphotography.com" || host === "www.tplumphotography.com",
    };
  });

/** Same shape as getPageContent, for the CMS preview (draft content supplied by the editor). */
export function previewContent<K extends PageKey>(key: K, site: unknown, page: unknown) {
  return { site: mergeContent(SEED.site, site), page: mergeContent(SEED[key], page) as PageContentMap[K] };
}
