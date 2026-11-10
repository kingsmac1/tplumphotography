/**
 * Delivery data for the whole dashboard (menu badge, Overview, Deliveries page, bookings tables): the settings, every
 * tracked photo and event booking, and each one's delivery state. One shared copy, refreshed after any change.
 * Works before supabase/delivery-tracking.sql has been run: the defaults are used and `installed` is false.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { byBooking, refreshGalleries, useGalleryIndex } from '@/features/gallery/admin/useGalleryIndex'
import type { GalleryRow } from '@/features/gallery/types'
import { computeDelivery, byPriority, DEFAULT_DELIVERY_SETTINGS, lagosDay, type Delivery, type DeliverySettings, type DeliveryTable, type DeliveryInput } from './model'

export type DeliveryRow = {
  table: DeliveryTable
  id: string
  name: string
  phone: string
  email: string
  /** "Birthday · Classic" or "Wedding · Ibom Hall" */
  what: string
  date: string | null
  endDate: string | null
  time: string | null
  /** for the gallery link (photo bookings only) */
  hasGallery: boolean
  input: DeliveryInput
}
export type DeliveryItem = DeliveryRow & { d: Delivery }

type State = { settings: DeliverySettings; installed: boolean; rows: DeliveryRow[]; loading: boolean; error: string; loadedAt: number }
let state: State = { settings: DEFAULT_DELIVERY_SETTINGS, installed: false, rows: [], loading: false, error: '', loadedAt: 0 }
const listeners = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((f) => f()) }
let inflight: Promise<void> | null = null

export const isMissing = (msg: string) => /(delivery_settings|delivered_)/.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg)
export const SETUP_NOTE = 'Delivery tracking is not switched on in the database yet. Run npm run gallery:go-live once (or paste supabase/delivery-tracking.sql into the Supabase SQL editor), then reload. Until then the default promises are used (48–72 hours, events and weddings 7 days) and nothing can be marked delivered.'

type Row = { [column: string]: unknown }
type BookingGalleries = { proof?: GalleryRow; final?: GalleryRow }
const str = (v: unknown) => (v == null || v === '' ? null : String(v))

/** the shoot/event as delivery input (the tables use this too, with the rows they already loaded) */
export function photoInput(row: object, g?: BookingGalleries): DeliveryInput {
  const b = row as Row
  return {
    date: str(b.shoot_date), time: str(b.shoot_time), long: isLongShoot(b), durationMinutes: b.duration_minutes == null ? null : Number(b.duration_minutes),
    deliveredAt: str(b.delivered_at), deliveredVia: str(b.delivered_via), deliveredBy: str(b.delivered_by), ...pick(g),
  }
}
/** weddings (from the wedding form) and photo bookings for an event get the events-and-weddings promise */
export const isLongShoot = (b: object) => (b as Row).source === 'wedding_form' || /^(event|wedding)$/i.test(String((b as Row).shoot_type ?? '').trim())
export function eventInput(row: object): DeliveryInput {
  const e = row as Row
  return { date: str(e.event_start_date), endDate: str(e.event_end_date), time: str(e.event_time), isEvent: true, long: true, deliveredAt: str(e.delivered_at), deliveredVia: str(e.delivered_via), deliveredBy: str(e.delivered_by) }
}

export function refreshDeliveries() {
  inflight ??= (async () => {
    set({ loading: true })
    const s = await supabase.from('delivery_settings').select('*').eq('id', 1).maybeSingle()
    const installed = !s.error && !!s.data
    const num = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d)
    const D = DEFAULT_DELIVERY_SETTINGS
    const settings: DeliverySettings = installed
      ? { track_from: String(s.data!.track_from), due_hours: num(s.data!.due_hours, D.due_hours), late_hours: num(s.data!.late_hours, D.late_hours), event_due_hours: num(s.data!.event_due_hours, D.event_due_hours), event_late_hours: num(s.data!.event_late_hours, D.event_late_hours) }
      : D
    // a week before tracking starts too, so a shoot moved to an earlier date still shows (as "not tracked")
    const from = lagosDay(new Date(`${settings.track_from}T12:00:00Z`).getTime() - 7 * 86_400_000)
    const [b, e] = await Promise.all([
      supabase.from('bookings').select('*').gte('shoot_date', from).limit(5000),
      supabase.from('event_bookings').select('*').or(`event_end_date.gte.${from},event_start_date.gte.${from}`).limit(5000),
    ])
    const err = (s.error && !isMissing(s.error.message) ? s.error.message : '') || b.error?.message || e.error?.message || ''
    const rows: DeliveryRow[] = [
      ...((b.data ?? []) as Row[]).map((r): DeliveryRow => ({
        table: 'bookings', id: String(r.id), name: str(r.full_name) ?? '', phone: str(r.phone) ?? '', email: str(r.email) ?? '',
        what: [r.source === 'wedding_form' ? 'Wedding' : str(r.shoot_type), str(r.selected_service)].filter(Boolean).join(' · ') || 'Photo shoot', date: str(r.shoot_date), endDate: null, time: str(r.shoot_time),
        hasGallery: true, input: photoInput(r),
      })),
      ...((e.data ?? []) as Row[]).map((r): DeliveryRow => ({
        table: 'event_bookings', id: String(r.id), name: str(r.full_name) ?? '', phone: str(r.phone) ?? '', email: str(r.email) ?? '',
        what: [str(r.event_type) || 'Event', str(r.venue)].filter(Boolean).join(' · '), date: str(r.event_start_date), endDate: str(r.event_end_date), time: str(r.event_time),
        hasGallery: false, input: eventInput(r),
      })),
    ]
    set({ settings, installed, rows, loading: false, error: err, loadedAt: Date.now() })
  })().finally(() => { inflight = null })
  return inflight
}

