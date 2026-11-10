/**
 * The 48–72 hour delivery promise, worked out for one booking. Pure functions only (no React, no database), so the
 * dashboard, the bookings tables and the tests all use the same rules.
 *
 * Two promises: standard shoots 48–72 hours; events and weddings 7 days (amber for the last 2 days).
 * The clock starts when the shoot ends (shoot date + time + length, Mountain Time). An event's clock starts at the end of its
 * last day. While the client has the previews and hasn't sent their picks, the clock is paused: the studio can't finish
 * until the client chooses. So the studio's time = shoot → previews sent, plus picks received → finals delivered.
 *   0 → due hours:          on track
 *   due → late hours:       due now
 *   past late hours:        overdue
 * Shoots before `track_from` are not tracked (work from before the dashboard tracked deliveries).
 */

export type DeliverySettings = {
  track_from: string
  /** standard shoots */
  due_hours: number; late_hours: number
  /** events and weddings */
  event_due_hours: number; event_late_hours: number
}
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = { track_from: '2026-11-01', due_hours: 48, late_hours: 72, event_due_hours: 120, event_late_hours: 168 }

/** 72 → "72 hours", 168 → "7 days" */
export const fmtSpan = (h: number) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`)
/** "48–72 hours; events and weddings 7 days" */
export const promiseText = (s: DeliverySettings) => `shoots ${s.due_hours}–${s.late_hours} hours, events and weddings ${fmtSpan(s.event_late_hours)}`

/** the hours that apply: events and weddings get the longer promise */
export const promiseHours = (s: DeliverySettings, long?: boolean) => (long ? { due: s.event_due_hours, late: s.event_late_hours } : { due: s.due_hours, late: s.late_hours })

export type DeliveryTable = 'bookings' | 'event_bookings'
export type DeliveryState = 'overdue' | 'due' | 'on_track' | 'waiting_client' | 'upcoming' | 'delivered' | 'untracked'

export type DeliveryInput = {
  /** first (or only) day of the shoot/event, YYYY-MM-DD */
  date: string | null
  /** last day of a multi-day event */
  endDate?: string | null
  /** start time, "14:00", "14:00:00" or "2:00 PM" */
  time?: string | null
  durationMinutes?: number | null
  /** events: the clock starts at the end of the last day instead of at the start time */
  isEvent?: boolean
  /** events and weddings: the longer promise (7 days by default) */
  long?: boolean
  deliveredAt?: string | null
  deliveredVia?: string | null
  deliveredBy?: string | null
  proof?: { status?: string | null; sent_at?: string | null; submitted_at?: string | null } | null
  final?: { status?: string | null; delivered_at?: string | null } | null
}

export type Delivery = {
  state: DeliveryState
  label: string
  tone: 'red' | 'amber' | 'blue' | 'violet' | 'grey' | 'green' | 'gold'
  /** when the clock started (ms), null when the date is unknown */
  start: number | null
  /** the moment it becomes "due now" / "overdue", moved on by any pause (ms) */
  dueAt: number | null
  lateAt: number | null
  /** hours of the promise left (negative = overdue) */
  hoursLeft: number | null
  /** hours the clock was paused waiting on the client */
  pausedHours: number
  /** the promise that applies: hours until due now / overdue */
  dueHours: number
  lateHours: number
  deliveredAt: string | null
  via: 'gallery' | 'manual' | null
  by: string | null
  /** delivered within late_hours of studio time */
  onTime: boolean | null
  /** sort key: lower = more urgent */
  rank: number
}

const H = 3_600_000

/** "14:00", "14:00:00", "2:00 PM", "2pm" → [hour, minute] */
export function parseTime(t?: string | null): [number, number] | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]\.?m\.?)?\s*$/i.exec(t ?? '')
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const ap = m[3]?.toLowerCase()[0]
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  return h > 23 || min > 59 ? null : [h, min]
}

/** offset of Calgary/Edmonton time from UTC at a moment, in ms (-6 h in summer, -7 h in winter) */
function mountainOffsetMs(ms: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second)) - Math.floor(ms / 1000) * 1000
}

/** a Calgary/Edmonton wall-clock time (Mountain Time, with daylight saving) as epoch ms */
export function localTime(date: string, h = 0, min = 0): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return null
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, min)
  let t = guess - mountainOffsetMs(guess)
  const again = guess - mountainOffsetMs(t)
  if (again !== t) t = again
  return t
}

export const lagosDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton' }).format(new Date(ms))

/** When the delivery clock starts for this booking. */
export function clockStart(i: DeliveryInput): number | null {
  if (!i.date) return null
  if (i.isEvent) {
    const last = i.endDate && i.endDate > i.date ? i.endDate : i.date
    return localTime(last, 24, 0)
  }
  const [h, min] = parseTime(i.time) ?? [12, 0]
  const at = localTime(i.date, h, min)
  return at == null ? null : at + Math.max(0, Number(i.durationMinutes) || 0) * 60_000
}

/** "45m", "14h", "2d 5h" */
export function fmtHours(hours: number): string {
  const mins = Math.round(Math.abs(hours) * 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

export function computeDelivery(i: DeliveryInput, s: DeliverySettings = DEFAULT_DELIVERY_SETTINGS, now = Date.now()): Delivery {
  const start = clockStart(i)
  const galleryDone = i.final?.status === 'delivered' ? i.final.delivered_at ?? null : null
  const deliveredAt = i.deliveredAt ?? galleryDone
  const via: Delivery['via'] = i.deliveredAt ? (i.deliveredVia === 'gallery' ? 'gallery' : 'manual') : galleryDone ? 'gallery' : null
  const done = deliveredAt ? new Date(deliveredAt).getTime() : null
  const hrs = promiseHours(s, i.long)
  const base = { start, deliveredAt, via, by: via === 'manual' ? i.deliveredBy ?? null : null, dueHours: hrs.due, lateHours: hrs.late }

  // time with the client: previews sent → picks submitted (or still waiting)
  const sent = i.proof?.sent_at ? new Date(i.proof.sent_at).getTime() : null
  const submitted = i.proof?.submitted_at ? new Date(i.proof.submitted_at).getTime() : null
  const until = done ?? now
  const waitingOnClient = sent != null && submitted == null && !done
  const pauseFrom = sent != null && start != null ? Math.max(sent, start) : null
  const pauseTo = submitted ?? until
  const pausedMs = pauseFrom != null && pauseTo > pauseFrom ? pauseTo - pauseFrom : 0
  const pausedHours = pausedMs / H
  const dueAt = start == null ? null : start + hrs.due * H + pausedMs
  const lateAt = start == null ? null : start + hrs.late * H + pausedMs
  const tracked = !!i.date && i.date >= s.track_from

  if (done != null) {
    const onTime = tracked && lateAt != null ? done <= lateAt : null
    const late = onTime === false && lateAt != null ? ` ${fmtHours((done - lateAt) / H)} late` : ''
    return { ...base, state: 'delivered', label: onTime === false ? `Delivered${late}` : 'Delivered', tone: onTime === false ? 'gold' : 'green', dueAt, lateAt, hoursLeft: null, pausedHours, onTime, rank: 500 }
  }
  if (!tracked || start == null) {
    return { ...base, state: 'untracked', label: i.date ? 'Not tracked' : 'No shoot date', tone: 'grey', dueAt, lateAt, hoursLeft: null, pausedHours, onTime: null, rank: 900 }
  }
  if (now < start) {
    const hoursToGo = (start - now) / H
    return { ...base, state: 'upcoming', label: 'Shoot not done yet', tone: 'grey', dueAt, lateAt, hoursLeft: null, pausedHours, onTime: null, rank: 400 + Math.min(99, hoursToGo / 24) }
  }
  if (waitingOnClient) {
    return { ...base, state: 'waiting_client', label: 'Waiting for client picks', tone: 'violet', dueAt, lateAt, hoursLeft: null, pausedHours, onTime: null, rank: 300 }
  }
  const hoursLeft = (lateAt! - now) / H
  if (hoursLeft <= 0) {
    // most overdue first
    return { ...base, state: 'overdue', label: `Overdue by ${fmtHours(hoursLeft)}`, tone: 'red', dueAt, lateAt, hoursLeft, pausedHours, onTime: null, rank: 100 - Math.min(99, -hoursLeft / 24) }
  }
  if (now >= dueAt!) {
    return { ...base, state: 'due', label: `Due — ${fmtHours(hoursLeft)} left`, tone: 'amber', dueAt, lateAt, hoursLeft, pausedHours, onTime: null, rank: 200 + hoursLeft / 1000 }
  }
  return { ...base, state: 'on_track', label: `On track — ${fmtHours(hoursLeft)} left`, tone: 'blue', dueAt, lateAt, hoursLeft, pausedHours, onTime: null, rank: 250 + hoursLeft / 1000 }
}

/** most urgent first; within the same state, by how close the deadline is */
export const byPriority = <T extends { d: Delivery }>(a: T, b: T) =>
  a.d.rank - b.d.rank || (a.d.state === 'delivered' ? (b.d.deliveredAt ?? '').localeCompare(a.d.deliveredAt ?? '') : 0)

export const STATE_LABEL: Record<DeliveryState, string> = {
  overdue: 'Overdue', due: 'Due now', on_track: 'On track', waiting_client: 'Waiting for client picks',
  upcoming: 'Shoot not done yet', delivered: 'Delivered', untracked: 'Not tracked',
}

/** for the bookings-table filter: "needs delivery" groups the three that count against the promise */
export const DELIVERY_FILTERS = [
  { value: 'attention', label: 'Needs delivery (priority first)' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due', label: 'Due now' },
  { value: 'on_track', label: 'On track' },
  { value: 'waiting_client', label: 'Waiting for client picks' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delivered_late', label: 'Delivered late' },
  { value: 'untracked', label: 'Not tracked' },
]
export const NEEDS_DELIVERY: DeliveryState[] = ['overdue', 'due', 'on_track']

export function matchesDeliveryFilter(d: Delivery, f: string) {
  if (!f) return true
  if (f === 'attention') return NEEDS_DELIVERY.includes(d.state)
  if (f === 'delivered_late') return d.state === 'delivered' && d.onTime === false
  return d.state === f
}
