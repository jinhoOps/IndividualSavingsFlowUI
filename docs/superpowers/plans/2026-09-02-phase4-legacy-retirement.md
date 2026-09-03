# Phase 4 Legacy Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the retired Main/runtime/storage implementation and compatibility fields while preserving atomic, one-way conversion of supported workspace v1/v2 records and format-v1 backups into a single current workspace v3 record.

**Architecture:** Current code reads and writes only the strict workspace-v3 contract at `isf-workspace-v3`. A quarantined pure converter recognizes the exact historical v1/v2 shapes, validates all retained slices and references, drops fields with no approved current meaning, and returns a validated v3 value. The browser repository uses the retired v1 lock only while snapshotting an absent-v3 migration source, commits through the v3 lock, never mutates the v1 bytes, and never falls back when v3 exists but is invalid.

**Tech Stack:** TypeScript 5.5, React 19, Vite 5, Vitest 4, Playwright 1.60, browser `localStorage`, Web Locks API with bakery-lock fallback.

**Spec:** [Phase 4 Legacy Retirement Design](../specs/2026-09-02-phase4-legacy-retirement-design.md)

## Global Constraints

- Preserve Main ownership of the five monthly amounts; Simulation, Portfolio, and Account Map remain read-only consumers of that slice.
- Account Map may write only `locations` and current `accountMap`; Portfolio remains aggregate-only.
- Treat `isf-workspace-v1` as immutable rollback evidence. Do not delete, rewrite, normalize, or merge it after v3 exists.
- Treat an invalid `isf-workspace-v3` value as current corruption. Do not hide it by loading v1.
- Do not read, write, migrate, or delete retired standalone keys such as `isf-main-v1`, `isf-main-v2`, `isf-rebuild-v1`, or `isf-journey-snapshot-v1`.
- Retain `shared/brand/mainBrandGeometry.js`; it is a current branding dependency, not a legacy runtime.
- Keep historical specs and plans unchanged. Only current-state documents receive final-state updates.
- Before every task, run `git status --short`; preserve unrelated user or worker changes.
- Use `apply_patch` for edits and commit only the files named by the task.
- Use `.codegraph/` only where it already exists and is usable. Do not initialize or rebuild it from this worktree.

---

### Task 1: Establish route-closure and retired-storage evidence before deletion

**Files:**

- Create: `tests/unit/journey/supportedRouteClosure.test.ts`
- Create: `tests/unit/journey/fixtures/routeClosure/ast/entry.ts`
- Create: `tests/unit/journey/fixtures/routeClosure/ast/runtime.js`
- Create: `tests/unit/journey/fixtures/routeClosure/ast/styles.css`
- Create: `tests/unit/journey/fixtures/routeClosure/ast/type-only.ts`
- Create: `tests/unit/journey/fixtures/routeClosure/canonical/apps/main/index.html`
- Create: `tests/unit/journey/fixtures/routeClosure/canonical/apps/main/entry.js`
- Create: `tests/unit/journey/fixtures/routeClosure/canonical/apps/main/app.js`
- Create: `tests/unit/journey/fixtures/routeClosure/canonical/apps/main/styles.css`
- Rename: `tests/main-compat.spec.ts` → `tests/retired-storage-isolation.spec.ts`
- Delete after migration: `tests/unit/portfolio/legacyIsolation.test.ts`
- Delete after migration: `tests/unit/portfolio/fixtures/legacyIsolation/**`
- Create: `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`

**Interfaces:**

- Consume the five Vite inputs: `/index.html`, `apps/main/index.html`, `apps/simulation/index.html`, `apps/portfolio/index.html`, and `apps/account-map/index.html`.
- Produce `readSupportedRouteClosure(projectRoot: string): Promise<Map<string, string>>` inside the test file.
- Produce a checked disposition table with columns `legacy case`, `supported behavior`, `replacement evidence`, and `disposition`.

- [ ] **Step 1: Write the generalized failing route-closure test**

Move the TypeScript-AST import walker from the Portfolio-only test into the journey-level test, then make the supported-route assertion cover all five inputs. Declare exact forbidden files, directories, and runtime tokens:

```ts
const supportedEntries = [
  'index.html',
  'apps/main/index.html',
  'apps/simulation/index.html',
  'apps/portfolio/index.html',
  'apps/account-map/index.html',
] as const;

const forbiddenFiles = [
  'apps/main/app.js',
  'apps/main/styles.css',
  'shared/legacy/sw.js',
] as const;

const forbiddenDirectories = [
  'apps/main/modules',
  'shared/components',
  'shared/storage',
  'shared/pwa',
  'shared/core',
  'shared/styles',
] as const;

const forbiddenRuntimeTokens = [
  'CompatibilityBridge',
  'IsfStore',
  'isf-rebuild-v1',
  'window.ISF',
] as const;
```

Retain the synthetic AST tests proving side-effect imports and CSS imports are followed and type-only imports are ignored. Replace the fixture's Portfolio path with Main so the detector proves it catches the largest retired graph.

- [ ] **Step 2: Run the focused unit test and confirm the evidence gap**

Run:

```bash
npx vitest run tests/unit/journey/supportedRouteClosure.test.ts
```

