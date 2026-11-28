/**
 * Admin: the photographer signs a contract for Tplum Photography (Dashboard → Contracts → a contract).
 *   { contract_id, name, signature, save_default? } → records the studio's signature. Usually done before sending;
 *     when the client has already signed, the contract is complete ('countersigned') and both are emailed.
 *   { contract_id, action: 'remove' } → removes the studio's signature while the contract is still a draft, so the
 *     text can be edited again.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'
import { mailConfig, sendToClientAndOwner } from '../_shared/email.ts'
import { simpleEmail } from '../_shared/email-templates.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.contract_id)) throw new HttpError('Missing contract.')
  const db = service()
  const { data: c } = await db.from('contracts').select('*').eq('id', body.contract_id).maybeSingle()
  if (!c) throw new HttpError('This contract no longer exists.', 404)
  if (c.status === 'void') throw new HttpError('This contract was voided.')

  if (body.action === 'remove') {
    if (c.status !== 'draft') throw new HttpError('The studio signature can only be removed before the contract is sent.')
    await db.from('contracts').update({ studio_signed_at: null, studio_signer_name: null, studio_signature_data: null }).eq('id', c.id)
    return json({ ok: true })
  }

  if (c.studio_signed_at) throw new HttpError('Tplum Photography has already signed this contract.')
  if (!String(c.body ?? '').trim()) throw new HttpError('The contract is empty.')
  const name = String(body.name ?? '').trim().slice(0, 120)
  const signature = String(body.signature ?? '')
  if (name.length < 2) throw new HttpError('Type the name of the person signing for Tplum Photography.')
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 400_000) throw new HttpError('Draw the signature, or use the saved one.')
  const now = new Date().toISOString()
  const complete = c.status === 'signed'
  const { error } = await db.from('contracts').update({ studio_signed_at: now, studio_signer_name: name, studio_signature_data: signature, ...(complete ? { status: 'countersigned' } : {}) })
    .eq('id', c.id).is('studio_signed_at', null)
  if (error) throw error
  if (body.save_default === true) await db.from('contract_settings').upsert({ id: 1, signer_name: name, signature_image: signature, updated_at: now })

  if (complete) {
    const cfg = mailConfig()
    const link = `${cfg.siteUrl}/contract/?t=${c.public_token}`
    const first = String(c.signer_name || c.client_name || '').trim().split(/\s+/)[0] || 'there'
    const signedAt = new Date(now).toLocaleString('en-CA', { timeZone: 'America/Edmonton', dateStyle: 'long', timeStyle: 'short' })
    await sendToClientAndOwner({
      client: c.client_email,
      clientMessage: simpleEmail({ subject: `Signed by both: ${c.title}`, eyebrow: 'Contract signed', title: 'Your contract is complete', intro: `Hi ${first}, Tplum Photography has signed your contract, so it is now signed by both parties. You can view or print the signed copy at any time.`, rows: [['Contract', c.number], ['Signed for Tplum Photography', `${name} · ${signedAt} (Mountain Time)`]], button: { href: link, label: 'View signed contract' } }),
      ownerMessage: simpleEmail({ subject: `Fully signed: ${c.title} (${c.client_name})`, eyebrow: 'Contract signed by both', title: c.title, intro: 'The contract is now signed by both parties.', rows: [['Contract', c.number], ['Client', `${c.client_name} (${c.client_email})`], ['Studio signed', `${name} · ${signedAt} (Mountain Time)`]], button: { href: link, label: 'View signed contract' } }),
    })
  }
  return json({ ok: true, complete })
}))
