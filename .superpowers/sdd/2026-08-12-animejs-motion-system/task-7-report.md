# Task 7 Report: Journey launcher, overlays, and Account Map readiness

## Status

Implemented and committed as `1ceea69` (`feat(journey): add restrained shared motion`).

The implementation keeps React state, DOM removal, ARIA state, navigation, focus handling, and touch suppression synchronous. Anime.js only owns short visual interpolation and always leaves a usable final UI if setup fails or reduced motion is active.

## Files and purpose

- `src/journey/ui/AppLauncher.tsx`
  - Reveals the current-app line with the 120ms fast token and 4px downward settlement.
  - Reveals overflow from 4px above with the same fast token.
  - Leaves `href`, `aria-expanded`, resize focus transfer, Escape/outside dismissal, and long-press suppression unchanged and synchronous.
- `src/journey/ui/ManagementConfirmationDialog.tsx`
  - Reveals inner dialog content with the 180ms normal token and 4px vertical travel so the centered dialog transform is not overwritten.
  - Preserves modal lifecycle, focus trap, pending behavior, immediate unmount, and focus return.
- `src/journey/ui/ReadinessApp.tsx`
  - Reveals readiness content with the 180ms normal token and 8px vertical travel once per mount.
  - Recreates the one visible reveal after React StrictMode cancels its pre-paint setup, without replaying on ordinary rerenders.
  - Adds no repository, workspace, or storage dependency.
- `src/components/common/Toast.tsx`
  - Replaces bounce with a 180ms opacity/8px vertical reveal.
  - Separates the existing horizontal centering transform onto an outer wrapper and adds an accessible synchronous close action.
- `src/main/ui/dashboard/SummaryDashboard.tsx`
  - Replaces the 12px CSS mobile editor animation with an 8px, 180ms shared reveal.
  - Uses the approved 8px horizontal direction for the desktop side panel.
  - Preserves focus trap/return, backdrop/Escape handling, dirty confirmation, inert dashboard state, and immediate removal.
- `src/portfolio/ui/PortfolioDialog.tsx`
  - Uses a 4px vertical reveal for centered confirmations, 8px vertical reveal for sheets, and 8px horizontal reveal for panels, all at 180ms.
  - Disables the legacy full-height sheet keyframe on the dialog element.
  - Preserves the existing `dataPresentation` API supplied by `PortfolioEditSurface` and `PortfolioItemSheet`, focus trap/return, Escape, and optional backdrop close.
- `src/journey/ui/journey.css`
  - Removes the superseded current-line CSS transition so the shared scope owns that reveal.
- `tests/unit/journey/AppLauncher.test.tsx`
  - Covers fast current-line/overflow motion, immediate ARIA/DOM/focus state, confirmation motion and synchronous close, toast motion, and retained touch behavior.
- `tests/unit/journey/ReadinessApp.test.tsx`
  - Covers normal, rerender, StrictMode, and reduced-motion reveal behavior plus zero storage reads/writes.
- `tests/unit/main/SummaryDashboard.test.tsx`
  - Covers mobile sheet direction/token, immediate close/focus return, and reduced-motion final state.
- `tests/unit/portfolio/PortfolioDialogs.test.tsx`
  - Covers centered modal, bottom sheet, side-panel directions/tokens, and reduced-motion final state while retaining existing focus tests.
- `tests/app-journey.spec.ts`
  - Adds Account Map localStorage operation instrumentation, synchronous overflow ARIA/DOM/focus checks, reduced-motion final geometry, and Main mobile editor containment/focus evidence.

`src/portfolio/ui/PortfolioEditSurface.tsx` did not require a code change: its existing `dataPresentation="sheet" | "panel"` contract is now consumed directly by `PortfolioDialog` to select the approved direction.

## TDD evidence

### Baseline

```text
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
4 files passed; 39 tests passed
```

### RED

The same command after adding the new behavior tests failed only the nine new assertions:

```text
4 files failed; 9 failed, 39 passed
```

Failures were the intended missing contracts: no Anime call for current-line/overflow/Main/Portfolio, no motion wrapper for confirmation/toast/readiness/modal, and no reduced-motion final inline state.

A later StrictMode regression test also failed as intended (`expected 2 reveal setups, received 1`) before the mount guard was corrected.

### GREEN

```text
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
4 files passed; 49 tests passed

npx vitest run tests/unit/journey/AppManagementMenu.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
3 files passed; 41 tests passed

npx playwright test tests/app-journey.spec.ts
14 passed

npx playwright test tests/portfolio.spec.ts --grep "contains the mobile editor|isolates applied editing|contains the focused target sheet|protects dirty mobile"
4 passed

npm run check
check:source and check:unit passed

git diff --check
passed
```

## Focus, storage, and viewport evidence

