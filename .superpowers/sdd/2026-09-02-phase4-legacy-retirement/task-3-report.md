# Phase 4 Task 3 Report

Date: 2026-09-03

Status: complete

## Outcome

Task 3 moves browser workspace persistence and coordination to v3 while retaining `isf-workspace-v1` as byte-for-byte immutable conversion and rollback evidence.

- A valid or invalid `isf-workspace-v3` record has strict precedence; invalid v3 never falls back to v1.
- With v3 absent, exact retired workspace v1/v2 records convert in memory and report `needsMigration: true`.
- Initial conversion writes re-read and convert while holding the retired v1 lock, then nest the current v3 lock for revision validation, guarded write, readback, and notification.
- Current and retired Web Lock/fallback-lease namespaces are independently parameterized. The default namespace is v3.
- Failed source reads, conversion rejection, stale revisions, and failed v3 verification do not change the retired source. An unverified first v3 write is removed.
- After v3 exists, later old-tab v1 writes are ignored by loads and current updates.
- Invalid reset, restoration, notifications, and all post-migration writes target v3 only.
- Main remains the only editor of the five monthly values. Simulation and Portfolio remain Main readers; Account Map ownership is unchanged.

## Changed files

Production:

- `src/workspace/infrastructure/workspaceSaveLock.ts`: added current/retired lock namespaces and made Web Lock names, fallback lease keys, and lease enumeration namespace-dependent.
- `src/workspace/infrastructure/workspaceRepository.ts`: added strict v3 precedence, read-only retired conversion, injected/default retired save lock, retired-to-current lock nesting, and guarded v3-only persistence.

Tests and fixtures:

- `tests/unit/workspace/workspaceSaveLock.test.ts`: added direct Web Lock and fallback-lease namespace coverage.
- `tests/unit/workspace/workspaceRepository.test.ts`: replaced obsolete single-key migration expectations with v3 precedence, v1/v2 conversion, rollback, source failure, lock order, stale revision, reset isolation, and old-tab regression coverage.
- `tests/unit/main/mainRepository.test.ts`: records the intentional retired workspace lookup after absent v3 while proving standalone records remain untouched.
- `tests/unit/simulation/simulationRepository.test.ts`: records the same absent-v3 retired-source lookup without consuming the standalone Simulation key.
- `tests/unit/portfolio/portfolioRepository.test.ts`: records the same absent-v3 retired-source lookup without consuming standalone Portfolio keys.
- `tests/retired-storage-isolation.spec.ts`: asserts a Main edit writes v3 while exact v1 and standalone raw strings remain unchanged.

The named Portfolio/Main-source and Account Map fixtures already used `WORKSPACE_STORAGE_KEY` or injected repository doubles, so they needed no textual change; they remained in the focused verification command.

## TDD evidence

Initial repository state:

```text
$ git status --short
(no output)
```

RED after adding namespace and repository behavior tests, before production changes:

```text
$ npx vitest run tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts
Test Files  2 failed (2)
Tests       14 failed | 34 passed (48)
exit 1
```

The observed failures were the intended missing behavior: the default Web Lock still requested `isf-workspace-v1-save`; fallback leases still used the v1 prefix; retired v1/v2 records loaded as empty; migration writes conflicted against empty revision 0; partial-write rollback and stale-source assertions could not run through conversion; and no retired/current lock nesting occurred.

GREEN after namespace parameterization and guarded conversion implementation:

```text
$ npx vitest run tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts
Test Files  2 passed (2)
Tests       48 passed (48)
exit 0
```

The first cross-product run then identified three stale fixture expectations. Main, Simulation, and Portfolio correctly read `isf-workspace-v1` after absent v3 but their tracking assertions still expected only one read:

```text
$ npx vitest run tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/main/mainRepository.test.ts tests/unit/simulation/simulationRepository.test.ts tests/unit/portfolio/mainSourceRepository.test.ts tests/unit/portfolio/portfolioRepository.test.ts tests/unit/account-map/mainSourceRepository.test.ts tests/unit/account-map/accountMapRepository.test.ts
Test Files  3 failed | 5 passed (8)
Tests       3 failed | 95 passed (98)
exit 1
```

After correcting those intentional boundary-read expectations, the same focused command was green:

```text
Test Files  8 passed (8)
Tests       98 passed (98)
exit 0
```

## Final verification

Focused browser isolation:

```text
$ npx playwright test tests/retired-storage-isolation.spec.ts --reporter=list
2 passed (3.8s)
0 skipped
exit 0
```

TypeScript gates:

```text
$ npm run check
> tsc --noEmit
> tsc --noEmit -p tsconfig.unit.json
exit 0
```

Full unit regression gate required by the branch-finishing review:

```text
$ npm run test:unit
Test Files  125 passed (125)
Tests       1187 passed (1187)
exit 0
```

Whitespace/staging gate:

```text
$ git diff --cached --check
(no output; exit 0)
```

Compatibility/reference review:

```text
$ rg -n "isf-workspace-v1|isf-workspace-v3|isf-workspace-v[13]-save" src/workspace/infrastructure tests/unit/workspace tests/unit/main/mainRepository.test.ts tests/unit/simulation/simulationRepository.test.ts tests/unit/portfolio tests/unit/account-map tests/retired-storage-isolation.spec.ts
```

The remaining v1 references are limited to the retired source key, retired lock constants, explicit migration/isolation fixtures, and negative namespace assertions. Current writes and notifications use the v3 constant.

## Concurrency and rollback self-review

- Lock acquisition is acyclic: old writers take retired v1 only; ordinary current writers take current v3 only; initial conversion always takes retired v1 before current v3.
- Conversion re-reads the source after retired-lock entry. The current record is re-checked after current-lock entry, so a winning v3 writer cannot be overwritten or downgraded by a captured v1 snapshot.
- Both guards are asserted before conversion persistence. A lost retired or current lease makes the operation unavailable rather than accepting a write.
- Revision comparison occurs inside the acquired lock; a stale retired revision remains a conflict and does not create v3.
- The existing guarded write/readback restoration path uses `WORKSPACE_STORAGE_KEY`, now v3. The retired source and standalone keys have no write/delete path.
- Same-tab publication occurs only after exact serialized v3 readback. Storage-event subscription filters on v3 only.

## Commits

- `f3b8956 feat: migrate workspace storage to v3`
- This evidence report is committed separately so it can name the implementation commit without a circular commit hash.

## Concerns

No Task 3 blocker or product concern remains. Verification emitted only existing Node/Playwright environment warnings (`module.register()` deprecation, `NO_COLOR`/`FORCE_COLOR`, and the full-unit localStorage experimental warning); all required commands exited zero.