Expected: the test fails until the new fixture paths and all five route expectations are wired correctly. It must not fail merely because retired files exist outside the supported route closure.

- [ ] **Step 3: Complete the route scanner and remove the superseded Portfolio-only scanner**

Implement `readSupportedRouteClosure` by calling the existing `readRouteAssets` logic for each supported HTML input and merging the returned maps. Assert that `shared/brand/mainBrandGeometry.js` is allowed when reached from current Main code.

- [ ] **Step 4: Narrow the browser storage-isolation suite**

Keep the first two current-behavior tests from `tests/main-compat.spec.ts` and delete the sanitizer/Sankey test that imports retired Main modules. At this evidence-only gate, retain the existing workspace-v1 expectation; Task 3 changes the same test to assert the v3 write and immutable v1 source after the repository implementation exists. The standalone stored values must be compared byte-for-byte:

```ts
await expect.poll(() => page.evaluate(() => ({
  mainV1: localStorage.getItem('isf-main-v1'),
  mainV2: localStorage.getItem('isf-main-v2'),
  rebuildV1: localStorage.getItem('isf-rebuild-v1'),
  journeyV1: localStorage.getItem('isf-journey-snapshot-v1'),
}))).toEqual(retiredRaw);
```

- [ ] **Step 5: Record every active and skipped `step1` case**

In the evidence file, enumerate each `test(` and `test.skip(` title in `tests/step1.spec.ts`. Map supported Main setup, restart/cancel, cashflow overflow, responsive width, Account Map navigation, and tooltip behavior to their current owning suites. Mark sanitizer, Sankey, household-budget, Financial Detail Modal, preset, and old renderer behavior `retired by approved spec; no replacement`.

Verify the table has the same row count as:

```bash
rg -n "test(?:\.skip)?\(" tests/step1.spec.ts
```

- [ ] **Step 6: Run focused evidence tests**

Run:

```bash
npx vitest run tests/unit/journey/supportedRouteClosure.test.ts
npx playwright test tests/retired-storage-isolation.spec.ts --reporter=list
git diff --check
```

Expected: the route test and both standalone-key isolation cases pass with no skips.

- [ ] **Step 7: Commit the evidence gate**

```bash
git add tests/unit/journey tests/retired-storage-isolation.spec.ts tests/unit/portfolio/legacyIsolation.test.ts tests/unit/portfolio/fixtures/legacyIsolation docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md tests/main-compat.spec.ts
git commit -m "test: establish phase 4 retirement evidence"
```

---

### Task 2: Introduce the strict workspace-v3 domain and pure retired converter

**Files:**

- Modify: `src/account-map/domain/model.ts`
- Modify: `src/account-map/domain/commands.ts`
- Modify: `src/account-map/application/bootstrap.ts`
- Modify: `src/account-map/application/reducer.ts`
- Modify: `src/account-map/domain/editIntent.ts`
- Modify: `src/account-map/infrastructure/accountMapRepository.ts`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/AccountMapManagementMenu.tsx`
- Modify: `src/account-map/ui/AccountMapSetup.tsx`
- Modify: `src/portfolio/domain/model.ts`
- Modify: `src/portfolio/domain/validation.ts`
- Modify: `src/portfolio/infrastructure/portfolioRepository.ts`
- Modify: `src/workspace/domain/model.ts`
- Modify: `src/workspace/domain/validation.ts`
- Delete: `src/workspace/domain/migration.ts`
- Create: `src/workspace/infrastructure/retiredWorkspaceMigration.ts`
- Modify: `src/workspace/infrastructure/workspaceRepository.ts`
- Modify: `src/workspace/infrastructure/workspaceBackup.ts`
- Rename: `tests/unit/workspace/migration.test.ts` → `tests/unit/workspace/retiredWorkspaceMigration.test.ts`
- Modify: `tests/unit/workspace/validation.test.ts`
- Modify: `tests/unit/workspace/workspaceBackup.test.ts`
- Modify: `tests/unit/account-map/AccountMapApp.test.tsx`
- Modify: `tests/unit/account-map/AccountMapSetup.test.tsx`
- Modify: `tests/unit/account-map/accountMapRepository.test.ts`
- Modify: `tests/unit/account-map/bootstrap.test.ts`
- Modify: `tests/unit/account-map/commands.test.ts`
- Modify: `tests/unit/account-map/editIntent.test.ts`
- Modify: `tests/unit/account-map/mainSourceRepository.test.ts`
- Modify: `tests/unit/account-map/reducer.test.ts`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/unit/portfolio/mainSourceRepository.test.ts`
- Modify: `tests/unit/portfolio/portfolioRepository.test.ts`
- Modify: `tests/unit/workspace/locationCommands.test.ts`
- Modify workspace fixtures in: `tests/unit/main/MainApp.test.tsx`, `tests/unit/main/mainBackupCommands.test.ts`, `tests/unit/main/mainRepository.test.ts`, `tests/unit/simulation/SimulationApp.test.tsx`, `tests/unit/simulation/mainSourceRepository.test.ts`, `tests/unit/simulation/simulationRepository.test.ts`

