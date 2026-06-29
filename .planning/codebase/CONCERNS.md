# Codebase Concerns

**Analysis Date:** 2026-06-29

## Tech Debt

**Large modal controller owns too many responsibilities:**
- Issue: `apps/main/modules/financial-modal-controller.js` is 2,288 lines and combines modal state, row rendering, validation, drag/drop, dirty detection, pending-bar behavior, account recommendation, create flow, over-budget adjustment, income allocation editing, and savings maturity/yield editing.
- Files: `apps/main/modules/financial-modal-controller.js`, `tests/step1.spec.ts`
- Impact: Small financial-detail changes can regress unrelated flows because category-specific behavior is coupled through shared mutable closure state such as `activeCategory`, `baselineInputs`, `outflowDrafts`, `editingIndex`, `rowErrors`, and `savingsAdditionalOpenRows`.
- Fix approach: Extract category-neutral draft state helpers and category renderers into separate modules under `apps/main/modules/financial-modal/`; keep `createFinancialModalController()` as the event-binding facade. Move validation helpers into pure functions with focused tests before changing UI behavior.

**Step 1 E2E test file is oversized and phase-accumulated:**
- Issue: `tests/step1.spec.ts` is 2,938 lines and mixes layout audits, sanitizer probes, persistence checks, Sankey contracts, and modal regressions across many historical phases.
- Files: `tests/step1.spec.ts`, `playwright.config.ts`
- Impact: The suite is hard to navigate and expensive to run serially because `playwright.config.ts` sets `fullyParallel: false` and `workers: 1`; future regressions are likely to be patched into the same file instead of isolated by feature.
- Fix approach: Split into `tests/step1-modal.spec.ts`, `tests/step1-sankey.spec.ts`, `tests/step1-sanitizer.spec.ts`, and `tests/step1-responsive.spec.ts`; keep shared setup helpers in `tests/helpers/step1.ts`.

**Mixed TypeScript migration boundary:**
- Issue: `src/core/storage/CompatibilityBridge.ts` exposes typed storage services as `window.IsfStorageHub`, `window.IsfHubStorage`, and `window.IsfBackupManager`, while most app modules consume those globals from vanilla JS.
- Files: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `apps/main/modules/persistence-controller.js`, `apps/simulation/modules/storage-fallback.js`, `tsconfig.json`
- Impact: `tsconfig.json` enables `allowJs` and `skipLibCheck`, so contracts across the JS/TS boundary are only partially checked. Shape drift in the bridge can break Step 1/Step 2 persistence at runtime.
- Fix approach: Define a shared storage contract in `src/core/storage/types.ts`, attach it to `window` through a single declaration file, and move JS callers behind thin local adapters before changing storage behavior.

**Legacy storage wipe is embedded in initialization:**
- Issue: `IsfStore.init()` deletes `isf-hub-db-v1` whenever the modern store initializes.
- Files: `src/core/storage/IsfStore.ts`
- Impact: Opening any app entry that imports `src/core/storage/CompatibilityBridge.ts` can remove legacy IndexedDB data without a migration confirmation path.
- Fix approach: Replace unconditional deletion with an explicit migration/retention policy. If legacy data is truly obsolete, gate deletion behind a versioned one-time migration marker and add a Playwright storage migration test.

**Share/import silently swallows malformed payload failures:**
- Issue: Share decode helpers return `null` on most parse/decode errors and callers often convert that into generic UI feedback.
- Files: `shared/core/share-utils.js`, `apps/main/modules/persistence-controller.js`, `apps/simulation/modules/ui-controller.js`
- Impact: Users cannot distinguish a wrong app key, oversized/truncated hash, invalid JSON, unsupported schema, or corrupted compressed payload. Debugging import/share failures requires manual reproduction.
- Fix approach: Return typed error results from `decodePayloadFromHash()` and `parseImportedJson()`, then map error codes to user-visible feedback in each app controller.

## Known Bugs

