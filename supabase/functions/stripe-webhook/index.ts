/**
 * Stripe webhook (TEST mode during setup). Subscribed events only:
 *   checkout.session.completed, checkout.session.async_payment_succeeded -> record the payment
 *   checkout.session.expired -> release the unpaid booking's 30-minute hold
 *   charge.refunded -> record a refund (negative payment) and update the booking/invoice
 * The signing secret is STRIPE_WEBHOOK_SECRET (Supabase secret). Deployed with verify_jwt = false
 * (Stripe can't send a Supabase token); the Stripe signature is checked instead.
 */
import { service } from '../_shared/auth.ts'
import { verifyWebhook } from '../_shared/stripe.ts'
import { addInvoicePayment, kickEmails, recordCheckoutPayment } from '../_shared/payments.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const payload = await req.text()
  const ok = await verifyWebhook(payload, req.headers.get('stripe-signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '')
  if (!ok) return new Response('Bad signature', { status: 400 })
  const event = JSON.parse(payload)
  const obj = event.data?.object ?? {}
  const db = service()
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const r = await recordCheckoutPayment(obj)
        if (r.recorded) await kickEmails()
        break
      }
      case 'checkout.session.expired': {
        const m = obj.metadata ?? {}
        if (m.booking_table && m.booking_id) {
          await db.from(m.booking_table).update({ status: 'cancelled', cancel_reason: 'Online payment not completed', hold_expires_at: null } as never)
            .eq('id', m.booking_id).eq('status', 'pending_payment')
        }
        break
      }
      case 'charge.refunded': {
        const pi = String(obj.payment_intent ?? '')
        const refunded = (Number(obj.amount_refunded) || 0) / 100
        const { data: orig } = await db.from('payments').select('*').eq('stripe_payment_intent', pi).maybeSingle()
        if (orig && refunded > 0) {
          const { data: already } = await db.from('payments').select('amount').eq('stripe_payment_intent', `${pi}:refund`).maybeSingle()
          const delta = refunded - Math.abs(Number(already?.amount ?? 0))
          if (delta > 0) {
            if (already) await db.from('payments').update({ amount: -refunded }).eq('stripe_payment_intent', `${pi}:refund`)
            else await db.from('payments').insert({ booking_table: orig.booking_table, booking_id: orig.booking_id, invoice_id: orig.invoice_id, amount: -refunded, method: 'stripe', kind: 'refund', stripe_payment_intent: `${pi}:refund`, note: 'Refund via Stripe' })
            if (orig.booking_table && orig.booking_id) await db.rpc('recalc_booking_payment', { p_table: orig.booking_table, p_id: orig.booking_id })
            if (orig.invoice_id) await addInvoicePayment(orig.invoice_id, -delta, 'Refund (Stripe)')
          }
        }
        break
      }
      default:
        break
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('stripe-webhook', event.type, e)
    // 500 makes Stripe retry later
    return new Response('Webhook handler failed', { status: 500 })
  }
})