**Interfaces:**

- Produce `WORKSPACE_SCHEMA_VERSION = 3`, `WORKSPACE_STORAGE_KEY = 'isf-workspace-v3'`, and `RETIRED_WORKSPACE_STORAGE_KEY = 'isf-workspace-v1'`.
- Produce current `WorkspaceDocument` with `accountMap: { applied; draft }` only.
- Produce `ACCOUNT_MAP_APPLIED_SCHEMA_VERSION = 2` and `AccountMapApplied` without `layout`.
- Produce aggregate-only `PortfolioScope = { type: 'aggregate' }`.
- Produce `convertRetiredWorkspaceDocument(value: unknown, migratedAt: number): RetiredWorkspaceConversionResult`.
- Retain `parseWorkspaceDocument(value: unknown): WorkspaceDocument | null` as a strict v3-only parser.
- Retain `validateWorkspaceDocument(value: unknown): WorkspaceDocumentValidationResult` with `valid`, `schema`, and `reference` outcomes for current backup error classification.
- Produce backup format v2 export and format-v1 import through the pure retired converter without writing storage.

- [ ] **Step 1: Write failing v3 and converter tests**

Add tests proving:

```ts
expect(parseWorkspaceDocument(createEmptyWorkspace(100))).toMatchObject({
  schemaVersion: 3,
  accountMap: { applied: null, draft: null },
});

expect(parseWorkspaceDocument({
  ...createEmptyWorkspace(100),
  accountMap: { applied: null, draft: null, legacyPhaseA: { instruments: [], flows: [] } },
})).toBeNull();
```

For exact retired v1 and v2 fixtures, assert the converter preserves Main, upgraded Simulation, locations, current custom purposes/links, and the aggregate Portfolio record while dropping Phase A values, `layout`, and every location-scoped plan/draft. Add rejection cases for unknown workspace, Account Map, Portfolio, and Simulation versions; invalid retained references; duplicate identifiers; and future timestamps.

Also add pure backup tests proving current export emits `formatVersion: 2` with workspace v3, format-v1 v1/v2 fixtures convert through the same function, and format-v2 rejects any non-v3 workspace.

```ts
expect(JSON.parse(exportWorkspaceBackup(createEmptyWorkspace(100), 200))).toMatchObject({
  format: 'isf-workspace-backup',
  formatVersion: 2,
  exportedAt: 200,
  workspace: { schemaVersion: 3 },
});

expect(() => importWorkspaceBackup(JSON.stringify({
  format: 'isf-workspace-backup',
  formatVersion: 2,
  exportedAt: 200,
  workspace: retiredWorkspaceV2,
}))).toThrow('backup-schema');
```

- [ ] **Step 2: Run the pure tests and confirm failure**

Run:

```bash
npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts
```

Expected: failures show schema 2, compatibility fields, and location scope are still accepted.

- [ ] **Step 3: Define the current-only contracts**

Use these exact current shapes:

```ts
export const WORKSPACE_SCHEMA_VERSION = 3 as const;
export const WORKSPACE_STORAGE_KEY = 'isf-workspace-v3';
export const RETIRED_WORKSPACE_STORAGE_KEY = 'isf-workspace-v1';

export interface WorkspaceDocument extends WorkspaceSlices {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  accountMap: {
    applied: AccountMapApplied | null;
    draft: AccountMapDraft | null;
  };
}
```

Use `AccountMapApplied.schemaVersion: 2` with no layout member. Keep the draft schema at version 1 because its persisted shape is unchanged. Define Portfolio scope as:

```ts
export type PortfolioScope = { type: 'aggregate' };

export function scopeKey(_scope: PortfolioScope): 'aggregate' {
  return 'aggregate';
}
```

Current validators must use exact-key checks and reject every retired field rather than ignoring it.

- [ ] **Step 4: Isolate historical shapes inside the converter**

Move all historical v1/v2 interfaces and parsing helpers out of `model.ts` and `validation.ts` into `retiredWorkspaceMigration.ts`. Do not export historical document types. Export only:

```ts
export type RetiredWorkspaceConversionResult =
  | {
      status: 'converted';
      sourceVersion: 1 | 2;
      workspace: WorkspaceDocument;
      simulationMigration: SimulationDraftMigration | null;
    }
  | { status: 'invalid'; reason: 'schema' | 'reference' };

export function convertRetiredWorkspaceDocument(
  value: unknown,
  migratedAt: number,
): RetiredWorkspaceConversionResult;
```

Build a new object field-by-field; never `structuredClone` the historical envelope into current state. Finish by passing the candidate through `parseWorkspaceDocument`. Filter Portfolio values before current parsing:

```ts
const aggregatePlans = retiredPortfolio.plans.filter(
  (plan) => plan.scope.type === 'aggregate',
);
const aggregateDraft = retiredPortfolio.draft?.scope.type === 'aggregate'
  ? retiredPortfolio.draft
  : null;
```

Convert applied Account Map schema 1 to schema 2 by retaining `sourceMainUpdatedAt`, `customPurposes`, `links`, `setupCompletedAt`, and `updatedAt` only.

- [ ] **Step 5: Advance the pure backup envelope and import dispatch**

