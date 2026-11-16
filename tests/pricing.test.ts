import { describe, expect, it } from 'vitest'
import { balanceDue, couponDiscount, depositFor, PricingError, quoteSession, quoteStudio, quoteWedding, taxOn } from '../src/lib/pricing'
import { DEFAULT_BOOKING_EXTRAS, DEFAULT_BOOKING_PRICES } from '../src/data/pricingDefaults'

const services = DEFAULT_BOOKING_PRICES.map((r) => ({ id: r.service_id, name: r.name, price: r.price, pricing_mode: r.pricing_mode }))
const extras = DEFAULT_BOOKING_EXTRAS

describe('session quotes (Tplum portrait packages)', () => {
  const svc = DEFAULT_BOOKING_PRICES.map((r) => ({ id: r.service_id, name: r.name, price: r.price, pricing_mode: r.pricing_mode, duration_minutes: r.duration_minutes }))
  const GST = { name: 'GST', rate: 5 }
  it('prices a package with no extras', () => {
    const q = quoteSession({ serviceId: 'package-1', extras: [] }, svc, extras)
    expect(q).toMatchObject({ serviceTotal: 350, extrasTotal: 0, subtotal: 350, discount: 0, tax: 0, total: 350, durationMinutes: 60 })
  })
  it('adds GST on top (5% of the discounted subtotal)', () => {
    const q = quoteSession({ serviceId: 'package-2', extras: [], tax: GST }, svc, extras)
    expect(q).toMatchObject({ subtotal: 450, tax: 22.5, taxName: 'GST', taxRate: 5, total: 472.5 })
  })
  it('multiplies quantity extras and adds tick-box extras once', () => {
    const q = quoteSession({ serviceId: 'package-3', extras: [{ name: 'Additional Edited Images', qty: 4 }, { name: 'Rush Delivery' }] }, svc, extras)
    expect(q.extrasTotal).toBe(4 * 25 + 100)
    expect(q.total).toBe(500 + 200)
  })
  it('"Extra 30 Minutes" adds $50 and 30 minutes per unit', () => {
    const q = quoteSession({ serviceId: 'package-1', extras: [{ name: 'Extra 30 Minutes', qty: 2 }] }, svc, extras)
    expect(q.extrasTotal).toBe(100)
    expect(q.durationMinutes).toBe(60 + 60)
  })
  it('caps quantities at the maximum and never below 1', () => {
    const q = quoteSession({ serviceId: 'package-1', extras: [{ name: 'Additional Edited Images', qty: 999 }, { name: 'Extra Outfit', qty: -3 }] }, svc, extras)
    expect(q.extrasTotal).toBe(20 * 25 + 1 * 50)
  })
  it('ignores a duplicated extra (a tampered request cannot double-charge)', () => {
    const q = quoteSession({ serviceId: 'package-1', extras: [{ name: 'Rush Delivery' }, { name: 'Rush Delivery' }] }, svc, extras)
    expect(q.extrasTotal).toBe(100)
  })
  it('applies a coupon to the package only, then GST on what is left', () => {
    const q = quoteSession({ serviceId: 'package-2', extras: [{ name: 'Rush Delivery' }], promoPercent: 10, tax: GST }, svc, extras)
    expect(q.discount).toBe(45)
    expect(q.tax).toBe(25.25) // 5% of (450 + 100 − 45)
    expect(q.total).toBe(530.25)
  })
  it('rounds coupons and tax to the cent', () => {
    expect(couponDiscount(333.33, 15)).toBe(50)
    expect(couponDiscount(99.99, 33)).toBe(33)
    expect(taxOn(333.33, { name: 'GST', rate: 5 })).toBe(16.67)
    expect(taxOn(100, null)).toBe(0)
  })
  it('per-outfit packages multiply by outfits', () => {
    const q = quoteSession({ serviceId: 'x', outfits: 3, extras: [] }, [{ id: 'x', name: 'Per outfit', price: 120.5, pricing_mode: 'per_outfit' }], [])
    expect(q.total).toBe(361.5)
  })
  it('"same price as the package" extras follow the chosen package', () => {
    const q = quoteSession({ serviceId: 'x', extras: [{ name: 'Same', qty: 2 }] }, [{ id: 'x', name: 'X', price: 200, pricing_mode: 'bundle' }], [{ name: 'Same', price: 0, max_qty: 3, follows_package: true }])
    expect(q.extrasTotal).toBe(400)
  })
  it('rejects unknown packages and extras', () => {
    expect(() => quoteSession({ serviceId: 'nope', extras: [] }, svc, extras)).toThrow(PricingError)
    expect(() => quoteSession({ serviceId: 'package-1', extras: [{ name: 'Free money' }] }, svc, extras)).toThrow(PricingError)
  })
})

