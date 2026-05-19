# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**Browser APIs:**
- Clipboard API - Used in `shared/core/clipboard-parser.js` to parse transaction text (SMS) from Korean financial services.
- Web Crypto API - Used for secure unique ID generation in `shared/storage/hub-storage.js` and `src/core/storage/IsfStore.ts`.
- Share API - Integrated via `shared/core/share-utils.js` for data sharing capabilities.

## Data Storage

**Databases:**
- IndexedDB (Browser Native)
  - `isf-v2-db`: Primary storage for Step 1 history, Step 2 simulations, and automated backups.
  - `isf-hub-db-v1`: Legacy storage (automatically migrated/wiped by modern store).
  - Clients: `src/core/storage/IsfStore.ts` (Modern) and `shared/storage/hub-storage.js` (Legacy/Bridged).

**File Storage:**
- LocalStorage: Stores active application state, PWA visibility flags, and small-scale configuration.
- Local JSON: Static market index data (QQQ, KOSPI, etc.) stored in `public/data/indices/`.

**Caching:**
- Cache Storage API: Managed by Service Worker (`sw.js`) for full offline availability.

## Authentication & Identity

**Auth Provider:**
- None (Local-First Architecture)
  - Data remains on the user's device.
  - Privacy-by-design: No central database for user financial data.

## Monitoring & Observability

**Error Tracking:**
- Console Logging (Dev mode)
- Custom `IsfFeedback`: UI-based notification system for application state changes and errors (`shared/components/feedback-manager.js`).

**Logs:**
- Browser DevTools Console.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages - Automated deployment via GitHub Actions.

**CI Pipeline:**
- GitHub Actions: `.github/workflows/deploy.yml` handles build and deployment to Pages.

## Environment Configuration

**Required env vars:**
- None (Static application).

**Secrets location:**
- Not applicable (No secrets stored or used in frontend).

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-05-12*
