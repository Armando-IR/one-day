import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `vite build` makes the real app (installable, works offline).
// `vite build --mode demo` makes a self-contained copy with example data, for trying the app without a database.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    base: demo ? './' : '/',
    // The Supabase client alone is about 220 kB: one file of ~520 kB is fine for an app that stays cached.
    build: { outDir: demo ? 'dist-demo' : 'dist', chunkSizeWarningLimit: 800 },
    // On Vercel the app has api/ics.js, which turns events into real calendar files (see src/lib/calendar.ts).
    define: { __ICS_API__: JSON.stringify(process.env.VERCEL === '1') },
    plugins: [
      react(),
      VitePWA({
        disable: demo || mode === 'test',
        registerType: 'prompt',
        injectRegister: false,
        // Icons and favicon are already picked up by globPatterns below.
        includeManifestIcons: false,
        manifest: {
          name: 'Finanze',
          short_name: 'Finanze',
          description: 'Fatture, spese fisse, cashflow e obiettivi.',
          lang: 'it',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#eef2f5',
          theme_color: '#eef2f5',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Only the latin font files: the other alphabets are never used and would only take space.
          globPatterns: ['**/*.{js,css,html,svg,png}', '**/*latin-wdth*.woff2'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
        },
      }),
    ],
  };
});
