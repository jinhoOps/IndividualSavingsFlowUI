# Task 1 Report: Anime scope consumer cleanup

## Implementation

- Added the exported `MotionCleanup` type and updated `useAnimeScope` setup to optionally return a cleanup callback.
- Stored scoped consumer cleanup and invoked it before Anime scope revert on dependency cleanup and unmount.
- Wrapped both consumer cleanup and scope revert with `attemptMotion()` so cleanup failures do not prevent the other operation.
- Returned fallback cleanup functions for both `createScope()` construction failure and partial Anime setup failure.
- Preserved consumer setup error discrimination, partial scope revert, reduced-motion fallback, and consumer error rethrow behavior.

## Files changed

- `src/components/motion/useAnimeScope.ts`
- `tests/unit/components/useAnimeScope.test.tsx`

## TDD evidence

### RED

Command:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
```

Result: expected failure. 8 existing tests passed; the 2 new cleanup tests failed because consumer cleanup was not called on dependency change/unmount or fallback unmount.

### GREEN

Commands:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
npm run check
```

Results:

- Focused Vitest: 1 file passed, 10 tests passed.
- `npm run check`: `check:source` and `check:unit` TypeScript checks passed.
- `git diff --check`: passed.

## Self-review

- Confirmed cleanup ordering is consumer cleanup before `scope.revert()`.
- Confirmed dependency rerender and unmount each invoke the consumer cleanup once for their setup instance.
- Confirmed reduced-motion fallback cleanup is returned when Anime scope construction is unavailable.
- Confirmed existing scope error and fallback tests remain green.
- No unrelated files or consumers were changed.

## Concerns

None identified within the requested scope. The implementation follows the provided contract; broader integration behavior is covered by the existing type check and hook tests.

## Fix Round 1

### Covering test

Updated `tests/unit/components/useAnimeScope.test.tsx` with a regression case where `scope.add` invokes the consumer setup, captures its returned cleanup, and then throws. The test verifies consumer cleanup runs before partial Anime scope revert and that the fallback cleanup runs once on unmount.

### TDD evidence

RED command:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
```

Result: 1 failed, 10 passed. The new test observed `revert` without the required preceding `consumer-cleanup`.

GREEN commands:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
npm run check
git diff --check
```

Results:

- Focused Vitest: 1 file passed, 11 tests passed.
- `npm run check`: `check:source` and `check:unit` TypeScript checks passed.
- `git diff --check`: passed.

### Changed files

- `src/components/motion/useAnimeScope.ts`: invoke captured consumer cleanup via `attemptMotion()` before partial scope revert.
- `tests/unit/components/useAnimeScope.test.tsx`: add the post-consumer-setup `scope.add` failure regression test.

### Self-review and concerns

- Cleanup remains best-effort and cannot mask the original setup error or scope revert behavior.
- The ordering is explicitly consumer cleanup, then partial Anime revert.
- No unrelated files or consumers were changed.
- No concerns identified.
