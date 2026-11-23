import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

const page = cmsPage("book", "/book/");

export const Route = createFileRoute("/book")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
