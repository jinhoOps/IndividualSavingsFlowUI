# Task 3 Report — Readiness screens

## Status

Completed and committed as `feat(journey): add readiness screens`.

## Changes

- `src/journey/ui/ReadinessApp.tsx`: Adds Simulation, Portfolio, and Account Map readiness states. It validates the handoff destination, preserves zero and negative amounts as connected values, writes only the Simulation → Portfolio handoff, and prevents navigation on a save error.
- `src/journey/simulation.tsx`, `src/journey/portfolio.tsx`, `src/journey/accountMap.tsx`: Add strict-mode React readiness entries with the shared error boundary, app launcher styles, and service-worker registration.
- `tests/unit/journey/ReadinessApp.test.tsx`: Covers connected, missing, invalid, mismatched, zero, negative, handoff success/failure, and Account Map no-read behavior.

## TDD evidence

1. RED: `npx vitest run tests/unit/journey/ReadinessApp.test.tsx` failed because `ReadinessApp` did not exist.
2. GREEN: the same command passed with 8 tests after the minimal implementation.

## Verification

- `git diff --check`
- `npx vitest run tests/unit/journey/ReadinessApp.test.tsx` — 1 file, 8 tests passed
- `npx vitest run tests/unit/journey` — 5 files, 21 tests passed
- `npm run check` — source and unit TypeScript checks passed

## Self-review

- Simulation and Portfolio accept only snapshots addressed to their own destination.
- Account Map does not call `JourneyRepository.load()`.
- A failed Simulation → Portfolio save renders a visible error and does not navigate.
- No legacy runtime, storage key, route, or Main UI dependency was added.

## Concerns

The entry files are intentionally not wired into the existing `apps/*` HTML files in this task; that integration belongs to the separately scoped entry-replacement work.

## Fix round 1 — Main recovery touch target

- Added the `.journey-action` inline-flex, center alignment, and `0.5rem 0.75rem` padding contract while preserving its 44px minimum height.
- Added a ReadinessApp component/style contract test that confirms the recovery link uses `.journey-action` and the stylesheet supplies the touch-target declarations.
- RED: `npx vitest run tests/unit/journey/ReadinessApp.test.tsx` failed because `.journey-action` lacked `display: inline-flex`, alignment, and padding.
- GREEN: `npx vitest run tests/unit/journey/ReadinessApp.test.tsx` — 1 file, 9 tests passed.
- Verification: `npm run check` passed source and unit TypeScript checks; `git diff --check` passed.
