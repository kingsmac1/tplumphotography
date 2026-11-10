import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";

// The client area: bookings, galleries, downloads and profile for whoever is signed in. Browser-only, never indexed.
const AccountApp = lazy(() => import("@/features/account/AccountApp"));

function Account() {
  const { site } = Route.useLoaderData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wait = <div className="min-h-[60vh]" aria-busy="true" />;
  return (
    <AppShell site={site}>
      {mounted ? <Suspense fallback={wait}><AccountApp /></Suspense> : wait}
    </AppShell>
  );
}

export const Route = createFileRoute("/account")({
  loader: () => getSiteContent(),
  component: Account,
  head: () => privateHead("Your account · Tplum Photography"),
});
