# External Integrations

**Analysis Date:** 2026-06-29

## APIs & External Services

**Static Hosting:**
- GitHub Pages - Production hosting for the built static app.
  - SDK/Client: GitHub Actions workflow in `.github/workflows/deploy.yml`
  - Auth: GitHub-provided `GITHUB_TOKEN` permissions declared as `contents: read`, `pages: write`, and `id-token: write`

**Browser Platform APIs:**
- IndexedDB - Primary client-side structured storage.
  - SDK/Client: Native browser `indexedDB` API in `src/core/storage/IsfStore.ts`, `apps/main/modules/storage-manager.js`, `shared/storage/hub-storage.js`, and `shared/storage/backup-manager.js`
  - Auth: Not applicable
- Web Storage - Fast local persistence and draft state.
  - SDK/Client: Native `localStorage` and `sessionStorage` in `src/core/storage/CompatibilityBridge.ts`, `apps/main/modules/storage-manager.js`, `apps/simulation/modules/state.js`, and `apps/simulation/modules/storage-fallback.js`
  - Auth: Not applicable
- Service Worker and Cache Storage - Offline/PWA caching and update lifecycle.
  - SDK/Client: Native `navigator.serviceWorker` and `caches` in `shared/pwa/pwa-manager.js` and `shared/legacy/sw.js`; generated PWA behavior configured by `vite-plugin-pwa` in `vite.config.ts`
  - Auth: Not applicable

**Runtime Static Data:**
- Market evidence JSON files - Local static benchmark data used by Step 2 assumptions.
  - SDK/Client: Static files in `public/data/indices/*.json`; assumptions reference them by path in `apps/simulation/modules/assumptions.js`
  - Auth: Not applicable

**Remote Fetches:**
- PWA manifest version check - Fetches the app's own manifest to detect newer deployed versions.
  - SDK/Client: Native `fetch` in `shared/pwa/pwa-manager.js`
  - Auth: Not applicable
- Service worker same-origin asset fetch/cache - Fetches same-origin app assets and navigations only.
  - SDK/Client: Native `fetch` and Cache Storage in `shared/legacy/sw.js`
  - Auth: Not applicable

## Data Storage

**Databases:**
- Browser IndexedDB `isf-v2-db`, version 1.
  - Connection: Native browser storage; no env var.
  - Client: `src/core/storage/IsfStore.ts`
  - Stores: `step1_history`, `step2_simulations`, and `backups`
- Browser IndexedDB `isf-share-pointer-db-v1`, version 1.
  - Connection: Native browser storage; no env var.
  - Client: `apps/main/modules/storage-manager.js`
  - Store: `shareSnapshots`
- Legacy browser IndexedDB `isf-hub-db-v1`, version 2.
  - Connection: Native browser storage; no env var.
  - Client: `shared/storage/hub-storage.js`
  - Stores: `step1Snapshots` and `step2Entries`
- Legacy browser IndexedDB `isf-backup-db-v1`, version 2.
  - Connection: Native browser storage; no env var.
  - Client: `shared/storage/backup-manager.js`
  - Store: `backupEntries`

**File Storage:**
- Browser JSON import/export only - Data hub events are emitted by `shared/components/data-hub-modal.js` and handled by app controllers such as `apps/main/modules/persistence-controller.js` and `apps/simulation/modules/ui-controller.js`.
- Static runtime assets - `public/manifest.webmanifest`, `public/icons/*`, and `public/data/indices/*.json` are served as bundled/static files.

**Caching:**
- Browser Cache Storage - `shared/legacy/sw.js` caches core same-origin app assets under `isf-static-v${APP_VERSION}`.
- Workbox-generated PWA cache - `vite.config.ts` configures `vite-plugin-pwa` Workbox `globPatterns` for JS, CSS, HTML, icons, PNG, SVG, and webmanifest assets.

## Authentication & Identity

**Auth Provider:**
- None - `README.md` states the app operates without server accounts or bank integrations.
  - Implementation: Local-first browser storage, manually entered data, optional JSON export/import, and hash/code sharing.

**User Identity:**
- Not detected - No login, OAuth, session token, Supabase, Firebase, or custom auth provider code was detected.

## Monitoring & Observability

**Error Tracking:**
- None - No Sentry, Datadog, OpenTelemetry, LogRocket, or equivalent dependency is present in `package.json`.

**Logs:**
- Browser console logging only - `console.log`, `console.warn`, and `console.error` appear in storage, PWA, and service-worker code such as `src/core/storage/CompatibilityBridge.ts`, `shared/pwa/pwa-manager.js`, `shared/storage/hub-storage.js`, and `apps/main/modules/storage-manager.js`.
- Playwright reporter is `list` in `playwright.config.ts`.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages - `README.md` lists `https://jinhoops.github.io/IndividualSavingsFlowUI/`, and `vite.config.ts` sets `base: '/IndividualSavingsFlowUI/'`.

**CI Pipeline:**
- GitHub Actions - `.github/workflows/deploy.yml` runs on pushes to `main` and `feat/backtest-simulator`, plus manual `workflow_dispatch`.
- CI steps: checkout, `actions/setup-node@v4` with Node 22 and npm cache, `npm install --legacy-peer-deps`, `npm run build`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, and `actions/deploy-pages@v4`.

## Environment Configuration

**Required env vars:**
- None for app runtime.
- `CI` is optional and read by `playwright.config.ts` to alter test behavior.

**Secrets location:**
- Not applicable for the app - No `.env*` files were detected and no secret-backed runtime integrations were found.
- GitHub Pages deployment uses GitHub Actions' built-in OIDC/token permissions in `.github/workflows/deploy.yml`.

## Webhooks & Callbacks

**Incoming:**
- None - No server endpoints, API routes, webhook receivers, or callback handlers were detected.

**Outgoing:**
- None to third-party services - Runtime `fetch` usage is limited to same-origin manifest/version checks and service-worker asset caching in `shared/pwa/pwa-manager.js` and `shared/legacy/sw.js`.

**Share/Callback-Like Local Flows:**
- URL hash sharing - `shared/core/share-utils.js` encodes and decodes app state into the `s` hash parameter, consumed by `apps/main/modules/state.js`, `apps/main/modules/persistence-controller.js`, and `apps/simulation/app.js`.
- Query-parameter view mode - `shared/core/share-utils.js` recognizes `sid` and `view=1`; `apps/main/modules/storage-manager.js` can load `sid` from local IndexedDB `shareSnapshots`.

---

*Integration audit: 2026-06-29*
