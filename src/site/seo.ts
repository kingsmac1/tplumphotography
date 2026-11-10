import type { SeoContent, SiteContent } from "@/cms/types";

export const PROD_ORIGIN = "https://tplumphotography.com";

const abs = (origin: string, src?: string) => (!src ? undefined : /^https?:/.test(src) ? src : `${origin}${src}`);

/** <head> tags for a page: the SEO title, description and OG/Twitter tags copied from WordPress (AIOSEO). */
export function pageHead(seo: SeoContent, path: string, opts: { origin: string; indexable: boolean }) {
  const url = `${PROD_ORIGIN}${path}`;
  const image = abs(opts.origin, seo.shareImage?.src);
  const meta: Record<string, string>[] = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { name: "robots", content: opts.indexable ? "max-image-preview:large" : "noindex, nofollow" },
    { property: "og:locale", content: "en_US" },
    { property: "og:site_name", content: "Tplum Photography → Calgary | Edmonton | Toronto Wedding & Portrait Photographer + Destination Wedding" },
    { property: "og:type", content: seo.ogType || "website" },
    { property: "og:title", content: seo.ogTitle || seo.title },
    { property: "og:description", content: seo.ogDescription || seo.description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: seo.twitterTitle || seo.title },
    { name: "twitter:description", content: seo.twitterDescription || seo.description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image }, { property: "og:image:secure_url", content: image }, { name: "twitter:image", content: image });
  }
  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** JSON-LD for a local photography business (schema.org LocalBusiness + ProfessionalService). */
export function businessJsonLd(site: SiteContent, origin: string) {
  const email = site.contact.email.toLowerCase();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": `${PROD_ORIGIN}/#business`,
        name: "Tplum Photography",
        description: "Calgary | Edmonton | Toronto Wedding & Portrait Photographer + Destination Wedding",
        url: `${PROD_ORIGIN}/`,
        image: abs(origin, site.brand.shareImage?.src),
        logo: abs(origin, site.brand.shareImage?.src),
        email,
        telephone: site.contact.phone,
        address: { "@type": "PostalAddress", addressRegion: "AB", addressCountry: "CA" },
        areaServed: [
          { "@type": "City", name: "Calgary" },
          { "@type": "City", name: "Edmonton" },
          { "@type": "City", name: "Toronto" },
        ],
        knowsAbout: ["Wedding photography", "Portrait photography", "Engagement photography", "Destination weddings", "Event photography"],
        priceRange: "$$",
        sameAs: [site.contact.instagramUrl, site.contact.facebookUrl],
      },
      { "@type": "WebSite", "@id": `${PROD_ORIGIN}/#website`, url: `${PROD_ORIGIN}/`, name: "Tplum Photography", publisher: { "@id": `${PROD_ORIGIN}/#business` } },
    ],
  };
}
