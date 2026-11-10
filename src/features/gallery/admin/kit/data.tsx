/**
 * What the gallery screens need from the DMI dashboard: the photo-shoot bookings (from public.bookings, in the shape the
 * gallery code uses) and toast messages. Wrap the gallery screens in <GalleryAdminProvider>.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../supabase'
import './kit.css'

export type R = Record<string, any>

/** DMI booking row -> the fields the gallery uses (name, email, phone, kind, event_date, ref, packages …). */
export const toGalleryBooking = (b: R): R => ({
  ...b,
  name: b.full_name ?? '',
  email: b.email ?? '',
  phone: b.phone ?? '',
  kind: b.shoot_type || b.selected_service || 'Photo shoot',
  event_date: b.shoot_date ?? null,
  event_time: b.shoot_time ?? null,
  ref: String(b.id ?? '').slice(0, 6).toUpperCase(),
  packages: [b.selected_service, b.service_summary].filter(Boolean).join(' · '),
})

type Ctx = { d: { bookings: R[] }; loading: boolean; refresh: () => void; toast: (msg: string, kind?: 'ok' | 'err') => void }
const DataCtx = createContext<Ctx | null>(null)

export function GalleryAdminProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<R[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])

  const refresh = useCallback(() => {
    supabase
      .from('bookings')
      .select('id, created_at, full_name, email, phone, shoot_type, shoot_date, shoot_time, selected_service, service_summary, outfits, extra_edited_count, grand_total, payment_status')
      .order('created_at', { ascending: false })
      .limit(5000)
      .then(({ data }) => { setBookings((data ?? []).map(toGalleryBooking)); setLoading(false) })
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 3500)
  }, [])

  const value = useMemo(() => ({ d: { bookings }, loading, refresh, toast }), [bookings, loading, refresh, toast])
  return (
    <DataCtx.Provider value={value}>
      <div className="ad ad-kit">{children}</div>
      <div className="ad ad-kit ad-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={'ad-toast ' + t.kind}>{t.msg}</div>)}
      </div>
    </DataCtx.Provider>
  )
}

export function useData() {
  const c = useContext(DataCtx)
  if (!c) throw new Error('Wrap the gallery screens in <GalleryAdminProvider>')
  return c
}
