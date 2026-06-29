# Coding Conventions

**Analysis Date:** 2026-06-29

## Naming Patterns

**Files:**
- Use lowercase kebab-case for legacy browser modules under `apps/` and `shared/`, such as `apps/main/modules/input-sanitizer.js`, `apps/main/modules/financial-modal-controller.js`, `shared/core/clipboard-parser.js`, and `shared/storage/hub-storage.js`.
- Use PascalCase for TypeScript classes and React components under `src/`, such as `src/core/storage/BackupService.ts`, `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, and `src/components/common/Toast.tsx`.
- Use entry-point filenames by step under `src/entries/`, such as `src/entries/step1.ts`, `src/entries/step2.ts`, and `src/entries/step3.ts`.
- Use `.spec.ts` for Playwright tests in `tests/`, such as `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Avoid adding new ad hoc `.test.js` scripts like `shared/core/clipboard-parser.test.js`; it is outside the configured Playwright test directory in `playwright.config.ts`.

**Functions:**
- Use camelCase for functions and methods, such as `sanitizeInputs` in `apps/main/modules/input-sanitizer.js`, `createFinancialModalController` in `apps/main/modules/financial-modal-controller.js`, `formatCurrency` in `apps/main/modules/formatters.js`, and `createBackup` in `src/core/storage/BackupService.ts`.
- Use `create*Controller` factory names for stateful UI controller modules, such as `createPersistenceController` in `apps/main/modules/persistence-controller.js`, `createRenderOrchestrator` in `apps/main/modules/render-orchestrator.js`, `createVisualizationController` in `apps/main/modules/visualization-controller.js`, and `createFinancialModalController` in `apps/main/modules/financial-modal-controller.js`.
- Use `sanitize*`, `normalize*`, `format*`, and `build*` prefixes for pure or mostly pure transformation helpers, such as `sanitizeAllocationItems`, `normalizeMaturityMonth`, `formatSankeyDisplayValue`, and `buildAllocationMetaText` in `apps/main/modules/input-sanitizer.js` and `apps/main/modules/formatters.js`.
- Use predicate names beginning with `is*` or `has*`, such as `isVariableExpenseItem`, `isTemporaryItem`, `isOutflowMode`, `hasDraftChanges`, and `hasActiveUnsavedDraft` in `apps/main/modules/input-sanitizer.js` and `apps/main/modules/financial-modal-controller.js`.

**Variables:**
- Use camelCase for local values and object fields, such as `safeAmount`, `annualSavingsYield`, `surplusTransferAccountId`, `pendingBarHideTimer`, and `selectedAdjustmentBasis` in `apps/main/modules/input-sanitizer.js` and `apps/main/modules/financial-modal-controller.js`.
- Use UPPER_SNAKE_CASE for module constants, such as `MAX_BACKUPS`, `AUTO_BACKUP_INTERVAL_MS`, `CATEGORY_CONFIG`, `DETAIL_TABS`, `OUTFLOW_CATEGORIES`, `INTEGRATED_CATEGORIES`, and `CLOSE_CONFIRM_MESSAGE` in `src/core/storage/BackupService.ts` and `apps/main/modules/financial-modal-controller.js`.
- Use `safe*`, `raw*`, and `normalized*` names when validating external or user-provided data, as seen in `safeItem`, `rawAllocs`, `normalizedItem`, and `normalizedGroup` in `apps/main/modules/input-sanitizer.js`.
- Use `dom.*` references from `apps/main/modules/dom.js` for stable DOM handles in controllers such as `apps/main/modules/persistence-controller.js` and `apps/main/modules/financial-modal-controller.js`.

**Types:**
- TypeScript types and interfaces use PascalCase, such as `BackupEntry` in `src/core/types/models.ts`, `Props` in `src/components/common/Toast.tsx`, and storage classes in `src/core/storage/BackupService.ts`.
- Existing Playwright tests use `// @ts-nocheck` in `tests/step1.spec.ts` and `tests/step2.spec.ts`; new tests should prefer explicit Playwright types from `@playwright/test` instead of expanding this pattern.
- JavaScript modules in `apps/` and `shared/` are untyped ES modules and rely on runtime guards and sanitizers, such as `apps/main/modules/input-sanitizer.js` and `shared/core/clipboard-parser.js`.