Set `WorkspaceBackupEnvelope.formatVersion` to 2. Keep the existing public export/import signatures. Format-v2 import must call strict `parseWorkspaceDocument`; format-v1 import must call `convertRetiredWorkspaceDocument(value.workspace, value.exportedAt)`. Preserve the existing `backup-reference` versus `backup-schema` error contract without constructing or writing partial state:

```ts
if (value.formatVersion === 2) {
  const current = validateWorkspaceDocument(value.workspace);
  if (current.status !== 'valid') {
    throw new Error(current.status === 'reference' ? 'backup-reference' : 'backup-schema');
  }
  return current.workspace;
}
if (value.formatVersion === 1) {
  const retired = convertRetiredWorkspaceDocument(value.workspace, value.exportedAt);
  if (retired.status === 'invalid') {
    throw new Error(retired.reason === 'reference' ? 'backup-reference' : 'backup-schema');
  }
  return retired.workspace;
}
throw new Error('backup-format');
```

- [ ] **Step 6: Remove retired consumers from current code**

Delete `hasLegacy`, the management-menu compatibility message, layout construction, legacy preservation equality, and location-scope branches. Current Account Map applied creation must be:

```ts
const applied: AccountMapApplied = {
  schemaVersion: 2,
  sourceMainUpdatedAt: main.updatedAt,
  customPurposes,
  links,
  setupCompletedAt: now,
  updatedAt: now,
};
```

Update all named test fixtures to v3 and remove `legacyPhaseA`/`layout`. Retired shapes may remain only as inline migration fixtures in `retiredWorkspaceMigration.test.ts`.

Replace the deleted domain-migration imports in `workspaceRepository.ts` with the strict v3 parser so this commit type-checks without a legacy shim. At this stage, `load()` reads only the current v3 key and reports no source migration; Task 3 adds the approved read-only v1 fallback, dual lock ordering, and rollback behavior before the branch can be integrated. Do not duplicate the converter or retain an old `migration.ts` forwarding module.

- [ ] **Step 7: Run the domain and consumer tests**

Run:

```bash
npx vitest run \
  tests/unit/workspace/retiredWorkspaceMigration.test.ts \
  tests/unit/workspace/validation.test.ts \
  tests/unit/workspace/workspaceBackup.test.ts \
  tests/unit/workspace/locationCommands.test.ts \
  tests/unit/account-map \
  tests/unit/portfolio \
  tests/unit/main/MainApp.test.tsx \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/main/mainRepository.test.ts \
  tests/unit/simulation
npm run check:source
npm run check:unit
```

Expected: all tests pass; current source outside `retiredWorkspaceMigration.ts` and its focused fixtures contains no `legacyPhaseA`, applied `layout`, or `scope.type === 'location'` branch.

- [ ] **Step 8: Commit the v3 domain and backup gate**

```bash
git add \
  src/account-map \
  src/portfolio \
  src/workspace/domain \
  src/workspace/infrastructure/retiredWorkspaceMigration.ts \
  src/workspace/infrastructure/workspaceRepository.ts \
  src/workspace/infrastructure/workspaceBackup.ts \
  tests/unit/workspace/migration.test.ts \
  tests/unit/workspace/retiredWorkspaceMigration.test.ts \
  tests/unit/workspace/validation.test.ts \
  tests/unit/workspace/workspaceBackup.test.ts \
  tests/unit/workspace/locationCommands.test.ts \
  tests/unit/account-map \
  tests/unit/portfolio \
  tests/unit/main/MainApp.test.tsx \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/main/mainRepository.test.ts \
  tests/unit/simulation
git commit -m "refactor: define workspace v3 migration contract"
```

---

### Task 3: Move browser persistence to v3 with non-destructive v1 conversion locks

**Files:**

- Modify: `src/workspace/infrastructure/workspaceSaveLock.ts`
- Modify: `src/workspace/infrastructure/workspaceRepository.ts`
- Modify: `tests/unit/workspace/workspaceSaveLock.test.ts`
- Modify: `tests/unit/workspace/workspaceRepository.test.ts`
- Modify: `tests/unit/main/mainRepository.test.ts`
- Modify: `tests/unit/simulation/simulationRepository.test.ts`
- Modify: `tests/unit/portfolio/mainSourceRepository.test.ts`
- Modify: `tests/unit/portfolio/portfolioRepository.test.ts`
- Modify: `tests/unit/account-map/mainSourceRepository.test.ts`
- Modify: `tests/unit/account-map/accountMapRepository.test.ts`
- Modify: `tests/retired-storage-isolation.spec.ts`

**Interfaces:**

- Produce `WorkspaceSaveLockNamespace` with current and retired constants.
- Extend `WorkspaceSaveLeaseOptions` with `namespace?: WorkspaceSaveLockNamespace` without breaking existing injected lock tests.
- Extend `BrowserWorkspaceRepositoryOptions` with `retiredSaveLock?: WorkspaceSaveLock`.
- Keep the public `WorkspaceRepository` method signatures unchanged.

- [ ] **Step 1: Write failing lock namespace tests**

Add tests that capture calls to `navigator.locks.request` and fallback storage keys:

