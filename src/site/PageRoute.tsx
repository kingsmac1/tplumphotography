import type { ReactNode } from "react";
import { getPageContent, type FeedPost } from "@/cms/content";
import type { PageContentMap, PageKey, SiteContent } from "@/cms/types";
import { SiteLayout } from "./Layout";
import { businessJsonLd, pageHead } from "./seo";

/** Shared loader/head/component wiring for every CMS-driven public page. */
export function cmsPage<K extends PageKey>(key: K, path: string, Body: (p: { c: PageContentMap[K]; site: SiteContent }) => ReactNode, opts: { igVariant?: "default" | "about" } = {}) {
  return {
    loader: () => getPageContent({ data: key }),
    head: ({ loaderData }: { loaderData?: Awaited<ReturnType<typeof getPageContent>> }) => {
      if (!loaderData) return {};
      const page = loaderData.page as PageContentMap[K] & { seo: PageContentMap["home"]["seo"] };
      const h = pageHead(page.seo, path, { origin: loaderData.origin, indexable: loaderData.indexable });
      return {
        meta: h.meta,
        links: h.links,
        scripts: key === "home" ? [{ type: "application/ld+json", children: JSON.stringify(businessJsonLd(loaderData.site, loaderData.origin)) }] : [],
      };
    },
    component: function Page({ data }: { data: Awaited<ReturnType<typeof getPageContent>> }) {
      return (
        <SiteLayout site={data.site} posts={data.posts as FeedPost[]} igVariant={opts.igVariant}>
          <Body c={data.page as PageContentMap[K]} site={data.site} />
        </SiteLayout>
      );
    },
  };
}
