# Codebase Concerns

**Analysis Date:** 2026-06-23

## Tech Debt

**Large browser controller modules:**
- Issue: Several user-facing flows are implemented as long, stateful modules with nested closures and DOM mutation logic. `apps/main/modules/financial-modal-controller.js` is 1,261 lines and owns draft state, editing state, household UI, validation, row rendering, drag/drop, and persistence handoff. `apps/main/modules/sankey-renderer.js` is 846 lines and owns layout, SVG rendering, tooltips, export, and mobile collapse behavior.
- Files: `apps/main/modules/financial-modal-controller.js`, `apps/main/modules/sankey-renderer.js`, `apps/main/modules/list-renderer.js`
- Impact: Small feature changes can accidentally alter draft comparison, household mode, Sankey layout, or persistence behavior because related logic is spread through closure-local mutable variables and global `state`.
- Fix approach: Extract pure helpers first: draft diffing/validation from `apps/main/modules/financial-modal-controller.js`, Sankey layout calculation from `apps/main/modules/sankey-renderer.js`, and HTML rendering helpers from `apps/main/modules/list-renderer.js`. Keep DOM event binding at the edge and add focused unit tests for extracted functions.

**Mixed legacy JavaScript and modern TypeScript storage stacks:**
- Issue: Storage exists in parallel forms: legacy global browser utilities in `shared/storage/hub-storage.js` and `shared/storage/backup-manager.js`, direct app usage in `apps/main/modules/storage-manager.js`, and a modern bridge in `src/core/storage/CompatibilityBridge.ts` / `src/core/storage/IsfStore.ts`.
- Files: `shared/storage/hub-storage.js`, `shared/storage/backup-manager.js`, `apps/main/modules/storage-manager.js`, `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`
- Impact: Storage behavior can diverge by entry point. A change that works through the TypeScript bridge may bypass legacy fallback behavior or localStorage keys used by existing Playwright tests.
- Fix approach: Treat `src/core/storage/CompatibilityBridge.ts` as the compatibility boundary. New storage behavior should be implemented in `src/core/storage/IsfStore.ts` and verified against legacy consumers in `apps/main/modules/persistence-controller.js`, `apps/simulation/modules/storage-fallback.js`, and `apps/portfolio/modules/state.js`.

**Committed build output:**
- Issue: Built assets are present under `dist/`, including `dist/apps/main/index.html` and `dist/assets/mainApp-BAW_GJB3.js`.
- Files: `dist/apps/main/index.html`, `dist/assets/mainApp-BAW_GJB3.js`, `vite.config.ts`
- Impact: Source and generated output can drift. Reviewers and future agents may inspect stale `dist/` files instead of source modules under `apps/`, `shared/`, and `src/`.
- Fix approach: Prefer source paths for implementation and mapping. If `dist/` is intentionally committed for deployment, regenerate it only through `npm run build` and include it in release/deploy commits, not routine source-only changes.

**One backlog file captures product work outside planning structure:**
- Issue: `TODO.md` contains an unplanned real-estate/DSR/LTV feature idea and overlaps with a noted Step 1.2/newlywed hub direction.
- Files: `TODO.md`, `prd-10.md`, `.planning/`
- Impact: Product scope can fragment between `TODO.md`, PRDs, and `.planning/` artifacts.
- Fix approach: Promote actionable items from `TODO.md` into `.planning/` milestone/phase artifacts before implementation. Keep `TODO.md` as inbox only, not as authoritative requirements.

## Known Bugs

**Surplus transfer allocation uses bucket indexes from different arrays:**
- Symptoms: In `simulateProjection`, surplus cash allocation computes `surplusAdds` for `targetBuckets`, then uses `savingsBuckets.indexOf(bucket)` and `investBuckets.indexOf(bucket)` to index into the smaller `surplusAdds` array. When selected target buckets are not at index `0` in their source arrays, the wrong add amount can be used or the add can become `0`.
- Files: `apps/main/modules/calculator.js`
- Trigger: Configure `surplusTransferAccountId` to match a savings/invest bucket that is not the first bucket in `savingsBuckets` or `investBuckets`, then run projection with positive surplus.
- Workaround: Keep the surplus target mapped to the first matching bucket, or avoid relying on surplus transfer precision until fixed.

