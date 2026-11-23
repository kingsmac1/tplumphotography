import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

const page = cmsPage("faq", "/faq/");

export const Route = createFileRoute("/faq")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
