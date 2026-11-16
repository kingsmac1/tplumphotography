/**
 * /client-gallery-cover/?id=<id>&k=<key>: the gallery's cover as the share image. R2 links expire, so apps get this
 * steady address and it signs a fresh one each time. Anything invalid gets the general share image.
 */
import { galleryShareInfo } from '../../functions-lib/gallery-share.js'

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url)
  const info = await galleryShareInfo(ctx.env, url.searchParams.get('id'), url.searchParams.get('k'))
  const image = info?.cover ? await fetch(info.cover).catch(() => null) : null
  if (!image?.ok) return Response.redirect(`${url.origin}/brand/share-default.png`, 302)
  return new Response(image.body, {
    headers: { 'Content-Type': image.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
