import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/cms/content";
import { AppShell } from "@/site/AppShell";
import StudioSpace from "@/pages/StudioSpace";

export const Route = createFileRoute("/studio-space")({
  loader: () => getSiteContent(),
  head: () => ({ meta: [{ title: "Rent the Studio | Tplum Photography" }, { name: "description", content: "Book the Tplum Photography studio space by the hour." }] }),
  component: () => {
    const { site } = Route.useLoaderData();
    return <AppShell site={site}><StudioSpace /></AppShell>;
  },
});
