/**
 * What a shared client-gallery link shows on WhatsApp and other apps (they only read the HTML).
 * The gallery's title and cover are only given for a valid private link; anything else gets the general share image.
 * Reads the public Supabase values from the Pages project's environment variables.
 */
export async function galleryShareInfo(env, id, key) {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  if (!id || !key || !url || !anon || !/^[0-9a-f-]{36}$/i.test(id)) return null
  try {
    const res = await fetch(`${url}/functions/v1/gallery-view-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
      // cover_only: not counted as the client's visit
      body: JSON.stringify({ gallery_id: id, key, cover_only: true }),
      signal: AbortSignal.timeout(2500),
    })
    const data = await res.json()
    if (!data.ok || data.access !== 'full') return null
    return { title: data.gallery?.title ?? null, cover: data.cover?.url ?? null }
  } catch {
    return null
  }
}
