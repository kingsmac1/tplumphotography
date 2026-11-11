/**
 * Admin: invite someone to the dashboard (Dashboard -> Team -> Invite). Supabase emails them a link to set their
 * own password (nobody else ever sees or chooses it). They are added to the team as "staff" (check-in only) or
 * "admin" (full dashboard). An existing account is just given the role.
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'
import { EMAIL_RE } from '../_shared/contact-rules.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'staff'
  const name = String(body.full_name ?? '').trim().slice(0, 120)
  if (!EMAIL_RE.test(email)) throw new HttpError('Enter a valid email address.')
  const site = String(body.site_url || Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  const db = service()
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  let userId = existing?.id as string | undefined
  if (!userId) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${site}/account/` })
    if (error) throw new HttpError(error.message)
    userId = data.user?.id
  }
  if (!userId) throw new HttpError('The invite could not be created.')
  const { error: sErr } = await db.from('staff').upsert({ id: userId, full_name: name || email.split('@')[0], role }, { onConflict: 'id' })
  if (sErr) throw new HttpError(sErr.message)
  return json({ ok: true, invited: !existing, role })
}))
