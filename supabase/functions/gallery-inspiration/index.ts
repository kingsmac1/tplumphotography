/**
 * Inspiration images from the public booking form.
 *   POST ?booking_id=<id> with Content-Type image/jpeg and the image as the body: stores it for that booking. Open to anyone
 *   with the site's public key, so it only takes JPEGs (the form converts everything first) up to MAX_BYTES, only for a
 *   booking created in the last hour with room left, and limits uploads per visitor.
 *   POST JSON { action: 'view', booking_id }: signed links for the dashboard (admins only).
 * Files stay private in R2. gallery-purge-previews removes them after their booking is deleted.
 */
import { corsHeaders, fail, handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'
import { put, remove, signGet } from '../_shared/r2.ts'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_PER_BOOKING = 6
const PER_VISITOR_PER_HOUR = 30
const ALL_VISITORS_PER_DAY = 1000

const visitorHash = async (req: Request) => {
  const ip = req.headers.get('cf-connecting-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${Deno.env.get('SUPABASE_URL')}|${ip}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function upload(req: Request) {
  const booking_id = new URL(req.url).searchParams.get('booking_id')
  if (!isUuid(booking_id)) return fail('Missing booking.', 400)
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) return fail('That image is too large.', 413)
  const buffer = await req.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes.length > MAX_BYTES) return fail('That image is too large.', 413)
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return fail('Please upload a JPG, PNG or WebP image.', 415)

  const db = service()
  const since = (ms: number) => new Date(Date.now() - ms).toISOString()
  const { data: booking, error } = await db.from('bookings').select('id').eq('id', booking_id).gte('created_at', since(3_600_000)).maybeSingle()
  if (error) throw error
  if (!booking) return fail('This booking can no longer take images.', 403)
  const { count: forBooking } = await db.from('booking_inspiration_images').select('key', { count: 'exact', head: true }).eq('booking_id', booking_id)
  if ((forBooking ?? 0) >= MAX_PER_BOOKING) return fail(`A booking can have up to ${MAX_PER_BOOKING} images.`, 409)
  const ip_hash = await visitorHash(req)
  const { count: mine } = await db.from('booking_inspiration_images').select('key', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since(3_600_000))
  const { count: everyone } = await db.from('booking_inspiration_images').select('key', { count: 'exact', head: true }).gte('created_at', since(86_400_000))
  if ((mine ?? 0) >= PER_VISITOR_PER_HOUR || (everyone ?? 0) >= ALL_VISITORS_PER_DAY) return fail('Too many images were uploaded. Please send them to us on WhatsApp instead.', 429)

  const key = `inspiration/${crypto.randomUUID()}.jpg`
  await put(key, buffer, 'image/jpeg')
  const { error: e } = await db.from('booking_inspiration_images').insert({ key, ip_hash, bytes: bytes.length, booking_id })
  if (e) {
    await remove(key).catch(() => undefined)
    throw e
  }
  return json({ ok: true })
}

const admin = handle(async (req, body) => {
  await requireAdmin(req)
  if (body.action !== 'view' || !isUuid(body.booking_id)) throw new HttpError('Unknown action.')
  const { data, error } = await service().from('booking_inspiration_images').select('key, created_at').eq('booking_id', body.booking_id).order('created_at')
  if (error) throw error
  const images = await Promise.all((data ?? []).map(async (r) => ({ key: r.key, url: await signGet(r.key) })))
  return json({ ok: true, images })
})

Deno.serve(async (req) => {
  if (req.method === 'POST' && (req.headers.get('content-type') ?? '').toLowerCase().startsWith('image/')) {
    try {
      return await upload(req)
    } catch (err) {
      console.error(err)
      return new Response(JSON.stringify({ ok: false, error: 'The image could not be saved.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }
  return admin(req)
})
