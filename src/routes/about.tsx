import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

const page = cmsPage("about", "/about/");

export const Route = createFileRoute("/about")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
