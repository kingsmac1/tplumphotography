import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";

// The client's contract to read and sign: /contract/?t=<token> (linked from the contract email). One pre-rendered page
// serves every contract; the token is read in the browser. Older /contract/<token>/ links redirect here. Never indexed.
const ContractView = lazy(() => import("@/features/contracts/PublicContract"));

function Page() {
  const { site } = Route.useLoaderData();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("t") ?? ""), []);
  const wait = <div className="min-h-[60vh]" aria-busy="true" />;
  return <AppShell site={site}>{token !== null ? <Suspense fallback={wait}><ContractView token={token} /></Suspense> : wait}</AppShell>;
}

const head = privateHead("Your contract · Tplum Photography");

export const Route = createFileRoute("/contract/")({
  loader: () => getSiteContent(),
  component: Page,
  head: () => ({ meta: [...head.meta, { name: "referrer", content: "same-origin" }] }),
});
