import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";

const page = cmsPage("the-tplum-signature", "/the-tplum-signature/");

export const Route = createFileRoute("/the-tplum-signature")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
