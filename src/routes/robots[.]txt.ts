import { createFileRoute } from "@tanstack/react-router";
import { PROD_ORIGIN } from "@/site/seo";

/**
 * /robots.txt. On tplumphotography.com: everything public may be crawled, private areas may not, and the sitemap is
 * announced. On any preview address (*.workers.dev, localhost): nothing may be crawled, so previews never compete
 * with the real site in search results.
 */
const PRIVATE = ["/dashboard/", "/account/", "/checkin/", "/cms-preview/", "/invoice/", "/contract/", "/client-gallery/", "/client-gallery-cover/", "/booking/confirmed/"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const host = new URL(request.url).hostname;
        const live = host === "tplumphotography.com" || host === "www.tplumphotography.com";
        const body = live
          ? ["User-agent: *", "Allow: /", ...PRIVATE.map((p) => `Disallow: ${p}`), "", `Sitemap: ${PROD_ORIGIN}/sitemap.xml`, ""].join("\n")
          : ["User-agent: *", "Disallow: /", ""].join("\n");
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
