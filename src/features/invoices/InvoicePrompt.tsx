import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Modal } from './ui'
import { bookingPaid, bookingTotal, money, type BookingTable } from './model'
import { PAYMENT_EVENT, bookingInvoiceHref, type PaymentRecorded } from './events'
import '@/features/gallery/admin/kit/kit.css'

type Paid = { id: string; name: string; paid: number; total: number }

/** Asked after every payment that is recorded anywhere in the dashboard: does the client get an updated invoice? */
export function InvoicePrompt() {
  const [ask, setAsk] = useState<{ table: BookingTable; rows: Paid[] } | null>(null)
  useEffect(() => {
    const on = async (e: Event) => {
      const { table, ids } = (e as CustomEvent<PaymentRecorded>).detail
      const { data } = await supabase.from(table).select('*').in('id', ids)
      const rows = ((data ?? []) as Record<string, unknown>[])
        .map((b) => ({ id: String(b.id), name: String(b.full_name || 'This client'), paid: bookingPaid(table, b), total: bookingTotal(table, b) }))
        .filter((b) => b.paid > 0)
      if (rows.length) setAsk({ table, rows })
    }
    window.addEventListener(PAYMENT_EVENT, on)
    return () => window.removeEventListener(PAYMENT_EVENT, on)
  }, [])
  if (!ask) return null
  const close = () => setAsk(null)
  const one = ask.rows.length === 1 ? ask.rows[0] : null
  return (
    <Modal title={one ? 'Payment recorded' : `${ask.rows.length} payments recorded`} onClose={close}>
      {one ? (
        <>
          <p>{one.name} has now paid <b>{money(one.paid)}</b>{one.total > 0 ? <> of <b>{money(one.total)}</b></> : null}. Do you want to send them an updated invoice?</p>
          <div className="ad-formfoot" style={{ marginTop: 18 }}>
            <button className="ad-btn" onClick={close}>Not now</button>
            <a className="ad-btn primary" href={bookingInvoiceHref(ask.table, one.id, true)} onClick={close}>Send invoice</a>
          </div>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>Do you want to send these clients an updated invoice? Each one opens in a new tab.</p>
          <div className="ad-list">
            {ask.rows.map((b) => (
              <div key={b.id}>
                <span><b>{b.name}</b> <span className="ad-muted">paid {money(b.paid)}</span></span>
                <a className="ad-btn sm" href={`/admin${bookingInvoiceHref(ask.table, b.id, true)}`} target="_blank" rel="noreferrer">Send invoice</a>
              </div>
            ))}
          </div>
          <div className="ad-formfoot" style={{ marginTop: 18 }}><button className="ad-btn" onClick={close}>Not now</button></div>
        </>
      )}
    </Modal>
  )
}
