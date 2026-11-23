import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

const page = cmsPage("contact", "/contact/");

export const Route = createFileRoute("/contact")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
