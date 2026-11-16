import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/cms/content";
import { AppShell } from "@/site/AppShell";
import Booking from "@/pages/Booking";

/** /booking/kiddies/: Tplum Kiddies sessions (birthday, cake smash, milestone). Same calendar as portraits, its own packages and terms. */
export const Route = createFileRoute("/booking/kiddies")({
  loader: () => getSiteContent(),
  head: () => ({
    meta: [
      { title: "Tplum Kiddies | Book a Kids Session | Tplum Photography" },
      { name: "description", content: "Tplum Kiddies: birthday, cake smash and milestone photo sessions for your little ones in Calgary. All props provided. Capturing the innocence, preserving the moments." },
    ],
  }),
  component: () => {
    const { site } = Route.useLoaderData();
    return <AppShell site={site}><Booking category="kiddies" /></AppShell>;
  },
});
