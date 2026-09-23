# Unified Sheet and Modal Verification

Reviewed branch: `jinhoOps/unified-sheet-modal`

Date: 2026-09-23

## Automated checks

| Command | Result |
| --- | --- |
| `npm run check:ci` | Passed: 129 test files, 1,147 unit tests |
| `npx vitest run tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/useSheetDismiss.test.tsx tests/unit/journey/AppManagementMenu.test.tsx --reporter=dot` | Passed: 58 tests |
| `npx playwright test --workers=1 --reporter=line --retries=1` | 251 passed, 4 flaky cases passed on retry, 1 failed, 1 skipped (10.7 minutes) |
| Focused reruns of all six failures from the first full E2E run | Passed: four Portfolio containment/focus cases, Main reset at 1280px, and right-edge tooltip after resize |
| `npx playwright test tests/portfolio.spec.ts --grep 'closes on outside clicks, preserves rejected changes, and restores the entry row|discards a dirty mobile Portfolio editor through its close confirmation' --workers=1 --reporter=line` | Passed: 2 tests |
| Portfolio exit-lock and containment focus group | Passed: clean editor input is blocked after approval; four footer/focus/long-list cases passed |

The full browser suites exercised 257 Chromium tests across 390px, 768px, desktop, short-screen, and cloud-backed routes. The latest full run's only final failure is the Main right-edge tooltip viewport-resize check. It does not touch the dialog surfaces in this change: the tooltip component, its styles, and its test are unchanged. On the feature branch, repeating that test ten times produced 4 passes and 6 failures; on the unmodified local `main` worktree, the same command produced 6 passes and 4 failures. A focused single run passed on both worktrees. This confirms a pre-existing timing-sensitive tooltip failure, and it remains separate from the shared dialog change.

The first full run without retries produced 250 passes, 6 failures, and 1 skip. Each of those six tests passed when rerun alone. The retry-enabled full run recovered four intermittent cases; their results are counted separately as flaky rather than clean passes. The one test skipped by its project guard remained skipped.

## Motion measurements

`tests/main-react.spec.ts` records requestAnimationFrame samples until each animation reaches its final state. It measures the observed browser interval separately from the configured 450ms Anime.js duration.

| Motion | Observed completion |
| --- | ---: |
| Mobile sheet enter | 448.9ms |
| Mobile sheet return after cancelled drag | 466.7ms |
| Mobile sheet exit | 450.5ms |
| Desktop modal enter | 475.0ms |
| Desktop modal exit | 450.2ms |

All five measurements fall within the requested 400–500ms interval. The 550ms timer remains an error-recovery fallback and was not reached during these measurements.

## Visual evidence

Screenshots are captured after the dialog entrance motion settles. Mobile captures are 390×844; tablet captures are 768×1024; desktop captures are 1280×900.

| App | Mobile sheet | 768px modal | Desktop modal |
| --- | --- | --- | --- |
| Main | [main-dialog-390.png](main-dialog-390.png) | [main-dialog-768.png](main-dialog-768.png) | [main-dialog-1280.png](main-dialog-1280.png) |
| Simulation | [simulation-condition-390x844.png](simulation-condition-390x844.png) | [simulation-condition-768x1024.png](simulation-condition-768x1024.png) | [simulation-condition-1280x900.png](simulation-condition-1280x900.png) |
| Portfolio | [portfolio-edit-390x844.png](portfolio-edit-390x844.png) | [portfolio-edit-768.png](portfolio-edit-768.png) | [portfolio-edit-1280.png](portfolio-edit-1280.png) |

The screenshots show each app using the same responsive presentation boundary: a bottom-attached sheet with a long handle on mobile, then a centered modal without a handle at 768px and desktop. Browser assertions also check the 88dvh bound, centered modal geometry, footer/control containment, no horizontal document overflow, and minimum touch sizes.

## Interaction and compatibility checks

- Actual Chromium CDP touch input verifies body scrolling, fresh downward drag from blank noninteractive space, both ends of the mobile handle, drag cancellation and re-drag during return.
- Interactive controls—including text input, labels, buttons, toggles and sliders—remain interactive and do not start dismissal.
- Escape, backdrop, close buttons, dirty confirmation, pending-save guards, rejected saves, nested confirmation and focus restoration were exercised.
- An approved dialog surface becomes inert during its exit animation. A browser pointer regression confirms that a clean Portfolio editor cannot be changed during the exit interval; async pending and rejected guards remain interactive.
- The open surface survives the 767px/768px transition and viewport-height changes without losing its draft.
- `npm run check:ci` and focused shared-dialog E2E passed. The full E2E result and the known baseline tooltip failure are recorded above. `git diff --check` is rerun in the final check.
- No workspace schema, server protocol, retained `accountMap`/`locations`, or app-owned storage behavior was changed.

## Device limitations

Interaction and visual checks ran in Chromium with Playwright viewport emulation and CDP touch input. Physical iOS Safari, Android Chrome, VoiceOver, and TalkBack were not tested in this workspace.
