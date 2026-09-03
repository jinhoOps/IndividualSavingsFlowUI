# Phase 4 Task 2 Report

Date: 2026-09-03

Status: complete

## Outcome

Task 2 establishes the current-only workspace v3 contract, isolates v1/v2 knowledge in a pure infrastructure converter, advances backups to format v2, and removes the retired Account Map and Portfolio shapes from current consumers.

- Current workspace documents use schema 3 and `isf-workspace-v3`.
- `isf-workspace-v1` is named only as the retired source key; Task 2 does not read, write, or delete it.
- Current Account Map state has only `applied` and `draft`; applied state is schema 2 without `layout`.
- Current Portfolio state is aggregate-only.
- The pure converter preserves Main, upgraded Simulation, Financial Locations, current Account Map purpose/link data, and aggregate Portfolio data while dropping Phase A data, applied layout, and location-scoped Portfolio data.
- Backup export emits format 2. Format-2 import is strict v3; format-1 import delegates to the same converter.
- Current Account Map and Portfolio writes preserve Main and all other protected slices.

## Scope ruling

Coordinator ruling `156a5a3` corrected the planned sequencing around the deleted domain migration module. Task 2 therefore also changes `src/workspace/infrastructure/workspaceRepository.ts` only to remove the deleted `migration.ts` import and make the interim repository parse/read the strict current v3 key. It intentionally does not add a migration shim, v1 fallback, dual-lock behavior, or retired-source writes. Task 3 owns the complete repository migration behavior and its focused repository tests. The v1 save-lock namespace is likewise unchanged here because Task 4 owns that change.

## Changed files

Current contracts and consumers:

- `src/workspace/domain/model.ts`
- `src/workspace/domain/validation.ts`
- `src/workspace/domain/locationCommands.ts`
- `src/account-map/domain/model.ts`
- `src/account-map/domain/commands.ts`
- `src/account-map/ui/AccountMapApp.tsx`
- `src/account-map/ui/AccountMapManagementMenu.tsx`
- `src/portfolio/domain/model.ts`
- `src/portfolio/domain/validation.ts`
- `src/portfolio/infrastructure/portfolioRepository.ts`

Migration, backup, and interim repository boundary:

- deleted `src/workspace/domain/migration.ts`
- added `src/workspace/infrastructure/retiredWorkspaceMigration.ts`
- `src/workspace/infrastructure/workspaceBackup.ts`
- `src/workspace/infrastructure/workspaceRepository.ts`

Focused tests and current fixtures:

- replaced `tests/unit/workspace/migration.test.ts` with `tests/unit/workspace/retiredWorkspaceMigration.test.ts`
- `tests/unit/workspace/validation.test.ts`
- `tests/unit/workspace/workspaceBackup.test.ts`
- `tests/unit/workspace/locationCommands.test.ts`
- `tests/unit/account-map/AccountMapApp.test.tsx`
- `tests/unit/account-map/AccountMapCanvas.test.tsx`
- `tests/unit/account-map/AccountMapManagementMenu.test.tsx`
- `tests/unit/account-map/accountMapCanvasModel.test.ts`
- `tests/unit/account-map/accountMapGraph.test.ts`
- `tests/unit/account-map/accountMapRepository.test.ts`
- `tests/unit/account-map/bootstrap.test.ts`
- `tests/unit/account-map/commands.test.ts`
- `tests/unit/account-map/editIntent.test.ts`
- `tests/unit/account-map/reconciliation.test.ts`
- `tests/unit/account-map/reducer.test.ts`
- `tests/unit/portfolio/bootstrap.test.ts`
- `tests/unit/portfolio/portfolioRepository.test.ts`
- `tests/unit/portfolio/validation.test.ts`
- `tests/unit/main/MainApp.test.tsx`
- `tests/unit/main/mainBackupCommands.test.ts`
- `tests/unit/main/mainRepository.test.ts`
- `tests/unit/simulation/simulationRepository.test.ts`

Named Task 2 fixtures that already built their workspace through `createEmptyWorkspace` required no textual edit; advancing that factory made them v3 without retaining retired fields.

## TDD evidence

Baseline before edits:

```text
$ git status --short
(no output)

$ npx vitest run tests/unit/workspace/migration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts
Test Files  3 passed (3)
Tests       74 passed (74)
```

Strict v3 validation red:

```text
$ npx vitest run tests/unit/workspace/validation.test.ts
Test Files  1 failed (1)
Tests       9 failed | 10 passed (19)
```

Observed failures showed the missing behavior: `createEmptyWorkspace` still emitted schema 2, `legacyPhaseA` and applied `layout` were accepted, and current-only reference/schema classification did not exist.

Strict v3 validation green after the minimal current model/parser implementation:

```text
$ npx vitest run tests/unit/workspace/validation.test.ts
Test Files  1 passed (1)
Tests       19 passed (19)
```

Pure converter and backup red:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts
Test Files  2 failed | 1 passed (3)
Tests       25 failed | 25 passed (50)
```

The converter module was intentionally absent and the old backup path still emitted/accepted format 1. After adding the converter, its first focused run exposed two real failures in shared-object traversal:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts
Test Files  1 failed (1)
Tests       2 failed | 11 passed (13)
```

The future-timestamp walk treated repeated object references as invalid. It was corrected to skip already visited objects while continuing to reject future timestamps.

Converter and strict parser green:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts
Test Files  2 passed (2)
Tests       32 passed (32)
```

Backup dispatch red before implementation:

```text
$ npx vitest run tests/unit/workspace/workspaceBackup.test.ts
Test Files  1 failed (1)
Tests       9 failed | 4 passed (13)
```

Observed failures showed format-2 export/import was absent and format-1 retired documents still used the deleted domain migration path.

Pure contract green after format-v2 dispatch:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts
Test Files  3 passed (3)
Tests       45 passed (45)
```

