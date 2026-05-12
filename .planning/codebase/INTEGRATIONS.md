# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**PWA Sync:**
- `sync-version.js` - Synchronizes version strings across `manifest.webmanifest`, `sw.js`, and `utils.js` during build.
  - Auth: None (Local build script)

**Clipboard Integration:**
- `ClipboardParser` - Extracts transaction data (amount, merchant, date) from Korean bank/card SMS strings.
  - Location: `shared/core/clipboard-parser.js`

## Data Storage

**Databases:**
- IndexedDB (`isf-hub-db-v1`)
  - Connection: `IsfHubStorage.openHubDb()`
  - Client: Native IndexedDB API with custom wrapper in `shared/storage/hub-storage.js`
- LocalStorage
  - Used for persistent app state and view-specific data.
  - Keys: `my-dividend-simulation` (formerly `my-portfolio-flow`)

**File Storage:**
- JSON Import/Export - Users can manually backup/restore data via `.json` files.
  - Location: `shared/components/data-hub-modal.js`

**Caching:**
- Service Worker Caching - Managed by `vite-plugin-pwa` and `shared/legacy/sw.js`.

## Authentication & Identity

**Auth Provider:**
- Custom (Anonymous/Local-first)
  - Implementation: Data is tied to the local device storage. No remote auth server integrated in v0.10.0.

## Monitoring & Observability

**Error Tracking:**
- None (Local console logging only)

**Logs:**
- Browser `console.log` / `console.warn`
- Persistent backup logs in `IsfStorageHub`

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (implied by `vite.config.ts` base path `/IndividualSavingsFlowUI/`)

**CI Pipeline:**
- GitHub Actions - `.github/workflows/deploy.yml`

## Environment Configuration

**Required env vars:**
- `__APP_VERSION__` - Injected via `vite.config.ts` from `package.json`.

**Secrets location:**
- Not applicable (Project is static and client-side only).

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## State Sharing (ISF CODE)

**Mechanism:**
- LZ-based URL Hash - Compresses state into a short string ("ISF CODE") stored in the URL fragment (`#s=...`).
- Location: `shared/core/share-utils.js`

## Data Migration

**Logic:**
- Versioned Migration: `modelVersion: 10` enforcement in `IsfStorageHub`.
- Key Migration: `ensureMigration` handles renaming storage keys (e.g., from v0.7.0 legacy keys).
- Location: `shared/storage/hub-storage.js`

---

*Integration audit: 2026-05-12*