## Code Style

**Formatting:**
- No Prettier, ESLint, or Biome configuration is present at `.prettierrc`, `.eslintrc*`, `eslint.config.*`, or `biome.json`.
- `package.json` maps both `check` and `lint` to `tsc --noEmit`; style enforcement is TypeScript checking only.
- Use semicolons consistently in new code, matching `apps/main/modules/input-sanitizer.js`, `apps/main/modules/financial-modal-controller.js`, `src/core/storage/BackupService.ts`, and `tests/step2.spec.ts`.
- Match the local quote style of the file being edited: many legacy `apps/main/modules/*.js` files use double quotes, while `src/*.ts`, `tests/*.spec.ts`, and older `shared/core/clipboard-parser.js` use single quotes.
- Prefer two-space indentation in JavaScript, TypeScript, TSX, and Playwright test files, matching `apps/main/modules/input-sanitizer.js`, `src/components/common/Toast.tsx`, and `tests/step2.spec.ts`.
- Keep trailing commas in multiline objects and arrays where the surrounding file uses them, such as `apps/main/modules/persistence-controller.js`, `vite.config.ts`, and `tests/step2.spec.ts`.

**Linting:**
- `npm run lint` runs `tsc --noEmit` from `package.json`; it validates TypeScript and JavaScript included by `tsconfig.json`.
- `tsconfig.json` sets `strict: true`, `allowJs: true`, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`, and `noEmit: true`.
- `tsconfig.json` includes only `src`, `apps`, and `shared`; `tests/` is not included in the TypeScript check.
- Use `npm run check` or `npm run lint` before completing source changes because both commands exercise the same compiler gate from `package.json`.

## Import Organization

**Order:**
1. External packages first, as in `vite.config.ts` importing `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `@tailwindcss/vite`, `path`, and then `package.json`.
2. Shared cross-app modules next, usually via relative paths to `shared/`, such as `../../../shared/core/utils.js` in `apps/main/modules/financial-modal-controller.js` and `../../shared/core/utils.js` in `src/entries/step1.ts`.
3. Same-feature local modules last, such as `./constants.js`, `./dom.js`, `./state.js`, and `./input-sanitizer.js` in `apps/main/modules/bootstrap-controller.js` and `apps/main/modules/event-bindings.js`.
4. Side-effect style and bootstrap imports are grouped in step entries, such as `src/entries/step1.ts`, `src/entries/step2.ts`, and `src/entries/step3.ts`.

**Path Aliases:**
- `tsconfig.json` defines `@/*` to `./src/*` and `@shared/*` to `./shared/*`, but the observed code primarily uses relative imports in `src/entries/step1.ts`, `apps/main/modules/*.js`, and `shared/core/clipboard-parser.test.js`.
- Prefer existing relative imports when modifying nearby legacy code under `apps/` and `shared/`.
- Use aliases only when adding new TypeScript code where the local file already uses aliases or where long relative paths would reduce clarity.

## Error Handling

**Patterns:**
- Prefer guard clauses for invalid state and optional DOM nodes, such as `if (state.isViewMode) return`, `if (!dom.financialModalPendingBar) return`, and `if (!Array.isArray(items)) return []` in `apps/main/modules/persistence-controller.js`, `apps/main/modules/financial-modal-controller.js`, and `apps/main/modules/input-sanitizer.js`.
- Convert untrusted input through sanitizer functions before persistence or rendering, such as `sanitizeInputs`, `sanitizeAllocationItems`, `sanitizeTransfers`, and `normalizeMaturityMonth` in `apps/main/modules/input-sanitizer.js`.
- Return structured validation errors instead of throwing for user-editable modal state, such as `{ value, error }` from `normalizeMoneyValue` and `{ category, index, message }` from `findFirstValidationError` in `apps/main/modules/financial-modal-controller.js`.
- Catch persistence and import failures close to the UI action and update visible status, such as `persistPrimaryState`, `handleImportJson`, and `initializeBackupStore` in `apps/main/modules/persistence-controller.js`.
- Use `try/finally` when module state flags must be reset after applying URL hash state, as in `handleHashChange` in `apps/main/modules/persistence-controller.js`.
- Throw explicit `Error` objects only in test fakes or lower-level failure simulations, such as `throw new Error('IDB_BLOCKED_SAVE')` in `tests/step2.spec.ts`.

