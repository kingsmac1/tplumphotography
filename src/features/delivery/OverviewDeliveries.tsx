/** Overview: the deliveries that need attention, most urgent first. Hidden when nothing is waiting. */
import { Timer } from 'lucide-react'
import { Panel } from '@/pages/admin/viz'
import { NEEDS_DELIVERY, promiseText } from './model'
import { useDeliveries } from './useDeliveries'
import { DeliveryBadge, deliveryTitle } from './ui'

export function OverviewDeliveries({ onOpen, delay = 0.28 }: { onOpen: () => void; delay?: number }) {
  const { items, counts, settings } = useDeliveries()
  const urgent = items.filter((i) => NEEDS_DELIVERY.includes(i.d.state))
  if (!urgent.length) return null
  const sub = [counts.overdue && `${counts.overdue} overdue`, counts.due && `${counts.due} due now`, counts.on_track && `${counts.on_track} on track`].filter(Boolean).join(' · ')
  return (
    <Panel delay={delay} title="Delivery deadlines" sub={`${sub} · promise: ${promiseText(settings)}`}
      action={<button onClick={onOpen} className="text-xs font-body font-bold tracking-widest text-accent hover:underline whitespace-nowrap">DELIVERIES →</button>}>
      <ul data-overview-deliveries className="divide-y divide-border">
        {urgent.slice(0, 5).map((i) => (
          <li key={`${i.table}:${i.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium font-body truncate">{i.name || '—'}</p>
              <p className="text-xs text-muted-foreground font-body truncate">{i.what}</p>
            </div>
            <span title={deliveryTitle(i.d)}><DeliveryBadge d={i.d} /></span>
          </li>
        ))}
      </ul>
      {urgent.length > 5 && <button onClick={onOpen} className="mt-3 inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest text-muted-foreground hover:text-foreground"><Timer size={14} /> {urgent.length - 5} MORE</button>}
    </Panel>
  )
}

/** the welcome banner's button when something is overdue or due */
export function OverviewDeliveryButton({ onOpen }: { onOpen: () => void }) {
  const { counts } = useDeliveries()
  if (!counts.overdue && !counts.due) return null
  const text = counts.overdue ? `${counts.overdue} DELIVER${counts.overdue === 1 ? 'Y' : 'IES'} OVERDUE` : `${counts.due} DELIVER${counts.due === 1 ? 'Y' : 'IES'} DUE NOW`
  return (
    <button onClick={onOpen} className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-body font-bold tracking-widest transition-colors ${counts.overdue ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-amber-300/70 text-amber-200 hover:bg-white/10'}`}>
      <Timer size={14} /> {text}
    </button>
  )
}
