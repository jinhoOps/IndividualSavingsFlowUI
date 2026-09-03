# Phase 4 Task 1 report

## Changed files

- `tests/unit/journey/supportedRouteClosure.test.ts` and its `routeClosure`
  fixtures: move the AST/HTML/CSS closure scanner to the journey level, scan all
  five supported Vite entries, retain the type-only/side-effect/CSS checks, and
  prove `shared/brand/mainBrandGeometry.js` remains allowed.
- `tests/retired-storage-isolation.spec.ts`: rename and narrow the old
  compatibility browser suite to the two supported isolation behaviors; compare
  the four retired-key reads byte-for-byte while retaining the Task 1
  workspace-v1 write baseline.
- Removed `tests/main-compat.spec.ts`, the superseded Portfolio-only scanner,
  and its fixtures.
- `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`:
  records all 71 declared legacy `step1` cases plus the two helper-regex matches
  returned by the mandated broad `rg` command (73 checked rows total).

## TDD evidence

- RED: `npx vitest run tests/unit/journey/supportedRouteClosure.test.ts` exited
  1 after the generalized test was created. It correctly failed on the missing
  new route-closure fixtures. It also exposed that the currently supported Main
  closure reaches the Task 4 startup purge token
  `isf-journey-snapshot-v1`.
- GREEN: after adding the moved fixtures and completing the generalized scanner,
  `npx vitest run tests/unit/journey/supportedRouteClosure.test.ts` passed with
  5 tests. The coordinator ruled that Task 1 must not remove the purge; the
  corrected Task 1 route-token set therefore excludes that token. Task 4 owns
  the non-null retired-key sentinel and purge removal proof.
- The browser change deliberately retains existing behavior rather than adding
  runtime code: `npx playwright test tests/retired-storage-isolation.spec.ts
  --reporter=list` passed with 2 tests and no skips.

## Verification

- `npx vitest run tests/unit/journey/supportedRouteClosure.test.ts`: 1 file,
  5 tests passed.
- `npx playwright test tests/retired-storage-isolation.spec.ts --reporter=list`:
  2 passed, 0 skipped.
- `npm run check`: passed (`tsc --noEmit` and `tsc --noEmit -p
  tsconfig.unit.json`).
- `git diff --check` and staged `git diff --cached --check`: passed.
- `rg -n "test(?:\.skip)?\(" tests/step1.spec.ts | wc -l`: 73; the evidence
  table has 73 rows.

## Commit

- `9fa5b35b6fb0da94e1c5cd193d0acb586ac5a8fe` — `test: establish phase 4 retirement evidence`

## Concerns

- The dispatched brief still listed `isf-journey-snapshot-v1` as a Task 1 route
  token after the coordinator corrected the plan. The Task 4 source-purge
  removal is intentionally out of this task's scope, so Task 1 records
  `journeyV1: null` in the compact isolation assertions; Task 4 must add the
  non-null untouched-sentinel proof.
- The mandated broad `rg` finds two helper regular expressions as well as 71
  executable test declarations. The evidence labels those two rows as
  non-cases to preserve both exact title coverage and the required row count.
