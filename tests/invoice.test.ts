import { describe, expect, it } from 'vitest'
import { blankInvoice, invoiceFromBooking, invoiceStatus, invoiceTotals, lineAmount, nextNumber } from '../src/features/invoices/model'

const doc = (over = {}) => ({ ...blankInvoice('2026-11-10'), items: [{ title: 'A', description: '', qty: '2', rate: '150', amount: '300' }, { title: 'B', description: '', qty: '1', rate: '99.99', amount: '99.99' }], ...over })

describe('invoice totals', () => {
  it('line amount = qty × rate, to the cent', () => {
    expect(lineAmount('3', '33.335')).toBe('100.01')
    expect(lineAmount('2', '')).toBe('')
  })
  it('no tax by default', () => {
    const t = invoiceTotals(doc())
    expect(t).toMatchObject({ subtotal: 399.99, discount: 0, tax: 0, total: 399.99, paid: 0, balance: 399.99, stage: 'before' })
  })
  it('tax (e.g. GST 5%) applies after the discount when switched on', () => {
    const t = invoiceTotals(doc({ discount: '50', taxEnabled: true, taxRate: '5' }))
    expect(t.taxable).toBe(349.99)
    expect(t.tax).toBe(17.5)
    expect(t.total).toBe(367.49)
  })
  it('HST 13%', () => {
    expect(invoiceTotals(doc({ items: [{ title: 'x', description: '', qty: '1', rate: '1000', amount: '1000' }], taxEnabled: true, taxRate: '13' })).total).toBe(1130)
  })
  it('discount can never exceed the subtotal', () => {
    expect(invoiceTotals(doc({ discount: '5000' })).total).toBe(0)
  })
  it('payments reduce the balance and set the stage', () => {
    const part = invoiceTotals(doc({ payments: [{ date: '2026-11-10', method: 'Stripe', amount: '120' }] }))
    expect(part).toMatchObject({ paid: 120, balance: 279.99, stage: 'part' })
    const full = invoiceTotals(doc({ payments: [{ date: '', method: '', amount: '400' }] }))
    expect(full).toMatchObject({ balance: 0, overpaid: 0.01, stage: 'paid' })
  })
})

describe('invoice status', () => {
  const t = (total: number, paid: number) => ({ total, paid, balance: Math.max(0, total - paid) })
  it('draft until sent', () => expect(invoiceStatus(t(100, 0), { sent: false, today: '2026-11-10' })).toBe('draft'))
  it('sent', () => expect(invoiceStatus(t(100, 0), { sent: true, dueDate: '2026-12-01', today: '2026-11-10' })).toBe('sent'))
  it('overdue when past due with money owed', () => expect(invoiceStatus(t(100, 20), { sent: true, dueDate: '2026-11-01', today: '2026-11-10' })).toBe('overdue'))
  it('part paid', () => expect(invoiceStatus(t(100, 20), { sent: true, dueDate: '2026-12-01', today: '2026-11-10' })).toBe('part_paid'))
  it('paid wins over overdue', () => expect(invoiceStatus(t(100, 100), { sent: true, dueDate: '2026-11-01', today: '2026-11-10' })).toBe('paid'))
})

describe('numbering', () => {
  it('starts at TPL-0001 and carries on', () => {
    expect(nextNumber([])).toBe('TPL-0001')
    expect(nextNumber(['TPL-0009', 'TPL-0010'])).toBe('TPL-0011')
  })
})

describe('invoice from a booking', () => {
  it('pre-fills client, package, extras, coupon discount and the deposit paid', () => {
    const b = { full_name: 'Ada Client', email: 'ada@example.com', phone: '+1 403 555 0100', selected_service: 'Engagement Session', shoot_type: 'Engagement', shoot_date: '2026-12-05', shoot_time: '14:00', service_total: 450, extras_total: 150, grand_total: 555, payment_status: 'Part Payment', amount_paid: 166.5, payment_updated_at: '2026-11-10T10:00:00Z', service_summary: 'Engagement Session | Coupon TPLUM10 (10% off)' }
    const d = invoiceFromBooking(blankInvoice('2026-11-10'), 'bookings', b)
    expect(d.billName).toBe('Ada Client')
    expect(d.items.map((i) => i.amount)).toEqual(['450', '150'])
    expect(d.discount).toBe('45')
    expect(d.discountLabel).toBe('Coupon TPLUM10')
    const t = invoiceTotals(d)
    expect(t).toMatchObject({ total: 555, paid: 166.5, balance: 388.5 })
  })
})