**IndexedDB availability is overreported by the modern bridge:**
- Symptoms: `target.IsfBackupManager.isIndexedDbAvailable` always returns `true` in `src/core/storage/CompatibilityBridge.ts`, while actual IndexedDB open can fail in `src/core/storage/IsfStore.ts`.
- Files: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `apps/main/modules/persistence-controller.js`
- Trigger: Run in a browser/context where IndexedDB is unavailable, blocked, quota-limited, or fails during open.
- Workaround: Legacy `shared/storage/backup-manager.js` has a real availability check; use that pattern when hardening the TypeScript bridge.

**Legacy database deletion runs during storage initialization:**
- Symptoms: `IsfStore.init()` calls `window.indexedDB.deleteDatabase('isf-hub-db-v1')` when it detects the old database.
- Files: `src/core/storage/IsfStore.ts`
- Trigger: Opening an app path that initializes the TypeScript storage bridge on a browser profile with existing `isf-hub-db-v1` data.
- Workaround: Export/import JSON or create manual backups before testing storage migration changes.

## Security Considerations

**HTML string rendering must keep escaping discipline:**
- Risk: Multiple renderers assign template strings to `innerHTML`. Some paths escape user-controlled labels with `IsfUtils.escapeHtml`, but not every assignment is structurally enforced by a sanitizer or typed safe-HTML helper.
- Files: `apps/main/modules/list-renderer.js`, `apps/main/modules/visualization-controller.js`, `apps/portfolio/modules/dom.js`, `apps/simulation/modules/renderers.js`
- Current mitigation: Representative item renderers in `apps/main/modules/list-renderer.js` escape names/groups with `IsfUtils.escapeHtml`; tooltip rendering in `apps/main/modules/visualization-controller.js` escapes `&`, `<`, and `>` before applying limited markup transforms.
- Recommendations: Use DOM APIs or a small `htmlEscape`/safe-template helper for all user-controlled values. Add tests for names/groups containing `<img onerror=...>`, quotes, and backticks in Step 1, Step 2, and portfolio renderers.

**Financial data is stored locally without encryption or access controls:**
- Risk: Income, expense, account, portfolio, and backup data are stored in `localStorage`, `sessionStorage`, URL hashes, and IndexedDB. Any script running on the origin can read it.
- Files: `apps/main/modules/storage-manager.js`, `apps/main/modules/persistence-controller.js`, `shared/core/share-utils.js`, `shared/storage/hub-storage.js`, `src/core/storage/IsfStore.ts`, `apps/simulation/modules/state.js`
- Current mitigation: No remote API is detected; storage is local-first. Share IDs are constrained by regex in `shared/core/share-utils.js`, and hash payloads are length-limited by `HASH_STATE_MAX_LENGTH`.
- Recommendations: Keep third-party scripts off these pages, document local-only privacy expectations, avoid adding analytics that can read app state, and consider optional encrypted export/share flows before handling sensitive production user data.

**Share links and ISF codes are integrity-free payloads:**
- Risk: `shared/core/share-utils.js` encodes compressed/base64 JSON in URL hashes or codes and `apps/main/modules/persistence-controller.js` applies decoded data after normalization. There is no signature, expiry, or sender authenticity.
- Files: `shared/core/share-utils.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/external-input-guard.js`
- Current mitigation: `parseStateEnvelope` checks the app key when present, `decodePayloadFromHash` catches parse errors, and external inputs are normalized before commit.
- Recommendations: Treat share payloads as untrusted input. Keep all imported fields routed through `normalizeExternalStep1Inputs`; add schema-version checks and user-visible source warnings before accepting future higher-risk fields.

## Performance Bottlenecks

**Frequent full-state JSON diffing and cloning:**
- Problem: Draft-change checks and state comparisons use `JSON.stringify` on nested financial inputs during UI updates and hash handling.
- Files: `apps/main/modules/financial-modal-controller.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/state-helpers.js`, `shared/storage/backup-manager.js`
- Cause: Deep equality and cloning are implemented through JSON serialization for convenience.
- Improvement path: Add stable signatures for item arrays and input revisions. Compare category-level signatures in modal code and only serialize full state at persistence/export boundaries.

