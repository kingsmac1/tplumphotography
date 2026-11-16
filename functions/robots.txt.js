/**
 * /robots.txt. On tplumphotography.com the static public/robots.txt is served (public pages may be crawled, private
 * areas may not, and the sitemap is announced). On any preview address (*.pages.dev) nothing may be crawled, so the
 * preview never competes with the real site in search results.
 */
export async function onRequestGet(ctx) {
  const host = new URL(ctx.request.url).hostname
  if (host === 'tplumphotography.com' || host === 'www.tplumphotography.com') return ctx.next()
  return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
