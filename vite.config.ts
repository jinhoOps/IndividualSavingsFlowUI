import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.ico'],
      manifest: {
        name: '나의 가계 흐름',
        short_name: '가계흐름',
        description: '월 단위 가계 흐름을 카드와 Sankey Diagram으로 확인하는 개인 자산 흐름 프로토타입',
        theme_color: '#ea5b2a',
        background_color: '#f3f4ef',
        display: 'standalone',
        start_url: '/IndividualSavingsFlowUI/',
        scope: '/IndividualSavingsFlowUI/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/IndividualSavingsFlowUI/index.html'
      }
    })
  ],
  base: '/IndividualSavingsFlowUI/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        step1: resolve(__dirname, 'apps/step1/index.html'),
        step2: resolve(__dirname, 'apps/step2/index.html'),
        step4: resolve(__dirname, 'apps/step4/index.html'),
      },
    },
  },
});
