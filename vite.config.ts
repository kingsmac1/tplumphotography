import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Static output for Cloudflare Pages (same set-up as PairMediaPro): every page is pre-rendered to HTML at build time,
// with the same addresses as the WordPress site. Build output: dist/client.
// Private links carry their token in the query string (/invoice/?t=…, /contract/?t=…, /client-gallery/?id=…&k=…), so one
// pre-rendered page serves each kind. Older path-style links redirect (public/_redirects, functions/client-gallery).
const pages = [
  // public pages
  '/', '/portfolio/', '/about/', '/contact/', '/the-tplum-signature/', '/faq/', '/book/', '/coming-soon/', '/404/',
  // booking flows
  '/booking/', '/booking/wedding/', '/booking/confirmed/', '/events/',
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
      prerender: { enabled: true, crawlLinks: false, autoSubfolderIndex: true, concurrency: 4, retryCount: 3, retryDelay: 500 },
    }),
    viteReact(),
  ],
})
