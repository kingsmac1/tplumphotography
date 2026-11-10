import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Home from "@/site/pages/Home";

const page = cmsPage("home", "/", ({ c }) => <Home c={c} />);

export const Route = createFileRoute("/")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
