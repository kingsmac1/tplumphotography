/** "A payment was just recorded on these bookings": the dashboard then asks whether to send an updated invoice. */
import { isBookingTable, type BookingTable } from './model'

export const PAYMENT_EVENT = 'dmi:payment-recorded'
export type PaymentRecorded = { table: BookingTable; ids: string[] }

/** Call after a payment status other than Not Paid is saved. Tables that cannot be invoiced (academy) are ignored. */
export function announcePayment(table: string, ids: (string | null | undefined)[], status?: string | null) {
  if (typeof window === 'undefined' || !isBookingTable(table) || status === 'Not Paid') return
  const clean = ids.filter((x): x is string => !!x)
  if (clean.length) window.dispatchEvent(new CustomEvent<PaymentRecorded>(PAYMENT_EVENT, { detail: { table, ids: clean } }))
}

/** Link to a booking's invoice. It reuses the booking's invoice when it has one; `send` opens the email step straight away. */
export const bookingInvoiceHref = (table: BookingTable, bookingId: string, send = false) => `#invoices/booking/${table}/${bookingId}${send ? '/send' : ''}`
