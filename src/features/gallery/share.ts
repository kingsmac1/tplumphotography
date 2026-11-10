/**
 * What a shared client-gallery link shows on WhatsApp and other apps. Runs on the server, because those apps only read the
 * HTML. The cover and title are only given for a valid private link; anything else gets the general DMI share image.
 */
type ViewResponse = { ok?: boolean; access?: string; gallery?: { title?: string }; cover?: { url?: string } | null }

export async function galleryShareInfo(id: string, key: string | null) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!key || !url || !anon) return null
  try {
    const res = await fetch(`${url}/functions/v1/gallery-view-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
      // cover_only: not counted as the client's visit
      body: JSON.stringify({ gallery_id: id, key, cover_only: true }),
      signal: AbortSignal.timeout(2500),
    })
    const data = (await res.json()) as ViewResponse
    if (!data.ok || data.access !== 'full') return null
    return { title: data.gallery?.title ?? null, cover: data.cover?.url ?? null }
  } catch {
    return null
  }
}
