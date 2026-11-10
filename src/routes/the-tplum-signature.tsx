import { createFileRoute } from "@tanstack/react-router";
import { cmsPage } from "@/site/PageRoute";
import Signature from "@/site/pages/Signature";

const page = cmsPage("the-tplum-signature", "/the-tplum-signature/", ({ c }) => <Signature c={c} />);

export const Route = createFileRoute("/the-tplum-signature")({
  loader: page.loader,
  head: page.head,
  component: () => <page.component data={Route.useLoaderData()} />,
});
