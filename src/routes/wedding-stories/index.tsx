import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

/** /wedding-stories/: every couple's album as a card (both designs). */
const page = cmsPage("wedding-stories", "/wedding-stories/");

export const Route = createFileRoute("/wedding-stories/")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