**Backup/store readiness can be reported as available even when IndexedDB is unavailable:**
- Symptoms: `src/core/storage/CompatibilityBridge.ts` sets `IsfBackupManager.isIndexedDbAvailable: () => true`, while `IsfStore.init()` can still fail on `indexedDB.open()` or browsers without usable IndexedDB.
- Files: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `apps/main/modules/persistence-controller.js`
- Trigger: Run in a browser context with blocked IndexedDB, private mode restrictions, or an `indexedDB.open()` failure.
- Workaround: Step 2 has `apps/simulation/modules/storage-fallback.js`; Step 1 backup initialization only catches after calling bridge methods.

**`setPendingBarVisible()` is an empty persistence hook:**
- Symptoms: `commitImmediateInputs()` calls `setPendingBarVisible(false)`, but the function body is empty.
- Files: `apps/main/modules/persistence-controller.js`
- Trigger: Any path that expects the persistence controller to hide a shared pending state after committing.
- Workaround: The financial modal has its own pending-bar logic inside `apps/main/modules/financial-modal-controller.js`, so current modal flows can still work independently.

**Clipboard merchant matching is exact/partial only:**
- Symptoms: Similar merchant names, spacing variants, and typo-heavy SMS messages do not auto-match expense categories.
- Files: `shared/core/clipboard-parser.js`, `shared/core/clipboard-parser.test.js`, `apps/main/modules/feature-controllers.js`
- Trigger: Use smart add with a merchant string that differs from existing item names by spelling, whitespace, aliases, or Korean/English variants.
- Workaround: The parser returns a fallback transaction with merchant `"알 수 없는 상점"` when it finds an amount but cannot classify the merchant.

## Security Considerations

**String-template rendering requires constant escaping discipline:**
- Risk: Multiple UI renderers assign template strings to `innerHTML`; most user-controlled fields are escaped, but safety depends on every interpolated value using `IsfUtils.escapeHtml()` or equivalent.
- Files: `apps/main/modules/list-renderer.js`, `apps/portfolio/modules/dom.js`, `shared/components/data-hub-modal.js`, `apps/simulation/modules/renderers.js`, `apps/main/modules/visualization-controller.js`
- Current mitigation: `apps/main/modules/list-renderer.js` escapes names, labels, ids, and account text in most dynamic rows; `apps/portfolio/modules/dom.js` uses `escapeAttr()`/`IsfUtils.escapeHtml()` for portfolio and asset names.
- Recommendations: Prefer DOM construction for user data, add an ESLint rule or local review checklist for `innerHTML`, and add malicious-string regression tests for portfolio names, asset names, account names, group labels, transfer labels, share imports, and DataHub entries.

**Hash/share payloads can contain full household financial state in URLs:**
- Risk: `shared/core/share-utils.js` builds share links by embedding compressed state in `location.hash`, including income, debt, savings, investment, and household context values.
- Files: `shared/core/share-utils.js`, `apps/main/modules/persistence-controller.js`, `apps/simulation/app.js`
- Current mitigation: No server upload is required for hash sharing; `getShareIdFromUrl()` validates pointer ids with `/^[a-zA-Z0-9_-]{8,48}$/`.
- Recommendations: Add explicit privacy copy before generating share codes/links, keep generated links out of logs, and consider a redacted/export-minimal mode for demos.

**Drag/drop JSON parsing trusts same-page payload shape:**
- Risk: Financial modal drag/drop reads JSON from `event.dataTransfer` and uses parsed fields to reorder rows.
- Files: `apps/main/modules/financial-modal-controller.js`
- Current mitigation: The code catches JSON parse failures before using the payload.
- Recommendations: Validate payload category/index/id against current draft state before applying any reorder; add tests for malformed and cross-category drag payloads.

## Performance Bottlenecks

**Frequent full rerenders and JSON dirty checks in financial modal:**
- Problem: `hasDraftChanges()` compares full input snapshots with `JSON.stringify()`, and many field interactions call `renderRows()` or broad stat synchronization.
- Files: `apps/main/modules/financial-modal-controller.js`
- Cause: Modal state is stored as mutable arrays in closure variables, and dirty state is derived by serializing entire candidate/baseline inputs.
- Improvement path: Track per-category dirty flags and row-level updates. Use stable draft reducers that update only the affected row, rail summary, and pending bar.

