/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";

const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400&family=Lato:wght@300;400;700&family=Montserrat:wght@400;600&family=Raleway:wght@500&family=Roboto:wght@400;600&family=Inter:wght@400;500&display=swap";

function NotFound() {
  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Lato, sans-serif", textAlign: "center" }}>
      <div>
        <h1 style={{ fontFamily: "Fulgate, serif", fontSize: 50, fontWeight: 100, margin: 0 }}>Page not found</h1>
        <p>The page you were looking for has moved or no longer exists.</p>
        <a href="/" style={{ textDecoration: "underline" }}>Go to the home page</a>
      </div>
    </div>
  );
}

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
      { rel: "preload", href: "/fonts/Fulgate-SemiBold.ttf", as: "font", type: "font/ttf", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192.png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/favicon-180.png" },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US">
      <head>
        {/* Lets CSS hide entrance-animated elements only when JavaScript is running (no-JS visitors and crawlers see everything). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
