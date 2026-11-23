import type { ReactNode } from "react";
import type { SiteContent } from "@/cms/types";
import { Footer, SiteChrome } from "./Layout";
import { MChrome, MFooter } from "./m/MLayout";
import { Designs } from "./design";
import { useLiveContent } from "@/cms/content";

/**
 * Tplum header + footer around DMI-style app pages (booking flow, events, check-in, client areas). The header and
 * footer follow the visitor's design (classic or modern); the page itself is rendered once, in its own app styling.
 */
export function AppShell({ site, children }: { site: SiteContent; children: ReactNode }) {
  const live = useLiveContent(null, { site });
  return (
    <>
      <Designs classic={<div className="tp"><SiteChrome site={live.site} app /></div>} modern={<div className="tp tpm"><MChrome site={live.site} app /></div>} />
      <main id="content" className="app">{children}</main>
      <Designs classic={<div className="tp"><Footer site={live.site} /></div>} modern={<div className="tp tpm"><MFooter site={live.site} /></div>} />
    </>
  );
}

/** noindex for private pages (client galleries, invoices, contracts, dashboard). */
export const privateHead = (title: string) => ({ meta: [{ title }, { name: "robots", content: "noindex, nofollow" }] });
