/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { DESIGN_HEAD_SCRIPT } from "@/site/design";
import { NotFoundView } from "@/site/NotFound";
import { BootPreloader, PRELOADER_FAILSAFE, releasePreloader } from "@/site/preloader";

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
  useEffect(() => {
    releasePreloader();
    // 404.html (Cloudflare Pages): put back the address the visitor asked for (see scripts/postbuild.mjs).
    const real = (window as { __realPath?: string }).__realPath;
    if (real) window.history.replaceState(window.history.state, "", real);
  }, []);
  return <Outlet />;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        {/* Lets CSS hide entrance-animated elements only when JavaScript is running (no-JS visitors and crawlers see everything). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Temporary design switch (see src/site/design.tsx): applies the chosen design before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: DESIGN_HEAD_SCRIPT + ";" + PRELOADER_FAILSAFE }} />
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
