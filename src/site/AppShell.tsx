import type { ReactNode } from "react";
import type { SiteContent } from "@/cms/types";
import { SiteLayout } from "./Layout";

/** Tplum header + footer around DMI-style app pages (booking flow, studio rental, check-in, client areas). */
export function AppShell({ site, children }: { site: SiteContent; children: ReactNode }) {
  return <SiteLayout site={site} posts={[]} app>{children}</SiteLayout>;
}

/** noindex for private pages (client galleries, invoices, contracts, dashboard). */
export const privateHead = (title: string) => ({ meta: [{ title }, { name: "robots", content: "noindex, nofollow" }] });