**Sankey rendering recalculates and redraws SVG on many state changes:**
- Problem: Visualization changes call `renderSankey()` after rebuilding Sankey data and clearing SVG content.
- Files: `apps/main/modules/visualization-controller.js`, `apps/main/modules/sankey-renderer.js`, `apps/main/modules/sankey-builder.js`
- Cause: The renderer clears `dom.sankeySvg.innerHTML` and rebuilds the diagram rather than diffing or memoizing layout inputs.
- Improvement path: Cache `buildSankeyData()` results by sanitized input/version and grouping mode; debounce rapid controls such as sort/group/zoom changes.

**Storage fallback duplicates Step 2 entries in LocalStorage without retention limit:**
- Problem: `apps/simulation/modules/storage-fallback.js` writes all fallback entries to `localStorage` and sorts them, but it does not cap count or byte size.
- Files: `apps/simulation/modules/storage-fallback.js`
- Cause: The IndexedDB-backed path is preferred, while fallback mode optimizes for continuity over quota control.
- Improvement path: Apply the same retention policy used for Step 1 history/backups, surface quota errors, and test fallback behavior near browser LocalStorage limits.

## Fragile Areas

**Sanitizer is the central compatibility boundary:**
- Files: `apps/main/modules/input-sanitizer.js`, `apps/main/modules/external-input-guard.js`, `apps/main/modules/account-correction.js`, `tests/step1.spec.ts`
- Why fragile: Saved data, imported JSON, share hashes, reset presets, Step 1 render state, and Step 2/Step 3 connectors all depend on `sanitizeInputs()` preserving current model fields while stripping or repairing legacy account-flow data.
- Safe modification: Add table-driven tests for each field before changing sanitizer output; verify save/import/share/Sankey flows through Playwright after edits.
- Test coverage: Good Step 1 E2E coverage exists in `tests/step1.spec.ts`, but there are no focused unit tests that run sanitizer cases without the browser.

**Share schema and app-key handling affects all app entries:**
- Files: `shared/core/share-utils.js`, `apps/main/modules/constants.js`, `apps/simulation/modules/constants.js`, `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`
- Why fragile: `SHARE_STATE_KEY` and `SHARE_STATE_SCHEMA` differ per app, and legacy simulation keys remain supported. A schema/key change can make existing links or ISF codes unreadable.
- Safe modification: Version share envelopes explicitly and keep app-key migration tests for Step 1 and Step 2.
- Test coverage: Step 1 import/share fields are exercised in `tests/step1.spec.ts`; there is no dedicated `share-utils` unit test file.

**Portfolio app has minimal automated coverage:**
- Files: `apps/portfolio/app.js`, `apps/portfolio/modules/dom.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/calculator.js`
- Why fragile: Step 3 uses direct DOM rendering, alerts, LocalStorage, and modal editing, but no Playwright spec targets `/apps/portfolio/index.html`.
- Safe modification: Add smoke tests for create/edit/delete portfolio, asset validation, persistence reload, malicious asset names, and mobile layout before significant Step 3 changes.
- Test coverage: Not detected for portfolio-specific E2E; no `tests/portfolio.spec.ts` exists.

**PWA/service worker cache paths must match Vite base path:**
- Files: `vite.config.ts`, `shared/legacy/sw.js`, `public/manifest.webmanifest`, `scripts/sync-version.js`
- Why fragile: The app is deployed under `/IndividualSavingsFlowUI/`; Workbox `navigateFallback` and legacy cache URLs must stay aligned with generated entry assets and version bump scripts.
- Safe modification: Verify `npm run build` and a Playwright preview smoke test after changing base paths, PWA settings, or service worker assets.
- Test coverage: Source-first cleanup is checked in `tests/step1.spec.ts`; offline/PWA update behavior is not covered by Playwright because `playwright.config.ts` blocks service workers.

## Scaling Limits

**Client-only persistence is bounded by browser storage quotas:**
- Current capacity: Step 1 active state is mirrored to LocalStorage, Step 1 history is trimmed to 50 entries in IndexedDB, Step 2 fallback entries are uncapped in LocalStorage.
- Limit: Large share/import payloads, many Step 2 simulations, or repeated backups can hit LocalStorage/IndexedDB quotas and fail silently or degrade to fallback behavior.
- Scaling path: Centralize quota handling in `src/core/storage/IsfStore.ts` and `apps/simulation/modules/storage-fallback.js`; expose storage status to `shared/components/data-hub-modal.js`.

