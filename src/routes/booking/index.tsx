import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/cms/content";
import { AppShell } from "@/site/AppShell";
import Booking from "@/pages/Booking";

export const Route = createFileRoute("/booking/")({
  loader: () => getSiteContent(),
  head: () => ({ meta: [{ title: "Book a Session | Tplum Photography" }, { name: "description", content: "Book a portrait, engagement, maternity or family session with Tplum Photography in Calgary and Edmonton." }] }),
  component: () => {
    const { site } = Route.useLoaderData();
    return <AppShell site={site}><Booking /></AppShell>;
  },
});
