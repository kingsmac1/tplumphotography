/**
 * Resend delivery for every Tplum email (bookings, payments, invoices, contracts, galleries, forms).
 * Needs the Supabase secrets RESEND_API_KEY, FROM_EMAIL and OWNER_EMAIL (never hard-coded).
 * Every email to a client is also copied to the business (see sendToClientAndOwner).
 */
import { LOGO_BASE64, LOGO_CID } from './logo.ts'

export type RenderedEmail = { subject: string; html: string; text: string }
export type SendResult = { sent: boolean; error?: string }

const env = (k: string) => (Deno.env.get(k) ?? '').trim()

/** pulls plain addresses out of messy values: quotes, "Name <a@b.c>", comma/semicolon lists */
const extractEmails = (v?: string) => (v ?? '').match(/[^\s"'<>,;]+@[^\s"'<>,;]+\.[^\s"'<>,;]+/g)?.map((x) => x.toLowerCase()) ?? []

export function mailConfig() {
  const owners = extractEmails(env('OWNER_EMAIL'))
  return {
    apiKey: env('RESEND_API_KEY'),
    from: env('FROM_EMAIL') || env('EMAIL_FROM'),
    owners,
    siteUrl: (env('SITE_URL') || 'https://tplumphotography.com').replace(/\/$/, ''),
  }
}

export type Attachment = { filename: string; content: string; content_type?: string }

/** Sends one email. Never throws: a missing key or a Resend error comes back as { sent: false, error }. `attachments` are base64 files (an invoice PDF). */
export async function sendEmail(o: { to: string | string[]; replyTo?: string; message: RenderedEmail; attachments?: Attachment[] }): Promise<SendResult> {
  const cfg = mailConfig()
  if (!cfg.apiKey || !cfg.from) return { sent: false, error: 'Email is not set up yet (RESEND_API_KEY / FROM_EMAIL missing in Supabase secrets).' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from,
        to: Array.isArray(o.to) ? o.to : [o.to],
        reply_to: o.replyTo,
        subject: o.message.subject,
        html: o.message.html,
        text: o.message.text,
        attachments: [{ filename: 'tplum-logo.png', content: LOGO_BASE64, content_id: LOGO_CID, content_type: 'image/png' }, ...(o.attachments ?? [])],
      }),
    })
    if (!res.ok) {
      const raw = await res.text().catch(() => '')
      let detail = raw
      try { detail = (JSON.parse(raw) as { message?: string }).message ?? raw } catch { /* keep raw */ }
      return { sent: false, error: `The email provider refused the email (${res.status}): ${detail.slice(0, 200)}` }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Email failed' }
  }
}

/** Sends the client their copy and the business its own copy (every form, booking, payment, invoice, contract and gallery email goes to both). */
export async function sendToClientAndOwner(o: { client?: string | null; clientMessage: RenderedEmail; ownerMessage?: RenderedEmail; attachments?: Attachment[]; replyTo?: string }) {
  const cfg = mailConfig()
  const results: { to: string; sent: boolean; error?: string }[] = []
  if (o.client) {
    const r = await sendEmail({ to: o.client, replyTo: cfg.owners[0], message: o.clientMessage, attachments: o.attachments })
    results.push({ to: o.client, ...r })
  }
  if (cfg.owners.length) {
    const msg = o.ownerMessage ?? { ...o.clientMessage, subject: `[Copy] ${o.clientMessage.subject}` }
    const r = await sendEmail({ to: cfg.owners, replyTo: o.replyTo ?? o.client ?? undefined, message: msg, attachments: o.attachments })
    results.push({ to: cfg.owners.join(', '), ...r })
  }
  return results
}
