// GENERATED from src/features/invoices/model.ts by scripts/sync-shared.mjs — do not edit here.
/**
 * The invoice as data, shared by the form, the preview and the PDF. No React and no browser APIs in here.
 * Amounts are kept as the text the admin typed, so a half-typed "12." stays in the field; the sums work in cents.
 * Ported from DMI; Tplum adds sales tax (GST/HST, off by default), Interac e-Transfer details and invoice statuses.
 */
export type InvoiceItem = { title: string; description: string; qty: string; rate: string; amount: string }
export type InvoicePayment = { date: string; method: string; amount: string }
export type InvoiceStage = 'before' | 'part' | 'paid'

export type InvoiceDoc = {
  /** a data: URL when the studio uploaded its own logo; empty means the standard Tplum logo */
  logo: string
  title: string
  number: string
  invoiceDate: string
  terms: string
  dueDate: string
  fromName: string
  fromAddress: string
  billName: string
  billEmail: string
  billPhone: string
  billAddress: string
  items: InvoiceItem[]
  discountLabel: string
  discount: string
  payments: InvoicePayment[]
  notes: string
  bankName: string
  accountName: string
  accountNumber: string
  paymentReference: string
  /** Interac e-Transfer email clients send money to (Canada) */
  etransferEmail: string
  /** free text shown under "How to pay" (e.g. e-Transfer password rules, card payment link note) */
  paymentInstructions: string
  termsTitle: string
  termsText: string
  /** sales tax: off by default; name like "GST" or "HST", rate in percent, and the business number */
  taxEnabled: boolean
  taxName: string
  taxRate: string
  taxNumber: string
  footerText: string
}

/** the fields that stay the same from invoice to invoice ("Save as default" in the form) */
export const BUSINESS_FIELDS = ['logo', 'fromName', 'fromAddress', 'notes', 'bankName', 'accountName', 'accountNumber', 'paymentReference', 'etransferEmail', 'paymentInstructions', 'termsTitle', 'termsText', 'taxEnabled', 'taxName', 'taxRate', 'taxNumber', 'footerText'] as const
export type BusinessDefaults = Partial<Pick<InvoiceDoc, (typeof BUSINESS_FIELDS)[number]>>

export const emptyItem = (): InvoiceItem => ({ title: '', description: '', qty: '1', rate: '', amount: '' })

export function blankInvoice(today: string, defaults: BusinessDefaults = {}): InvoiceDoc {
  return {
    logo: '',
    title: 'INVOICE',
    number: '',
    invoiceDate: today,
    terms: 'Due on Receipt',
    dueDate: today,
    fromName: 'Tplum Photography',
    fromAddress: '[Business address — edit in Invoice settings]\nCalgary, AB\n+1 (403) 493-5511\ninfo@tplumphotography.com',
    billName: '',
    billEmail: '',
    billPhone: '',
    billAddress: '',
    items: [emptyItem()],
    discountLabel: 'Discount',
    discount: '',
    payments: [],
    notes: 'Thank you for choosing Tplum Photography.',
    bankName: '',
    accountName: '',
    accountNumber: '',
    paymentReference: 'Invoice number',
    etransferEmail: '[e-Transfer email — edit in Invoice settings]',
    paymentInstructions: 'Pay by Interac e-Transfer, or by card using the "Pay online" button on your invoice link.',
    termsTitle: 'Terms & Conditions',
    termsText: '[Payment terms — edit in Invoice settings]',
    taxEnabled: false,
    taxName: 'GST',
    taxRate: '5',
    taxNumber: '',
    footerText: '[Invoice footer — edit in Invoice settings]',
    ...defaults,
  }
}

/** an old or partial row still opens: anything missing falls back to a blank field */
export const normalizeDoc = (raw: Partial<InvoiceDoc> | null | undefined): InvoiceDoc => ({ ...blankInvoice(''), ...(raw ?? {}) })

