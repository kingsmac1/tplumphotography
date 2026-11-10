import { createFileRoute } from "@tanstack/react-router";
import { getPageContent } from "@/cms/content";
import type { ComingSoonContent } from "@/cms/types";
import { pageHead } from "@/site/seo";
import ComingSoon from "@/site/pages/ComingSoon";

export const Route = createFileRoute("/coming-soon")({
  loader: () => getPageContent({ data: "coming-soon" }),
  head: ({ loaderData }) => (loaderData ? pageHead((loaderData.page as ComingSoonContent).seo, "/coming-soon/", loaderData) : {}),
  component: () => <ComingSoon c={Route.useLoaderData().page as ComingSoonContent} />,
});
