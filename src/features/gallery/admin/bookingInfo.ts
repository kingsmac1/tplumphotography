/** Defaults the Gallery Manager takes from a DMI booking: the gallery title and the number of photos the package includes. */
import { fmtDay } from '../status'

type Booking = Record<string, any>

export const shootName = (b: Booking) => String(b.kind ?? 'Photo shoot').replace(/ booking$/i, '')

export const defaultTitle = (b: Booking, kind: 'proof' | 'final') =>
  `${shootName(b)}${b.event_date ? ` — ${fmtDay(b.event_date)}` : ''}${kind === 'final' ? ' · Final photos' : ''}`

/**
 * Edited photos in the booked package, read from the booking summary, e.g. "Individual - $50,000 (1 outfit · 3 edited images)",
 * plus any "N extra edited images" add-on written in the summary. null = no number found (set the limit by hand).
 */
export function suggestLimit(b: Booking): number | null {
  const text = `${b.service_summary ?? ''} ${b.packages ?? ''}`
  const base = /(\d+)\s*edited\s*(?:images|pictures|photos)/i.exec(text)
  const extra = /(\d+)\s*extra\s*edited\s*(?:images|pictures|photos)/i.exec(text) ?? /extra\s*edited\s*(?:images|pictures|photos)\s*[x×]\s*(\d+)/i.exec(text)
  const total = (base ? Number(base[1]) : 0) + (extra ? Number(extra[1]) : 0)
  return total || null
}
