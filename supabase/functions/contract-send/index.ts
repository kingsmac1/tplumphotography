/**
 * Admin: send a contract for e-signature (Dashboard -> Contracts -> Send). The client gets a private link
 * (/contract/<token>/); the business gets a copy. Draft -> Sent. Resending a sent contract re-sends the same link.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'
import { mailConfig, sendToClientAndOwner } from '../_shared/email.ts'
import { simpleEmail } from '../_shared/email-templates.ts'
import { EMAIL_RE } from '../_shared/contact-rules.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.contract_id)) throw new HttpError('Missing contract.')
  const db = service()
  const { data: c } = await db.from('contracts').select('*').eq('id', body.contract_id).maybeSingle()
  if (!c) throw new HttpError('This contract no longer exists.', 404)
  if (c.status === 'void') throw new HttpError('This contract was voided. Create a new one instead.')
  if (c.status === 'signed' || c.status === 'countersigned') throw new HttpError('This contract is already signed.')
  // both parties sign: Tplum Photography signs first, so the client sees the studio's signature on the contract
  if (!c.studio_signed_at) throw new HttpError('Sign the contract for Tplum Photography first (Studio signature), then send it to the client.')
  if (!EMAIL_RE.test(String(c.client_email ?? ''))) throw new HttpError("Add the client's email address first.")
  if (!String(c.body ?? '').trim()) throw new HttpError('The contract is empty.')
  const cfg = mailConfig()
  const link = `${cfg.siteUrl}/contract/?t=${c.public_token}`
  const first = String(c.client_name || '').trim().split(/\s+/)[0] || 'there'
  const results = await sendToClientAndOwner({
    client: c.client_email,
    clientMessage: simpleEmail({
      subject: `Please review and sign: ${c.title}`, eyebrow: 'Contract', title: c.title,
      intro: `Hi ${first}, your ${c.title.toLowerCase()} with Tplum Photography is ready. Please read it carefully and sign online. Your date is secured once the contract is signed and your retainer is paid.`,
      rows: [['Contract', c.number]], button: { href: link, label: 'Review & sign' }, footnote: 'This link is private. Please don’t forward this email.',
    }),
    ownerMessage: simpleEmail({ subject: `[Copy] Contract sent to ${c.client_name}: ${c.title}`, eyebrow: 'Contract sent', title: c.title, intro: `The contract was sent to ${c.client_name} (${c.client_email}).`, rows: [['Contract', c.number]], button: { href: link, label: 'Open the client link' } }),
  })
  if (!results[0]?.sent) throw new HttpError(results[0]?.error ?? 'The email could not be sent.', 502)
  await db.from('contracts').update({ status: c.status === 'draft' ? 'sent' : c.status, sent_at: new Date().toISOString() }).eq('id', c.id)
  return json({ ok: true, link })
}))