**Hash payload size is capped at 6,000 characters:**
- Current capacity: `shared/core/share-utils.js` accepts compressed or base64 payloads only while the encoded hash is no longer than 6,000 characters.
- Limit: More fields, larger item lists, or verbose metadata can make `buildShareLink()` return `null`.
- Scaling path: Prefer IndexedDB-backed share pointers for large states, add payload-size diagnostics, and test maximum realistic household data.

## Dependencies at Risk

**Tailwind 4 alpha dependency:**
- Risk: `@tailwindcss/vite` and `tailwindcss` are pinned to `^4.0.0-alpha.13`.
- Impact: Alpha package behavior and config expectations can shift during install/update, which may affect CSS generation.
- Migration plan: Pin exact versions or move to a stable Tailwind release after verifying `src/styles/globals.css` and app CSS output.

**React dependencies are present but app code is mostly vanilla JS:**
- Risk: `react`, `react-dom`, and `@vitejs/plugin-react` are installed while entry points primarily import vanilla modules.
- Impact: Future contributors may add React islands without a clear ownership model, increasing bundle/runtime complexity.
- Migration plan: Either document React as reserved for future work or remove the dependency/plugin until a React-owned surface exists.

## Missing Critical Features

**No centralized telemetry/error reporting:**
- Problem: Most storage/share/import failures are caught locally and reported through generic UI status, `console.warn()`, or no user-facing detail.
- Blocks: Reliable support for user reports involving lost backups, failed imports, share-code failures, or PWA update issues.

**No first-class unit test runner command despite Vitest dependency:**
- Problem: `package.json` includes `vitest`, but scripts expose only `test:e2e`; `shared/core/clipboard-parser.test.js` is a console script rather than a Vitest/Jest test.
- Blocks: Fast regression coverage for pure modules such as `apps/main/modules/input-sanitizer.js`, `shared/core/share-utils.js`, `apps/main/modules/calculator.js`, and `apps/simulation/modules/comparison-calculator.js`.

## Test Coverage Gaps

**Storage bridge and backup failure modes:**
- What's not tested: IndexedDB open failure, `window.indexedDB.databases()` absence/failure, backup creation failure, trim behavior, legacy DB retention/deletion, and bridge shape compatibility.
- Files: `src/core/storage/IsfStore.ts`, `src/core/storage/CompatibilityBridge.ts`, `shared/storage/backup-manager.js`
- Risk: Data loss or silent fallback behavior can ship without browser-level coverage.
- Priority: High

**Share utility edge cases:**
- What's not tested: Corrupted compressed hashes, oversized payloads, wrong app keys, schema mismatch, Unicode payload round-trips, imported JSON error codes, and `sid` pointer validation.
- Files: `shared/core/share-utils.js`, `apps/main/modules/persistence-controller.js`, `apps/simulation/modules/ui-controller.js`
- Risk: Users cannot recover or diagnose failed share/import flows.
- Priority: High

**Portfolio Step 3 workflows:**
- What's not tested: Portfolio create/edit/delete, validation alerts, pending modal save/cancel, LocalStorage persistence, and XSS-resistant rendering.
- Files: `apps/portfolio/app.js`, `apps/portfolio/modules/dom.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/calculator.js`
- Risk: Step 3 can regress independently from the well-covered Step 1/Step 2 flows.
- Priority: Medium

**Clipboard parser classification quality:**
- What's not tested: Fuzzy matching, merchant aliases, duplicate category names, multiple currency values in one SMS, card cancellation/refund messages, and malformed SMS payloads.
- Files: `shared/core/clipboard-parser.js`, `shared/core/clipboard-parser.test.js`, `apps/main/modules/feature-controllers.js`
- Risk: Zero-input spending capture can misclassify or fail to classify real bank/card messages.
- Priority: Medium

---

*Concerns audit: 2026-06-29*
