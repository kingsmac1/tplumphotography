/**
 * Resend delivery for the gallery emails — the same provider, sender and inline-logo approach as the booking emails
 * (src/server/mail.ts, which runs in Cloudflare Pages). Needs the Edge Function secrets RESEND_API_KEY and EMAIL_FROM.
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
    from: env('EMAIL_FROM') || env('RESEND_FROM_EMAIL') || env('RESEND_FROM'),
    owners: owners.length ? owners : ['darlmacimpression@gmail.com'],
    siteUrl: (env('SITE_URL') || 'https://dmi.com.ng').replace(/\/$/, ''),
    whatsapp: env('OWNER_WHATSAPP').replace(/[^\d]/g, '') || '2349013962323',
  }
}

export type Attachment = { filename: string; content: string; content_type?: string }

/** Sends one email. Never throws: a missing key or a Resend error comes back as { sent: false, error }. `attachments` are base64 files (an invoice PDF). */
export async function sendEmail(o: { to: string | string[]; replyTo?: string; message: RenderedEmail; attachments?: Attachment[] }): Promise<SendResult> {
  const cfg = mailConfig()
  if (!cfg.apiKey || !cfg.from) return { sent: false, error: 'Email is not set up yet (RESEND_API_KEY / EMAIL_FROM missing in Supabase secrets).' }
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
        attachments: [{ filename: 'tplum-logo-dark.png', content: LOGO_BASE64, content_id: LOGO_CID, content_type: 'image/png' }, ...(o.attachments ?? [])],
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
