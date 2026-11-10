import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { privateHead } from "@/site/AppShell";

// The studio dashboard. Browser-only (it depends on the sign-in stored on this device), never indexed.
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));

function Admin() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loading = <div className="app dash min-h-screen flex items-center justify-center text-sm">Loading…</div>;
  return mounted ? <Suspense fallback={loading}><AdminDashboard /></Suspense> : loading;
}

export const Route = createFileRoute("/admin/")({
  component: Admin,
  head: () => privateHead("Dashboard · Tplum Photography"),
});
