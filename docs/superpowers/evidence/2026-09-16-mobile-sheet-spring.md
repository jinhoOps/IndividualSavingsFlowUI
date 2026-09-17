# Main·Portfolio mobile sheet spring verification

## Implemented behavior

Main and Portfolio use shared Anime.js spring profiles for existing surface and visual-value transitions. Eligible mobile sheets can be dismissed by dragging down from the header handle. The gesture forwards a close request to the owning app; existing dirty, saving, confirmation, and focus-restoration paths remain responsible for the outcome.

| Role | Spring configuration | Verified behavior |
| --- | --- | --- |
| `surface` | bounce `0.12`, perceived duration `260ms` | Sheet/panel settles with no repeated visible bounce; final position overshoot is at most `4px`. |
| `return` | bounce `0.12`, perceived duration `220ms` | A rejected or short drag returns to its resting position. |
| `exit` | bounce `0`, perceived duration `180ms` | Exit moves monotonically downward and fades; cleanup has a `300ms` deadline. |
| `value` | bounce `0`, perceived duration `260ms` | Existing financial visual values stay in range and move monotonically. |

Each animation receives its own spring object. Anime.js describes spring duration as perceived duration and exposes a separate settling duration; the profile value is not treated as a hard completion deadline. See the [Anime.js spring reference](https://animejs.com/documentation/easings/spring/).

The drag activates after `8px` of vertically dominant downward movement. It dismisses at `min(140, max(80, 20% of sheet height))` pixels, or after a recent downward flick of at least `32px` at `0.6px/ms`. The gesture is limited to opted-in sheet headers; cancellation, capture loss, a second pointer, resize, close guards, and reduced motion return or finish through their dedicated paths.

Async save or confirmation guards return the sheet to rest and keep it present while the existing flow decides whether dismissal is allowed. A rejected or canceled guard keeps the sheet open; an approved guard starts the exit after the return completes. When a Portfolio drag opens a nested discard confirmation, canceling it restores focus to a control inside the parent sheet—the target name field or editor close button—even if the gesture left `document.body` focused.

## Verification

- `npm run check` — passed (`tsc --noEmit` and unit-test TypeScript check).
- `npm run test:unit` — passed: 120 files, 1087 tests.
- `npx vitest run tests/unit/components/useSheetDismiss.test.tsx tests/unit/components/motionProfiles.test.ts` — passed: 2 files, 22 tests, including async close approval/rejection, visual-viewport resize, and missing-animation-callback deadline cases.
- `npm run test:e2e -- --reporter=list` — 214 tests: 201 passed, 12 failed, 1 skipped. Full-run failures included five Main initial-load/reload timeouts, a legacy Simulation route timeout, a cloud settings screenshot waiting for fonts, three existing brand-welcome launch assertions, and two Portfolio/app-journey assertions. The Portfolio reduced-motion launcher test passed alone; the local-cash validation test and both changed dirty-dismissal flows also passed in focused reruns. The remaining brand-welcome assertions fail to find the landing at 390px, 768px, and after signed-out launch. The full E2E run therefore remains non-green.
- Focused drag-close browser checks passed for Main expense-assistant save success/failure, Remaining Allocation confirmation, Portfolio editor and target-sheet discard confirmation, and the nested-confirmation focus return. The Portfolio local-cash validation case that failed in the full run passed alone as part of the same three-test focused group.
- Focused viewport checks passed for 390×844 and 390×600 drag surfaces, 767/768 breakpoint behavior, 768×1024 sheet layout, 769px panel layout, and 1280×900 panel layout. Full-run navigation and font timeouts did not reproduce in relevant focused checks.
- Main and Portfolio drag-close browser checks sampled sheet position over animation frames, checked monotonic exit, bounded return overshoot, and focus restoration. Unit coverage checks quick-flick timing, upward/horizontal gestures, pointer cancellation/capture loss, resize, a second pointer, interactive header children, blocked/non-topmost sheets, rejected close requests, async approval, and reduced motion.
- Physical iOS Safari/Android Chrome and an on-device software-keyboard resize were not tested. The final visual-viewport resize addition and the Portfolio in-sheet focus fallback have focused unit/browser coverage; automated Chromium Pointer Event coverage does not replace device verification.

## Changed product contracts

`DESIGN.md`, the shared Anime.js motion spec, and the Portfolio editor hierarchy spec now describe the applied profiles, sheet drag bounds, reduced-motion behavior, and bounded presentation-exit exception. Main data ownership, Portfolio draft/apply boundaries, and workspace/storage protocol contracts were not changed.