/** re-render every minute so countdowns stay current */
let tick = 0
const tickers = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
function subscribeTick(f: () => void) {
  tickers.add(f)
  timer ??= setInterval(() => { tick = Date.now(); tickers.forEach((x) => x()) }, 60_000)
  return () => { tickers.delete(f); if (!tickers.size && timer) { clearInterval(timer); timer = null } }
}
export const useNow = () => useSyncExternalStore(subscribeTick, () => tick || (tick = Date.now()), () => tick || Date.now())

export function useDeliverySettings() {
  const s = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, () => state, () => state)
  useEffect(() => { if (!state.loadedAt && !inflight) void refreshDeliveries() }, [])
  return s
}

/** every tracked booking with its delivery state, most urgent first */
export function useDeliveries() {
  const s = useDeliverySettings()
  const gx = useGalleryIndex()
  const now = useNow()
  const galleries = useMemo(() => byBooking(gx.galleries), [gx.galleries])
  const items = useMemo<DeliveryItem[]>(() => s.rows.map((r) => {
    const input = r.table === 'bookings' ? { ...r.input, ...pick(galleries.get(r.id)) } : r.input
    return { ...r, input, d: computeDelivery(input, s.settings, now) }
  }).sort(byPriority), [s.rows, s.settings, galleries, now])
  const counts = useMemo(() => {
    const c = { overdue: 0, due: 0, on_track: 0, waiting_client: 0, upcoming: 0, delivered: 0, untracked: 0, deliveredLate: 0 }
    for (const i of items) { c[i.d.state]++; if (i.d.state === 'delivered' && i.d.onTime === false) c.deliveredLate++ }
    return c
  }, [items])
  return { ...s, items, counts, loading: s.loading || (!s.loadedAt && !s.error) }
}
function pick(g?: BookingGalleries) { return { proof: g?.proof ?? null, final: g?.final ?? null } }

/**
 * Mark bookings delivered (at `at`, default now) or not delivered. Only manual marks can be undone: a delivery made
 * through the client gallery stays delivered. Returns an error message, or '' on success.
 */
export async function setDelivered(table: DeliveryTable, ids: string[], delivered: boolean, at?: Date): Promise<string> {
  if (!ids.length) return ''
  const { data: u } = await supabase.auth.getUser()
  const patch = delivered
    ? { delivered_at: (at ?? new Date()).toISOString(), delivered_via: 'manual', delivered_by: u.user?.email ?? null }
    : { delivered_at: null, delivered_via: null, delivered_by: null }
  let q = supabase.from(table).update(patch).in('id', ids)
  if (!delivered) q = q.eq('delivered_via', 'manual')
  const { data, error } = await q.select('id')
  if (error) return isMissing(error.message) ? SETUP_NOTE : error.message
  if (!data?.length) return delivered ? 'Nothing was updated. Make sure your account is an admin.' : 'Only deliveries marked by hand can be undone; finals sent through the client gallery stay delivered.'
  void refreshDeliveries()
  void refreshGalleries()
  return ''
}

export async function saveDeliverySettings(p: DeliverySettings): Promise<string> {
  const { error } = await supabase.from('delivery_settings').upsert({ id: 1, ...p, updated_at: new Date().toISOString() })
  if (error) return isMissing(error.message) ? SETUP_NOTE : error.message
  await refreshDeliveries()
  return ''
}
