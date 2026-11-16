/**
 * Client galleries on Cloudflare Pages (same approach as PairMediaPro).
 *  - /client-gallery/?id=<id>&k=<key> is one pre-rendered page for every gallery. WhatsApp and other apps only read the
 *    HTML, so for a valid private link this swaps in the gallery's own title and cover photo for the share preview.
 *  - Older links in the form /client-gallery/<id>/?k=<key> are redirected to the new form, keeping the key.
 */
import { galleryShareInfo } from '../../functions-lib/gallery-share.js'

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url)
  const parts = url.pathname.split('/').filter(Boolean) // ['client-gallery', '<id>'?]
  if (parts.length > 1) {
    const to = new URL('/client-gallery/', url.origin)
    to.searchParams.set('id', parts[1])
    const k = url.searchParams.get('k')
    if (k) to.searchParams.set('k', k)
    return Response.redirect(to.toString(), 301)
  }
  const res = await ctx.next()
  const id = url.searchParams.get('id')
  const key = url.searchParams.get('k')
  if (!id || !key || !(res.headers.get('content-type') ?? '').includes('text/html')) return res
  const info = await galleryShareInfo(ctx.env, id, key)
  if (!info) return res
  const title = info.title ? `${info.title} · Tplum Photography` : null
  const image = info.cover ? `${url.origin}/client-gallery-cover/?id=${encodeURIComponent(id)}&k=${encodeURIComponent(key)}` : null
  const out = new HTMLRewriter()
    .on('meta[property="og:title"]', { element: (el) => { if (title) el.setAttribute('content', title) } })
    .on('meta[name="twitter:title"]', { element: (el) => { if (title) el.setAttribute('content', title) } })
    .on('meta[property="og:image"]', { element: (el) => { if (image) el.setAttribute('content', image) } })
    .on('meta[name="twitter:image"]', { element: (el) => { if (image) el.setAttribute('content', image) } })
    .transform(res)
  const headers = new Headers(out.headers)
  headers.set('Cache-Control', 'private, no-store')
  return new Response(out.body, { status: out.status, headers })
}
