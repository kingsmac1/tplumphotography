import { createFileRoute } from "@tanstack/react-router";
import { getPageContent, useLiveContent } from "@/cms/content";
import type { StoriesContent } from "@/cms/types";
import { AppShell } from "@/site/AppShell";
import Weddings from "@/pages/Weddings";

/** Wedding collections (Services → Wedding): packages, add-ons, then the couples' albums and the wedding films. */
const load = async () => {
  const d = await getPageContent({ data: "wedding-stories" });
  return { ...d, page: d.page as StoriesContent };
};

export const Route = createFileRoute("/booking/wedding")({
  loader: load,
  head: () => ({ meta: [{ title: "Wedding Collections | Tplum Photography" }, { name: "description", content: "Wedding photography collections by Tplum Photography — Calgary, Edmonton, Toronto and destination weddings." }] }),
  component: () => {
    const live = useLiveContent("wedding-stories", Route.useLoaderData());
    return <AppShell site={live.site}><Weddings site={live.site} stories={live.page as StoriesContent} videos={live.videos ?? []} /></AppShell>;
  },
});
