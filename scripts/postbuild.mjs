// After the build: Cloudflare Pages serves dist/client/404.html for any unknown address.
import fs from 'node:fs'
const from = 'dist/client/404/index.html'
if (fs.existsSync(from)) {
  // Pages serves this file at whatever unknown address was asked for. The app was pre-rendered at /404/, so while it
  // starts the address is set to /404/ (the page hydrates cleanly), and the real address is put back straight after
  // (src/routes/__root.tsx). Visitors keep seeing the address they typed.
  const html = fs.readFileSync(from, 'utf8').replace('<head>', `<head><script>if(location.pathname!=='/404/'){window.__realPath=location.pathname+location.search+location.hash;history.replaceState(null,'','/404/')}</script>`)
  fs.writeFileSync('dist/client/404.html', html)
}
else console.warn('postbuild: dist/client/404/index.html missing, no custom 404 page')
const pages = fs.readdirSync('dist/client', { recursive: true }).filter((f) => String(f).endsWith('index.html')).length
console.log(`postbuild: ${pages} pre-rendered pages ready in dist/client`)

// Every page in the pre-render list must exist. The pre-renderer can give up on a page and still finish, which would
// leave that page missing on the live site; failing here keeps the last good deployment live instead.
const config = fs.readFileSync('vite.config.ts', 'utf8')
const listed = [...config.slice(config.indexOf('const pages = ['), config.indexOf('].map((path)')).matchAll(/'(\/[^']*)'/g)].map((m) => m[1])
const stories = (() => {
  const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} } }
  const albums = read('src/cms/published.json')?.docs?.['wedding-stories']?.albums ?? read('src/cms/seed.json')?.['wedding-stories']?.albums ?? []
  const slug = (n) => n.toLowerCase().replace(/&/g, ' and ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'couple'
  return albums.filter((a) => a?.name).map((a) => `/wedding-stories/${slug(a.name)}/`)
})()
const missing = [...listed, ...stories].filter((p) => !fs.existsSync(`dist/client${p}index.html`))
if (missing.length) {
  console.error(`postbuild: these pages were not pre-rendered: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`postbuild: all ${listed.length + stories.length} expected pages are there`)
