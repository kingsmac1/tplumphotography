import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultError({ error }: { error: Error }) {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Lato, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 style={{ fontFamily: "Fulgate, serif", fontSize: 40, fontWeight: 100 }}>Something went wrong</h1>
        <p>Please refresh the page. If it keeps happening, contact us at info@tplumphotography.com.</p>
        {import.meta.env.DEV && <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", fontSize: 12 }}>{error.message}</pre>}
      </div>
    </div>
  );
}

export const getRouter = () =>
  createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultError,
    trailingSlash: "always",
  });
