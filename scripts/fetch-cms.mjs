// Runs before every build (same as PairMediaPro). With real Supabase keys it saves the published website content and
// the latest Instagram posts into src/cms/published.json, so the pre-rendered pages carry the latest words and photos.
// Without keys (Phase A, tests) or if Supabase can't be reached, it leaves the file as it is and the build continues.
import fs from 'node:fs'

const env = { ...Object.fromEntries((fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])), ...process.env }
const url = env.VITE_SUPABASE_URL ?? ''
const key = env.VITE_SUPABASE_ANON_KEY ?? ''
const FILE = 'src/cms/published.json'
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ docs: {}, instagram: [], videos: [], design: { site_design: 'classic', allow_design_switch: true } }))
if (!/^https:\/\/.+\.supabase\.(co|in)/.test(url) || key.length < 20) {
  console.log('fetch-cms: no Supabase keys, building with the content already saved')
  process.exit(0)
}
const get = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 120)}`)
  return res.json()
}
try {
  const [rows, ig, videos, settings] = await Promise.all([
    get('cms_published?select=key,content'),
    get('instagram_posts?select=permalink,caption,image_url,width,height&hidden=eq.false&order=posted_at.desc&limit=8').catch(() => []),
    get('videos?select=id,youtube_id,title,description,category,on_home,sort_order&active=eq.true&order=sort_order.asc,created_at.desc').catch(() => []),
    get('business_settings?select=site_design,allow_design_switch&id=eq.1').catch(() => []),
  ])
  const docs = {}
  for (const r of rows) if (r.content && typeof r.content === 'object' && Object.keys(r.content).length) docs[r.key] = r.content
  const instagram = ig.map((r) => ({ image: { src: r.image_url, width: r.width ?? 1080, height: r.height ?? 1350, alt: '' }, caption: r.caption ?? '', url: r.permalink }))
  const s = settings[0] ?? {}
  const design = { site_design: s.site_design === 'modern' ? 'modern' : 'classic', allow_design_switch: s.allow_design_switch !== false }
  fs.writeFileSync(FILE, JSON.stringify({ docs, instagram, videos, design }, null, 1))
  console.log(`fetch-cms: ${Object.keys(docs).length} published pages, ${instagram.length} Instagram posts, ${videos.length} videos, design ${design.site_design}${design.allow_design_switch ? ' (switch on)' : ''}`)
} catch (e) {
  console.warn(`fetch-cms: could not read Supabase (${String(e.message).slice(0, 140)}). Building with the content already saved`)
}
