import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";

// The client's invoice: /invoice/?t=<token> (linked from the invoice email). One pre-rendered page serves every invoice;
// the token is read in the browser. Older /invoice/<token>/ links redirect here (public/_redirects). Never indexed.
const InvoiceView = lazy(() => import("@/features/invoices/PublicInvoice"));

function Page() {
  const { site } = Route.useLoaderData();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("t") ?? ""), []);
  const wait = <div className="min-h-[60vh]" aria-busy="true" />;
  return <AppShell site={site}>{token !== null ? <Suspense fallback={wait}><InvoiceView token={token} /></Suspense> : wait}</AppShell>;
}

const head = privateHead("Your invoice · Tplum Photography");

export const Route = createFileRoute("/invoice/")({
  loader: () => getSiteContent(),
  component: Page,
  head: () => ({ meta: [...head.meta, { name: "referrer", content: "same-origin" }] }),
});
