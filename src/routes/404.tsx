import { createFileRoute } from "@tanstack/react-router";
import { privateHead } from "@/site/AppShell";
import { NotFoundView } from "@/site/NotFound";

/** Pre-rendered to /404/ and copied to dist/client/404.html, which Cloudflare Pages serves for any unknown address. */
export const Route = createFileRoute("/404")({
  head: () => privateHead("Page not found · Tplum Photography"),
  component: NotFoundView,
});
