/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { NotFoundView } from "@/site/NotFound";
import { BootPreloader, PRELOADER_FAILSAFE, releasePreloader } from "@/site/preloader";
import { defaultDesign, designHeadScript } from "@/site/design";

const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400&family=Lato:wght@300;400;700&family=Montserrat:wght@400;600&family=Raleway:wght@500&family=Roboto:wght@400;600&family=Inter:wght@400;500&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#000000" },
      { name: "msapplication-TileImage", content: "/favicon-270.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
      { rel: "preload", href: "/fonts/Fulgate-SemiBold.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192.png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/favicon-180.png" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFoundView,
});

/** Lifts the boot preloader once the app has hydrated (every page, including the dashboard). */
function RootComponent() {
  useInstantLinks();
  useEffect(() => {
    releasePreloader();
    // 404.html (Cloudflare Pages): put back the address the visitor asked for (see scripts/postbuild.mjs).
    const real = (window as { __realPath?: string }).__realPath;
    if (real) window.history.replaceState(window.history.state, "", real);
  }, []);
  return <Outlet />;
}

/**
 * Pages open when a link is clicked, inside the running site (no full reload, no blank screen), like the owner's other
 * projects. Nothing is fetched before the click (no hover preloading). Left as normal browser links: new-tab and
 * modified clicks, downloads, other sites, mailto/tel, files (sitemap.xml…), same-page anchors, and the app areas that
 * set themselves up from the address on load (dashboard, client area, galleries, invoices, contracts, check-in).
 */
const FULL_LOAD = /^\/(dashboard|account|client-gallery|invoice|contract|checkin|cms-preview)(\/|$|\?)/;
function useInstantLinks() {
  const router = useRouter();
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (FULL_LOAD.test(url.pathname) || /\.\w{2,5}$/.test(url.pathname)) return;
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return; // same-page anchor
      e.preventDefault();
      void router.navigate({ href: url.pathname + url.search + url.hash });
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [router]);
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" data-design={defaultDesign()} suppressHydrationWarning>
      <head>
        {/* Lets CSS hide entrance-animated elements only when JavaScript is running (no-JS visitors and crawlers see everything). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Never leave the preloader up for more than 4 seconds, whatever happens. */}
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_FAILSAFE }} />
        {/* Which design this visitor sees (classic or modern), before anything paints. See src/site/design.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: designHeadScript() }} />
        <HeadContent />
      </head>
      <body>
        <BootPreloader />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