/* ---------------------------------- money ---------------------------------- */
export const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[$,\s]|CAD/gi, ''))
  return Number.isFinite(n) ? n : 0
}
const kobo = (v: unknown) => Math.round(num(v) * 100) // cents (name kept from DMI)
const figures = (n: number) => Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (n: number) => `${n < 0 ? '-' : ''}$${figures(n)}`
/** the figure without the $, for the Rate and Amount columns */
export const bare = (n: number) => `${n < 0 ? '-' : ''}${figures(n)}`
/** a number for an amount field: "160000" or "12.50" */
export const plain = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** the amount for qty × rate, as the Amount field shows it */
export const lineAmount = (qty: string, rate: string) => (String(rate).trim() === '' ? '' : plain(Math.round(num(qty) * num(rate) * 100) / 100))

export type InvoiceTotals = { subtotal: number; discount: number; taxable: number; tax: number; total: number; paid: number; balance: number; overpaid: number; stage: InvoiceStage }

/** Sales tax is charged on the subtotal after the discount, only when switched on (off by default). */
export function invoiceTotals(doc: Pick<InvoiceDoc, 'items' | 'discount' | 'payments'> & Partial<Pick<InvoiceDoc, 'taxEnabled' | 'taxRate'>>): InvoiceTotals {
  const subtotal = (doc.items ?? []).reduce((s, i) => s + kobo(i.amount), 0)
  const discount = Math.min(Math.max(0, kobo(doc.discount)), Math.max(0, subtotal))
  const taxable = subtotal - discount
  const rate = doc.taxEnabled ? Math.max(0, Math.min(100, num(doc.taxRate))) : 0
  const tax = Math.round((taxable * rate) / 100)
  const total = taxable + tax
  const paid = (doc.payments ?? []).reduce((s, p) => s + kobo(p.amount), 0)
  const stage: InvoiceStage = total > 0 && paid >= total ? 'paid' : paid > 0 ? 'part' : 'before'
  return { subtotal: subtotal / 100, discount: discount / 100, taxable: taxable / 100, tax: tax / 100, total: total / 100, paid: paid / 100, balance: Math.max(0, total - paid) / 100, overpaid: Math.max(0, paid - Math.max(0, total)) / 100, stage }
}

export type InvoiceStatus = 'draft' | 'sent' | 'part_paid' | 'paid' | 'overdue' | 'void'
export const STATUS_LABEL: Record<InvoiceStatus, string> = { draft: 'Draft', sent: 'Sent', part_paid: 'Part paid', paid: 'Paid', overdue: 'Overdue', void: 'Void' }
export const STATUS_TONE: Record<InvoiceStatus, string> = { draft: 'grey', sent: 'blue', part_paid: 'amber', paid: 'green', overdue: 'red', void: 'grey' }

/**
 * The invoice's status, recalculated from its figures every time it is saved or a payment is recorded:
 * paid in full -> paid; never sent -> draft; money still owed past the due date -> overdue; part paid -> part_paid; else sent.
 */
export function invoiceStatus(t: Pick<InvoiceTotals, 'total' | 'paid' | 'balance'>, opts: { sent: boolean; dueDate?: string; today: string; void?: boolean }): InvoiceStatus {
  if (opts.void) return 'void'
  if (t.total > 0 && t.balance <= 0) return 'paid'
  if (!opts.sent) return t.paid > 0 ? 'part_paid' : 'draft'
  if (opts.dueDate && opts.dueDate < opts.today && t.balance > 0) return 'overdue'
  return t.paid > 0 ? 'part_paid' : 'sent'
}

export const STAGE_LABEL: Record<InvoiceStage, string> = { before: 'Before payment', part: 'Part paid', paid: 'Paid in full' }
export const STAGE_TONE: Record<InvoiceStage, string> = { before: 'amber', part: 'blue', paid: 'green' }
/** the mark on the paper; an invoice nothing has been paid on has none */
export const STAGE_STAMP: Record<InvoiceStage, string> = { before: '', part: 'PART PAID', paid: 'PAID' }

/* ---------------------------------- layout ---------------------------------- */
/** 08/09/26 */
export function shortDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso ?? ''
}

export type TermsLine = { kind: 'head' | 'bullet' | 'text' | 'gap'; text: string }
/** the terms text as the preview and the PDF both lay it out */
export function parseTerms(text: string): TermsLine[] {
  return (text ?? '').split(/\r?\n/).map((raw) => {
    const line = raw.trim()
    if (!line) return { kind: 'gap', text: '' }
    if (/^[•\-*]\s+/.test(line)) return { kind: 'bullet', text: line.replace(/^[•\-*]\s+/, '') }
    if (/^\d+\.\s/.test(line) && line.length < 80) return { kind: 'head', text: line }
    return { kind: 'text', text: line }
  })
}

