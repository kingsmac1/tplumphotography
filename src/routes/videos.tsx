import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

/** /videos/: the video portfolio (films from Dashboard → Videos, played from YouTube), in both designs. */
const page = cmsPage("videos", "/videos/");

export const Route = createFileRoute("/videos")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
