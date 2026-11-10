/**
 * Records money received and keeps bookings and invoices in step. Used by the Stripe webhook, the booking
 * status page and the dashboard. Idempotent: a Stripe payment intent is recorded once (unique index).
 */
import { service } from './auth.ts'
import { invoiceStatus, invoiceTotals, normalizeDoc, plain } from './invoice-model.ts'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton' }).format(new Date())

/** Recalculates an invoice's stored figures and status from its document (after a payment or an edit). */
export async function syncInvoice(invoiceId: string) {
  const db = service()
  const { data: inv } = await db.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
  if (!inv) return
  const doc = normalizeDoc(inv.doc)
  const t = invoiceTotals(doc)
  const status = invoiceStatus(t, { sent: !!inv.sent_at, dueDate: doc.dueDate || inv.due_date || undefined, today: today(), void: inv.status === 'void' })
  await db.from('invoices').update({
    subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total, paid: t.paid, balance: t.balance, status,
    paid_at: status === 'paid' ? inv.paid_at ?? new Date().toISOString() : null,
  }).eq('id', invoiceId)
}

/** Adds a payment line to an invoice document, then re-syncs its figures. */
export async function addInvoicePayment(invoiceId: string, amount: number, method: string, date = today()) {
  const db = service()
  const { data: inv } = await db.from('invoices').select('doc').eq('id', invoiceId).maybeSingle()
  if (!inv) return
  const doc = normalizeDoc(inv.doc)
  doc.payments = [...(doc.payments ?? []), { date, method, amount: plain(amount) }]
  await db.from('invoices').update({ doc }).eq('id', invoiceId)
  await syncInvoice(invoiceId)
}

type Session = { id: string; payment_intent?: string | null; amount_total?: number | null; payment_status?: string; metadata?: Record<string, string> }

/** A paid Checkout Session -> payments row, booking amount_paid/status, invoice payment line + status. */
export async function recordCheckoutPayment(session: Session): Promise<{ recorded: boolean }> {
  if (session.payment_status !== 'paid') return { recorded: false }
  const db = service()
  const m = session.metadata ?? {}
  const amount = (Number(session.amount_total) || 0) / 100
  const pi = String(session.payment_intent ?? session.id)
  const { error } = await db.from('payments').insert({
    booking_table: m.booking_table || null,
    booking_id: m.booking_id || null,
    invoice_id: m.invoice_id || null,
    amount,
    method: 'stripe',
    kind: m.kind === 'deposit' ? 'deposit' : m.kind === 'balance' ? 'balance' : 'payment',
    stripe_session_id: session.id,
    stripe_payment_intent: pi,
    note: m.reference ? `Stripe Checkout · ${m.reference}` : 'Stripe Checkout',
  })
  if (error) {
    if (error.code === '23505') return { recorded: false } // already recorded (webhook retry)
    throw error
  }
  if (m.booking_table && m.booking_id) await db.rpc('recalc_booking_payment', { p_table: m.booking_table, p_id: m.booking_id })
  if (m.invoice_id) await addInvoicePayment(m.invoice_id, amount, 'Card (Stripe)')
  else if (m.booking_table && m.booking_id) {
    // an invoice made from this booking gets the payment too
    const { data: inv } = await db.from('invoices').select('id').eq('booking_table', m.booking_table).eq('booking_id', m.booking_id).neq('status', 'void').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (inv) await addInvoicePayment(inv.id, amount, 'Card (Stripe)')
  }
  return { recorded: true }
}

/** Asks the email job to run now (payment receipts and confirmations go out within seconds). */
export async function kickEmails() {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) return
  await fetch(`${url}/functions/v1/process-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '', Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}` },
    body: '{}',
  }).catch(() => undefined)
}
