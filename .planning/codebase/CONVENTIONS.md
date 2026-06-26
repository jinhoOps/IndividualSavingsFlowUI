# Coding Conventions

**Analysis Date:** 2026-06-23

## Naming Patterns

**Files:**
- Use kebab-case for browser app modules: `apps/main/modules/input-sanitizer.js`, `apps/main/modules/financial-modal-controller.js`, `apps/simulation/modules/storage-fallback.js`.
- Use kebab-case for shared browser modules: `shared/core/share-utils.js`, `shared/storage/backup-manager.js`, `shared/components/feedback-manager.js`.
- Use PascalCase for TypeScript class/service modules under the modern storage layer: `src/core/storage/BackupService.ts`, `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`.
- Use PascalCase for React components: `src/components/common/Toast.tsx`.
- Use `.spec.ts` for Playwright tests under `tests/`: `tests/step1.spec.ts`, `tests/step2.spec.ts`.
- The script-style parser smoke test uses `.test.js`: `shared/core/clipboard-parser.test.js`.

**Functions:**
- Use camelCase verbs for exported functions: `sanitizeInputs`, `sanitizeHouseholdContext`, `createIncomeItem`, `normalizeAllocationGroupName` in `apps/main/modules/input-sanitizer.js`.
- Use camelCase for private helper functions in modules: `readFallbackEntries`, `writeFallbackEntries`, `buildDisplayName` in `apps/simulation/modules/storage-fallback.js`.
- Use object method names for controller-style modules: `init`, `bindEvents`, `updateAll`, `renderCharts` on `uiController` in `apps/simulation/modules/ui-controller.js`.
- Use class names only where the module is intentionally stateful and instantiated: `IsfState` in `apps/portfolio/modules/state.js`, `PwaManager` in `shared/pwa/pwa-manager.js`.

**Variables:**
- Use `const` by default and `let` only for mutable state such as `fallbackMode` in `apps/simulation/modules/storage-fallback.js` and timer handles in `shared/components/feedback-manager.js`.
- Use UPPER_SNAKE_CASE for module constants and storage keys: `STEP2_FALLBACK_STORAGE_KEY` in `apps/simulation/modules/storage-fallback.js`, `STORAGE_KEY` and `SHARE_STATE_SCHEMA` in `apps/main/modules/constants.js`.
- Use `safe*`, `raw*`, and `normalized*` names for validation pipelines: `safeContext`, `rawAllocs`, `safeAllocations`, `normalizedItem` in `apps/main/modules/input-sanitizer.js`.
- Use descriptive DOM element names in `dom` modules and controller code: `totalMonthlyInvestCapacity`, `strategyCardGroup`, `advancedAssumptionsModal` in `apps/simulation/modules/ui-controller.js`.

**Types:**
- TypeScript type/interface names use PascalCase: `BackupEntry` in `src/core/types/models.ts`.
- React prop types use short PascalCase interfaces near the component: `Props` in `src/components/common/Toast.tsx`.
- Browser JavaScript modules rely on runtime validation rather than declared TypeScript types; preserve defensive checks in files such as `apps/main/modules/input-sanitizer.js`.

## Code Style

**Formatting:**
- No Prettier, Biome, or ESLint configuration is present. Formatting is enforced informally through existing style in `apps/`, `shared/`, and `src/`.
- JavaScript app modules generally use 2-space indentation, semicolons, and double quotes in `apps/main/modules/*.js` and `apps/simulation/modules/*.js`.
- Some older/shared files use single quotes, especially `shared/core/clipboard-parser.js` and `apps/portfolio/modules/*.js`; match the surrounding file rather than normalizing unrelated code.
- Keep object/array literals readable with trailing commas when the surrounding file uses them, as in `apps/main/modules/input-sanitizer.js` and `vite.config.ts`.

**Linting:**
- `npm run lint` runs `tsc --noEmit` from `package.json`; there is no ESLint rule set.
- `npm run check` also runs `tsc --noEmit` from `package.json`.
- `tsconfig.json` enables `strict`, `allowJs`, `forceConsistentCasingInFileNames`, `isolatedModules`, and `noEmit`.
- `tests/step1.spec.ts` and `tests/step2.spec.ts` use `// @ts-nocheck`; keep new Playwright tests type-safe when practical, but do not remove existing suppression without fixing the file.

## Import Organization

**Order:**
1. External package imports first: `import { defineConfig } from 'vite';` in `vite.config.ts`, `import { test, expect } from '@playwright/test';` in `tests/step1.spec.ts`.
2. Relative module imports next: `import { state, markDirty } from "./state.js";` and `import { dom } from "./dom.js";` in `apps/simulation/modules/ui-controller.js`.
3. Group multi-symbol imports across lines when the list is long: `apps/main/modules/input-sanitizer.js` imports several constants from `./constants.js`.

**Path Aliases:**
- `tsconfig.json` defines `@/*` as `./src/*` and `@shared/*` as `./shared/*`.
- Existing browser app modules use explicit relative `.js` imports: `apps/simulation/modules/ui-controller.js`, `apps/main/modules/input-sanitizer.js`.
- Playwright browser-context dynamic imports use absolute app URLs under the Vite base path: `import('/IndividualSavingsFlowUI/apps/simulation/modules/state.js')` in `tests/step2.spec.ts`.
- Prefer relative `.js` imports inside `apps/` and `shared/`; use aliases mainly in TypeScript/React source under `src/`.

## Error Handling