- Overflow: `aria-expanded` changes immediately; Escape and outside pointer remove the region immediately and return focus to `앱 더보기` without an exit animation.
- Confirmation and Portfolio dialogs: existing trap tests still cycle Tab/Shift+Tab; Escape removes the dialog before queued focus return; backdrop behavior remains opt-in.
- Main mobile editor: dashboard controls become `inert`, the editor is immediately `aria-modal="true"`, Escape removes it and returns focus to the opening summary card.
- Portfolio editor/item sheets: focused unit and browser flows retain cancel, dirty confirmation, nested confirmation, and opener focus restoration.
- Touch: all existing launcher long-press, multi-touch cancellation, click/context-menu suppression, expiration, and ordinary navigation tests remain green.
- Account Map: unit spies record zero `getItem`, `setItem`, or `removeItem` calls; browser instrumentation also records an empty localStorage call list on readiness navigation.
- 390px, 768px, and 1280px: app-journey checks launcher geometry, 16px popover/overflow gutters, target sizes, no horizontal overflow, and readiness availability at all required widths.
- Reduced motion: readiness, current line, overflow, Main mobile editor, and Portfolio sheet commit opacity 1 and zero translation before paint; no Anime call is made in reduced-motion unit cases.

## Self-review

- Motion is limited to opacity and 4–8px translation; the old Main 12px editor and Portfolio full-height sheet motion no longer run.
- Fast (120ms) is used only for launcher current-line/overflow; normal (180ms) is used for disclosures, overlays, readiness, and toast.
- Bottom sheets move vertically; side panels move horizontally; centered dialogs animate inner content so their centering transform remains intact.
- No exit animation or retained closed subtree was introduced. All overlays remain conditional React DOM.
- No route delay, href mutation, storage/schema change, Account Map repository access, or Main write ownership change was introduced.
- Reveal setup does not pre-hide the React result. If Anime construction or its frame loop is unavailable, the already-rendered final UI remains visible.
- Scope cleanup remains owned by `useAnimeScope`; StrictMode and ordinary rerender behavior have explicit coverage.
- No ledger file was edited.

## Concerns

An exploratory run of two unrelated `tests/main-react.spec.ts` cases exposed existing stale assertions outside Task 7's file scope:

- `live dashboard keeps ... contained` selects the first `.cashflow-donut__center span`, which is now the pre-existing `sr-only` semantic value rather than the visible label, so `centerWithinChart` is false before any editor interaction.
- `dashboard edit persists ...` still expects the removed persistent `저장됨` status, contrary to the approved motion spec and current passing SummaryDashboard unit contract.

Task 7 does not modify either the donut DOM or this legacy Main E2E assertion. The Task 7-required Journey suite and the independent Main mobile editor browser coverage pass. These stale assertions should be updated by the Main/E2E owner rather than folded into the overlay change.

## Review fix round

Implemented the two Important findings from `task-7-review.md` in code/test commit `86b1483` (`fix(journey): complete overlay motion contracts`).

### Fixes

- `AppManagementMenu` now applies the shared 180ms normal reveal to both the management popover and icon-help disclosure. Each settles from 4px above using only opacity and vertical translation. Reduced motion writes opacity 1 and zero translation before paint without starting Anime.
- The popover/disclosure remain conditional DOM. Trigger/help `aria-expanded`, DOM removal, outside touch dismissal, and focus restoration retain their existing state lifecycle and never wait for an exit animation.
- `ManagementConfirmationDialog` and `PortfolioDialog` now assign each focus effect setup a generation. A StrictMode preflight cleanup queues its focus return, but the immediately following setup advances the generation and invalidates that stale microtask. A real close/unmount has no successor generation, so it still restores opener focus.

### Review-round RED

```text
npx vitest run tests/unit/journey/AppManagementMenu.test.tsx
1 file failed; 2 failed, 9 passed
```

The new tests failed because neither the management popover nor help disclosure invoked shared motion or wrote a reduced-motion final state.

```text
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
2 files failed; 2 failed, 27 passed
```

Both new StrictMode regressions failed with opener focus received instead of the dialog's initial cancel control.

### Review-round GREEN and integration evidence

```text
npx vitest run tests/unit/journey/AppManagementMenu.test.tsx
1 file passed; 11 tests passed

npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
2 files passed; 29 tests passed

npx vitest run tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
7 files passed; 94 tests passed

npx playwright test tests/app-journey.spec.ts
14 passed

npx playwright test tests/portfolio.spec.ts --grep "contains the mobile editor|isolates applied editing|contains the focused target sheet|protects dirty mobile"
4 passed

npm run check
check:source and check:unit passed

git diff --check
passed
```

The Journey browser suite continues to cover management popover/help containment and focus restoration at 390px, 768px, and 1280px. Portfolio overlay browser tests continue to cover mobile confirmation, sheet/panel isolation, 768px containment, dirty close protection, and opener focus restoration.
