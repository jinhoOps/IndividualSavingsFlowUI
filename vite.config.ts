import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import packageJson from './package.json';
import { createMpaNavigationCaching } from './src/main/infrastructure/pwaRoutes';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
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
        lang: 'ko-KR',
        version: packageJson.version,
        description: '월 단위 가계 흐름을 카드와 Sankey Diagram으로 확인하는 개인 자산 흐름 프로토타입',
        theme_color: '#0f766e',
        background_color: '#f8f6f1',
        display: 'standalone',
        start_url: './apps/main/',
        scope: './',
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
        ],
        screenshots: [
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'ISF Desktop Dashboard'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'ISF Mobile View'
          }
        ]
      },
      workbox: {
        ...createMpaNavigationCaching('/IndividualSavingsFlowUI/'),
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        skipWaiting: true,
        clientsClaim: true,
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
        mainApp: resolve(__dirname, 'apps/main/index.html'),
        simulation: resolve(__dirname, 'apps/simulation/index.html'),
        portfolio: resolve(__dirname, 'apps/portfolio/index.html'),
        accountMap: resolve(__dirname, 'apps/account-map/index.html'),
	
      },
    },
  },
});
