/**
 * Admin: email an invoice to the client with its PDF attached (Dashboard → Invoices → Email to client).
 * The PDF is made in the dashboard (the same file the admin can download) and sent here as base64. The payment stage
 * (before payment / part paid / paid in full) is worked out again here from the saved invoice, not taken from the page.
 * After a send: the invoice records when, to whom and at which stage; email_log keeps a line like every other email.
 * MAIL_DRY_RUN=1 (a function secret) checks everything but sends nothing, for testing.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'
import { mailConfig, sendEmail } from '../_shared/email.ts'
import { invoiceEmail } from '../_shared/email-templates.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PDF_BASE64 = 7_000_000 // about 5 MB of PDF

type Doc = { number?: string; billName?: string; items?: { amount?: string }[]; discount?: string; payments?: { amount?: string }[] }
const kobo = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[$,\s]|NGN/gi, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
/** the same sums as the dashboard (src/features/invoices/model.ts → invoiceTotals) */
export function totals(doc: Doc) {
  const subtotal = (doc.items ?? []).reduce((s, i) => s + kobo(i.amount), 0)
  const total = subtotal - kobo(doc.discount)
  const paid = (doc.payments ?? []).reduce((s, p) => s + kobo(p.amount), 0)
  const stage = total > 0 && paid >= total ? 'paid' : paid > 0 ? 'part' : 'before'
  return { total: total / 100, paid: paid / 100, balance: Math.max(0, total - paid) / 100, stage: stage as 'before' | 'part' | 'paid' }
}
export const pdfFilename = (number: string) => `Invoice-${(number || 'draft').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60)}.pdf`

Deno.serve(handle(async (req, body) => {
  const who = await requireAdmin(req)
  if (!isUuid(body.invoice_id)) throw new HttpError('Missing invoice.')
  const to = String(body.to ?? '').trim().toLowerCase()
  const subject = String(body.subject ?? '').trim().slice(0, 200)
  const message = String(body.message ?? '').trim().slice(0, 5000)
  const pdf = String(body.pdf ?? '')
  if (!EMAIL_RE.test(to)) throw new HttpError('Enter a valid email address.')
  if (!subject || !message) throw new HttpError('Enter a subject and a message.')
  if (!pdf.startsWith('JVBERi0')) throw new HttpError('The invoice PDF is missing. Please try again.') // base64 of "%PDF-"
  if (pdf.length > MAX_PDF_BASE64) throw new HttpError('The invoice PDF is too large to email (over 5 MB). Use a smaller logo.')

  const db = service()
  const { data: inv, error } = await db.from('invoices').select('*').eq('id', body.invoice_id).maybeSingle()
  if (error) throw new HttpError(error.message, 500)
  if (!inv) throw new HttpError('This invoice no longer exists.', 404)
  const doc = (inv.doc ?? {}) as Doc
  const t = totals(doc)
  const number = String(inv.number)
  const filename = pdfFilename(number)
  const cfg = mailConfig()
  const email = invoiceEmail({ siteUrl: cfg.siteUrl, subject, message, stage: t.stage, number, filename, total: t.total, paid: t.paid, balance: t.balance })

  if (Deno.env.get('MAIL_DRY_RUN') === '1') return json({ ok: true, dryRun: true, stage: t.stage, email: { to, subject: email.subject }, attachment: { filename, bytes: Math.floor(pdf.length * 0.75) } })

  const sent = await sendEmail({ to, replyTo: cfg.owners[0], message: email, attachments: [{ filename, content: pdf, content_type: 'application/pdf' }] })
  const now = new Date().toISOString()
  // the email has gone (or failed); recording it must never be reported as a failed send
  await Promise.allSettled([
    sent.sent ? db.from('invoices').update({ sent_at: now, sent_to: to, sent_stage: t.stage, sent_count: (Number(inv.sent_count) || 0) + 1 }).eq('id', inv.id) : Promise.resolve(),
    db.from('email_log').insert({ dedupe_key: `invoice:${inv.id}:${now}`, template_key: `invoice_${t.stage}`, recipient: to, subject: email.subject, status: sent.sent ? 'sent' : 'failed', error: sent.error ?? null, source_table: 'invoices', source_id: inv.id }),
  ]).then((r) => r.forEach((x) => x.status === 'rejected' && console.error('invoice record failed', x.reason)))
  if (!sent.sent) throw new HttpError(sent.error ?? 'The email could not be sent.', 502)
  console.log(`invoice ${number} sent by ${who.email}`)
  return json({ ok: true, sent_at: now, stage: t.stage })
}))