```ts
expect(requestedNames).toEqual(['isf-workspace-v3-save']);
expect([...storage.keys()]).toContainEqual(
  expect.stringMatching(/^isf-workspace-v3-save-lease:/),
);
```

Instantiate a second lock with the retired namespace and assert it uses only `isf-workspace-v1-save` and `isf-workspace-v1-save-lease:`.

- [ ] **Step 2: Write failing repository migration and rollback tests**

Cover all of these transitions:

- v3 present and valid: read v3 only, even when v1 changes later;
- v3 present and invalid: return `invalid` and never read/fallback to v1;
- v3 absent plus valid v1/v2 source: return converted v3 with `needsMigration: true`;
- migration success: v1 raw remains byte-for-byte identical and v3 is written/read back;
- conversion rejection or v3 write failure: v1 unchanged and no accepted partial v3;
- concurrent retired source mutation: conversion occurs under the retired lock, then the v3 commit occurs under the current lock;
- post-migration old-tab v1 write: subsequent loads and updates keep v3 canonical;
- reset-invalid changes only invalid v3 and never touches v1 or standalone keys;
- stale revision still returns `conflict`.

Use recording locks to assert nesting order:

```ts
expect(events).toEqual([
  'retired:enter',
  'current:enter',
  'current:exit',
  'retired:exit',
]);
```

- [ ] **Step 3: Run focused tests and confirm failures**

Run:

```bash
npx vitest run tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts
```

Expected: current code still uses the v1 key/lock, falls through a single-key load path, and cannot satisfy immutable-source assertions.

- [ ] **Step 4: Parameterize save-lock namespaces**

Implement:

```ts
export interface WorkspaceSaveLockNamespace {
  lockName: string;
  leasePrefix: string;
}

export const CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE = {
  lockName: 'isf-workspace-v3-save',
  leasePrefix: 'isf-workspace-v3-save-lease:',
} satisfies WorkspaceSaveLockNamespace;

export const RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE = {
  lockName: 'isf-workspace-v1-save',
  leasePrefix: 'isf-workspace-v1-save-lease:',
} satisfies WorkspaceSaveLockNamespace;
```

Derive `workspaceSaveLeaseKey`, lease enumeration, and Web Lock calls from the injected namespace. Default to current v3.

- [ ] **Step 5: Implement strict precedence and guarded conversion**

Repository `load()` must inspect `WORKSPACE_STORAGE_KEY` first. If raw v3 exists, parse with `parseWorkspaceDocument` and return invalid on any failure. Only if v3 is exactly absent may it read `RETIRED_WORKSPACE_STORAGE_KEY` and call `convertRetiredWorkspaceDocument`.

Construct the default retired lock from the same storage:

```ts
this.retiredSaveLock = options.retiredSaveLock
  ?? new BrowserWorkspaceSaveLock(storageOverride, {
    ...options.saveLeaseOptions,
    namespace: RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
  });
```

When `update`, `replace`, or `migrate` starts without v3 but with a retired source, run under retired lock, re-read and convert the source, then acquire the current lock and re-check that v3 is still absent before the guarded write. All restoration logic targets v3 only.

- [ ] **Step 6: Update consumer repositories and browser isolation**

Update named fixtures and assertions from `isf-workspace-v1` to `isf-workspace-v3` where they represent current state. Keep old-key values only in tests explicitly exercising conversion or untouched-key isolation. Change `retired-storage-isolation.spec.ts` so the Main edit writes v3 while v1 and standalone raw strings remain unchanged.

- [ ] **Step 7: Run repository and cross-product tests**

Run:

```bash
npx vitest run \
  tests/unit/workspace/workspaceSaveLock.test.ts \
  tests/unit/workspace/workspaceRepository.test.ts \
  tests/unit/main/mainRepository.test.ts \
  tests/unit/simulation/simulationRepository.test.ts \
  tests/unit/portfolio/mainSourceRepository.test.ts \
  tests/unit/portfolio/portfolioRepository.test.ts \
  tests/unit/account-map/mainSourceRepository.test.ts \
  tests/unit/account-map/accountMapRepository.test.ts
npx playwright test tests/retired-storage-isolation.spec.ts --reporter=list
npm run check
```

Expected: all tests pass with zero skipped cases in the isolation suite.

- [ ] **Step 8: Commit the storage gate**

```bash
git add src/workspace/infrastructure tests/unit/workspace tests/unit/main/mainRepository.test.ts tests/unit/simulation/simulationRepository.test.ts tests/unit/portfolio tests/unit/account-map tests/retired-storage-isolation.spec.ts
git commit -m "feat: migrate workspace storage to v3"
```

---

### Task 4: Make Main import atomic and remove retired-key startup mutation

**Files:**

