import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Checkin from "@/pages/Checkin";
import { privateHead } from "@/site/AppShell";

function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <Checkin /> : <div className="min-h-screen" />;
}

export const Route = createFileRoute("/checkin")({
  component: Page,
  head: () => privateHead("Staff check-in · Tplum Photography"),
});
