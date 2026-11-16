/**
 * Dashboard only (admins). Rebuilds the website on Cloudflare Pages so its pre-rendered pages carry the newly published
 * content (what search engines read). Visitors already see the change straight away; this refreshes the saved pages.
 * CF_DEPLOY_HOOK_URL is the Pages project's deploy hook (Settings → Builds → Deploy hooks), stored as a Supabase secret.
 * Same approach as PairMediaPro.
 */
import { handle, HttpError, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'

Deno.serve(handle(async (req) => {
  await requireAdmin(req)
  const hook = Deno.env.get('CF_DEPLOY_HOOK_URL')
  if (!hook) throw new HttpError('Rebuilding is not set up yet (CF_DEPLOY_HOOK_URL is missing). Your changes are live for visitors already.', 503)
  const res = await fetch(hook, { method: 'POST' })
  if (!res.ok) throw new HttpError(`Cloudflare answered ${res.status}. Try Publish again in a minute.`, 502)
  return json({ ok: true })
}))
