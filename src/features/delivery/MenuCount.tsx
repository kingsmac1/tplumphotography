/** The number next to "Deliveries" in the dashboard menu: overdue (red), or else due now (amber). Nothing when all is well. */
import { useDeliveries } from './useDeliveries'

export function DeliveryMenuCount({ compact }: { compact?: boolean }) {
  const { counts } = useDeliveries()
  const n = counts.overdue || counts.due
  if (!n) return null
  const red = counts.overdue > 0
  const label = red ? `${counts.overdue} overdue` : `${counts.due} due now`
  const tone = red ? 'bg-red-600 text-white' : 'bg-amber-400 text-black'
  return compact
    ? <span data-delivery-count aria-label={label} title={label} className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] leading-4 font-bold text-center ${tone}`}>{n}</span>
    : <span data-delivery-count aria-label={label} title={label} className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] leading-5 font-bold text-center ${tone}`}>{n}</span>
}
