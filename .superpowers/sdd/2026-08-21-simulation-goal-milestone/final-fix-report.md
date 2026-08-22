# Simulation Goal Milestone Final Fix Report

Date: 2026-08-22

Worktree: `/Users/jinho/orca/workspaces/IndividualSavingsFlowUI/simulation-goal-milestone`

Starting HEAD: `323d3d2`

## Status

All seven verified final-review findings were remediated and committed.

Implementation commit: `5cf2722 fix(simulation): close goal milestone review`

This evidence report is committed separately after the implementation commit, so its own commit is intentionally not self-referential here.

## Changed files

- `src/simulation/ui/SimulationOnboarding.tsx` — makes a migrated nullable-target draft complete directly from the goal step while preserving its saved duration, return, rate, inflation offset, and amount mode.
- `src/simulation/ui/SimulationApp.tsx` — waits for a successful target save before leaving `goal-required`; a failed save leaves the goal entry mounted and retryable before any `main-required` transition.
- `src/simulation/ui/GoalAmountStep.tsx` — preserves invalid raw input, accepts plain digits or correctly grouped comma formatting, associates validation feedback, and shows saving/failure/retry actions for resumed goals.
- `src/simulation/ui/simulation.css` — applies the selected preset treatment to onboarding `aria-pressed="true"` buttons.
- `src/simulation/ui/format.ts` — rejects non-positive/non-integer target-reach months, including month zero.
- `tests/unit/simulation/SimulationOnboarding.test.tsx` — covers direct migrated-goal completion, setting preservation, raw invalid text, validation association, and comma-formatted input.
- `tests/unit/simulation/SimulationApp.test.tsx` — covers save-before-transition behavior and failed-then-successful retry with both empty Main and zero-contribution Main.
- `tests/unit/simulation/ExpectedReturnStep.test.tsx` — asserts the selected and unselected `aria-pressed` states.
- `tests/unit/simulation/format.test.ts` — covers the month-zero rejection.
- `tests/unit/workspace/workspaceBackup.test.ts` — covers nested Simulation v1/v2 automatic-target migration, v1/v2 high-principal nullable-target migration, exact non-Simulation slice preservation, and atomic malformed-target rejection.
- `tests/simulation.spec.ts` — exercises the high-principal goal input, focus, containment, touch size, selected preset computed styles, and retained result/graph checks at 390px, 768px, and desktop.

No production workspace backup/import code changed: the new compatibility cases passed against the existing versioned parser, and the added tests now preserve that behavior as regression evidence.

## TDD evidence

### Unit RED

Command:

```sh
npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/ExpectedReturnStep.test.tsx tests/unit/simulation/format.test.ts tests/unit/workspace/workspaceBackup.test.ts
```

Expected result before implementation: 6 failed, 58 passed across 5 files. Failures specifically showed the old `다음` branch for migrated goals, stripped invalid characters, missing retry state, and the `0개월` formatter result. Backup migration and existing ARIA state coverage passed because those runtime behaviors already existed; the missing evidence was added without changing that parser.

### Browser RED

Command:

```sh
npx playwright test tests/simulation.spec.ts --grep "keeps the high-principal goal entry and result contained" --reporter=list
```

Expected result before the CSS fix: 3 failed. At all three viewports, the selected 9% preset remained white with the default border/text colors instead of the primary selected treatment.

### Focused GREEN

Command:

```sh
npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/ExpectedReturnStep.test.tsx tests/unit/simulation/format.test.ts tests/unit/workspace/workspaceBackup.test.ts
```

Result: 5 files passed, 65 tests passed, 0 failed.

Command:

```sh
npx playwright test tests/simulation.spec.ts --grep "keeps the high-principal goal entry and result contained" --reporter=list
```

Result: 3 passed, 0 failed.

## Required verification

Command:

```sh
npm run check
```

Result: passed. Both `tsc --noEmit` and `tsc --noEmit -p tsconfig.unit.json` exited successfully.

Command:

```sh
npx playwright test tests/simulation.spec.ts --reporter=list
```

Result: 11 passed, 0 failed.

Command:

```sh
npm run test:e2e -- --reporter=list
```

Result: 130 passed, 61 intentional skips, 0 failed, 191 total, 2.5 minutes.

Command:

```sh
git diff --check
```

Result: passed with no output.

## Concerns

- No unresolved product, storage-compatibility, responsive, or accessibility concerns were found in the requested scope.
- Playwright emitted existing non-failing Node `DEP0205` and `NO_COLOR`/`FORCE_COLOR` warnings. They did not affect test results.
- The full E2E run retained 61 intentional legacy/PWA skips; all 130 enabled tests passed.
