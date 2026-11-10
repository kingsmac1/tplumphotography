import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Faq from "@/site/pages/Faq";

const page = cmsPage("faq", "/faq/", ({ c, site }) => <Faq c={c} site={site} />);

export const Route = createFileRoute("/faq")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
