/**
 * Dashboard building blocks for the gallery screens: the same pieces as the Illuszionz dashboard, so the Gallery Manager and
 * the Galleries page look and work the same. Styles: ./kit.css (all under `.ad`).
 */
import { useEffect, useState, type ReactNode } from 'react'

export const fmtDate = (v?: string | null, withTime = false) => {
  if (!v) return '—'
  const d = new Date(v.length === 10 ? v + 'T12:00:00' : v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}

export const ago = (v?: string | null) => {
  if (!v) return '—'
  const s = (Date.now() - new Date(v).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(v)
}

export const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()

const TONES: Record<string, string> = {
  'Not Paid': 'red', 'Deposit Paid': 'amber', 'Part Paid': 'amber', Paid: 'green', draft: 'grey', sent: 'green', failed: 'red', pending: 'amber',
}
export const Badge = ({ children, tone }: { children: ReactNode; tone?: string }) => <span className={'ad-badge ' + (tone ?? TONES[String(children)] ?? 'grey')}>{children}</span>

export const Field = ({ label, children, hint, full }: { label: string; children: ReactNode; hint?: string; full?: boolean }) => (
  <label className={'ad-field' + (full ? ' full' : '')}>
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
)

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="ad-empty">
    <strong>{title}</strong>
    {hint && <p>{hint}</p>}
    {action}
  </div>
)

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="ad-pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="ad-actions">{actions}</div>
    </div>
  )
}

export const Stat = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) => (
  <div className={'ad-stat ' + (tone ?? '')}>
    <span>{label}</span>
    <strong>{value}</strong>
    {sub && <small>{sub}</small>}
  </div>
)

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="ad-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <em>{t.count}</em>}
        </button>
      ))}
    </div>
  )
}

export function useDebounced<T>(v: T, ms = 250) {
  const [x, setX] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return x
}
