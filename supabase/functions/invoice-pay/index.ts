/**
 * Public: "Pay online" on the client's invoice page (/invoice/<token>/). Starts Stripe Checkout (CAD) for the
 * invoice's current balance, recalculated on the server from the saved invoice. The webhook records the payment,
 * adds it to the invoice and updates its status (part paid / paid) automatically.
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { service } from '../_shared/auth.ts'
import { createCheckout, stripeReady } from '../_shared/stripe.ts'
import { invoiceTotals, normalizeDoc } from '../_shared/invoice-model.ts'
import { cents } from '../_shared/pricing.ts'

Deno.serve(handle(async (_req, body) => {
  const token = String(body.token ?? '')
  if (!/^[0-9a-f]{40,80}$/.test(token)) throw new HttpError('Invoice not found.', 404)
  const db = service()
  const { data: inv } = await db.from('invoices').select('*').eq('public_token', token).maybeSingle()
  if (!inv || inv.status === 'draft' || inv.status === 'void') throw new HttpError('Invoice not found.', 404)
  const { data: settings } = await db.from('business_settings').select('online_payments_enabled').eq('id', 1).single()
  if (!settings?.online_payments_enabled || !stripeReady()) throw new HttpError('Online payment is not available for this invoice. Please use the payment instructions on the invoice.')
  const doc = normalizeDoc(inv.doc)
  const t = invoiceTotals(doc)
  if (t.balance <= 0) throw new HttpError('This invoice is already paid in full. Thank you!')
  const site = String(body.returnUrl || Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  const session = await createCheckout({
    amountCents: cents(t.balance),
    name: `Invoice ${inv.number}`,
    description: `Tplum Photography · balance on invoice ${inv.number}`,
    email: inv.client_email || doc.billEmail || undefined,
    successUrl: `${site}/invoice/${token}/?paid=1`,
    cancelUrl: `${site}/invoice/${token}/`,
    metadata: { invoice_id: inv.id, booking_table: inv.booking_table ?? '', booking_id: inv.booking_id ?? '', kind: 'balance', reference: inv.number },
    expiresInMinutes: 60,
  })
  return json({ ok: true, url: session.url })
}))
