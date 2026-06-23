# Technology Stack

**Analysis Date:** 2026-06-23

## Languages

**Primary:**
- TypeScript 5.5.2 - Typed source under `src/`, Vite and Playwright config in `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`.
- JavaScript ES modules - Main runtime app code under `apps/`, shared browser modules under `shared/`, and build/version scripts under `scripts/`.
- HTML/CSS - Multi-entry static app shells in `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, `apps/portfolio/index.html`; app styles in `apps/*/styles.css`, `src/styles/globals.css`, `shared/styles/step-theme.css`.

**Secondary:**
- Python 3 - Offline market-data generation scripts in `scripts/generate_qqq_data.py`, `scripts/generate_market_data.py`, `scripts/generate_extra_indices.py`, `scripts/generate_kospi_data.py`.
- JSON/Web App Manifest - Runtime market evidence in `public/data/indices/*.json` and PWA metadata in `public/manifest.webmanifest`.

## Runtime

**Environment:**
- Browser runtime - The shipped app runs as static client-side pages using DOM APIs, IndexedDB, localStorage, service workers, Cache Storage, and URL hash/query state. Key files: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`, `shared/pwa/pwa-manager.js`, `shared/storage/hub-storage.js`.
- Node.js 22 - CI/deploy runtime configured in `.github/workflows/deploy.yml`.
- Node.js types 20.14.9 - Type definitions configured by `@types/node` in `package.json`.

**Package Manager:**
- npm - Scripts and lockfile are defined in `package.json` and `package-lock.json`.
- Lockfile: present at `package-lock.json`.

## Frameworks

**Core:**
- Vite 5.3.1 - Static multi-page build and dev server configured in `vite.config.ts`.
- React 19.2.5 / React DOM 19.2.5 - Installed runtime dependencies in `package.json`; TypeScript JSX mode is `react-jsx` in `tsconfig.json`.
- Vite PWA 0.21.1 - PWA manifest and Workbox-driven service worker generation configured in `vite.config.ts`.
- Tailwind CSS 4.0.0-alpha.13 - Vite plugin configured in `vite.config.ts`; shared/global styles are plain CSS files under `src/styles/`, `shared/styles/`, and `apps/*/styles.css`.

**Testing:**
- Playwright 1.60.0 - End-to-end runner configured in `playwright.config.ts`; tests live in `tests/`.
- Vitest 4.1.5 / Vitest UI 4.1.5 - Installed in `package.json`; co-located unit test example at `shared/core/clipboard-parser.test.js`.
- TypeScript compiler 5.5.2 - `npm run check` and `npm run lint` both execute `tsc --noEmit` from `package.json`.

**Build/Dev:**
- Vite dev server - `npm run dev` starts `vite` from `package.json`.
- Vite build - `npm run build` runs `scripts/bump-version.js`, `npm run sync-version`, and `vite build`.
- Version sync scripts - `scripts/sync-version.js` updates `public/manifest.webmanifest`, `shared/legacy/sw.js`, and `shared/core/utils.js`; `scripts/bump-version.js` increments package version before production builds.
- GitHub Actions Pages deployment - `.github/workflows/deploy.yml` installs dependencies, builds `dist`, and deploys with GitHub Pages actions.

## Key Dependencies

**Critical:**
- `vite` ^5.3.1 - Owns local dev server and static production build in `vite.config.ts`.
- `react` ^19.2.5 and `react-dom` ^19.2.5 - Installed UI runtime dependencies for typed React entry support under `src/`.
- `vite-plugin-pwa` ^0.21.1 - Generates PWA assets and service-worker behavior from `vite.config.ts`.
- `@vitejs/plugin-react` ^4.3.1 - Enables React transform in `vite.config.ts`.
- `@tailwindcss/vite` ^4.0.0-alpha.13 and `tailwindcss` ^4.0.0-alpha.13 - CSS framework/tooling dependency configured by `vite.config.ts`.

**Infrastructure:**
- `@playwright/test` ^1.60.0 - Browser E2E testing in `tests/` with dev-server orchestration in `playwright.config.ts`.
- `typescript` ^5.5.2 - Type checking for `src`, `apps`, and `shared` via `tsconfig.json`.
- `autoprefixer` ^10.4.19 and `postcss` ^8.4.38 - CSS processing dependencies in `package.json`.
- `@types/react`, `@types/react-dom`, `@types/node` - Type packages listed in `package.json`.

## Configuration

**Environment:**
- No `.env` files detected at the repository root during this scan.
- No runtime environment-variable reads detected in `apps/`, `src/`, `shared/`, `scripts/`, `public/`, or `tests/`; `playwright.config.ts` only reads `process.env.CI`.
- Browser app configuration is static and path-based: `vite.config.ts` sets `base: '/IndividualSavingsFlowUI/'`, `publicDir: 'public'`, and `__APP_VERSION__` from `package.json`.

**Build:**
- `vite.config.ts` defines a multi-entry Rollup build for `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, and `apps/portfolio/index.html`.
- `vite.config.ts` emits to `dist` with assets under `dist/assets`.
- `vite.config.ts` configures PWA manifest values, included icon assets, Workbox glob patterns, `skipWaiting`, `clientsClaim`, and `navigateFallback`.
- `tsconfig.json` uses `strict: true`, `allowJs: true`, `module: ESNext`, `moduleResolution: Node`, `jsx: react-jsx`, aliases `@/* -> ./src/*` and `@shared/* -> ./shared/*`.
- `playwright.config.ts` sets `testDir: './tests'`, Chromium-only execution, `workers: 1`, `baseURL: 'http://localhost:5173/IndividualSavingsFlowUI/'`, blocks service workers in tests, and starts Vite through `webServer`.

## Platform Requirements

**Development:**
- Use `npm install` with `package-lock.json`.
- Use `npm run dev` for local Vite development.
- Use `npm run check` or `npm run lint` for TypeScript validation.
- Use `npm run test:e2e` for Playwright E2E tests.
- The app expects browser support for IndexedDB/localStorage for persistence paths in `src/core/storage/IsfStore.ts`, `src/core/storage/CompatibilityBridge.ts`, `shared/storage/hub-storage.js`, and `shared/storage/backup-manager.js`.

**Production:**
- Static hosting target is GitHub Pages, configured by `.github/workflows/deploy.yml` and the `/IndividualSavingsFlowUI/` base path in `vite.config.ts`.
- Production artifact is `dist` from `npm run build`.
- PWA installation and offline operation depend on HTTPS or localhost checks in `shared/pwa/pwa-manager.js`.
- Runtime market evidence is served from committed static files under `public/data/indices/`, documented in `public/data/indices/README.md`.

---

*Stack analysis: 2026-06-23*
