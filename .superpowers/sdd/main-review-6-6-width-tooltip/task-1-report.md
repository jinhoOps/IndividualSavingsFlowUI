# Task 1 report: restore outer review reading width

## Result

`SetupFlow` no longer gives its review-only outer `Surface` the
`app-wide-visual` class. The nested assembly `AllocationBar` continues to own
that class. This restores the outer progress, heading, and actions to the
48rem reading frame while preserving the assembly bar's 75rem exception.

## Changed files

- `src/main/ui/setup/SetupFlow.tsx`: remove the review-only outer wide class.
- `tests/unit/main/SetupFlow.test.tsx`: assert the review Surface is narrow
  while the assembly AllocationBar remains wide.
- `tests/main-react.spec.ts`: assert first and restart review widths at 390,
  768, and 1280px: `min(viewport - 32px, 48rem)` for the outer surface and
  `min(viewport - 32px, 75rem)` for the assembly bar.

No tooltip CSS or `PercentageTooltip` component file was modified.

## TDD evidence

### RED

1. `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx`

   Exit 1. `19 passed, 1 failed`. The new expectation failed as intended:
   the review Surface received `ui-surface setup-flow-surface shadow-float
   app-wide-visual`.

2. `npx playwright test tests/main-react.spec.ts -g "setup motion reaches final state in real time at required viewports"`

   Exit 1. The focused browser test failed as intended at the new outer-surface
   assertion. Playwright reported that `.setup-flow-surface` still had
   `app-wide-visual`.

### GREEN

1. `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx tests/unit/main/AllocationBar.test.tsx`

   Exit 0. `2 passed` files; `43 passed` tests. This retains the existing
   assembly geometry, clipping, fallback tooltip, interaction, and motion
   coverage.

2. `npx playwright test tests/main-react.spec.ts -g "setup motion reaches final state in real time at required viewports"`

   Exit 0. `1 passed`. It checks initial and restart review at 390, 768, and
   1280px.

3. `npm run check`

   Exit 0. Both `tsc --noEmit` and `tsc --noEmit -p tsconfig.unit.json` passed.

4. `npx playwright test tests/main-react.spec.ts -g "setup motion reaches final state in real time at required viewports|review assembly captures timed deficit geometry and reduced motion"`

   The sandboxed attempt could not bind Playwright's local server
   (`listen EPERM 127.0.0.1:5662`). The same command was rerun with approved
   local-server permission and exited 0: `2 passed` (width/restart coverage
   and timed deficit/reduced-motion coverage).

5. `git diff --check`

   Exit 0.

## Self-review

- The only production change is removal of the review Surface's wide class.
- `AllocationBar` assembly class assignment, deficit clipping, animation,
  reduced-motion and restart behavior, storage, ARIA, and tooltip code remain
  unchanged.
- Browser assertions verify no horizontal document overflow alongside the
  first/restart width checks.

## Fix round 1: reading-width focused contract correction

### Changed expectations

- `tests/reading-width.spec.ts` now asserts that `.setup-flow-surface` does
  **not** receive `app-wide-visual` and measures it as the shared reading
  frame: `min(viewport - 32px, 48rem)` at 390, 768, and 1280px.
- The same first-review and restart-review checks retain the assembly
  `.allocation-bar` `app-wide-visual` assertion and its
  `min(viewport - 32px, 75rem)` width.
- The deficit clipping geometry and hover, touch tap, and keyboard
  focus/Enter fallback-tooltip checks remain in the same focused test.
- Removed the obsolete desktop-only assumption that the intentionally wide
  assembly bar must be contained by its now-narrow outer surface. Its own
  stage/table containment and clipping assertions remain covered.

No tooltip CSS, tooltip component, or production source is changed by this
fix round.

### TDD evidence

The corrected browser contract passes against the already-fixed source, then
a temporary local mutation restored the former review-only
`app-wide-visual` class in `SetupFlow`. The focused group failed at all three
viewports as intended (`Expected pattern: not /app-wide-visual/`; received
`ui-surface setup-flow-surface shadow-float app-wide-visual`). The source was
immediately restored before final verification, leaving no production diff.

### Verification

1. `npx playwright test tests/reading-width.spec.ts -g "keeps first and restart Main review frames correct"`

   Exit 0. `3 passed` (390px, 768px, 1280px).

2. `npx playwright test tests/reading-width.spec.ts`

   Exit 0. `10 passed`, including the three corrected first/restart review
   checks and their clipped-deficit plus hover/tap/focus tooltip coverage.

3. `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx tests/unit/main/AllocationBar.test.tsx`

   Exit 0. `2 passed` files; `43 passed` tests.

4. `npx playwright test tests/main-react.spec.ts -g "setup motion reaches final state in real time at required viewports|review assembly captures timed deficit geometry and reduced motion"`

   Exit 0. `2 passed`.

5. `npm run check`

   Exit 0. `tsc --noEmit` and `tsc --noEmit -p tsconfig.unit.json` passed.

6. `git diff --check`

   Exit 0.
