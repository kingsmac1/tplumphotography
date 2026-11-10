/**
 * Dashboard → Deliveries: every photo and event booking against the 48–72 hour delivery promise, most urgent first.
 * Finals sent through the client gallery count as delivered automatically; anything else is marked here by hand.
 */
import { useMemo, useState } from 'react'
import { useData } from '@/features/gallery/admin/kit/data'
import { BulkBar, BulkBtn, RowBox, SelectAllBox, confirmN, useSelection } from '@/features/gallery/admin/kit/bulk'
import { Badge, Empty, PageHead, Stat, Tabs, useDebounced } from '@/features/gallery/admin/kit/ui'
import { byBooking, useGalleryIndex } from '@/features/gallery/admin/useGalleryIndex'
import { bookingGalleryStage } from '@/features/gallery/status'
import { Pager, downloadCsv } from '@/features/invoices/ui'
import { STATE_LABEL, fmtHours, fmtSpan, promiseText, type DeliverySettings, type DeliveryState, type DeliveryTable } from './model'
import { SETUP_NOTE, saveDeliverySettings, setDelivered, useDeliveries, type DeliveryItem } from './useDeliveries'
import { DeliveryBadge, MarkDeliveredDialog, deliveryTitle, fmtWhen } from './ui'
import './delivery.css'

type TabId = 'attention' | 'waiting' | 'upcoming' | 'delivered' | 'untracked' | 'all'
const TAB_STATES: Record<TabId, DeliveryState[] | null> = {
  attention: ['overdue', 'due', 'on_track'], waiting: ['waiting_client'], upcoming: ['upcoming'], delivered: ['delivered'], untracked: ['untracked'], all: null,
}
const PAGE = 25
const KIND: Record<DeliveryTable, string> = { bookings: 'Photo shoot', event_bookings: 'Event' }
const key = (i: DeliveryItem) => `${i.table}:${i.id}`
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date')