Consumer red before retired branches and fixtures were removed:

```text
$ npx vitest run tests/unit/workspace/locationCommands.test.ts tests/unit/account-map tests/unit/portfolio
Test Files  8 failed | 30 passed (38)
Tests       126 failed | 360 passed (486)
```

Failures were the intended missing behavior: Account Map tests still expected `legacyPhaseA`/layout and Portfolio/location commands still constructed or managed location-scoped Portfolio state.

The first complete focused green attempt then exposed three stale fixture expectations:

```text
$ npx vitest run \
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
Test Files  2 failed | 64 passed (66)
Tests       3 failed | 740 passed (743)
```

One Main invalid-reference fixture relied on a removed location-scoped Portfolio reference, and two Simulation repository tests expected legacy drafts in the strict v3 key to migrate. The reference fixture now uses a duplicate current location ID, while strict repository reads reject retired Simulation/workspace shapes; converter tests own the migration expectations.

Final focused green:

```text
$ npx vitest run \
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
Test Files  66 passed (66)
Tests       743 passed (743)
```

## Final verification

```text
$ npm run check
> npm run check:source && npm run check:unit
> tsc --noEmit
> tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
(no output; exit 0)
```

Focused purity rerun after strengthening v1 Simulation and zero-write coverage:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/workspaceBackup.test.ts
Test Files  2 passed (2)
Tests       26 passed (26)
```

Reference searches:

```text
$ rg -n "legacyPhaseA|hasLegacy|layout:\\s*['\\\"](?:purpose|account)['\\\"]|scope\\.type\\s*===\\s*['\\\"]location['\\\"]|scope\\.type\\s*!==\\s*['\\\"]aggregate['\\\"]|scope:\\s*\\{\\s*type:\\s*['\\\"]location['\\\"]" src --glob '!**/retiredWorkspaceMigration.ts'
(no output)

$ rg -n "localStorage|sessionStorage|window\\.|globalThis|isf-main|isf-simulation-compound|isf-portfolio-allocation|isf-account-map" src/workspace/infrastructure/retiredWorkspaceMigration.ts
(no output)

$ rg -n "domain/migration|WorkspaceDocumentV1|WorkspaceDocumentV2|LEGACY_WORKSPACE_SCHEMA_VERSION" src tests/unit/account-map tests/unit/portfolio tests/unit/main tests/unit/simulation tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts tests/unit/workspace/locationCommands.test.ts
(no output)
```

`shared/brand/mainBrandGeometry.js` remains present and untouched. Source scans show only `isf-workspace-v3` product reads/writes in current workspace consumers. The existing v1 save-lock strings remain by explicit Task 4 ownership.

## Ownership and safety review

- Main remains the only writer of the five monthly values.
- Simulation, Portfolio, and Account Map continue to read Main through their repository boundaries.
- Account Map command equality protects Main, Simulation, and Portfolio; its writes change only locations/current Account Map state.
- Portfolio writes only the aggregate Portfolio slice and preserves Main, Simulation, locations, and Account Map.
- The retired converter imports no storage API, old global bridge, deleted JavaScript module, or deleted domain migration module. Its tests assert source immutability and zero `setItem`/`removeItem` calls.
- Backup parsing finishes validation before returning a candidate and never writes storage.
- Current exact-key validation rejects retired compatibility properties instead of stripping them.

## Commits

- `3c72237 refactor: define workspace v3 migration contract`

## Concerns and handoff

No Task 2 blocker remains. By coordinator ruling, the existing focused `workspaceRepository.test.ts` still describes the Task 3 v1 fallback/migration behavior and was not changed or run as a Task 2 gate. Task 3 should start from the corrected plan and this strict-v3 repository interim state, then implement the read-only v1 fallback and guarded v3 creation without a compatibility shim.

## Fix round 1: stack-safe retired timestamp traversal

Review found that `containsFutureTimestamp` recursively traversed user-controlled format-v1 input before slice validation. A valid retired top-level shape containing a 20,000-level malformed `main` value exhausted the JavaScript call stack, leaking `RangeError: Maximum call stack size exceeded` instead of the public `backup-schema` classification.

Changed files:

- `src/workspace/infrastructure/retiredWorkspaceMigration.ts`
- `tests/unit/workspace/workspaceBackup.test.ts`

The traversal now uses an iterative worklist and retains the `WeakSet` repeated-reference guard. It still visits nested arrays and objects and detects numeric `*At` values later than `migratedAt`, without recursive stack growth.

RED, observed before the production change:

```text
$ npx vitest run tests/unit/workspace/workspaceBackup.test.ts
Test Files  1 failed (1)
Tests       1 failed | 13 passed (14)
Expected: "backup-schema"
Received: "Maximum call stack size exceeded"
```

GREEN after the production change:

```text
$ npx vitest run tests/unit/workspace/workspaceBackup.test.ts
Test Files  1 passed (1)
Tests       14 passed (14)
```

Required fix verification:

```text
$ npx vitest run tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/workspaceBackup.test.ts
Test Files  2 passed (2)
Tests       27 passed (27)

$ npm run check
> npm run check:source && npm run check:unit
> tsc --noEmit
> tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
(no output; exit 0)
```

Fix commit:

- `37efbb4 fix: bound retired timestamp traversal`

No remaining concern was identified in this fix round. Data ownership, converter purity, strict v3 parsing, backup dispatch, and retired-source preservation are unchanged.
