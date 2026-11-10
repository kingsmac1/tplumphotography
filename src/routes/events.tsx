import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/cms/content";
import { AppShell } from "@/site/AppShell";
import EventBooking from "@/pages/EventBooking";

export const Route = createFileRoute("/events")({
  loader: () => getSiteContent(),
  head: () => ({ meta: [{ title: "Book an Event | Tplum Photography" }, { name: "description", content: "Request event photography coverage from Tplum Photography." }] }),
  component: () => {
    const { site } = Route.useLoaderData();
    return <AppShell site={site}><EventBooking /></AppShell>;
  },
});
