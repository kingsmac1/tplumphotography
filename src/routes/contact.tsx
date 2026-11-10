import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Contact from "@/site/pages/Contact";

const page = cmsPage("contact", "/contact/", ({ c, site }) => <Contact c={c} site={site} />);

export const Route = createFileRoute("/contact")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
