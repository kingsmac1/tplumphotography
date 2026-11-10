import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'

// TanStack Start on Cloudflare Workers (server-rendered). See wrangler.jsonc.
export default defineConfig({
  server: { port: 3000 },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