## Logging

**Framework:** console

**Patterns:**
- Production and app modules use `console` sparingly; `src/core/storage/BackupService.ts` logs auto-backup activity with `console.log`.
- Parser errors in `shared/core/clipboard-parser.js` use `console.error` inside a narrow `try/catch` around a pattern mapper.
- The standalone script-style test `shared/core/clipboard-parser.test.js` uses `console.log` for manual PASS/FAIL output; do not use this pattern for new automated coverage.
- Prefer user-visible status helpers over console output for UI workflows, such as `dom.appHeader.updateStatus` in `apps/main/modules/persistence-controller.js` and `window.IsfFeedback.showFeedback` in `apps/main/modules/persistence-controller.js`.

## Comments

**When to Comment:**
- Use comments to explain domain-specific constraints, migration intent, or browser-test timing assumptions, such as the schema note in `src/core/storage/BackupService.ts`, Korean UI-flow comments in `tests/step1.spec.ts`, and SMS pattern comments in `shared/core/clipboard-parser.js`.
- Avoid comments that restate simple code; most app modules rely on descriptive function names and guard clauses, such as `apps/main/modules/input-sanitizer.js` and `apps/main/modules/formatters.js`.
- Keep TODOs actionable and rare; `shared/core/clipboard-parser.js` contains `TODO: Implement fuzzy matching (Levenshtein) if needed`.

**JSDoc/TSDoc:**
- JSDoc is used in plain JavaScript for shared utility contracts, such as `parseSms` and `matchCategory` in `shared/core/clipboard-parser.js`.
- TypeScript files such as `src/core/storage/BackupService.ts` and `src/components/common/Toast.tsx` rely on type annotations instead of JSDoc.

## Function Design

**Size:** Keep new functions focused and prefer extraction when a branch can be named. Existing large controllers such as `apps/main/modules/financial-modal-controller.js` are internally organized with many small local helpers; add new helpers near the state they operate on rather than growing event handlers.

**Parameters:** Use object parameters when a function has optional inputs or is a factory, such as `createFinancialModalController({ persistence, getVisibleInputs, renderAll } = {})` in `apps/main/modules/financial-modal-controller.js` and `createIncomeItem({ id, name, amount, accountId, allocations } = {})` in `apps/main/modules/input-sanitizer.js`.

**Return Values:** Prefer normalized plain objects and arrays from data helpers, such as `sanitizeInputs` returning a full model object in `apps/main/modules/input-sanitizer.js`, `formatSankeyDisplayValue` returning a display string in `apps/main/modules/formatters.js`, and `createBackup` returning `BackupEntry` in `src/core/storage/BackupService.ts`.

## Module Design

**Exports:** Use named exports for JavaScript and TypeScript modules, such as `export function sanitizeInputs` in `apps/main/modules/input-sanitizer.js`, `export function formatCurrency` in `apps/main/modules/formatters.js`, `export class BackupService` and `export const backupService` in `src/core/storage/BackupService.ts`, and `export const ClipboardParser` in `shared/core/clipboard-parser.js`.

**Barrel Files:** Not detected. Imports reference concrete module files directly, such as `apps/main/modules/event-bindings.js`, `apps/main/modules/persistence-controller.js`, `shared/core/utils.js`, and `src/core/storage/CompatibilityBridge.ts`.

---

*Convention analysis: 2026-06-29*
