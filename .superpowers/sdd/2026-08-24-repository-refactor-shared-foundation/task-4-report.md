# Task 4 report: shared reveal final-state helper

## Status

Implemented and verified the requested motion helper refactor.

## Changes

- Added `src/components/motion/setMotionFinalState.ts` with the pure `setMotionFinalState(target: HTMLElement)` helper.
- Added `tests/unit/components/setMotionFinalState.test.ts` covering opacity and translateY final-state commits.
- Replaced the identical local fallback helpers in `Toast`, `ReadinessApp`, and `ManagementConfirmationDialog`.
- Left geometry-specific motion in AppLauncher, PortfolioDialog, Main setup, and Account Map untouched.

## Verification

- TDD red run: `npx vitest run tests/unit/components/setMotionFinalState.test.ts` failed because the helper module did not exist.
- Focused tests: `npx vitest run tests/unit/components/setMotionFinalState.test.ts tests/unit/components/useAnimeScope.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/journey/AppLauncher.test.tsx` — 4 files, 38 tests passed.
- TypeScript checks: `npm run check` — source and unit checks passed.
- Diff hygiene: `git diff --check` passed.

## Concerns

None identified. Existing first-visit/Strict Mode replay, reduced-motion, and Anime.js fallback branches remain in their original consumers and are covered by the focused tests.
