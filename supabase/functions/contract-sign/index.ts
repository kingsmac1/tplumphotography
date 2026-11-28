/**
 * Public: the client signs a contract on /contract/<token>/.
 * Records the typed full name, the drawn signature (PNG), the time, IP address, browser, and a SHA-256 hash of the
 * exact contract text, then locks the contract (a database trigger refuses later edits).
 * Contracts are signed by both parties. When Tplum Photography has already signed, the contract is complete
 * ('countersigned') and both are emailed the fully signed copy; otherwise it waits for the studio ('signed') and the
 * owner is asked to sign it in the dashboard.
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { service } from '../_shared/auth.ts'
import { mailConfig, sendToClientAndOwner } from '../_shared/email.ts'
import { simpleEmail } from '../_shared/email-templates.ts'

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')

Deno.serve(handle(async (req, body) => {
  const token = String(body.token ?? '')
  if (!/^[0-9a-f]{40,80}$/.test(token)) throw new HttpError('Contract not found.', 404)
  const name = String(body.name ?? '').trim().slice(0, 120)
  const signature = String(body.signature ?? '')
  if (name.length < 2) throw new HttpError('Please type your full name.')
  if (!body.agree) throw new HttpError('Please tick the box to agree to the contract.')
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 400_000) throw new HttpError('Please draw your signature.')
  const db = service()
  const { data: c } = await db.from('contracts').select('*').eq('public_token', token).maybeSingle()
  if (!c || c.status === 'draft' || c.status === 'void') throw new HttpError('Contract not found.', 404)
  if (c.status === 'signed' || c.status === 'countersigned') throw new HttpError('This contract has already been signed.')
  // the text the client saw must be the text being signed
  const hash = await sha256(String(c.body))
  if (body.body_hash && body.body_hash !== hash) throw new HttpError('This contract was changed while you were reading it. Please reload the page.', 409)
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const now = new Date().toISOString()
  const studioSigned = !!c.studio_signed_at
  const { error } = await db.from('contracts').update({
    status: studioSigned ? 'countersigned' : 'signed', signed_at: now, signer_name: name, signer_email: c.client_email, signature_data: signature,
    signer_ip: ip || null, signer_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300), body_hash: hash,
  }).eq('id', c.id).in('status', ['sent', 'viewed'])
  if (error) throw error
  const cfg = mailConfig()
  const link = `${cfg.siteUrl}/contract/?t=${token}`
  const signedAt = new Date(now).toLocaleString('en-CA', { timeZone: 'America/Edmonton', dateStyle: 'long', timeStyle: 'short' })
  const first = name.split(/\s+/)[0]
  if (studioSigned) {
    await sendToClientAndOwner({
      client: c.client_email,
      clientMessage: simpleEmail({ subject: `Signed by both: ${c.title}`, eyebrow: 'Contract signed', title: 'Your contract is complete', intro: `Hi ${first}, your contract with Tplum Photography is now signed by you and by the studio. You can view or print the signed copy at any time.`, rows: [['Contract', c.number], ['Signed by you', `${signedAt} (Mountain Time)`], ['Signed for Tplum Photography', c.studio_signer_name ?? '']], button: { href: link, label: 'View signed contract' } }),
      ownerMessage: simpleEmail({ subject: `Fully signed: ${c.title} (${name})`, eyebrow: 'Contract signed by both', title: c.title, intro: `${name} signed. The contract is now signed by both parties.`, rows: [['Contract', c.number], ['Client', `${c.client_name} (${c.client_email})`], ['Signed', `${signedAt} (Mountain Time)`], ['IP address', ip || '—']], button: { href: link, label: 'View signed contract' } }),
    })
  } else {
    // the studio still has to sign: the client is thanked, the owner is asked to countersign
    await sendToClientAndOwner({
      client: c.client_email,
      clientMessage: simpleEmail({ subject: `Thank you for signing: ${c.title}`, eyebrow: 'Contract', title: 'Thank you for signing', intro: `Hi ${first}, thank you for signing. Tplum Photography will now sign the contract too, and you will receive the fully signed copy by email.`, rows: [['Contract', c.number], ['Signed by you', `${signedAt} (Mountain Time)`]] }),
      ownerMessage: simpleEmail({ subject: `Client signed: ${c.title} (your signature needed)`, eyebrow: 'Contract', title: 'Your signature is needed', intro: `${name} signed the contract. Sign it for Tplum Photography in Dashboard → Contracts to complete it; the fully signed copy then goes to the client.`, rows: [['Contract', c.number], ['Client', `${c.client_name} (${c.client_email})`], ['Signed', `${signedAt} (Mountain Time)`], ['IP address', ip || '—']], button: { href: `${cfg.siteUrl}/dashboard/#contracts/${c.id}`, label: 'Open in dashboard' } }),
    })
  }
  return json({ ok: true, signed_at: now })
}))
