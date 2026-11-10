import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/cms/content";
import { AppShell } from "@/site/AppShell";
import Weddings from "@/pages/Weddings";

export const Route = createFileRoute("/booking/wedding")({
  loader: () => getSiteContent(),
  head: () => ({ meta: [{ title: "Wedding Collections | Tplum Photography" }, { name: "description", content: "Wedding photography collections by Tplum Photography — Calgary, Edmonton, Toronto and destination weddings." }] }),
  component: () => {
    const { site } = Route.useLoaderData();
    return <AppShell site={site}><Weddings site={site} /></AppShell>;
  },
});
