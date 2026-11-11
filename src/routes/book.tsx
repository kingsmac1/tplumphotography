import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Book from "@/site/pages/Book";

const page = cmsPage("book", "/book/", ({ c }) => <Book c={c} />);

export const Route = createFileRoute("/book")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
