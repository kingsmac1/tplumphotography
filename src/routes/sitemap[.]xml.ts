import { createFileRoute } from "@tanstack/react-router";
import { PROD_ORIGIN } from "@/site/seo";

/**
 * /sitemap.xml: every public page, so search engines find and re-crawl them. Always lists the real domain's
 * addresses (the canonical ones), even when served from a preview address. Private areas are never listed.
 */
const PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/portfolio/", priority: "0.9", changefreq: "weekly" },
  { path: "/book/", priority: "0.9", changefreq: "monthly" },
  { path: "/about/", priority: "0.8", changefreq: "monthly" },
  { path: "/the-tplum-signature/", priority: "0.8", changefreq: "monthly" },
  { path: "/contact/", priority: "0.8", changefreq: "monthly" },
  { path: "/faq/", priority: "0.7", changefreq: "monthly" },
  { path: "/booking/", priority: "0.7", changefreq: "monthly" },
  { path: "/booking/wedding/", priority: "0.7", changefreq: "monthly" },
  { path: "/events/", priority: "0.6", changefreq: "monthly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = PAGES.map((p) => `  <url>\n    <loc>${PROD_ORIGIN}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
