/**
 * Public: create a booking from the website (sessions, weddings, studio rental).
 *  - validates every field again on the server,
 *  - recalculates the price from the database (the browser's totals are ignored),
 *  - inserts the booking; a session holds its 1-hour slot for 30 minutes while the client pays
 *    (the database refuses a taken or closed slot: errcode 23P01),
 *  - starts Stripe Checkout (CAD, TEST mode during setup) for the deposit set in Settings,
 *  - when online payment is off, the booking is confirmed straight away and the email job announces it.
 * Emails to the client and the studio are sent by process-emails once the booking is confirmed (or paid).
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { service } from '../_shared/auth.ts'
import { createCheckout, stripeReady } from '../_shared/stripe.ts'
import { cents, depositFor, PricingError, quoteSession, quoteStudio, quoteWedding, type Quote } from '../_shared/pricing.ts'
import { EMAIL_RE } from '../_shared/contact-rules.ts'

const clip = (v: unknown, n = 200) => String(v ?? '').trim().slice(0, n)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
const PHONE_RE = /^\+?[0-9 ()\-.]{7,20}$/
const HOLD_MINUTES = 30

const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton' }).format(new Date())
const nowMinutesLocal = () => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Edmonton', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number)
  return h * 60 + m
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay()

function requireClient(c: Record<string, unknown>, dateKey: string) {
  const name = clip(c.full_name, 200)
  const email = clip(c.email, 200).toLowerCase()
  const phone = clip(c.phone, 30)
  if (!name) throw new HttpError('Please enter your full name.')
  if (!EMAIL_RE.test(email)) throw new HttpError('Please enter a valid email address.')
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7) throw new HttpError('Please enter a valid phone number.')
  const date = clip(c[dateKey], 10)
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError('Please choose a valid date.')
  if (date < todayLocal()) throw new HttpError('Please choose a date in the future.')
  return { name, email, phone, date }
}

Deno.serve(handle(async (req, body) => {
  const db = service()
  const kind = body.kind as 'session' | 'wedding' | 'studio'
  if (!['session', 'wedding', 'studio'].includes(kind)) throw new HttpError('Unknown booking type.')

  const { data: settings, error: sErr } = await db.from('business_settings').select('*').eq('id', 1).single()
  if (sErr) throw sErr
  const returnUrl = String(body.returnUrl || Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(returnUrl)) throw new HttpError('Missing return address.')

  // Coupons: validated on the server (codes are never trusted from the browser).
  const promoCode = clip(body.promoCode, 40)
  let promoPercent: number | null = null
  if (promoCode) {
    const fn = kind === 'studio' ? 'validate_studio_space_promo' : 'validate_promo'
    const { data } = await db.rpc(fn, { p_code: promoCode })
    const found = Array.isArray(data) ? data[0] : null
    if (!found) throw new HttpError("That coupon code isn't valid or has expired.")
    promoPercent = Number(found.percent)
  }

  let quote: Quote
  let table: 'bookings' | 'studio_bookings'
  let row: Record<string, unknown>
  let itemName: string

  try {
    if (kind === 'session') {
      const c = (body.client ?? {}) as Record<string, unknown>
      const { name, email, phone, date } = requireClient(c, 'shoot_date')
      const time = clip(c.shoot_time, 5)
      if (!TIME_RE.test(time)) throw new HttpError('Please choose a time for your session.')
      const [{ data: services }, { data: extras }] = await Promise.all([
        db.from('booking_prices').select('*').eq('active', true),
        db.from('booking_extras').select('*').eq('active', true),
      ])
      const svc = (services ?? []).find((s) => s.service_id === body.serviceId && (!body.setting || s.setting === body.setting))
      if (!svc) throw new HttpError('That package is no longer available. Please refresh the page.')
      // opening hours + minimum notice (same rules as the calendar on the page)
      const hours = (settings.opening_hours ?? {})[String(weekday(date))] as [string, string] | null
      const duration = Number(svc.duration_minutes) || 60
      if (!hours || toMin(time) < toMin(hours[0]) || toMin(time) + duration > toMin(hours[1])) throw new HttpError('That time is outside our booking hours. Please pick another slot.', 409, 'slot_taken')
      const daysAhead = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayLocal()}T00:00:00Z`)) / 86400000
      if (daysAhead * 1440 + toMin(time) - nowMinutesLocal() < Number(settings.min_notice_hours ?? 0) * 60) throw new HttpError('That time is too soon. Please pick a later slot.', 409, 'slot_taken')
      if (daysAhead > Number(settings.booking_horizon_days ?? 365)) throw new HttpError('That date is too far ahead to book online. Please contact us.')
      quote = quoteSession(
        { serviceId: svc.service_id, outfits: Number(body.outfits) || 1, extras: Array.isArray(body.extras) ? body.extras.slice(0, 20) : [], promoPercent },
        (services ?? []).filter((s) => s.service_id === svc.service_id).map((s) => ({ id: s.service_id, name: s.name, price: Number(s.price), pricing_mode: s.pricing_mode })),
        (extras ?? []).map((e) => ({ name: e.name, price: Number(e.price), max_qty: e.max_qty, follows_package: e.follows_package })),
      )
      table = 'bookings'
      itemName = `${svc.name} — ${date} ${time}`
      const extrasLine = quote.lines.slice(1).map((l) => l.label).join(' | ')
      row = {
        full_name: name, email, phone, gender: clip(c.gender, 40), shoot_type: clip(c.shoot_type, 60), shoot_date: date, shoot_time: time,
        duration_minutes: duration, date_of_birth: DATE_RE.test(clip(c.date_of_birth, 10)) ? clip(c.date_of_birth, 10) : null,
        social_handles: clip(c.social_handles, 500), inspiration_links: clip(c.inspiration_links, 3000), location: '',
        shoot_setting: svc.setting === 'outdoor' ? 'On location' : 'Studio', selected_service: svc.name, service_price: Number(svc.price),
        service_pricing_mode: svc.pricing_mode, outfits: quote.lines[0].qty, selected_extras: extrasLine,
        extras_detail: quote.lines.slice(1), service_total: quote.serviceTotal, extras_total: quote.extrasTotal,
        discount_total: quote.discount, promo_code: promoPercent ? promoCode.toUpperCase() : null, grand_total: quote.total,
        service_summary: [svc.name, promoPercent ? `Coupon ${promoCode.toUpperCase()} (${promoPercent}% off)` : ''].filter(Boolean).join(' | '),
        source: 'booking_form',
      }
    } else if (kind === 'wedding') {
      const c = (body.client ?? {}) as Record<string, unknown>
      const { name, email, phone, date } = requireClient(c, 'shoot_date')
      const [{ data: packages }, { data: extras }] = await Promise.all([
        db.from('wedding_packages').select('*').eq('active', true),
        db.from('wedding_extras').select('*').eq('active', true),
      ])
      quote = quoteWedding(
        { packageId: clip(body.packageId, 80), days: body.days === 'two' ? 'two' : 'one', extras: Array.isArray(body.extras) ? body.extras.slice(0, 20).map(String) : [], promoPercent },
        (packages ?? []).map((p) => ({ id: p.id, name: p.name, one_event: Number(p.one_event), two_events: p.two_events == null ? null : Number(p.two_events) })),
        (extras ?? []).map((e) => ({ name: e.name, price: Number(e.price) })),
      )
      const pkg = (packages ?? []).find((p) => p.id === body.packageId)!
      table = 'bookings'
      itemName = `Wedding — ${pkg.name} — ${date}`
      row = {
        full_name: name, email, phone, shoot_type: 'Wedding', shoot_date: date, shoot_time: null, duration_minutes: 720,
        location: clip(c.location, 200), shoot_setting: clip(c.shoot_setting, 200) || 'Wedding', selected_service: pkg.name,
        service_price: quote.serviceTotal, service_pricing_mode: 'wedding_package', selected_extras: quote.lines.slice(1).map((l) => l.label).join(' | '),
        extras_detail: quote.lines.slice(1), service_total: quote.serviceTotal, extras_total: quote.extrasTotal, discount_total: quote.discount,
        promo_code: promoPercent ? promoCode.toUpperCase() : null, grand_total: quote.total, notes: clip(c.notes, 3000),
        service_summary: quote.lines[0].label, source: 'wedding_form',
      }
    } else {
      const c = (body.client ?? {}) as Record<string, unknown>
      const { name, email, phone, date } = requireClient(c, 'rental_date')
      const time = clip(c.rental_time, 5)
      if (!TIME_RE.test(time)) throw new HttpError('Please choose a start time.')
      const [{ data: spaces }, { data: extras }] = await Promise.all([
        db.from('studio_space_prices').select('*').eq('active', true),
        db.from('studio_space_extras').select('*').eq('active', true),
      ])
      const q = quoteStudio(
        { spaceId: clip(body.spaceId, 80), extras: Array.isArray(body.extras) ? body.extras.slice(0, 20) : [], promoPercent },
        (spaces ?? []).map((s) => ({ id: s.id, name: s.name, price: Number(s.price), duration_minutes: s.duration_minutes })),
        (extras ?? []).map((e) => ({ id: e.id, name: e.name, price: Number(e.price), max_qty: e.max_qty, follows_package: e.follows_package })),
      )
      quote = q
      const sp = (spaces ?? []).find((s) => s.id === body.spaceId)!
      // the studio can't be rented twice at the same time
      const { data: same } = await db.from('studio_bookings').select('rental_time, duration_minutes, status, hold_expires_at').eq('rental_date', date).neq('status', 'cancelled')
      const s0 = toMin(time), s1 = s0 + q.durationMinutes
      const clash = (same ?? []).some((r) => r.rental_time && (r.status !== 'pending_payment' || !r.hold_expires_at || Date.parse(r.hold_expires_at) > Date.now()) && toMin(r.rental_time) < s1 && s0 < toMin(r.rental_time) + (r.duration_minutes || 60))
      if (clash) throw new HttpError('That time has just been taken. Please pick another time.', 409, 'slot_taken')
      table = 'studio_bookings'
      itemName = `Studio rental — ${sp.name} — ${date} ${time}`
      row = {
        full_name: name, email, phone, rental_date: date, rental_time: time, space_name: sp.name, space_price: Number(sp.price),
        duration_minutes: q.durationMinutes, selected_extras: q.lines.slice(1).map((l) => l.label).join(' | '), extras_total: q.extrasTotal,
        space_total: q.serviceTotal, discount_total: q.discount, promo_code: promoPercent ? promoCode.toUpperCase() : null, grand_total: q.total,
        notes: clip(c.notes, 2000), source: 'studio_space_form',
      }
    }
  } catch (e) {
    if (e instanceof PricingError) throw new HttpError(e.message)
    throw e
  }

  const deposit = settings.online_payments_enabled ? depositFor(quote.total, settings) : 0
  const takePayment = deposit > 0 && stripeReady()
  row.deposit_amount = deposit
  row.status = takePayment ? 'pending_payment' : 'confirmed'
  row.hold_expires_at = takePayment ? new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString() : null

  const { data: inserted, error: insErr } = await db.from(table).insert(row).select('id').single()
  if (insErr) {
    if (insErr.code === '23P01') throw new HttpError('That time has just been taken. Please pick another slot.', 409, 'slot_taken')
    throw insErr
  }
  const bookingId = inserted.id as string
  const reference = bookingId.slice(0, 6).toUpperCase()

  let checkoutUrl: string | null = null
  if (takePayment) {
    const session = await createCheckout({
      amountCents: cents(deposit),
      name: deposit < quote.total ? `Deposit · ${itemName}` : itemName,
      description: `Tplum Photography booking ${reference}. Total ${quote.total.toFixed(2)} CAD.`,
      email: String(row.email),
      successUrl: `${returnUrl}/booking/confirmed/?b=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${returnUrl}/booking/confirmed/?b=${bookingId}&cancelled=1`,
      metadata: { booking_table: table, booking_id: bookingId, kind: 'deposit', reference },
      expiresInMinutes: HOLD_MINUTES,
    })
    await db.from(table).update({ stripe_session_id: session.id }).eq('id', bookingId)
    checkoutUrl = session.url
  }

  return json({ ok: true, bookingId, reference, total: quote.total, deposit, checkoutUrl })
}))
