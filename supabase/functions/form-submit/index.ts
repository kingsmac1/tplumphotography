/**
 * Public forms: the Contact page form and the event request form.
 *  - same validation rules as the browser (shared contact-rules.ts),
 *  - honeypot field ("website"): bots that fill it get a normal-looking success and nothing is stored or sent,
 *  - at most 5 submissions per hour per visitor (hashed IP, never stored in plain text),
 *  - stored (contact_submissions / event_bookings) and emailed to BOTH the visitor and the studio.
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { service } from '../_shared/auth.ts'
import { sendToClientAndOwner } from '../_shared/email.ts'
import { EMAIL_RE, normalizeContact, validateContact } from '../_shared/contact-rules.ts'
import { simpleEmail } from '../_shared/email-templates.ts'

const clip = (v: unknown, n = 200) => String(v ?? '').trim().slice(0, n)

async function ipHash(req: Request) {
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const data = new TextEncoder().encode(`${ip}|${Deno.env.get('SUPABASE_URL')}`)
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

Deno.serve(handle(async (req, body) => {
  const db = service()
  const form = body.form === 'event' ? 'event' : 'contact'
  if (clip(body.website)) return json({ ok: true }) // honeypot: pretend all is well
  const hash = await ipHash(req)
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('ip_hash', hash).gte('created_at', since)
  if ((count ?? 0) >= 5) throw new HttpError('Too many messages from this connection. Please try again later or email us directly.', 429)

  if (form === 'contact') {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton' }).format(new Date())
    const { data: cms } = await db.from('cms_documents').select('published').eq('key', 'contact').maybeSingle()
    const services: string[] | undefined = cms?.published?.form?.serviceOptions
    const v = normalizeContact(body)
    const errors = validateContact(v, { services, today })
    if (Object.keys(errors).length) return json({ ok: false, error: 'Please check the highlighted fields.', fields: errors }, 400)
    const { error } = await db.from('contact_submissions').insert({
      form: 'contact', first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
      service: v.service === 'Others' && v.service_other ? `Others: ${v.service_other}` : v.service, event_date: v.event_date, location: v.location,
      instagram: v.instagram, heard_from: v.heard_from, message: v.message, ip_hash: hash,
    })
    if (error) throw error
    const rows: [string, string][] = [
      ['Name', `${v.first_name} ${v.last_name}`], ['Email', v.email], ['Phone', v.phone],
      ['Service', v.service === 'Others' && v.service_other ? `Others: ${v.service_other}` : v.service], ['Preferred date', v.event_date],
      ['Location', v.location], ['Instagram', v.instagram], ['Heard about us', v.heard_from], ['Message', v.message],
    ]
    await sendToClientAndOwner({
      client: v.email,
      clientMessage: simpleEmail({ subject: 'Thanks for contacting Tplum Photography', eyebrow: 'Contact', title: 'We received your message',
        intro: `Hi ${v.first_name}, thank you for reaching out! Kindly allow 24–48 hours for a reply. If you don’t see an email within that time, please check your spam or junk folder.`, rows }),
      ownerMessage: simpleEmail({ subject: `New enquiry: ${v.first_name} ${v.last_name} · ${v.service}`, eyebrow: 'New submission', title: 'Contact form enquiry',
        intro: 'A new enquiry came in from the Contact page.', rows }),
      replyTo: v.email,
    })
    return json({ ok: true })
  }

  // ---------- event request ----------
  const name = clip(body.full_name), email = clip(body.email).toLowerCase(), phone = clip(body.phone, 30)
  const eventType = clip(body.event_type, 80), start = clip(body.event_start_date, 10)
  const fields: Record<string, string> = {}
  if (!name) fields.full_name = 'This field is required.'
  if (!EMAIL_RE.test(email)) fields.email = 'Please enter a valid email address.'
  if (phone.replace(/\D/g, '').length < 7) fields.phone = 'Please enter a valid phone number.'
  if (!eventType) fields.event_type = 'Please choose the type of event.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) fields.event_start_date = 'Please choose a date.'
  const amount = Number(body.agreed_amount)
  if (!(amount > 0) || amount > 1_000_000) fields.agreed_amount = 'Please enter the amount agreed with us.'
  if (Object.keys(fields).length) return json({ ok: false, error: 'Please check the highlighted fields.', fields }, 400)
  const end = clip(body.event_end_date, 10)
  const { error } = await db.from('event_bookings').insert({
    full_name: name, email, phone, event_type: eventType, event_start_date: start, event_end_date: /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null,
    event_time: clip(body.event_time, 20), venue: clip(body.venue, 300), expected_guests: Number(body.expected_guests) || null,
    agreed_amount: Math.round(amount * 100) / 100, notes: clip(body.notes, 3000), source: 'event_form',
  })
  if (error) throw error
  await db.from('contact_submissions').insert({ form: 'event', first_name: name, email, phone, service: eventType, event_date: start, location: clip(body.venue, 200), message: clip(body.notes, 3000), ip_hash: hash, status: 'booked' })
  // The confirmation + studio alert are sent by process-emails (event_confirmation / owner_event), as on DMI.
  return json({ ok: true })
}))
