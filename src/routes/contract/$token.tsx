import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";

// The client's contract to read and sign: /contract/<token>/ (linked from the contract email). Never indexed.
const ContractView = lazy(() => import("@/features/contracts/PublicContract"));

function Page() {
  const { site } = Route.useLoaderData();
  const { token } = Route.useParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wait = <div className="min-h-[60vh]" aria-busy="true" />;
  return <AppShell site={site}>{mounted ? <Suspense fallback={wait}><ContractView token={token} /></Suspense> : wait}</AppShell>;
}

const head = privateHead("Your contract · Tplum Photography");

export const Route = createFileRoute("/contract/$token")({
  loader: () => getSiteContent(),
  component: Page,
  head: () => ({ meta: [...head.meta, { name: "referrer", content: "same-origin" }] }),
});
