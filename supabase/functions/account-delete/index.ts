/**
 * Admin: permanently delete a website account (the login, its profile, staff record and check-ins).
 * Bookings and galleries are kept — they belong to the booking, not the login.
 *   body: { user_id, confirm_email } — confirm_email must be the account's email, typed by the admin.
 * Admin accounts can't be deleted here: remove their admin access first (Dashboard → Team).
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { requireAdmin, service } from '../_shared/auth.ts'

Deno.serve(handle(async (req, body) => {
  const who = await requireAdmin(req)
  if (!isUuid(body.user_id)) throw new HttpError('Missing account.')
  if (body.user_id === who.userId) throw new HttpError('You can’t delete your own account.', 403)

  const db = service()
  const { data, error } = await db.auth.admin.getUserById(body.user_id)
  if (error || !data?.user) throw new HttpError('That account no longer exists.', 404)
  const email = (data.user.email ?? '').toLowerCase()
  if (!email || String(body.confirm_email ?? '').trim().toLowerCase() !== email) throw new HttpError('The email you typed doesn’t match this account.')

  const { data: staff } = await db.from('staff').select('role').eq('id', body.user_id).maybeSingle()
  if (staff?.role === 'admin') throw new HttpError('This is an admin account. Change it to Staff or Client first, then delete it.', 409)

  const { error: delErr } = await db.auth.admin.deleteUser(body.user_id)
  if (delErr) throw delErr
  return json({ ok: true })
}))
