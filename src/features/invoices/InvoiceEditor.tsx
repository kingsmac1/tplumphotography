import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { callFn } from '@/features/gallery/api'
import { useData } from '@/features/gallery/admin/kit/data'
import { Badge, Field, fmtDate } from '@/features/gallery/admin/kit/ui'
import { Modal, addDaysIso, todayIso } from './ui'
import { BOOKING_KIND, BUSINESS_FIELDS, STAGE_LABEL, STAGE_TONE, blankInvoice, bookingPaid, defaultEmail, emptyItem, invoiceFromBooking, invoiceStatus, invoiceTotals, isBookingTable, lineAmount, money, nextNumber, normalizeDoc, paymentsFromBooking, pdfFilename, plain, type BookingTable, type BusinessDefaults, type InvoiceDoc, type InvoicePayment, type InvoiceStage } from './model'
import { DEFAULT_LOGO } from './logo'
import { InvoicePaper } from './InvoicePaper'
import { SETUP_NOTE, missingTable, type InvoiceRow } from './InvoicesSection'
import { LEAVE_QUESTION, setInvoiceDirty } from './guard'
import './invoices.css'

const METHODS = ['Bank transfer', 'POS', 'Cash', 'Paystack', 'Flutterwave', 'Other']
const TERMS: Record<string, number> = { 'Due on Receipt': 0, 'Due in 3 days': 3, 'Due in 7 days': 7, 'Due in 14 days': 14, 'Due in 30 days': 30 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** the part payment the Part paid button starts with, before the admin types the real amount */
const PART_SHARE = 0.7

type Booking = Record<string, unknown> & { id: string }

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ad-card"><h3>{title}</h3>{children}</section>
)

/** Shrinks an uploaded logo and re-encodes it, so only a small PNG is ever stored or put in the PDF. */
function logoToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 800 / img.naturalWidth, 300 / img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Choose a JPG or PNG.')) }
    img.src = url
  })
}

/**
 * The invoice form with the live preview beside it.
 *   `#invoices/new`                                a blank invoice for anyone
 *   `#invoices/new/<table>/<bookingId>`            a new invoice filled in from a booking
 *   `#invoices/booking/<table>/<bookingId>[/send]` the booking's latest invoice with its payment brought up to date (or a new one)
 *   `#invoices/<id>`                               a saved invoice
 * <table> is bookings (photo and wedding), studio_bookings or event_bookings.
 */
