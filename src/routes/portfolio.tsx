import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Portfolio from "@/site/pages/Portfolio";

const page = cmsPage("portfolio", "/portfolio/", ({ c }) => <Portfolio c={c} />);

export const Route = createFileRoute("/portfolio")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