**Patterns:**
- Use guard clauses for invalid inputs and unavailable DOM nodes: `if (!domElement) return;` in `shared/components/feedback-manager.js`, `if (!id) return null;` in `apps/simulation/modules/storage-fallback.js`.
- Sanitize external or persisted data before use. Follow the `safe*` object pattern in `apps/main/modules/input-sanitizer.js` and `normalizeStep2Entry` in `apps/simulation/modules/storage-fallback.js`.
- For optional browser APIs and storage bridges, catch errors and degrade gracefully: IndexedDB failures activate LocalStorage fallback in `apps/simulation/modules/storage-fallback.js`.
- User-facing recoverable errors should update UI feedback with `window.IsfFeedback.showFeedback`, as in `apps/simulation/modules/ui-controller.js` and `apps/main/modules/persistence-controller.js`.
- Critical initialization failures are logged with `console.error` in app entry points such as `apps/simulation/app.js`.
- Validation failures in direct UI flows use `window.alert` or `alert`, visible in `apps/main/modules/financial-modal-controller.js` and `apps/portfolio/app.js`.
- Throw explicit machine-readable errors only for invalid internal states or contracts: `INVALID_STEP2_ENTRY` in `apps/simulation/modules/storage-fallback.js`, `DB_NOT_INITIALIZED` in `src/core/storage/IsfStore.ts`.

## Logging

**Framework:** `console`

**Patterns:**
- Use `console.warn` for fallback or non-fatal degradation, such as `activateFallback` in `apps/simulation/modules/storage-fallback.js`.
- Use `console.error` when an operation fails and user feedback or fallback follows, such as import failures in `apps/simulation/modules/ui-controller.js`.
- Startup and migration logs are present in `apps/simulation/app.js`, `shared/storage/hub-storage.js`, `src/core/storage/CompatibilityBridge.ts`, and `shared/pwa/pwa-manager.js`.
- Avoid adding noisy logs in hot rendering paths. If logging is required, keep it contextual and removable.

## Comments

**When to Comment:**
- Comment non-obvious browser behavior, visual verification rationale, storage fallback behavior, or compatibility constraints.
- Use comments sparingly in implementation modules. Existing examples include SMS parser examples in `shared/core/clipboard-parser.js` and Playwright layout rationale in `tests/step1.spec.ts`.
- Korean comments are acceptable where the surrounding test or UX text is Korean, as in `tests/step1.spec.ts`.

**JSDoc/TSDoc:**
- JSDoc is used lightly for shared utilities: `parseSms` and `matchCategory` in `shared/core/clipboard-parser.js`.
- Most app modules do not require JSDoc for every function. Add it when a helper has a reusable contract or non-obvious inputs.

## Function Design

**Size:** Keep pure calculation, sanitization, and normalization helpers small and export them when they are useful to tests or other modules. Examples: `normalizeAllocationGroupName`, `sanitizeInteger`, `toMonthlyFactor` in `apps/main/modules/input-sanitizer.js`.

**Parameters:** Prefer a single options object for extensible behavior: `createIncomeItem({ id, name, amount, accountId, allocations } = {})` in `apps/main/modules/input-sanitizer.js`, `normalizeStep2Entry(data = {})` in `apps/simulation/modules/storage-fallback.js`.

**Return Values:** Return normalized data structures rather than mutating caller-owned data when sanitizing or repairing. `sanitizeInputs` returns a repaired copy in `apps/main/modules/input-sanitizer.js`; `normalizeStep2Entry` returns a normalized entry in `apps/simulation/modules/storage-fallback.js`.

**Async:** Use `async`/`await` for storage, import, and controller operations. Catch storage bridge failures locally and preserve feature behavior with fallback paths.

## Module Design

**Exports:** 
- Export named functions and constants for reusable logic: `apps/main/modules/input-sanitizer.js`, `apps/main/modules/comparison-engine.js`, `apps/simulation/modules/storage-fallback.js`.
- Export singleton objects for controllers and managers that own event binding or stateful orchestration: `uiController` in `apps/simulation/modules/ui-controller.js`, `IsfSnapshotManager` in `apps/portfolio/modules/snapshot-manager.js`.
- IIFE globals are used for browser-wide legacy utilities: `shared/components/feedback-manager.js`, `shared/storage/backup-manager.js`, `shared/pwa/pwa-manager.js`.

**Barrel Files:** Not detected. Import directly from the owning file, for example `./storage-fallback.js` or `./input-sanitizer.js`.

**State Management:** 
- Main and simulation apps keep module-level exported state objects in `apps/main/modules/state.js` and `apps/simulation/modules/state.js`.
- Controllers mutate state directly and then trigger render/update functions, as in `apps/simulation/modules/ui-controller.js`.
- Preserve this pattern for existing app modules; introduce new shared state only through the relevant `state.js` module.

**DOM Patterns:**
- Use data attributes and event delegation for dynamic UI controls, as in `apps/simulation/modules/ui-controller.js` with `[data-strategy-card]` and `[data-advanced-assumptions-close]`.
- Use `hidden`, ARIA attributes, and class toggles for UI state. Examples: `dom.step1SyncBanner.hidden`, `aria-selected`, and `.is-active` in `apps/simulation/modules/ui-controller.js`.
- Use `document.createElement` and helper functions for programmatic DOM construction in legacy modules such as `apps/main/modules/financial-modal-controller.js`.

---

*Convention analysis: 2026-06-23*