/** the bank lines under the notes; a blank field leaves its line out */
export function bankLines(doc: Pick<InvoiceDoc, 'bankName' | 'accountName' | 'accountNumber' | 'paymentReference'> & Partial<Pick<InvoiceDoc, 'etransferEmail'>>) {
  return [
    doc.etransferEmail?.trim() && `Interac e-Transfer to: ${doc.etransferEmail.trim()}`,
    doc.bankName?.trim() && `Bank: ${doc.bankName.trim()}`,
    doc.accountName?.trim() && `Account name: ${doc.accountName.trim()}`,
    doc.accountNumber?.trim() && `Account number: ${doc.accountNumber.trim()}`,
    doc.paymentReference?.trim() && `Payment reference: ${doc.paymentReference.trim()}`,
  ].filter(Boolean) as string[]
}

/** Invoice-INV-000001.pdf: safe in a filename whatever was typed into the number field */
export const pdfFilename = (number: string) => `Invoice-${(number || 'draft').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60)}.pdf`

/** TPL-0041 → TPL-0042, from the highest number used so far. Any prefix the studio uses carries on. */
export function nextNumber(used: string[], fallback = 'TPL-0001') {
  let best: { prefix: string; n: number; width: number } | null = null
  for (const u of used) {
    const m = /^(.*?)(\d+)$/.exec(u.trim())
    if (!m) continue
    const n = Number(m[2])
    if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length }
  }
  return best ? `${best.prefix}${String(best.n + 1).padStart(best.width, '0')}` : fallback
}

/* ---------------------------------- email ---------------------------------- */
export function defaultEmail(doc: InvoiceDoc) {
  const t = invoiceTotals(doc)
  const first = doc.billName.trim().split(/\s+/)[0] || 'there'
  const number = doc.number.trim()
  const bank = t.balance > 0 ? bankLines(doc) : []
  const payTo = bank.length ? `\n\nHow to pay:\n${bank.join('\n')}` : ''
  const due = doc.dueDate ? ` by ${shortDate(doc.dueDate)}` : ''
  if (t.stage === 'paid') {
    return {
      subject: `Paid in full: invoice ${number} from Tplum Photography`,
      message: `Hi ${first},\n\nThank you. We have received your payment and invoice ${number} is now paid in full (${money(t.total)}).\n\nYour copy is attached as a PDF for your records.`,
    }
  }
  if (t.stage === 'part') {
    return {
      subject: `Payment received: ${money(t.balance)} left on invoice ${number}`,
      message: `Hi ${first},\n\nThank you for your payment. So far you have paid ${money(t.paid)} of ${money(t.total)}, which leaves a balance of ${money(t.balance)}${due}.\n\nYour updated invoice ${number} is attached as a PDF.${payTo}`,
    }
  }
  return {
    subject: `Invoice ${number} from Tplum Photography: ${money(t.balance)} due`,
    message: `Hi ${first},\n\nYour invoice ${number} for ${money(t.total)} is attached as a PDF. The amount due is ${money(t.balance)}${due}.${payTo}`,
  }
}

/* ------------------------------ from a booking ------------------------------ */
/** the three booking tables an invoice can be made from */
export type BookingTable = 'bookings' | 'studio_bookings' | 'event_bookings'
export const BOOKING_TABLES: BookingTable[] = ['bookings', 'studio_bookings', 'event_bookings']
export const isBookingTable = (v: unknown): v is BookingTable => BOOKING_TABLES.includes(v as BookingTable)
export const BOOKING_KIND: Record<BookingTable, string> = { bookings: 'Photo session', studio_bookings: 'Studio rental', event_bookings: 'Event' }

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v).trim())

/** what the client owes on a booking: events have an agreed amount, the others a grand total */
export const bookingTotal = (table: BookingTable, b: Row) => num(table === 'event_bookings' ? b.agreed_amount : b.grand_total)