export function DeliveriesSection() {
  const { toast } = useData()
  const dv = useDeliveries()
  const gx = useGalleryIndex()
  const galleries = useMemo(() => byBooking(gx.galleries), [gx.galleries])
  const [tab, setTab] = useState<TabId>('attention')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [page, setPage] = useState(1)
  const [marking, setMarking] = useState<DeliveryItem | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const inTab = (t: TabId) => dv.items.filter((i) => !TAB_STATES[t] || TAB_STATES[t]!.includes(i.d.state))
  const list = useMemo(() => inTab(tab).filter((i) => !dq || `${i.name} ${i.phone} ${i.email} ${i.what}`.toLowerCase().includes(dq.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dv.items, tab, dq])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const view = list.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)
  const sel = useSelection(list.map(key))

  // on-time rate over deliveries in the last 30 days that were tracked
  const recent = dv.items.filter((i) => i.d.state === 'delivered' && i.d.onTime != null && i.d.deliveredAt && Date.now() - new Date(i.d.deliveredAt).getTime() < 30 * 86_400_000)
  const onTime = recent.filter((i) => i.d.onTime).length
  const c = dv.counts

  async function bulkDeliver() {
    const picked = list.filter((i) => sel.has(key(i)) && i.d.state !== 'delivered')
    if (!picked.length) return toast('Those are already delivered', 'err')
    if (!confirmN('Mark', picked.length, 'booking', 'They are recorded as delivered now. To use another date, mark them one at a time.')) return
    for (const t of ['bookings', 'event_bookings'] as DeliveryTable[]) {
      const msg = await setDelivered(t, picked.filter((i) => i.table === t).map((i) => i.id), true)
      if (msg) return toast(msg, 'err')
    }
    toast(`✓ ${picked.length} marked delivered`)
    sel.clear()
  }
  async function undo(i: DeliveryItem) {
    if (!window.confirm(`Mark ${i.name || 'this booking'} as not delivered?`)) return
    const msg = await setDelivered(i.table, [i.id], false)
    toast(msg || `✓ ${i.name || 'Booking'} is back on the delivery list`, msg ? 'err' : 'ok')
  }
  const csv = (items: DeliveryItem[]) => downloadCsv('deliveries', items.map((i) => ({
    client: i.name, phone: i.phone, email: i.email, type: KIND[i.table], booking: i.what, date: i.date ?? '', status: STATE_LABEL[i.d.state],
    deliver_by: i.d.lateAt ? new Date(i.d.lateAt).toISOString() : '', hours_left: i.d.hoursLeft == null ? '' : i.d.hoursLeft.toFixed(1),
    delivered_at: i.d.deliveredAt ?? '', delivered_via: i.d.via ?? '', on_time: i.d.onTime == null ? '' : i.d.onTime ? 'yes' : 'no',
  })))

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'attention', label: 'Needs delivery', count: c.overdue + c.due + c.on_track },
    { id: 'waiting', label: 'Waiting for client', count: c.waiting_client },
    { id: 'upcoming', label: 'Shoot not done yet', count: c.upcoming },
    { id: 'delivered', label: 'Delivered', count: c.delivered },
    { id: 'untracked', label: 'Not tracked', count: c.untracked },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="dl">
      <PageHead
        title="Deliveries"
        sub={`Every shoot and event against the delivery promise (${promiseText(dv.settings)}), most urgent first`}
        actions={<button className="ad-btn" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>Settings</button>}
      />
      {!dv.installed && !dv.loading && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{SETUP_NOTE}</div>}
      {dv.error && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{dv.error}</div>}
      {showSettings && <SettingsCard onSaved={() => { setShowSettings(false); toast('✓ Delivery settings saved') }} />}

      <div className="dl-stats">
        <Stat label="Overdue" value={c.overdue} sub={c.overdue ? 'past the promised time' : 'None — well done'} tone={c.overdue ? 'warn' : 'good'} />
        <Stat label="Due now" value={c.due} sub="close to the deadline" />
        <Stat label="On track" value={c.on_track} sub="time to spare" />
        <Stat label="Waiting for client" value={c.waiting_client} sub="clock paused" />
        <Stat label="On time, last 30 days" value={recent.length ? `${Math.round((onTime / recent.length) * 100)}%` : '—'} sub={recent.length ? `${onTime} of ${recent.length} deliveries` : 'No deliveries yet'} tone={recent.length && onTime === recent.length ? 'good' : ''} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setPage(1); sel.clear() }} />
      <div className="ad-toolbar">
        <input type="search" placeholder="Search client, phone, shoot…" aria-label="Search deliveries" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
      </div>
      <BulkBar s={sel} noun="booking">
        <BulkBtn onClick={bulkDeliver}>Mark delivered</BulkBtn>
        <BulkBtn onClick={() => csv(list.filter((i) => sel.has(key(i))))}>Export CSV</BulkBtn>
      </BulkBar>

      <div className="ad-tablewrap">
        <table>
          <thead><tr><th className="sel"><SelectAllBox s={sel} view={view.map(key)} /></th><th>Client</th><th>Shoot / event</th><th>Delivery</th><th>Client gallery</th><th className="dl-act"></th></tr></thead>
          <tbody>
            {view.map((i) => {
              const stage = i.table === 'bookings' ? bookingGalleryStage(galleries.get(i.id), (gid) => gx.stats.get(gid)?.picks) : null
              return (
                <tr key={key(i)} data-delivery-row={i.d.state} className={(sel.has(key(i)) ? 'picked ' : '') + `dl-${i.d.state}`}>
                  <td className="sel"><RowBox s={sel} id={key(i)} label={i.name || 'booking'} /></td>
                  <td><b>{i.name || '—'}</b><span className="sub">{i.phone || i.email}</span></td>
                  <td>{i.what}<span className="sub">{KIND[i.table]} · {fmtDate(i.date)}{i.endDate && i.endDate !== i.date ? ` → ${fmtDate(i.endDate)}` : ''}</span></td>
                  <td>
                    <DeliveryBadge d={i.d} />
                    <span className="sub" title={deliveryTitle(i.d)}>{when(i)}</span>
                  </td>
                  <td>{stage ? <a href={`#galleries/${i.id}`}><Badge tone={stage.tone}>{stage.label}</Badge></a> : <span className="ad-muted">—</span>}</td>
                  <td className="dl-act">
                    {i.d.state !== 'delivered' && <button className="ad-btn sm" onClick={() => setMarking(i)}>Mark delivered</button>}
                    {i.d.state === 'delivered' && i.d.via === 'manual' && <button className="ad-btn sm" onClick={() => undo(i)}>Undo</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!view.length && !dv.loading && <Empty title={dq ? 'Nothing matches that search' : EMPTY[tab]} hint={tab === 'attention' && !dq ? 'Every finished shoot has been delivered, or is waiting for the client’s picks.' : undefined} />}
        {dv.loading && !dv.items.length && <Empty title="Loading…" />}
        <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </div>
      {list.length > 0 && <div style={{ padding: '12px 0', textAlign: 'right' }}><button className="ad-btn sm" onClick={() => csv(list)}>Export CSV</button></div>}
      <p className="ad-muted dl-foot">
        Promise: {promiseText(dv.settings)} (events and weddings: the event bookings, wedding bookings and shoots of type Event). The clock starts when a shoot ends (an event: at the end of its last day). While the client has the previews and hasn’t sent their picks, it is paused.
        Finals sent through the client gallery are marked delivered automatically. Shoots before {fmtDate(dv.settings.track_from)} are not tracked.
      </p>
      {marking && <MarkDeliveredDialog table={marking.table} ids={[marking.id]} who={marking.name || 'this booking'} onClose={() => setMarking(null)} onDone={(m) => toast(m)} />}
    </div>
  )
}

const EMPTY: Record<TabId, string> = {
  attention: 'Nothing waiting to be delivered', waiting: 'No client is choosing their picks right now', upcoming: 'No shoots coming up',
  delivered: 'Nothing delivered yet', untracked: 'Nothing here', all: 'No bookings yet',
}

/** the line under the badge */
function when(i: DeliveryItem) {
  const d = i.d
  if (d.state === 'delivered') return `${fmtWhen(d.deliveredAt)} · ${d.via === 'gallery' ? 'client gallery' : 'by hand'}`
  if (d.state === 'overdue' || d.state === 'due' || d.state === 'on_track') return `by ${fmtWhen(d.lateAt)}`
  if (d.state === 'waiting_client') return d.pausedHours >= 1 ? `paused ${fmtHours(d.pausedHours)}` : 'clock paused'
  if (d.state === 'upcoming') return `starts ${fmtWhen(d.start)}`
  return ''
}

function SettingsCard({ onSaved }: { onSaved: () => void }) {
  const { settings } = useDeliveries()
  const [f, setF] = useState(settings)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.track_from)) return setErr('Choose the date tracking starts.')
    const bad = (due: number, late: number) => !(due >= 1 && late >= due && late <= 720)
    if (bad(f.due_hours, f.late_hours) || bad(f.event_due_hours, f.event_late_hours)) return setErr('"Overdue after" must be at least "Due from", and both between 1 and 720 hours.')
    setSaving(true)
    const m = await saveDeliverySettings(f)
    setSaving(false)
    if (m) return setErr(m)
    onSaved()
  }
  return (
    <div className="ad-card dl-settings">
      <h3>Delivery settings</h3>
      <div className="dl-settings-grid">
        <label className="ad-field"><span>Track shoots from</span><input type="date" value={f.track_from} onChange={(e) => setF({ ...f, track_from: e.target.value })} /><small>Earlier shoots are “not tracked”.</small></label>
      </div>
      <HoursPair title="Shoots" f={f} setF={setF} due="due_hours" late="late_hours" />
      <HoursPair title="Events and weddings" f={f} setF={setF} due="event_due_hours" late="event_late_hours" />
      {err && <p className="dl-err" role="alert">{err}</p>}
      <div style={{ marginTop: 14 }}><button className="ad-btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
    </div>
  )
}

type HourKey = 'due_hours' | 'late_hours' | 'event_due_hours' | 'event_late_hours'
function HoursPair({ title, f, setF, due, late }: { title: string; f: DeliverySettings; setF: (v: DeliverySettings) => void; due: HourKey; late: HourKey }) {
  return (
    <fieldset className="dl-settings-grid dl-pair" aria-label={title}>
      <legend>{title} <small>· {fmtSpan(f[late])}</small></legend>
      <label className="ad-field"><span>Due from (hours)</span><input type="number" min={1} max={720} value={f[due]} onChange={(e) => setF({ ...f, [due]: Number(e.target.value) })} /><small>Turns amber: “due now”.</small></label>
      <label className="ad-field"><span>Overdue after (hours)</span><input type="number" min={1} max={720} value={f[late]} onChange={(e) => setF({ ...f, [late]: Number(e.target.value) })} /><small>Turns red: “overdue”.</small></label>
    </fieldset>
  )
}
