import { getPageContent, useLiveContent, type FeedPost, type Video } from "@/cms/content";
import type { CmsImage, PageContentMap, PageKey, SiteContent } from "@/cms/types";
import { BG_PHONE_WIDTH, pickSrc } from "./ui";
import { SiteLayout } from "./Layout";
import { MLayout } from "./m/MLayout";
import { Designs } from "./design";
import { PAGE_REGISTRY } from "./pageRegistry";
import { businessJsonLd, pageHead } from "./seo";

/** Preload only the hero photo this screen size shows (the sliders' first images sit in <picture>, so React adds no preload of its own). */
function heroPreloads(c: PageContentMap["home"]) {
  const link = (img: { src?: string; srcset?: string } | undefined, media: string) =>
    img?.src ? [{ rel: "preload", as: "image", href: img.src, imageSrcSet: img.srcset || undefined, imageSizes: "100vw", media, fetchPriority: "high" as const }] : [];
  return [...link(c.hero.slidesDesktop[0], "(min-width: 768px)"), ...link(c.hero.slidesMobile[0], "(max-width: 767px)")];
}

/** Inner pages: the banner is a CSS background, found late by the browser, so preload the exact file each screen size uses. */
function bannerPreloads(c: { hero?: { image?: CmsImage } }) {
  const img = c.hero?.image;
  const l = pickSrc(img), s = pickSrc(img, BG_PHONE_WIDTH);
  if (!l) return [];
  return [
    { rel: "preload", as: "image", href: l, media: "(min-width: 768px)", fetchPriority: "high" as const },
    { rel: "preload", as: "image", href: s ?? l, media: "(max-width: 767px)", fetchPriority: "high" as const },
  ];
}

/**
 * Shared loader/head/component wiring for every CMS-driven public page. The page is rendered in both designs
 * (classic and modern, see design.tsx and pageRegistry.tsx); the visitor sees one.
 * The third argument is no longer used (kept so older route files still compile).
 */
export function cmsPage<K extends PageKey>(key: K, path: string, _body?: unknown, opts: { igVariant?: "default" | "about"; igClass?: string } = {}) {
  return {
    loader: () => getPageContent({ data: key }),
    head: ({ loaderData }: { loaderData?: Awaited<ReturnType<typeof getPageContent>> }) => {
      if (!loaderData) return {};
      const page = loaderData.page as PageContentMap[K] & { seo: PageContentMap["home"]["seo"] };
      const h = pageHead(page.seo, path, { origin: loaderData.origin, indexable: loaderData.indexable });
      return {
        meta: h.meta,
        links: [...h.links, ...(key === "home" ? heroPreloads(loaderData.page as PageContentMap["home"]) : bannerPreloads(loaderData.page as { hero?: { image?: CmsImage } }))],
        scripts: key === "home" ? [{ type: "application/ld+json", children: JSON.stringify(businessJsonLd(loaderData.site, loaderData.origin)) }] : [],
      };
    },
    component: function Page({ data: built }: { data: Awaited<ReturnType<typeof getPageContent>> }) {
      const data = useLiveContent(key, built);
      return <PageInBothDesigns pageKey={key} page={data.page} site={data.site} posts={data.posts as FeedPost[]} videos={data.videos ?? []} igVariant={opts.igVariant} igClass={opts.igClass} />;
    },
  };
}

/** One CMS page in both designs (also used by the dashboard's live preview). */
export function PageInBothDesigns({ pageKey, page, site, posts, videos, igVariant, igClass }: {
  pageKey: PageKey; page: unknown; site: SiteContent; posts: FeedPost[]; videos: Video[]; igVariant?: "default" | "about"; igClass?: string;
}) {
  const entry = PAGE_REGISTRY[pageKey];
  if (entry.bare) return <>{entry.classic(page as never, site, videos)}</>;
  return (
    <Designs
      classic={
        <SiteLayout site={site} posts={posts} igVariant={igVariant ?? entry.igVariant} igClass={igClass ?? entry.igClass ?? (pageKey === "home" ? "" : "inner")}>
          {entry.classic(page as never, site, videos)}
        </SiteLayout>
      }
      modern={<MLayout site={site} posts={posts}>{entry.modern(page as never, site, videos)}</MLayout>}
    />
  );
}