/** how much of the booking is paid (Paid counts as the whole total, as everywhere else in the dashboard) */
export function bookingPaid(table: BookingTable, b: Row) {
  const total = bookingTotal(table, b)
  if (b.payment_status === 'Paid') return total
  if (b.payment_status === 'Part Payment') return Math.min(num(b.amount_paid), total || num(b.amount_paid))
  return 0
}

/** The booking's payment as one invoice line (the running amount paid, e.g. the deposit). Individual payments are listed in the dashboard. */
export function paymentsFromBooking(table: BookingTable, b: Row): InvoicePayment[] {
  const paid = bookingPaid(table, b)
  if (paid <= 0) return []
  return [{ date: s(b.payment_updated_at).slice(0, 10), method: '', amount: plain(paid) }]
}

const time12 = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  const h = Number(m[1])
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}
const duration = (mins: number) => {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return [h && `${h} hr${h === 1 ? '' : 's'}`, m && `${m} min`].filter(Boolean).join(' ')
}
const lines = (pairs: [string, string][]) => pairs.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')

/** The client and the priced lines of a booking, before payments. */
function bookingLines(table: BookingTable, b: Row): { items: InvoiceItem[]; discountLabel?: string; discount: number } {
  const total = bookingTotal(table, b)
  if (table === 'event_bookings') {
    const dates = [s(b.event_start_date), s(b.event_end_date)].filter(Boolean).map(shortDate)
    const description = lines([
      ['Date', [...new Set(dates)].join(' – ')], ['Time', s(b.event_time)], ['Venue', s(b.venue)],
      ['Guests', s(b.expected_guests)],
    ])
    return { items: [{ title: s(b.event_type) ? `Event coverage: ${s(b.event_type)}` : 'Event coverage', description, qty: '1', rate: total ? plain(total) : '', amount: total ? plain(total) : '' }], discount: 0 }
  }
  const studio = table === 'studio_bookings'
  const main = studio ? num(b.space_total) || num(b.space_price) : num(b.service_total)
  const extras = num(b.extras_total)
  const description = studio
    ? lines([['Date', b.rental_date ? shortDate(s(b.rental_date)) : ''], ['Time', time12(s(b.rental_time))], ['Duration', duration(num(b.duration_minutes))]])
    : lines([
        ['Shoot', s(b.shoot_type)], ['Date', b.shoot_date ? shortDate(s(b.shoot_date)) : ''], ['Time', time12(s(b.shoot_time))],
        ['Location', s(b.location)], ['Setting', s(b.shoot_setting)], ['Outfits', s(b.outfits)],
      ])
  const title = studio ? `Studio rental: ${s(b.space_name) || 'rental'}` : s(b.selected_service) || s(b.shoot_type) || 'Photo session'
  const discount = Math.round((main + extras - total) * 100) / 100
  // the booking's own lines, as long as they still explain its total (a total edited by hand gets one line instead)
  if (main > 0 && discount >= 0) {
    const items: InvoiceItem[] = [{ title, description, qty: '1', rate: plain(main), amount: plain(main) }]
    if (extras > 0) items.push({ title: 'Extras', description: s(b.selected_extras), qty: '1', rate: plain(extras), amount: plain(extras) })
    const coupon = /coupon\s+([A-Z0-9_-]+)/i.exec(s(b.service_summary))?.[1]
    return { items, discount, discountLabel: discount > 0 && coupon ? `Coupon ${coupon.toUpperCase()}` : undefined }
  }
  const extra = s(b.selected_extras)
  return { items: [{ title, description: [description, extra && `Extras: ${extra}`].filter(Boolean).join('\n'), qty: '1', rate: total ? plain(total) : '', amount: total ? plain(total) : '' }], discount: 0 }
}

/** Fills the client, the items and the payments from a booking. Keeps the business fields of `base`. */
export function invoiceFromBooking(base: InvoiceDoc, table: BookingTable, b: Row): InvoiceDoc {
  const { items, discount, discountLabel } = bookingLines(table, b)
  return {
    ...base,
    billName: s(b.full_name),
    billEmail: s(b.email),
    billPhone: s(b.phone),
    billAddress: '',
    items,
    discountLabel: discountLabel ?? base.discountLabel,
    discount: discount > 0 ? plain(discount) : '',
    payments: paymentsFromBooking(table, b),
  }
}
