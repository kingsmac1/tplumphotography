/**
 * The pieces of the Illuszionz dashboard the invoice screens use that the DMI gallery kit does not have yet
 * (dialog, pager, CSV export, dates). Styles come from the kit (src/features/gallery/admin/kit/kit.css).
 */
import { useEffect, type ReactNode } from 'react'

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${todayIso()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = before
    }
  }, [onClose])
  return (
    <div className="ad ad-kit">
      <div className="ad-overlay" data-lenis-prevent onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={'ad-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
          <header>
            <h3>{title}</h3>
            <button className="ad-x" onClick={onClose} aria-label="Close">×</button>
          </header>
          <div className="ad-modal-body">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (n: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="ad-pager">
      <button className="ad-btn sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span>Page {page} of {pages}</span>
      <button className="ad-btn sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  )
}