- Modify: `src/main/application/mainBackupCommands.ts`
- Modify: `src/main/ui/useMainBackupController.ts`
- Modify: `tests/unit/main/mainBackupCommands.test.ts`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/main-react.spec.ts`
- Modify: `src/main/main.tsx`
- Delete: `src/main/infrastructure/retiredStorage.ts`
- Delete: `tests/unit/main/retiredStorage.test.ts`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**

- Consume the pure format-v1/v2 importer completed in Task 2.
- Keep import confirmation and focus-return behavior unchanged.
- Remove the `purgeRetiredJourneyStorage` call/module so old standalone storage is never mutated.

- [ ] **Step 1: Write failing atomic Main import tests**

Seed a valid current v3 raw string, attempt each invalid old/current import, cancel confirmation once, and simulate repository replacement failure. After each case assert the current raw bytes and all retired keys are unchanged. On success assert only v3 changes and imported data is visible.

- [ ] **Step 2: Write a failing no-touch startup assertion**

In `app-journey.spec.ts`, seed `isf-journey-snapshot-v1` with a sentinel before opening Main and assert it remains byte-for-byte unchanged after startup and one current edit.

- [ ] **Step 3: Run focused tests and confirm failures**

Run:

```bash
npx vitest run tests/unit/main/mainBackupCommands.test.ts tests/unit/main/MainApp.test.tsx
npx playwright test tests/app-journey.spec.ts --grep "retired|legacy|standalone" --reporter=list
```

Expected: the new invalid-import preservation assertions pass against the already-guarded command path; the retired snapshot sentinel fails because Main still deletes it. If an import preservation assertion fails, fix that regression in Step 4 before continuing.

- [ ] **Step 4: Complete atomic Main import and delete the purge**

Parse the entire backup into a validated v3 candidate before requesting repository replacement. Keep the current confirmation and error mapping. Remove the retired-storage import/call from `main.tsx`, then delete `retiredStorage.ts` and its unit test. No replacement cleanup function is created.

- [ ] **Step 5: Verify UI confirmation and focus behavior**

Keep current import confirmation, focus return, and the existing user-facing error wording. Update only schema-specific test fixtures. Run:

```bash
npx vitest run tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/mainBackupCommands.test.ts tests/unit/main/MainApp.test.tsx
npx playwright test tests/main-react.spec.ts --grep "백업|가져오기|복원" --reporter=list
npx playwright test tests/app-journey.spec.ts --grep "retired|legacy|standalone" --reporter=list
```

Expected: focused unit and browser tests pass; invalid input performs zero writes.

- [ ] **Step 6: Commit the import and retired-key gate**

```bash
git add src/main/application/mainBackupCommands.ts src/main/ui/useMainBackupController.ts src/main/main.tsx src/main/infrastructure/retiredStorage.ts tests/unit/main/retiredStorage.test.ts tests/unit/main/mainBackupCommands.test.ts tests/unit/main/MainApp.test.tsx tests/main-react.spec.ts tests/app-journey.spec.ts
git commit -m "refactor: finalize current import and retired storage isolation"
```

---

### Task 5: Complete current browser fixtures and supported-behavior replacement coverage

**Files:**

- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/account-map.spec.ts`
- Modify: `tests/portfolio.spec.ts`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/motion-system.spec.ts`
- Modify: `tests/reading-width.spec.ts`
- Modify: `tests/tooltip-contract.spec.ts`
- Modify: `tests/main-react.spec.ts`
- Modify: `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`

**Interfaces:**

- Keep all supported product routes and user-visible workflows unchanged.
- Produce browser fixtures that seed current state only under `isf-workspace-v3`, except explicit migration/isolation cases.

- [ ] **Step 1: Normalize supported E2E fixtures**

Update every named suite's current workspace fixtures to v3. Keep `isf-workspace-v1` only where the test title explicitly says migration, rollback, or retired isolation. Ordinary current-browser fixtures must not seed or assert any standalone retired records (`isf-main-v1`, `isf-main-v2`, `isf-rebuild-v1`, `isf-simulation-compound-v1`, legacy Step 3 keys, or `isf-journey-snapshot-v1`); the dedicated named isolation suites own those negative contracts.

- [ ] **Step 2: Reconcile the legacy test disposition**

For each supported behavior row from Task 1, run the replacement suite and record the exact test title that owns it. Do not copy old module-level assertions into current tests. If a legacy-only visual behavior has no current equivalent (for example merged Sankey line-broken tooltip content), mark it `retired by approved spec; no replacement` rather than citing a superficially related current interaction. If a supported external behavior lacks coverage, add it to the owning current suite before Task 6.

- [ ] **Step 3: Run the affected browser suites**

Run:

```bash
npx playwright test \
  tests/app-journey.spec.ts \
  tests/account-map.spec.ts \
  tests/portfolio.spec.ts \
  tests/simulation.spec.ts \
  tests/motion-system.spec.ts \
  tests/reading-width.spec.ts \
  tests/tooltip-contract.spec.ts \
  tests/retired-storage-isolation.spec.ts \
  --reporter=list