export function InvoiceEditor({ path }: { path: string[] }) {
  const { toast } = useData()
  const [mode, tableArg, bookingArg, after] = path
  const fromBooking = (mode === 'booking' || mode === 'new') && isBookingTable(tableArg) && !!bookingArg
  const startTable = fromBooking ? (tableArg as BookingTable) : null
  const startBooking = fromBooking ? bookingArg : null

  const [id, setId] = useState<string | null>(mode !== 'new' && mode !== 'booking' ? mode : null)
  const [link, setLink] = useState<{ table: BookingTable; id: string } | null>(startTable && startBooking ? { table: startTable, id: startBooking } : null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [doc, setDoc] = useState<InvoiceDoc | null>(null)
  const [row, setRow] = useState<InvoiceRow | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [reused, setReused] = useState<string | null>(null)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState('')
  const [send, setSend] = useState<null | { to: string; subject: string; message: string }>(null)

  const loadBooking = async (table: BookingTable, bookingId: string) => {
    const { data } = await supabase.from(table).select('*').eq('id', bookingId).maybeSingle()
    return (data as Booking | null) ?? null
  }

  /* ---------- open ---------- */
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    ;(async () => {
      const today = todayIso()
      const [{ data: all, error: err }, { data: defaultsRow }, startRow] = await Promise.all([
        supabase.from('invoices').select('id,number,booking_table,booking_id,created_at').order('created_at', { ascending: false }).limit(5000),
        supabase.from('invoice_settings').select('value').eq('key', 'defaults').maybeSingle(),
        startTable && startBooking ? loadBooking(startTable, startBooking) : Promise.resolve(null),
      ])
      const defaults = ((defaultsRow as { value?: BusinessDefaults } | null)?.value ?? {}) as BusinessDefaults
      if (startBooking && !startRow) { setError('That booking could not be found. It may have been deleted.'); return }
      setBooking(startRow)
      if (err) { setError(missingTable(err.message) ? SETUP_NOTE : err.message); setDoc(startRow ? invoiceFromBooking(blankInvoice(today, defaults), startTable!, startRow) : blankInvoice(today, defaults)); return }
      const used = (all ?? []) as { id: string; number: string; booking_table: string | null; booking_id: string | null }[]
      let openId = mode !== 'new' && mode !== 'booking' ? mode : null
      if (mode === 'booking') openId = used.find((u) => u.booking_id === startBooking && u.booking_table === startTable)?.id ?? null

      if (openId) {
        const { data, error: e2 } = await supabase.from('invoices').select('*').eq('id', openId).maybeSingle()
        if (e2 || !data) { setError(e2?.message ?? 'This invoice no longer exists.'); return }
        const r = data as InvoiceRow
        let opening = normalizeDoc(r.doc)
        setRow(r); setId(r.id)
        const linkedTable = isBookingTable(r.booking_table) ? r.booking_table : null
        setLink(linkedTable && r.booking_id ? { table: linkedTable, id: r.booking_id } : null)
        if (mode === 'booking' && startRow && startTable) {
          // arriving from the booking: its payment is the up-to-date one
          const fresh = paymentsFromBooking(startTable, startRow)
          if (JSON.stringify(fresh) !== JSON.stringify(opening.payments)) { opening = { ...opening, payments: fresh }; setDirty(true) }
          setReused(r.number)
        } else if (linkedTable && r.booking_id) {
          setBooking(await loadBooking(linkedTable, r.booking_id))
        }
        setDoc(opening)
        if (after === 'send') openSend(opening)
        return
      }
      // TPL-0001, TPL-0002 … from the database counter (never reused); falls back to the highest number in use
      const { data: dbNumber } = await supabase.rpc('next_invoice_number')
      const base = { ...blankInvoice(today, defaults), number: (typeof dbNumber === 'string' && dbNumber) || nextNumber(used.map((u) => u.number)) }
      const start = startRow && startTable ? invoiceFromBooking(base, startTable, startRow) : base
      setDoc(start)
      setDirty(!!startRow)
      if (after === 'send') openSend(start)
    })().catch((e) => setError(e instanceof Error ? e.message : 'This invoice could not be opened.'))
    // opens once; the form owns the invoice from then on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- nothing typed is lost by accident ---------- */
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  useEffect(() => { setInvoiceDirty(dirty) }, [dirty])
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault() }
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
      if (a && dirtyRef.current && !a.getAttribute('target') && !window.confirm(LEAVE_QUESTION)) { e.preventDefault(); e.stopPropagation() }
      else if (a && !a.getAttribute('target')) setInvoiceDirty(false)
    }
    window.addEventListener('beforeunload', leave)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', leave); document.removeEventListener('click', click, true); setInvoiceDirty(false) }
  }, [])

  const totals = useMemo(() => (doc ? invoiceTotals(doc) : null), [doc])
  if (error && !doc) return <div className="ad-note" role="alert">{error} <a href="#invoices">Back to invoices</a></div>
  if (!doc || !totals) return <p className="ad-muted">Loading…</p>

  const patch = (p: Partial<InvoiceDoc>) => { setDoc((c) => (c ? { ...c, ...p } : c)); setDirty(true) }
  const text = (k: keyof InvoiceDoc) => ({ value: doc[k] as string, onChange: (e: { target: { value: string } }) => patch({ [k]: e.target.value } as Partial<InvoiceDoc>) })

  const setItem = (n: number, p: Partial<InvoiceDoc['items'][number]>) => patch({ items: doc.items.map((it, i) => {
    if (i !== n) return it
    const next = { ...it, ...p }
    // qty × rate fills the amount; typing in Amount itself overrides it (a discounted line, say)
    return 'qty' in p || 'rate' in p ? { ...next, amount: lineAmount(next.qty, next.rate) } : next
  }) })
  const setPayment = (n: number, p: Partial<InvoicePayment>) => patch({ payments: doc.payments.map((x, i) => (i === n ? { ...x, ...p } : x)) })

  /** The three buttons only change the payment lines: the status always follows from the money, so they cannot disagree. */
  function chooseStage(s: InvoiceStage) {
    const t = invoiceTotals(doc!)
    if (s === t.stage) return
    const today = todayIso()
    if (s === 'before') {
      if (!window.confirm('Remove the payment lines from this invoice?')) return
      return patch({ payments: [] })
    }
    if (t.total <= 0) return toast('Add an item with a price first', 'err')
    if (s === 'paid') return patch({ payments: [...doc!.payments, { date: today, method: 'Interac e-Transfer', amount: plain(t.balance) }] })
    const part = plain(Math.round(t.total * PART_SHARE))
    patch({ payments: [{ date: doc!.payments[0]?.date || today, method: doc!.payments[0]?.method || 'Interac e-Transfer', amount: part }] })
  }

  /* ---------- save ---------- */
  function problem(toSend = false) {
    if (!doc!.number.trim()) return 'Enter an invoice number'
    if (toSend && !doc!.billName.trim()) return 'Enter who the invoice is for'
    if (toSend && !doc!.items.some((i) => i.title.trim() && i.amount.trim())) return 'Add at least one item with an amount'
    return ''
  }
  async function save(quiet = false): Promise<string | null> {
    const bad = problem()
    if (bad) { toast(bad, 'err'); return null }
    const clean = { ...doc!, number: doc!.number.trim() }
    // the figures and status are stored next to the document for fast lists, the client page and Stripe
    const t = invoiceTotals(clean)
    const status = invoiceStatus(t, { sent: !!row?.sent_at, dueDate: clean.dueDate || undefined, today: todayIso(), void: row?.status === 'void' })
    const values = { number: clean.number, doc: clean, booking_table: link?.table ?? null, booking_id: link?.id ?? null, updated_at: new Date().toISOString(),
      status, client_name: clean.billName, client_email: clean.billEmail.trim().toLowerCase(), invoice_date: clean.invoiceDate || null, due_date: clean.dueDate || null,
      subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total, paid: t.paid, balance: t.balance, paid_at: status === 'paid' ? row?.paid_at ?? new Date().toISOString() : null }
    const res = id ? await supabase.from('invoices').update(values).eq('id', id).select().single() : await supabase.from('invoices').insert(values).select().single()
    if (res.error) {
      const msg = res.error.code === '23505' ? `Invoice number ${clean.number} is already used. Choose another one.` : missingTable(res.error.message) ? SETUP_NOTE : res.error.message
      toast(msg, 'err')
      return null
    }
    const saved = res.data as InvoiceRow
    setRow(saved); setId(saved.id); setDirty(false); setInvoiceDirty(false)
    if (!quiet) { toast('✓ Invoice saved'); showSaved(saved.id) }
    return saved.id
  }
  /** moves the address on to the saved invoice, so a reload or + New invoice behaves from here on */
  function showSaved(savedId: string) {
    const hash = `#invoices/${savedId}`
    if (window.location.hash !== hash) window.location.hash = hash
  }
  async function saveDefaults() {
    const value = Object.fromEntries(BUSINESS_FIELDS.map((k) => [k, doc![k]]))
    const { error: err } = await supabase.from('invoice_settings').upsert({ key: 'defaults', value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (err) toast(missingTable(err.message) ? SETUP_NOTE : err.message, 'err')
    else toast('✓ New invoices will start with these business details')
  }

  /* ---------- pdf + send ---------- */
  async function download() {
    setBusy('pdf')
    try {
      const { buildInvoicePdf, downloadBytes } = await import('./pdf')
      downloadBytes(await buildInvoicePdf(doc!), pdfFilename(doc!.number))
    } catch (e) { toast(e instanceof Error ? e.message : 'The PDF could not be made', 'err') }
    setBusy('')
  }
  function openSend(from: InvoiceDoc = doc!) { setSend({ to: from.billEmail, ...defaultEmail(from) }) }
  async function sendNow() {
    const bad = problem(true)
    if (bad) return toast(bad, 'err')
    if (!EMAIL_RE.test(send!.to.trim())) return toast('Enter a valid email address', 'err')
    if (!send!.subject.trim() || !send!.message.trim()) return toast('Enter a subject and a message', 'err')
    setBusy('send')
    try {
      const invoiceId = dirty || !id ? await save(true) : id
      if (!invoiceId) return
      const { buildInvoicePdf, toBase64 } = await import('./pdf')
      const pdf = toBase64(await buildInvoicePdf(doc!))
      const r = await callFn<{ dryRun?: boolean; sent_at?: string }>('invoice-send', { invoice_id: invoiceId, to: send!.to.trim(), subject: send!.subject.trim(), message: send!.message, pdf })
      if (!r.ok) return toast(r.error === 'Not found.' ? 'Invoice emails are not switched on yet. Run npm run gallery:go-live once.' : r.error, 'err')
      toast(r.dryRun ? 'Test mode: the email was not really sent' : `✓ Invoice sent to ${send!.to.trim()}`)
      const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
      if (data) setRow(data as InvoiceRow)
      setSend(null)
      showSaved(invoiceId)
    } catch (e) { toast(e instanceof Error ? e.message : 'The invoice could not be sent', 'err') }
    finally { setBusy('') }
  }

  const linkedPaid = link && booking ? bookingPaid(link.table, booking) : 0
  const stageChanged = row?.sent_stage && row.sent_stage !== totals.stage

  return (
    <>
      <div className="iv-bar">
        <a className="ad-btn sm" href="#invoices" aria-label="Back to all invoices">← Invoices</a>
        <h1>{doc.number || 'New invoice'}</h1>
        <Badge tone={STAGE_TONE[totals.stage]}>{STAGE_LABEL[totals.stage]}</Badge>
        <span className="sp" />
        {dirty ? <span className="iv-saved">Not saved yet</span> : row ? <span className="iv-saved">Saved</span> : null}
        <button className="ad-btn" disabled={!!busy} onClick={() => save()}>Save</button>
        <button className="ad-btn" disabled={!!busy} onClick={download}>{busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}</button>
        <button className="ad-btn primary" disabled={!!busy} onClick={() => openSend()}>Email to client</button>
      </div>
      {error && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{error}</div>}
      {reused && link && (
        <div className="ad-note" style={{ marginBottom: 14 }}>
          This booking already has invoice {reused}, so it opened with its payment brought up to date. <a href={`#invoices/new/${link.table}/${link.id}`}>Start a new invoice instead</a>
        </div>
      )}
      {row?.sent_at && (
        <p className="iv-hint" style={{ margin: '0 0 14px' }}>
          Last sent {fmtDate(row.sent_at, true)} to {row.sent_to}{row.sent_stage ? ` as ${STAGE_LABEL[row.sent_stage].toLowerCase()}` : ''}.
          {stageChanged ? ' The payment has changed since, so the client has not seen this version.' : ''}
        </p>
      )}
      <div className="iv-tabs" role="tablist" aria-label="Edit or preview">
        <button role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
        <button role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
      </div>
      <div className="iv-layout" data-view={view}>
        <div className="iv-form">
          <Section title="Payment">
            <div className="iv-stages" role="group" aria-label="Payment status">
              {(Object.keys(STAGE_LABEL) as InvoiceStage[]).map((s) => <button key={s} type="button" aria-pressed={totals.stage === s} onClick={() => chooseStage(s)}>{STAGE_LABEL[s]}</button>)}
            </div>
            <p className="iv-hint">{totals.stage === 'before' ? 'Nothing paid yet: the client sees the full amount as due.' : totals.stage === 'part' ? `${money(totals.paid)} paid, ${money(totals.balance)} still due.` : 'Fully paid: the invoice is marked PAID and shows nothing due.'}</p>
            {link && booking && (
              <p className="iv-hint">Made from the {BOOKING_KIND[link.table].toLowerCase()} booking for {String(booking.full_name ?? 'this client')}.</p>
            )}
            {link && booking && Math.round(linkedPaid * 100) !== Math.round(totals.paid * 100) && (
              <p className="ad-note" style={{ marginTop: 10 }}>
                The booking shows {money(linkedPaid)} paid but this invoice shows {money(totals.paid)}. Payments typed here do not change the booking or Finance; change the booking’s payment status for that.{' '}
                <button type="button" className="ad-btn sm" onClick={() => patch({ payments: paymentsFromBooking(link.table, booking) })}>Use the booking’s payment</button>
              </p>
            )}
          </Section>

          <Section title="Invoice details">
            <div className="iv-grid">
              <Field label="Title"><input type="text" {...text('title')} /></Field>
              <Field label="Invoice number"><input type="text" {...text('number')} /></Field>
              <Field label="Invoice date"><input type="date" {...text('invoiceDate')} /></Field>
              <Field label="Terms">
                <input type="text" list="iv-terms" value={doc.terms} onChange={(e) => {
                  const days = TERMS[e.target.value]
                  patch(days != null && doc.invoiceDate ? { terms: e.target.value, dueDate: addDaysIso(doc.invoiceDate, days) } : { terms: e.target.value })
                }} />
                <datalist id="iv-terms">{Object.keys(TERMS).map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Due date"><input type="date" {...text('dueDate')} /></Field>
            </div>
          </Section>

          <Section title="Bill to">
            <div className="iv-grid">
              <Field label="Client name" full><input type="text" {...text('billName')} /></Field>
              <Field label="Email"><input type="email" {...text('billEmail')} /></Field>
              <Field label="Phone"><input type="tel" {...text('billPhone')} /></Field>
              <Field label="Address" full><textarea rows={2} style={{ minHeight: 60 }} {...text('billAddress')} /></Field>
            </div>
          </Section>

          <Section title="Items">
            {doc.items.map((it, n) => (
              <div className="iv-row" key={n} data-invoice-item>
                <div className="iv-row-top">
                  <span>Item {n + 1}</span>
                  {doc.items.length > 1 && <button type="button" className="ad-btn sm danger" onClick={() => patch({ items: doc.items.filter((_, i) => i !== n) })} aria-label={`Remove item ${n + 1}`}>Remove</button>}
                </div>
                <Field label="Item"><input type="text" value={it.title} onChange={(e) => setItem(n, { title: e.target.value })} placeholder="e.g. Birthday shoot, 2 outfits" /></Field>
                <Field label="Description"><textarea rows={3} style={{ minHeight: 74 }} value={it.description} onChange={(e) => setItem(n, { description: e.target.value })} placeholder={'Date, time, location, what’s included'} /></Field>
                <div className="iv-row-nums">
                  <Field label="Qty"><input type="number" min="0" step="any" value={it.qty} onChange={(e) => setItem(n, { qty: e.target.value })} /></Field>
                  <Field label="Rate ($)"><input type="number" step="0.01" value={it.rate} onChange={(e) => setItem(n, { rate: e.target.value })} /></Field>
                  <Field label="Amount ($)"><input type="number" step="0.01" value={it.amount} onChange={(e) => setItem(n, { amount: e.target.value })} /></Field>
                </div>
              </div>
            ))}
            <button type="button" className="ad-btn sm" onClick={() => patch({ items: [...doc.items, emptyItem()] })}>+ Add item</button>
          </Section>

          <Section title="Totals and payments received">
            <div className="iv-sum"><span>Sub total</span><b>{money(totals.subtotal)}</b></div>
            <div className="iv-grid" style={{ margin: '8px 0' }}>
              <Field label="Discount name"><input type="text" {...text('discountLabel')} /></Field>
              <Field label="Discount ($)"><input type="number" min="0" step="0.01" {...text('discount')} /></Field>
            </div>
            <div className="iv-grid" style={{ margin: '8px 0' }}>
              <Field label="Sales tax" hint="Off by default. Turn on if you charge GST/HST.">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', height: 38 }}><input type="checkbox" checked={!!doc.taxEnabled} onChange={(e) => patch({ taxEnabled: e.target.checked })} /> Charge tax on this invoice</label>
              </Field>
              {doc.taxEnabled && <Field label="Tax name"><input type="text" placeholder="GST" {...text('taxName')} /></Field>}
              {doc.taxEnabled && <Field label="Rate (%)"><input type="number" min="0" max="100" step="0.01" placeholder="5" {...text('taxRate')} /></Field>}
              {doc.taxEnabled && <Field label="Tax / business number"><input type="text" placeholder="e.g. 123456789 RT0001" {...text('taxNumber')} /></Field>}
            </div>
            {doc.taxEnabled && totals.tax > 0 && <div className="iv-sum"><span>{doc.taxName || 'Tax'} ({doc.taxRate}%)</span><b>{money(totals.tax)}</b></div>}
            <div className="iv-sum big"><span>Total (CAD)</span><span>{money(totals.total)}</span></div>
            <div style={{ marginTop: 12 }}>
              {doc.payments.map((p, n) => (
                <div className="iv-pay" key={n} data-invoice-payment>
                  <Field label="Date paid"><input type="date" value={p.date} onChange={(e) => setPayment(n, { date: e.target.value })} /></Field>
                  <Field label="Method"><input type="text" list="iv-methods" value={p.method} onChange={(e) => setPayment(n, { method: e.target.value })} /></Field>
                  <Field label="Amount ($)"><input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => setPayment(n, { amount: e.target.value })} /></Field>
                  <button type="button" className="ad-btn sm danger" style={{ height: 38 }} onClick={() => patch({ payments: doc.payments.filter((_, i) => i !== n) })} aria-label={`Remove payment ${n + 1}`}>✕</button>
                </div>
              ))}
              <datalist id="iv-methods">{METHODS.map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className="ad-btn sm" onClick={() => patch({ payments: [...doc.payments, { date: todayIso(), method: 'Bank transfer', amount: '' }] })}>+ Add payment</button>
            </div>
            <div className="iv-sum big"><span>Balance due</span><span>{money(totals.balance)}</span></div>
            {totals.overpaid > 0 && <p className="ad-err" role="alert">Payments are {money(totals.overpaid)} more than the total.</p>}
          </Section>

          <Section title="From">
            <div className="iv-grid">
              <div className="ad-field full">
                <span>Logo</span>
                <div className="iv-logo-row">
                  <img src={doc.logo || DEFAULT_LOGO} alt="Invoice logo" />
                  <label className="ad-btn sm" style={{ cursor: 'pointer' }}>Change logo
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      try { patch({ logo: await logoToPng(f) }) } catch (x) { toast((x as Error).message, 'err') }
                    }} />
                  </label>
                  {doc.logo && <button type="button" className="ad-btn sm" onClick={() => patch({ logo: '' })}>Use the standard logo</button>}
                </div>
              </div>
              <Field label="Business name" full><input type="text" {...text('fromName')} /></Field>
              <Field label="Business address" full><textarea rows={4} {...text('fromAddress')} /></Field>
            </div>
          </Section>

          <Section title="Notes and how to pay">
            {/^\[|^$/.test(doc.etransferEmail.trim()) && <p className="ad-note" style={{ marginBottom: 12 }}>Add your Interac e-Transfer email (and bank details if you take direct deposit), then press “Save … as default” below so every new invoice starts with them.</p>}
            <div className="iv-grid">
              <Field label="Notes" full><textarea rows={2} style={{ minHeight: 60 }} {...text('notes')} /></Field>
              <Field label="Interac e-Transfer email"><input type="email" placeholder="payments@example.com" {...text('etransferEmail')} /></Field>
              <Field label="Payment reference"><input type="text" {...text('paymentReference')} /></Field>
              <Field label="Payment instructions" full><textarea rows={2} style={{ minHeight: 60 }} {...text('paymentInstructions')} /></Field>
              <Field label="Bank (optional)"><input type="text" placeholder="e.g. RBC" {...text('bankName')} /></Field>
              <Field label="Account name (optional)"><input type="text" {...text('accountName')} /></Field>
              <Field label="Transit / institution / account (optional)"><input type="text" {...text('accountNumber')} /></Field>
              <Field label="Footer text" full><input type="text" {...text('footerText')} /></Field>
            </div>
          </Section>

          <Section title="Terms and conditions">
            <div className="iv-grid">
              <Field label="Heading" full><input type="text" {...text('termsTitle')} /></Field>
              <Field label="Terms" full hint="Printed on a second page. Leave the box empty to leave the terms page out. Start a heading line with a number (1. Booking) and a point with •."><textarea rows={12} {...text('termsText')} /></Field>
            </div>
          </Section>

          <div><button type="button" className="ad-btn sm" onClick={saveDefaults}>Save logo, business, payment, tax and terms as default</button></div>
        </div>
        <div className="iv-preview" aria-label="Invoice preview" data-lenis-prevent><InvoicePaper doc={doc} /></div>
      </div>

      {send && (
        <Modal title={`Email ${doc.number || 'invoice'} to the client`} onClose={() => { if (busy !== 'send') setSend(null) }}>
          <div className="ad-form">
            <div className="ad-field full"><span>Sending as</span><div><Badge tone={STAGE_TONE[totals.stage]}>{STAGE_LABEL[totals.stage]}</Badge> <span className="ad-muted">Total {money(totals.total)}, paid {money(totals.paid)}, balance due {money(totals.balance)}. The invoice is attached as a PDF.</span></div></div>
            <Field label="To" full><input type="email" autoFocus value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} /></Field>
            <Field label="Subject" full><input type="text" value={send.subject} onChange={(e) => setSend({ ...send, subject: e.target.value })} /></Field>
            <Field label="Message" full><textarea rows={9} value={send.message} onChange={(e) => setSend({ ...send, message: e.target.value })} /></Field>
            <div className="ad-formfoot">
              <button className="ad-btn" disabled={busy === 'send'} onClick={() => setSend(null)}>Cancel</button>
              <button className="ad-btn primary" disabled={busy === 'send'} onClick={sendNow}>{busy === 'send' ? 'Sending…' : 'Send invoice'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
