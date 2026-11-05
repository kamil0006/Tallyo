import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.VITE_API_PORT || '3002'

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon.svg',
          'icons/icon-maskable.svg',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png',
          'icons/apple-touch-icon.png',
        ],
        manifest: {
          name: 'Tallyo',
          short_name: 'Tallyo',
          description: 'Osobisty dashboard — finanse, produktywność, nawyki, nauka',
          theme_color: '#111315',
          background_color: '#111315',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/dashboard',
          scope: '/',
          lang: 'pl',
          icons: [
            {
              src: '/icons/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-maskable.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            { name: 'Dashboard', url: '/dashboard', description: 'Przejdź do dashboardu' },
            { name: 'To-do',     url: '/todo',      description: 'Lista zadań' },
            { name: 'Finanse',   url: '/finances',  description: 'Przegląd finansów' },
          ],
        },
        workbox: {
          // Cache zasobów statycznych (JS, CSS, fonty)
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          // API nigdy nie cachujemy — zawsze sieć
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        devOptions: {
          // Service worker aktywny też podczas `vite dev` — ułatwia testowanie
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      target: 'es2022',
      // Rozbij duże biblioteki na osobne chunki — lepsze cache'owanie
      // i mniejszy bundle początkowy (ładowane tylko gdy potrzebne).
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            // Ekosystem markdown (react-markdown + remark/rehype/micromark/unified…)
            // jest ciężki i potrzebny tylko w Notatkach — własny chunk = leniwy load.
            if (
              /[\\/]node_modules[\\/](react-markdown|remark|rehype|micromark|mdast|hast|unist|unified|vfile|decode-named-character-reference|character-entities|property-information|space-separated-tokens|comma-separated-tokens|hastscript|web-namespaces|zwitch|longest-streak|trim-lines|bail|is-plain-obj|trough|estree|devlop|html-url-attributes|markdown-table|ccount|escape-string-regexp)/.test(
                id,
              )
            )
              return 'markdown'
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils'))
              return 'motion'
            if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
            if (id.includes('@tanstack')) return 'query'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler'))
              return 'react'
            return 'vendor'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    // `vite preview` (build produkcyjny) też potrzebuje proxy do API,
    // inaczej Lighthouse mierzy stronę bez danych.
    preview: {
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