npm run check
```

Expected: all selected tests pass and the retired startup key remains untouched.

- [ ] **Step 4: Commit the consumer cleanup gate**

```bash
git add tests/app-journey.spec.ts tests/account-map.spec.ts tests/portfolio.spec.ts tests/simulation.spec.ts tests/motion-system.spec.ts tests/reading-width.spec.ts tests/tooltip-contract.spec.ts tests/main-react.spec.ts docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md
git commit -m "test: move legacy coverage to supported journeys"
```

---

### Task 6: Delete the unreachable legacy runtime, bridge, assets, and obsolete tests

**Files:**

- Delete: `apps/main/app.js`
- Delete: `apps/main/styles.css`
- Delete: `apps/main/modules/**`
- Delete: `shared/components/**`
- Delete: `shared/storage/**`
- Delete: `shared/pwa/**`
- Delete: `shared/core/**`
- Delete: `shared/styles/**`
- Delete: `shared/legacy/sw.js`
- Retain: `shared/brand/mainBrandGeometry.js`
- Modify: `shared/README.md`
- Delete: `src/core/storage/CompatibilityBridge.ts`
- Delete: `src/core/storage/BackupService.ts`
- Delete: `src/core/storage/IsfStore.ts`
- Delete: `src/core/types/models.ts`
- Delete: `src/core/types/money.ts`
- Retain: `src/core/domain/moneyInput.ts`
- Delete: `tests/unit/core/IsfStore.test.ts`
- Delete: `tests/step1.spec.ts`
- Modify: `scripts/sync-version.js`
- Modify: `package.json`
- Modify: `tests/unit/journey/supportedRouteClosure.test.ts`

**Interfaces:**

- `npm run sync-version` updates only `public/manifest.webmanifest`.
- The npm `version` hook stages only `public/manifest.webmanifest`.
- Current production entry points and brand geometry imports remain unchanged.

- [ ] **Step 1: Make route closure assert physical retirement**

Extend `supportedRouteClosure.test.ts` with an existence check for every deleted root and an explicit retain assertion:

```ts
for (const retiredPath of retiredPaths) {
  await expect(stat(retiredPath)).rejects.toMatchObject({ code: 'ENOENT' });
}
await expect(stat(resolve(projectRoot, 'shared/brand/mainBrandGeometry.js')))
  .resolves.toMatchObject({ isFile: expect.any(Function) });
```

Run the test before deletion and confirm the new retirement assertion fails.

- [ ] **Step 2: Delete only the classified implementation and tests**

Delete the exact paths above. Do not delete `shared/brand` or `src/core/domain`. Rewrite `shared/README.md` as a current-state note that `shared/brand/mainBrandGeometry.js` is the sole cross-entry JavaScript asset and that new shared TypeScript belongs under `src/`.

- [ ] **Step 3: Remove old version-sync targets**

Change `targets` in `scripts/sync-version.js` to contain only:

```js
const targets = [{
  path: 'public/manifest.webmanifest',
  pattern: /"version":\s*"[^"]*"/,
  replacement: `"version": "${version}"`,
}];
```

Change the package hook to:

```json
"version": "npm run sync-version && git add public/manifest.webmanifest"
```

- [ ] **Step 4: Run deletion and source-reference gates**

Run:

```bash
npx vitest run tests/unit/journey/supportedRouteClosure.test.ts
npm run sync-version
npm run check:ci
rg -n --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/evidence/**' \
  "apps/main/(?:app\.js|styles\.css|modules/)|shared/(?:legacy|components|storage|pwa|core|styles)/|CompatibilityBridge|IsfStore|BackupService" \
  .
```

Expected: route and CI checks pass. The search returns no runtime, package, manifest, test-selector, or script reference. Any allowed historical reference must be in an excluded historical/evidence document.

- [ ] **Step 5: Build and inspect generated assets**

Run:

```bash
npm run build
rg -n "apps/main/modules|shared/legacy/sw|CompatibilityBridge|IsfStore|isf-rebuild-v1" dist || true
test -f dist/sw.js
test ! -e dist/apps/main/app.js
test ! -e dist/apps/main/styles.css
```

Expected: build passes; the generated Vite PWA service worker exists; no retired source path or global appears in `dist`.

- [ ] **Step 6: Commit the deletion gate**

```bash
git add -A apps/main shared src/core tests/unit/core tests/step1.spec.ts scripts/sync-version.js package.json tests/unit/journey/supportedRouteClosure.test.ts
git commit -m "refactor: delete retired legacy runtime"
```

---

### Task 7: Align current product, design, and architecture documentation

**Files:**

- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md`
- Modify: `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`

**Interfaces:**

- Current documents state schema v3, key v3, one-way v1/v2 converter, immutable v1 rollback source, aggregate-only Portfolio, and no Account Map layout/legacy status UI.
- Historical execution documents remain untouched.
- Repository-wide refactor status marks Phases 2–4 complete only after the code gates and their verification evidence exist.

- [ ] **Step 1: Search current-state contradictions**

Run:

```bash
rg -n "schema v?2|isf-workspace-v1|legacyPhaseA|location-scoped|layout|Phase 4|레거시" \
  README.md DESIGN.md \
  docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md \
  docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md
```

Classify each hit as current contract, migration/rollback contract, or obsolete claim.

- [ ] **Step 2: Update canonical current-state text**

Document these exact boundaries:

- current persistence is workspace schema/key v3;
- a valid retired workspace v1/v2 source is read only when v3 is absent;
- successful conversion never mutates the retired source;
- current exports are backup format v2; format v1 imports use the converter;
- Portfolio current state is aggregate-only;
- Account Map current state has no layout preference or legacy Phase A payload;
- old standalone stores and the retired journey snapshot are untouched foreign records;
- Vite PWA owns the deployed service worker;
- `shared/brand/mainBrandGeometry.js` is the only retained file from the former shared browser tree.

- [ ] **Step 3: Finalize evidence status**

Add the final replacement test names, deletion commit, reference-search command/results, and remaining allowed historical/migration fixture references to the evidence file. Do not claim final verification until Task 8 runs.

- [ ] **Step 4: Verify documentation**

Run:

```bash
node -e "const fs=require('fs'); for (const f of ['README.md','DESIGN.md','docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md','docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md']) { const s=fs.readFileSync(f,'utf8'); for (const m of s.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) { if (!m[1].includes('://')) { const p=require('path').resolve(require('path').dirname(f),m[1]); if (!fs.existsSync(p)) throw new Error(`${f}: missing ${m[1]}`); } } }"
git diff --check
```

Expected: relative links resolve and whitespace verification passes.

- [ ] **Step 5: Commit current-state documentation**

```bash
git add README.md DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md
git commit -m "docs: record phase 4 legacy retirement"
```

---

### Task 8: Perform final reference audit, responsive QA, and repository verification

**Files:**

- Modify: `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md` only to append the exact final command outputs and review disposition.
- No implementation changes are permitted without returning to the owning task and adding a regression test first.

**Interfaces:**

- Produce fresh command evidence for type checks, unit tests, full E2E, production build, route closure, storage/legacy reference scans, and responsive import/recovery UI.
- Produce a clean final worktree except for intentional build/version outputs already tracked by the repository workflow.

- [ ] **Step 1: Audit runtime and storage references**

Run:

```bash
rg -n --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/evidence/**' \
  "legacyPhaseA|apps/main/(?:app\.js|styles\.css|modules/)|shared/(?:legacy|components|storage|pwa|core|styles)/|CompatibilityBridge|IsfStore|BackupService|isf-journey-snapshot-v1" \
  src apps shared scripts tests package.json public README.md DESIGN.md docs/ways-of-work

rg -n "isf-workspace-v1|isf-workspace-v3|isf-workspace-v[13]-save|isf-main-v1|isf-main-v2|isf-rebuild-v1" src tests
```

Expected: the first command has no current runtime/test-selector hits. In the second command, v1 workspace appears only in the converter/repository migration boundary and focused tests; standalone keys appear only in negative untouched-key tests; every current write/notification uses v3.

- [ ] **Step 2: Run focused high-risk suites**

Run:

```bash
npx vitest run \
  tests/unit/journey/supportedRouteClosure.test.ts \
  tests/unit/workspace/retiredWorkspaceMigration.test.ts \
  tests/unit/workspace/validation.test.ts \
  tests/unit/workspace/workspaceSaveLock.test.ts \
  tests/unit/workspace/workspaceRepository.test.ts \
  tests/unit/workspace/workspaceBackup.test.ts \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/portfolio \
  tests/unit/account-map
npx playwright test tests/retired-storage-isolation.spec.ts tests/main-react.spec.ts --reporter=list
```

Expected: all focused tests pass with no undocumented skips.

- [ ] **Step 3: Run the full verification matrix**

Run from a clean working tree:

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
npm run build
git diff --check
```

Expected: every command exits 0. Record exact unit file/test totals, E2E pass/skip totals and reasons, and build output. The former 61 legacy skips must be absent; only approved environment-conditional skips such as PWA capability checks may remain.

- [ ] **Step 4: Verify 390px, 768px, and desktop import/recovery surfaces**

Use the existing Playwright/browser QA path to inspect Main's backup import confirmation, invalid-workspace recovery, and focus return at widths 390, 768, and a desktop viewport. Verify no horizontal overflow, clipped overlay, lost focus indicator, sub-44px touch target, or invisible status. Save screenshots only if the repository's current evidence convention requires them.

- [ ] **Step 5: Self-review against the approved spec**

Read the final diff and verify each acceptance criterion in the design spec has direct evidence. Specifically check:

- no placeholder, `TODO`, temporary `fixme`, broad `any`, or unclassified skip was introduced;
- converter interfaces and call sites use the same exact names and versions;
- current validators reject retired fields rather than silently stripping them;
- v1 raw preservation is byte-for-byte tested across success and failure;
- invalid v3 never falls back;
- imported data is validated completely before replacement;
- current app ownership boundaries remain intact;
- rollback limits are documented accurately rather than promising cross-version merging.

- [ ] **Step 6: Commit final evidence only if it changed**

```bash
git add docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md
git commit -m "test: record phase 4 verification evidence"
```

If the evidence file did not change, do not create an empty commit.

- [ ] **Step 7: Hand off for code review and integration**

Use `superpowers:requesting-code-review` against the full Phase 4 commit range. If review findings require code changes, use `superpowers:receiving-code-review`, add a reproducing test in the owning task's suite, re-run the affected and final verification, and create a focused fix commit. Only after fresh verification passes use `superpowers:finishing-a-development-branch` to choose local merge, PR, or branch retention.
