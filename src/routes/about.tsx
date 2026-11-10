import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import About from "@/site/pages/About";

const page = cmsPage("about", "/about/", ({ c }) => <About c={c} />, { igVariant: "about", igClass: "inner gap-top" });

export const Route = createFileRoute("/about")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
