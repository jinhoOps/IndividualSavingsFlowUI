# Corrective Gate 8A — Invalid Retired Workspace Recovery Report

Status: DONE_WITH_CONCERNS

## Outcome

`BrowserWorkspaceRepository.resetInvalid()` now distinguishes an invalid current v3 record from an absent-v3/invalid-retired-v1 source. The current-invalid path remains v3-only. The retired-source path acquires the retired lock before the current lock, revalidates both records under a combined guard, writes and verifies only v3, and leaves v1 byte-for-byte unchanged.

The implementation reuses one guarded v3 serialization/read-back/restore writer for updates and both reset paths. It does not change UI copy, schema, the retired converter, lock namespaces, standalone-key behavior, or Main ownership.

## Changed files

- `src/workspace/infrastructure/workspaceRepository.ts`: adds the retired-to-current reset branch and shared guarded v3 writer.
- `tests/unit/workspace/workspaceRepository.test.ts`: adds retired reset success, current-winner race, retired-source-change race, failed-readback restoration, and current-v3 precedence coverage.
- `tests/unit/main/mainRepository.test.ts`: moves the recovery adapter case to invalid retired v1 and verifies the new v3 workspace plus exact v1 preservation.
- `tests/main-react.spec.ts`: verifies recovery preserves invalid v1, creates an empty revision-1 v3 record, and persists the subsequently applied plan in v3.

## TDD evidence

Initial status:

```text
$ git status --short
(no output)
```

Focused RED before production changes:

```text
$ npx vitest run tests/unit/workspace/workspaceRepository.test.ts -t "resets an exact invalid retired raw into v3 without mutating the retired source"
Test Files  1 failed (1)
Tests       1 failed | 46 skipped (47)
```

The failure was the intended defect: expected `{ status: 'saved', workspace: ... }`, received `{ status: 'changed' }` because reset compared the invalid retired raw with absent v3.

The expanded pre-implementation regression run also failed all five new repository/Main behaviors:

```text
$ npx vitest run tests/unit/workspace/workspaceRepository.test.ts tests/unit/main/mainRepository.test.ts -t "invalid retired|retired raw"
Test Files  2 failed (2)
Tests       5 failed | 1 passed | 61 skipped (67)
```

## Preservation, race, and rollback assertions

- Successful retired recovery saves exactly `{ ...createEmptyWorkspace(200), revision: 1 }` to v3, preserves the original invalid v1 string, and performs no v1 `setItem` or `removeItem`.
- Current-invalid recovery performs no retired-key read and continues through the current v3 lock only.
- A valid v3 winner installed immediately before the current-lock callback returns `changed`, preserves both winner v3 and invalid v1, and records exactly `retired:enter`, `current:enter`, `current:exit`, `retired:exit`.
- A changed v1 raw installed immediately before the current-lock callback returns `changed`, creates no v3, preserves the newer v1 raw, and records the same retired-to-current lock order.
- A corrupted v3 write/read-back returns `unavailable`, removes the unverified v3 record, and preserves the invalid v1 string exactly.
- After both locks are held, the combined guard asserts retired and current ownership before every transaction read/write, including verification and restoration.

## Final verification

```text
$ npx vitest run tests/unit/workspace/workspaceRepository.test.ts tests/unit/main/mainRepository.test.ts
Test Files  2 passed (2)
Tests       67 passed (67)
```

```text
$ npx playwright test tests/main-react.spec.ts --grep "downloads and explicitly resets an invalid workspace" --reporter=list
1 passed (1.4s)
```

```text
$ npm run check
> tsc --noEmit
> tsc --noEmit -p tsconfig.unit.json
exit 0
```

```text
$ git diff --check
(no output; exit 0)
```

Required combined browser run:

```text
$ npx playwright test tests/retired-storage-isolation.spec.ts tests/main-react.spec.ts --reporter=list
30 passed
8 failed
0 skipped
duration 1.8m
```

The corrected recovery case and both retired-storage-isolation cases passed. Seven failures directly read or compare current Main state through stale `isf-workspace-v1` assertions. The 390px timed brand-intro case timed out while evaluating a removed intro node; that parameterized test also retains the same stale v1 assertion later in its body. These are the previously documented corrective fixture gate outside 8A; they were not changed because the brief explicitly excludes unrelated fixture cleanup.

Playwright emitted the existing `module.register()` deprecation and `NO_COLOR`/`FORCE_COLOR` warnings.

## Commits

- `c3ca959 fix: recover invalid retired workspaces`
- This report is committed separately so it can name the implementation commit without a circular report-commit hash.

## Concerns

The 8A recovery defect is covered and its focused gates pass. The full requested Main/isolation browser command is not green until the separately owned ordinary Main v1 fixture/assertion cleanup lands; no part of that cleanup was included here.