**Sankey rendering recomputes layout and text metrics on each render:**
- Problem: `renderSankey` calculates column geometry, measures labels on canvas, clears SVG/legend, and rebuilds the complete SVG tree each render.
- Files: `apps/main/modules/sankey-renderer.js`, `apps/main/modules/sankey-builder.js`, `apps/main/modules/render-orchestrator.js`
- Cause: Rendering is full rebuild oriented and tied to global `state`.
- Improvement path: Keep the full rebuild for small datasets, but introduce memoized layout inputs for `snapshot`, grouping, value mode, sort mode, zoom, and viewport. Add a performance guard test for many income/allocation/account nodes.

**Backup listing trims by scanning all backup records:**
- Problem: `BackupService.listBackups` reads all backups with `getAll()` and filters in memory, and `trimBackups` repeatedly opens readwrite transactions for individual deletes.
- Files: `src/core/storage/BackupService.ts`, `src/core/storage/IsfStore.ts`
- Cause: The `appKey` index exists but is not used for lookup or trim operations.
- Improvement path: Query the `appKey` index in `listBackups`, delete stale entries in one transaction, and preserve the current caps of 20 auto and 10 manual backups per app key.

## Fragile Areas

**Global mutable state object is shared across many modules:**
- Files: `apps/main/modules/state.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/event-bindings.js`, `apps/main/modules/render-orchestrator.js`, `apps/main/modules/list-renderer.js`, `apps/main/modules/sankey-renderer.js`
- Why fragile: `state.inputs`, `state.draftInputs`, editor flags, projection options, Sankey settings, and backup flags are mutated directly by many modules.
- Safe modification: Route commits through `commitImmediateInputs` and `markPendingChanges` in `apps/main/modules/persistence-controller.js` when persistence/rendering is expected. For UI-only flags, update the smallest owning controller and call the relevant renderer explicitly.
- Test coverage: Playwright covers major Step 1 flows in `tests/step1.spec.ts`, but central state helpers and controllers have little isolated unit coverage.

**Model migration assumes pre-v10 currency fields need multiplication:**
- Files: `apps/main/modules/input-sanitizer.js`, `apps/main/modules/constants.js`, `shared/core/share-utils.js`
- Why fragile: `migrateInputsToWon` multiplies numeric currency fields and item amounts by 10,000 when `modelVersion < 10`. Incorrect or missing `modelVersion` on imported data can silently scale financial values.
- Safe modification: Add migration tests for missing, old, and current `modelVersion` payloads before changing currency fields. Keep imports through `sanitizeInputs` and `normalizeExternalStep1Inputs`.
- Test coverage: Some import/persistence flows are exercised in `tests/step1.spec.ts`; direct migration matrix tests are limited.

**Portfolio app is less integrated with the main test and storage hardening path:**
- Files: `apps/portfolio/app.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/calculator.js`, `apps/portfolio/modules/dom.js`
- Why fragile: Portfolio state writes through `IsfStorageHub` but lacks the same normalization and E2E coverage density as Step 1 and Step 2. Validation logs to console and `apps/portfolio/modules/dom.js` renders several user-entered fields through `innerHTML`.
- Safe modification: Add portfolio-specific tests before changing creator assets, portfolio validation, or storage keys. Escape all portfolio names/tickers in render output.
- Test coverage: No `tests/step3.spec.ts` or portfolio-specific spec was detected.

**PWA and storage update behavior can affect user data:**
- Files: `shared/pwa/pwa-manager.js`, `shared/storage/backup-manager.js`, `src/core/storage/IsfStore.ts`, `public/manifest.webmanifest`, `shared/legacy/sw.js`
- Why fragile: PWA update flows, backup creation, and database migration all touch persistent browser state. Errors are often caught and logged without surfacing durable diagnostics.
- Safe modification: Before changing service worker/version/storage migration behavior, run E2E flows with existing localStorage/IndexedDB data, update available, and blocked IndexedDB scenarios.
- Test coverage: Playwright blocks service workers in `playwright.config.ts`, so PWA update behavior is not exercised by the main E2E suite.

## Scaling Limits

**URL hash share payload is capped at 6,000 characters:**
- Current capacity: `HASH_STATE_MAX_LENGTH = 6000`.
- Limit: Large household datasets with many accounts, allocations, transfers, and backups cannot be shared through hash payloads once compressed/base64 data exceeds the cap.
- Scaling path: Use IndexedDB/local file export for large data, or introduce a server-backed share service with explicit privacy/security design.

