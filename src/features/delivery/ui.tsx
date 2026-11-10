/** Delivery pieces shared by the bookings tables, the booking details and the Deliveries page. */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '@/pages/admin/useBodyScrollLock'
import { fmtHours, fmtSpan, localTime, type Delivery, type DeliveryTable } from './model'
import { setDelivered } from './useDeliveries'

const TONE: Record<Delivery['tone'], string> = {
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-900',
  blue: 'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  grey: 'bg-muted text-muted-foreground',
  green: 'bg-green-100 text-green-800',
  gold: 'bg-yellow-100 text-yellow-900',
}

/** `wrap`: may break onto two lines (narrow table cells), so the time left is never cut off */
export function DeliveryBadge({ d, className = '', wrap }: { d: Delivery; className?: string; wrap?: boolean }) {
  return (
    <span data-delivery={d.state} title={deliveryTitle(d)} className={`inline-block px-2 py-0.5 text-[11px] font-body font-semibold ${wrap ? 'whitespace-pre-line leading-tight rounded-lg' : 'whitespace-nowrap rounded-full'} ${TONE[d.tone]} ${className}`}>
      {wrap ? d.label.replace(' — ', '\n') : d.label}
    </span>
  )
}

/** "Fri 6 Nov, 2:00 PM" in Mountain Time */
export const fmtWhen = (ms: number | string | null | undefined) => {
  if (ms == null) return '—'
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-CA', { timeZone: 'America/Edmonton', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

export function deliveryTitle(d: Delivery) {
  switch (d.state) {
    case 'overdue': case 'due': case 'on_track':
      return `Deliver by ${fmtWhen(d.lateAt)}${d.pausedHours >= 1 ? ` (includes ${fmtHours(d.pausedHours)} waiting for the client)` : ''}`
    case 'waiting_client': return 'The client has the previews. The delivery clock is paused until they send their picks.'
    case 'delivered': return `Delivered ${fmtWhen(d.deliveredAt)}${d.via === 'gallery' ? ' through the client gallery' : d.by ? ` (marked by ${d.by})` : ''}`
    case 'upcoming': return 'The delivery clock starts when the shoot ends.'
    default: return 'Shoots before tracking started are not tracked. You can still mark them delivered.'
  }
}

/** the current Mountain Time as a datetime-local value */
const lagosNowInput = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
const fromLagosInput = (v: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(v)
  const ms = m ? localTime(m[1], Number(m[2]), Number(m[3])) : null
  return ms == null ? null : new Date(ms)
}

/** Asks when the work was handed over (default: now), then marks the booking(s) delivered. */
export function MarkDeliveredDialog({ table, ids, who, onClose, onDone }: { table: DeliveryTable; ids: string[]; who: string; onClose: () => void; onDone?: (msg: string) => void }) {
  useBodyScrollLock(true)
  const [at, setAt] = useState(lagosNowInput)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const max = lagosNowInput()
  const save = async () => {
    const when = fromLagosInput(at)
    if (!when) return setError('Enter the date and time it was delivered.')
    if (when.getTime() > Date.now() + 60_000) return setError('That time is in the future.')
    setWorking(true)
    setError('')
    const msg = await setDelivered(table, ids, true, when)
    setWorking(false)
    if (msg) return setError(msg)
    onDone?.(`✓ ${who} marked delivered`)
    onClose()
  }
  // rendered on <body>, so the dashboard kit's styles on the Deliveries page can't reach it
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="mark-delivered-title" className="bg-background border border-border max-w-md w-full p-6 text-foreground" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 id="mark-delivered-title" className="font-display text-xl font-bold">Mark delivered</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <p className="text-sm font-body text-muted-foreground mb-4">
          For {who}. Use this when the photos were handed over without the client gallery (WhatsApp, Google Drive, flash drive…). Finals sent through the client gallery are marked delivered automatically.
        </p>
        <label className="block text-xs font-body font-bold tracking-widest text-muted-foreground mb-1" htmlFor="delivered-at">DELIVERED ON (LAGOS TIME)</label>
        <input id="delivered-at" type="datetime-local" value={at} max={max} onChange={(e) => setAt(e.target.value)} className="w-full border border-border bg-background px-3 py-2 text-sm font-body mb-4" />
        {error && <p role="alert" className="text-sm text-destructive font-body mb-4">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={working} className="px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md">Cancel</button>
          <button type="button" onClick={save} disabled={working} className="px-4 py-2 text-sm font-body font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{working ? 'Saving…' : 'Mark delivered'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The delivery box inside a booking's details. */
export function DeliveryPanel({ table, id, name, d, onChanged }: { table: DeliveryTable; id: string; name: string; d: Delivery; onChanged?: () => void }) {
  const [marking, setMarking] = useState(false)
  const [msg, setMsg] = useState('')
  const undo = async () => {
    if (!window.confirm(`Mark ${name || 'this booking'} as not delivered?`)) return
    const m = await setDelivered(table, [id], false)
    setMsg(m)
    if (!m) onChanged?.()
  }
  const lines: [string, string][] = []
  if (d.start != null && d.state !== 'untracked') lines.push(['Clock started', fmtWhen(d.start)])
  if (d.lateAt != null && d.state !== 'untracked') lines.push([`Deliver by (${fmtSpan(d.lateHours)})`, fmtWhen(d.lateAt)])
  if (d.pausedHours >= 1 / 60) lines.push(['Waiting for client', `${fmtHours(d.pausedHours)} (not counted)`])
  if (d.state === 'delivered') lines.push(['Delivered', `${fmtWhen(d.deliveredAt)} · ${d.via === 'gallery' ? 'client gallery' : `marked by hand${d.by ? ` by ${d.by}` : ''}`}`])
  return (
    <div data-delivery-panel className="border border-border p-4 mb-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-body font-bold tracking-widest text-muted-foreground">DELIVERY · {fmtSpan(d.lateHours).toUpperCase()}</p>
        <DeliveryBadge d={d} />
      </div>
      {lines.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-body">
          {lines.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
      {d.state !== 'delivered' && <p className="text-xs font-body text-muted-foreground">{deliveryTitle(d)}</p>}
      {msg && <p role="alert" className="text-sm text-destructive font-body">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {d.state !== 'delivered' && <button type="button" onClick={() => setMarking(true)} className="px-3 py-1.5 text-sm font-body font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90">Mark delivered</button>}
        {d.state === 'delivered' && d.via === 'manual' && <button type="button" onClick={undo} className="px-3 py-1.5 text-sm font-body font-medium border border-border rounded-md hover:bg-muted/50">Undo: not delivered</button>}
      </div>
      {marking && <MarkDeliveredDialog table={table} ids={[id]} who={name || 'this booking'} onClose={() => setMarking(false)} onDone={() => onChanged?.()} />}
    </div>
  )
}
