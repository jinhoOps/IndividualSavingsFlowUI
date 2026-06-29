# Technology Stack

**Analysis Date:** 2026-06-29

## Languages

**Primary:**
- JavaScript ES modules - Most app logic lives in `apps/main/modules/*.js`, `apps/simulation/modules/*.js`, `apps/portfolio/modules/*.js`, and `shared/**/*.js`.
- TypeScript 5.5.2 declared / 5.9.3 installed - Entry shims, storage services, domain types, and Playwright tests live in `src/**/*.ts`, `src/**/*.tsx`, and `tests/*.spec.ts`.
- HTML/CSS - Static app shells and styling live in `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, `apps/portfolio/index.html`, `apps/**/styles.css`, `src/styles/globals.css`, and `shared/styles/step-theme.css`.

**Secondary:**
- Python 3 - Offline market-data generation scripts live in `scripts/generate_market_data.py`, `scripts/generate_kospi_data.py`, `scripts/generate_qqq_data.py`, and `scripts/generate_extra_indices.py`.
- CommonJS JavaScript - One migration helper uses CommonJS in `scripts/migrate_okf.cjs`.

## Runtime

**Environment:**
- Browser runtime - The app is a static, local-first web app loaded through `apps/main/index.html`, `apps/simulation/index.html`, and `apps/portfolio/index.html`.
- Node.js 20+ recommended - `README.md` lists Node.js 20 or newer for development.
- Node.js 22 in CI - `.github/workflows/deploy.yml` configures `actions/setup-node@v4` with `node-version: 22`.
- Local shell observed Node.js `v24.15.0` and npm `11.10.0` during this analysis.

**Package Manager:**
- npm - Scripts and lockfile are managed through `package.json` and `package-lock.json`.
- Lockfile: present, npm lockfileVersion 3 in `package-lock.json`.
- Version note: `package.json` declares project version `0.11.85`; `package-lock.json` root metadata still shows `0.11.38`.

## Frameworks

**Core:**
- Vite `^5.3.1` declared / `5.4.21` installed - Static multi-entry build configured in `vite.config.ts`.
- React `^19.2.5` declared / `19.2.5` installed - Present for incremental UI migration; the observed React component is `src/components/common/Toast.tsx`.
- React DOM `^19.2.5` declared / `19.2.5` installed - Declared in `package.json`; no root React app bootstrap is present in the current entry files.
- Web Components / custom elements - Shared browser components are registered by `shared/components/app-header.js`, `shared/components/data-hub-modal.js`, and `shared/components/feedback-manager.js`.
- Progressive Web App - `vite-plugin-pwa` and `shared/pwa/pwa-manager.js` provide manifest/service-worker behavior; legacy service worker source is `shared/legacy/sw.js`.

**Testing:**
- Playwright `^1.60.0` declared / `1.60.0` installed - E2E tests live in `tests/step1.spec.ts` and `tests/step2.spec.ts`, configured by `playwright.config.ts`.
- Vitest `^4.1.5` declared / `4.1.5` installed - Declared in `package.json`; no Vitest config file was detected.
- TypeScript compiler - `npm run check` and `npm run lint` both run `tsc --noEmit`.

**Build/Dev:**
- Vite dev server - `npm run dev` runs `vite`.
- Vite production build - `npm run build` runs `node scripts/bump-version.js && npm run sync-version && vite build`.
- Tailwind CSS `^4.0.0-alpha.13` declared / `4.2.4` installed with `@tailwindcss/vite` - Plugin wired in `vite.config.ts`; global styles are in `src/styles/globals.css` and app styles under `apps/**/styles.css`.
- PostCSS `^8.4.38` declared / `8.5.13` installed and Autoprefixer `^10.4.19` declared / `10.5.0` installed.

## Key Dependencies

**Critical:**
- `vite` - Builds the static multi-page app from `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, and `apps/portfolio/index.html`.
- `vite-plugin-pwa` - Generates PWA registration/runtime artifacts from `vite.config.ts`; runtime awareness is handled in `shared/pwa/pwa-manager.js`.
- `@vitejs/plugin-react` - Enables React/TSX compilation for `src/components/common/Toast.tsx` and future React migration code.
- `react` and `react-dom` - Present foundation for React UI components; most current app code remains vanilla browser modules.

**Infrastructure:**
- `@playwright/test` - Browser regression suite in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- `typescript` - Type checking across `src`, `apps`, and `shared` via `tsconfig.json`.
- `@types/node` - Supports TypeScript config and tooling files such as `vite.config.ts`.
- `@types/react` and `@types/react-dom` - Type support for `src/components/common/Toast.tsx`.
- `tailwindcss`, `@tailwindcss/vite`, `postcss`, and `autoprefixer` - CSS toolchain declared in `package.json` and wired by `vite.config.ts`.

## Configuration

**Environment:**
- No `.env*` files detected at repo root.
- No app runtime env vars detected; `rg` found no `import.meta.env` or `VITE_*` usage outside dependencies.
- `process.env.CI` is used only by `playwright.config.ts` to enable `forbidOnly` and retries in CI.
- PWA version is injected at build time through `define.__APP_VERSION__` in `vite.config.ts`, sourced from `package.json`.

**Build:**
- `vite.config.ts` sets `base: '/IndividualSavingsFlowUI/'`, `publicDir: 'public'`, and `build.outDir: 'dist'`.
- `vite.config.ts` configures Rollup inputs for `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, and `apps/portfolio/index.html`.
- `vite.config.ts` configures `VitePWA` with `registerType: 'autoUpdate'`, app manifest metadata, Workbox `globPatterns`, `skipWaiting`, `clientsClaim`, and `navigateFallback`.
- `tsconfig.json` enables strict checking, `allowJs`, DOM libs, `jsx: react-jsx`, aliases `@/*` to `src/*` and `@shared/*` to `shared/*`, and includes `src`, `apps`, and `shared`.
- `tsconfig.node.json` covers `vite.config.ts`.
- `playwright.config.ts` sets `testDir: './tests'`, one Chromium worker, base URL `http://localhost:5173/IndividualSavingsFlowUI/`, and a Vite web server command.
- `scripts/bump-version.js` increments `package.json` patch version during `npm run build`.
- `scripts/sync-version.js` propagates the package version to `public/manifest.webmanifest`, `shared/legacy/sw.js`, and `shared/core/utils.js`.

## Platform Requirements

**Development:**
- Install dependencies with `npm install`.
- Run local dev with `npm run dev`.
- Run type checks with `npm run check`.
- Run E2E tests with `npm run test:e2e`.
- Browser APIs required by the app include `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `navigator.serviceWorker`, and PWA install events used by `shared/pwa/pwa-manager.js`.

**Production:**
- Static files are built to `dist` by `npm run build`.
- GitHub Pages is the deployment target; `.github/workflows/deploy.yml` uploads `./dist` through `actions/upload-pages-artifact@v3` and deploys with `actions/deploy-pages@v4`.
- Runtime base path is `/IndividualSavingsFlowUI/`, matching `vite.config.ts`, `public/manifest.webmanifest`, and `README.md`.

---

*Stack analysis: 2026-06-29*
