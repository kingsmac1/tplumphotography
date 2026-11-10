import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";

// The client's invoice: /invoice/<token>/ (linked from the invoice email). Browser-only, never indexed.
const InvoiceView = lazy(() => import("@/features/invoices/PublicInvoice"));

function Page() {
  const { site } = Route.useLoaderData();
  const { token } = Route.useParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wait = <div className="min-h-[60vh]" aria-busy="true" />;
  return <AppShell site={site}>{mounted ? <Suspense fallback={wait}><InvoiceView token={token} /></Suspense> : wait}</AppShell>;
}

const head = privateHead("Your invoice · Tplum Photography");

export const Route = createFileRoute("/invoice/$token")({
  loader: () => getSiteContent(),
  component: Page,
  head: () => ({ meta: [...head.meta, { name: "referrer", content: "same-origin" }] }),
});
