/**
 * "Page not found". Used both by the root route (any unknown address while browsing) and by the /404 route, which is
 * pre-rendered to dist/client/404.html for Cloudflare Pages. Keeping them identical lets the page hydrate cleanly.
 */
export function NotFoundView() {
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
