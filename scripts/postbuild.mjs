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