**Playwright suite is serialized to one browser worker:**
- Current capacity: `playwright.config.ts` sets `fullyParallel: false` and `workers: 1`.
- Limit: `tests/step1.spec.ts` is 1,523 lines and `tests/step2.spec.ts` is 550 lines; E2E runtime will grow linearly as more flows are added.
- Scaling path: Split tests by isolated storage keys and pages, make setup deterministic, then raise worker count or shard by project.

**Local browser storage has no quota handling strategy:**
- Current capacity: Browser-dependent `localStorage` and IndexedDB quotas.
- Limit: Save, backup, and export paths can fail when storage is blocked or quota is exceeded.
- Scaling path: Centralize quota/error handling in `src/core/storage/IsfStore.ts` and `shared/storage/hub-storage.js`; expose actionable UI recovery steps through `apps/main/modules/persistence-controller.js`.

## Dependencies at Risk

**Tailwind CSS alpha dependency:**
- Risk: `tailwindcss` and `@tailwindcss/vite` are pinned to `^4.0.0-alpha.13`.
- Impact: Alpha API or output changes can break builds or styling during install/update.
- Migration plan: Pin exact versions while alpha is required, or move to a stable Tailwind release and update `vite.config.ts` / CSS entrypoints in one verified change.

**React dependencies are present but the app is mostly vanilla DOM:**
- Risk: `react`, `react-dom`, `@vitejs/plugin-react`, and React type packages are installed, but the inspected app modules under `apps/` are vanilla JavaScript DOM controllers.
- Impact: Dependency surface and build complexity are larger than the active architecture suggests.
- Migration plan: Either document the React-backed entrypoints under `src/entries/` as the intended direction, or remove unused React dependencies after verifying `npm run build`, `npm run check`, and E2E tests.

## Missing Critical Features

**No durable diagnostics for storage/import failures:**
- Problem: Several important failure paths catch errors and show a short UI status or write to console. There is no persisted failure record for recovery.
- Blocks: Debugging user reports about lost backups, failed imports, broken share links, or quota problems.
- Files: `apps/main/modules/persistence-controller.js`, `apps/main/modules/storage-manager.js`, `src/core/storage/IsfStore.ts`, `shared/storage/backup-manager.js`

**No dedicated security/privacy mode for financial data:**
- Problem: Local financial data can be read by any same-origin script and exported/shared as plain JSON payloads.
- Blocks: Safe use in contexts with shared devices, browser extensions, analytics scripts, or sensitive household data.
- Files: `shared/core/share-utils.js`, `apps/main/modules/persistence-controller.js`, `shared/storage/hub-storage.js`, `src/core/storage/IsfStore.ts`

## Test Coverage Gaps

**Unit coverage is narrow:**
- What's not tested: Core pure functions such as `simulateProjection`, `migrateInputsToWon`, `sanitizeInputs`, `buildSavingsBuckets`, storage trimming, and share payload decoding are not covered by focused unit tests.
- Files: `apps/main/modules/calculator.js`, `apps/main/modules/input-sanitizer.js`, `shared/core/share-utils.js`, `src/core/storage/BackupService.ts`
- Risk: Financial math, migration, and import behavior can regress without a fast failing test.
- Priority: High

**Step 3 portfolio flows lack detected E2E coverage:**
- What's not tested: Portfolio creation, validation, deletion, chart rendering, storage persistence, and Step 1 connector behavior.
- Files: `apps/portfolio/app.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/calculator.js`, `apps/portfolio/modules/dom.js`
- Risk: Portfolio-specific bugs can ship while Step 1 and Step 2 suites pass.
- Priority: High

**PWA/service worker behavior is outside E2E coverage:**
- What's not tested: Service worker registration/update prompts, backup-before-update behavior, reload loop protection, and manifest/version sync.
- Files: `shared/pwa/pwa-manager.js`, `shared/legacy/sw.js`, `public/manifest.webmanifest`, `playwright.config.ts`
- Risk: Production install/update problems may only appear after deployment.
- Priority: Medium

**Cross-browser coverage is limited to Chromium:**
- What's not tested: Safari/WebKit and Firefox behavior for IndexedDB, localStorage, file import/export, SVG/PNG export, and mobile viewport rendering.
- Files: `playwright.config.ts`, `tests/step1.spec.ts`, `tests/step2.spec.ts`
- Risk: Browser-specific storage and rendering bugs can remain undetected.
- Priority: Medium

---

*Concerns audit: 2026-06-23*
