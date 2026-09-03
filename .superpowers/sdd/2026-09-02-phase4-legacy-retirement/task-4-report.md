# Phase 4 Task 4 Report

Date: 2026-09-03

Status: complete

## Outcome

Main import retains the guarded v3 repository boundary: full format-v1/v2 parsing creates a validated candidate before the confirmation dialog can request replacement. The added integration coverage proves invalid current and old backups, cancelled confirmation, and failed v3 replacement preserve the raw v3 document and every seeded retired record. A successful import changes only v3 and makes the imported Main value visible.

Main startup no longer imports, reads, writes, or deletes `isf-journey-snapshot-v1`. The retired-storage module and its obsolete deletion test are removed. A browser sentinel now proves exact retired bytes survive both startup and a successful current Main edit; the existing Main-to-Simulation journey assertion was updated from deletion to preservation.

## Changed files

- `src/main/main.tsx`: removes the retired-key purge import and startup call.
- `src/main/infrastructure/retiredStorage.ts`: deleted; no replacement cleanup path exists.
- `tests/unit/main/retiredStorage.test.ts`: deleted with the retired module.
- `tests/unit/main/MainApp.test.tsx`: adds v3 raw-byte and retired-record preservation tests for invalid old/current input, cancel, replace failure, and successful import isolation.
- `tests/main-react.spec.ts`: advances the focused backup/import/restore fixtures and assertions to v3 / backup format v2 while retaining atomicity, focus, and mobile-dialog coverage.
- `tests/app-journey.spec.ts`: adds the real startup-and-edit retired-key sentinel and updates the Main-to-Simulation expectation to preserve the old snapshot.

`mainBackupCommands.ts` and `useMainBackupController.ts` required no production edit: the Task 2 parser already produces a fully validated v3 candidate before controller confirmation, and the Task 3 v3 repository already performs guarded replacement and rollback. The new tests exercise those real boundaries.

## TDD evidence

Initial worktree check:

```text
$ git status --short
(no output)
```

RED, after adding the browser sentinel and before deleting the startup purge:

```text
$ npx playwright test tests/app-journey.spec.ts --grep "retired journey snapshot survives" --reporter=list
1 failed

Expected: {"retired":"keep-this-byte-for-byte"}
Received: null
exit 1
```

The failure was caused by Main startup deleting the exact sentinel. The new atomic-import cases were intentionally already green against Task 2/3's parser and guarded repository boundary:

```text
$ npx vitest run tests/unit/main/mainBackupCommands.test.ts tests/unit/main/MainApp.test.tsx
Test Files  2 passed (2)
Tests       65 passed (65)
exit 0
```

GREEN after removing the purge:

```text
$ npx playwright test tests/app-journey.spec.ts --grep "retired|legacy|standalone" --reporter=list
2 passed (2)
exit 0
```

## Final verification

```text
$ npx vitest run tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/mainBackupCommands.test.ts tests/unit/main/MainApp.test.tsx
Test Files  3 passed (3)
Tests       79 passed (79)
exit 0

$ npx playwright test tests/main-react.spec.ts --grep "backup|import|restore" --reporter=list
8 passed (8)
exit 0

$ npx playwright test tests/app-journey.spec.ts --grep "retired|legacy|standalone" --reporter=list
2 passed (2)
exit 0

$ npx playwright test tests/app-journey.spec.ts --grep "connects Main directly" --reporter=list
1 passed (1)
exit 0

$ npm run check
tsc --noEmit
tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
(no output; exit 0)
```

The task brief's literal browser command uses Korean title fragments:

```text
npx playwright test tests/main-react.spec.ts --grep "백업|가져오기|복원" --reporter=list
```

The current test titles are English, so Playwright returned `No tests found` before any browser test ran. The semantically equivalent `backup|import|restore` title group above ran all eight targeted tests successfully.

## Ownership and compatibility scan

```text
$ rg -n "purgeRetiredStorage|retiredStorage" --glob '!docs/**' --glob '!.superpowers/**' .
(no output)

$ rg -n "isf-journey-snapshot-v1" src/main
(no output)
```

The only remaining retired journey-key references are explicit negative-isolation and browser-sentinel tests. Main runtime has no reference. Main remains the sole five-month-value editor; the changed import flow replaces only the whole v3 workspace through the existing repository boundary.

## Commits

- `17c63fd refactor: finalize current import and retired storage isolation`
- This evidence report is committed separately so it can name the implementation commit.

## Concerns

No product or compatibility concern remains. Node/Playwright emitted existing environment warnings (`module.register()` deprecation, `NO_COLOR`/`FORCE_COLOR`, and Vitest's localStorage experimental warning); all executed verification gates passed.
