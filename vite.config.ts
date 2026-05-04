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
      injectRegister: null, // Disable automatic script injection
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: '나의 가계 흐름',
        short_name: '가계흐름',
        description: '월 단위 가계 흐름을 카드와 Sankey Diagram으로 확인하는 개인 자산 흐름 프로토타입',
        theme_color: '#ea5b2a',
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
          }
        ]
      }
    })
  ],
  base: '/IndividualSavingsFlowUI/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        step1: resolve(__dirname, 'apps/step1/index.html'),
        step2: resolve(__dirname, 'apps/step2/index.html'),
      },
    },
  },
});
