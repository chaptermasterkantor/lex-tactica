import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lex Tactica: WH40k 11th Edition Phase Playbook',
        short_name: 'Lex Tactica',
        description:
          'Local-first, offline-capable Warhammer 40,000 11th Edition Interactive Phase Playbook & Tabletop Tracker PWA',
        theme_color: '#090d16',
        background_color: '#090d16',
        display: 'standalone',
        start_url: './',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
  ],
});
