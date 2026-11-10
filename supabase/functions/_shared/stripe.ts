/**
 * Minimal Stripe client for the Edge Functions (REST API, no SDK). TEST mode only during setup:
 * STRIPE_SECRET_KEY must start with sk_test_ until the owner switches to live (see SETUP-GUIDE.md).
 */
const API = 'https://api.stripe.com/v1'

export const stripeKey = () => (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
export const stripeReady = () => /^sk_(test|live)_/.test(stripeKey()) || /^rk_(test|live)_/.test(stripeKey())

/** Stripe's form encoding for nested objects/arrays: line_items[0][price_data][currency]=cad */
function encode(obj: unknown, prefix = '', out: string[] = []): string[] {
  if (obj === undefined || obj === null) return out
  if (typeof obj !== 'object') { out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(obj))}`); return out }
  if (Array.isArray(obj)) obj.forEach((v, i) => encode(v, `${prefix}[${i}]`, out))
  else for (const [k, v] of Object.entries(obj as Record<string, unknown>)) encode(v, prefix ? `${prefix}[${k}]` : k, out)
  return out
}

export async function stripe<T = any>(path: string, params?: Record<string, unknown>, method = 'POST'): Promise<T> {
  const key = stripeKey()
  if (!key) throw new Error('Stripe is not set up yet (STRIPE_SECRET_KEY missing in Supabase secrets).')
  const res = await fetch(`${API}${path}${method === 'GET' && params ? `?${encode(params).join('&')}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: method === 'GET' ? undefined : encode(params ?? {}).join('&'),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Stripe: ${json?.error?.message ?? res.status}`)
  return json as T
}

export type CheckoutInput = {
  amountCents: number
  name: string
  description?: string
  email?: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  expiresInMinutes?: number
}

/** A Checkout Session for one CAD amount (deposit, balance or invoice payment). */
export async function createCheckout(i: CheckoutInput): Promise<{ id: string; url: string }> {
  const s = await stripe<{ id: string; url: string }>('/checkout/sessions', {
    mode: 'payment',
    currency: 'cad',
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    customer_email: i.email || undefined,
    expires_at: Math.floor(Date.now() / 1000) + Math.max(30, i.expiresInMinutes ?? 30) * 60,
    line_items: [{ quantity: 1, price_data: { currency: 'cad', unit_amount: i.amountCents, product_data: { name: i.name, description: i.description || undefined } } }],
    metadata: i.metadata,
    payment_intent_data: { metadata: i.metadata, description: i.name },
  })
  return { id: s.id, url: s.url }
}

/** Verifies the Stripe-Signature header (HMAC-SHA256 of "timestamp.payload"), rejecting events older than 5 minutes. */
export async function verifyWebhook(payload: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]).filter((p) => p.length === 2))
  const t = Number(parts.t)
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3))
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  return sigs.some((s) => timingSafeEqual(s, hex))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
