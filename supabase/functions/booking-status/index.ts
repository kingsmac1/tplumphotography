/**
 * Public: what the booking confirmation page shows after Stripe Checkout (or a direct booking).
 * Keyed by the booking id from the return URL (an unguessable UUID); returns no contact details.
 * If Stripe says the session is paid but the webhook hasn't landed yet, the payment is recorded here
 * (same idempotent path as the webhook, keyed by the payment intent), so the client never sees "unpaid" by mistake.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { service } from '../_shared/auth.ts'
import { stripe, stripeReady } from '../_shared/stripe.ts'
import { recordCheckoutPayment } from '../_shared/payments.ts'

Deno.serve(handle(async (_req, body) => {
  const id = String(body.b ?? body.ref ?? '')
  if (!isUuid(id)) throw new HttpError('Booking not found.', 404)
  const db = service()
  let table: 'bookings' | 'studio_bookings' = 'bookings'
  let { data: b } = await db.from('bookings').select('id, full_name, shoot_type, selected_service, shoot_date, shoot_time, grand_total, amount_paid, payment_status, status, stripe_session_id').eq('id', id).maybeSingle()
  if (!b) {
    const s = await db.from('studio_bookings').select('id, full_name, space_name, rental_date, rental_time, grand_total, amount_paid, payment_status, status, stripe_session_id').eq('id', id).maybeSingle()
    if (!s.data) throw new HttpError('Booking not found.', 404)
    table = 'studio_bookings'
    b = { ...s.data, shoot_type: 'Studio rental', selected_service: s.data.space_name, shoot_date: s.data.rental_date, shoot_time: s.data.rental_time } as typeof b
  }
  const sid = String(body.session_id ?? '')
  if (sid && b!.stripe_session_id === sid && Number(b!.amount_paid || 0) <= 0 && stripeReady()) {
    const session = await stripe(`/checkout/sessions/${sid}`, undefined, 'GET').catch(() => null)
    if (session?.payment_status === 'paid') {
      await recordCheckoutPayment(session)
      const again = await db.from(table).select('amount_paid, payment_status, status').eq('id', id).single()
      Object.assign(b!, again.data)
    }
  }
  const total = Number(b!.grand_total) || 0
  const paid = Number(b!.amount_paid) || 0
  return json({
    ok: true,
    reference: id.slice(0, 6).toUpperCase(),
    kind: [b!.shoot_type, b!.selected_service].filter(Boolean).join(' · '),
    name: String(b!.full_name ?? '').split(/\s+/)[0],
    when: [b!.shoot_date, b!.shoot_time ? String(b!.shoot_time).slice(0, 5) : ''].filter(Boolean).join(' at '),
    total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100),
    paymentStatus: b!.payment_status, status: b!.status,
  })
}))