describe('wedding quotes', () => {
  const pk = [{ id: 'classic', name: 'Classic', one_event: 3200, two_events: 5400 }, { id: 'intimate', name: 'Intimate', one_event: 1800, two_events: null }]
  const ex = [{ name: 'Engagement Session', price: 450 }]
  it('uses the two-day price when chosen', () => {
    expect(quoteWedding({ packageId: 'classic', days: 'two', extras: [] }, pk, ex).total).toBe(5400)
  })
  it('falls back to the single price when there is no two-day price', () => {
    expect(quoteWedding({ packageId: 'intimate', days: 'two', extras: ['Engagement Session'] }, pk, ex).total).toBe(2250)
  })
})

describe('studio rental quotes', () => {
  const spaces = [{ id: 's', name: 'Studio', price: 60, duration_minutes: 60 }]
  const sx = [{ id: 'extra-time', name: 'Extra Hour', price: 0, max_qty: 4, follows_package: true }, { id: 'props', name: 'Props', price: 10, max_qty: 10, follows_package: false }]
  it('extra hours cost the space rate and lengthen the booking', () => {
    const q = quoteStudio({ spaceId: 's', extras: [{ id: 'extra-time', qty: 2 }, { id: 'props', qty: 3 }] }, spaces, sx)
    expect(q.total).toBe(60 + 120 + 30)
    expect(q.durationMinutes).toBe(180)
  })
  it('promo discounts the space only', () => {
    const q = quoteStudio({ spaceId: 's', extras: [{ id: 'props', qty: 1 }], promoPercent: 50 }, spaces, sx)
    expect(q.discount).toBe(30)
    expect(q.total).toBe(40)
  })
})

describe('deposit rules', () => {
  it('percentage deposit', () => {
    expect(depositFor(1000, { deposit_mode: 'percent', deposit_percent: 30, deposit_fixed: 0 })).toBe(300)
    expect(depositFor(333.33, { deposit_mode: 'percent', deposit_percent: 30, deposit_fixed: 0 })).toBe(100)
  })
  it('fixed deposit never exceeds the total', () => {
    expect(depositFor(150, { deposit_mode: 'fixed', deposit_percent: 0, deposit_fixed: 200 })).toBe(150)
    expect(depositFor(1500, { deposit_mode: 'fixed', deposit_percent: 0, deposit_fixed: 200 })).toBe(200)
  })
  it('full payment and zero totals', () => {
    expect(depositFor(480.5, { deposit_mode: 'full', deposit_percent: 0, deposit_fixed: 0 })).toBe(480.5)
    expect(depositFor(0, { deposit_mode: 'percent', deposit_percent: 30, deposit_fixed: 0 })).toBe(0)
  })
  it('percent is clamped to 0–100', () => {
    expect(depositFor(100, { deposit_mode: 'percent', deposit_percent: 150, deposit_fixed: 0 })).toBe(100)
    expect(depositFor(100, { deposit_mode: 'percent', deposit_percent: -5, deposit_fixed: 0 })).toBe(0)
  })
  it('balance due', () => {
    expect(balanceDue(1000, 300)).toBe(700)
    expect(balanceDue(1000, 1200)).toBe(0)
    expect(balanceDue(0.3, 0.1)).toBe(0.2)
  })
})

import { localTime } from '../src/features/delivery/model'
describe('Mountain Time conversion (delivery clock)', () => {
  it('handles winter (MST, UTC-7) and summer (MDT, UTC-6)', () => {
    expect(new Date(localTime('2026-01-15', 14, 0)!).toISOString()).toBe('2026-01-15T21:00:00.000Z')
    expect(new Date(localTime('2026-07-15', 14, 0)!).toISOString()).toBe('2026-07-15T20:00:00.000Z')
  })
})
