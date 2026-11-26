import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

/** One page per couple album (Wedding Stories): the albums as published (src/cms/published.json, refreshed before every
 *  build by scripts/fetch-cms.mjs), or the seed when nothing is published. Same address rule as albumSlug(). */
function storyPages(): string[] {
  const read = (f: string) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return {} } }
  const seed = read('src/cms/seed.json')
  const published = read('src/cms/published.json')
  const albums: { name?: string }[] = published?.docs?.['wedding-stories']?.albums ?? seed?.['wedding-stories']?.albums ?? []
  const slug = (n: string) => n.toLowerCase().replace(/&/g, ' and ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'couple'
  return [...new Set(albums.filter((a) => a?.name).map((a) => `/wedding-stories/${slug(a.name!)}/`))]
}

// Static output for Cloudflare Pages (same set-up as PairMediaPro): every page is pre-rendered to HTML at build time,
// with the same addresses as the WordPress site. Build output: dist/client.
// Private links carry their token in the query string (/invoice/?t=…, /contract/?t=…, /client-gallery/?id=…&k=…), so one
// pre-rendered page serves each kind. Older path-style links redirect (public/_redirects, functions/client-gallery).
// scripts/postbuild.mjs checks every page in this list was written (a page the pre-renderer gave up on fails the build)
const pages = [
  // public pages
  '/', '/portfolio/', '/videos/', '/wedding-stories/', ...storyPages(), '/about/', '/contact/', '/the-tplum-signature/', '/faq/', '/book/', '/coming-soon/', '/404/',
  // booking flows
  '/booking/', '/booking/wedding/', '/booking/kiddies/', '/booking/confirmed/', '/events/',
  // app screens (browser-only content)
  '/dashboard/', '/dashboard/login/', '/account/', '/checkin/', '/cms-preview/',
  // one page per kind of private link
  '/invoice/', '/contract/', '/client-gallery/',
].map((path) => ({ path }))

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      pages,
      prerender: { enabled: true, crawlLinks: false, autoSubfolderIndex: true, concurrency: 2, retryCount: 4, retryDelay: 1500 },
    }),
    viteReact(),
  ],
})
