# Portfolio editor verification — 2026-09-16

**Status: automated gates pass; acceptance is incomplete because invalid raw cash input can still open apply confirmation.** See the unresolved finding below. This is not a release-complete claim.

Task 5 verifies the [approved design](../../specs/2026-09-16-portfolio-editor-hierarchy-design.md) and [implementation plan](../../plans/2026-09-16-portfolio-editor-hierarchy.md). Production baseline: `fdc68ec5f42a68ba1e257cd87bcb1ea9a8eb1b16`. The only test change replaces the retired inline gold textbox with row selection → item amount → 완료 in [motion-system.spec.ts](../../../../tests/motion-system.spec.ts); its amount, applied-state, motion, sorting, accessibility and reduced-motion assertions remain intact. No production source, shared component, storage contract or dependency change is included.

## Commands and results

Executed independently on **2026-09-16 KST**, against the baseline above plus this commit's motion test correction. Final runs were made without concurrent repository writes.

| Exact command | Result | Output |
| --- | --- | --- |
| `npm run check` | PASS, source and unit TypeScript, exit 0 | [check.log](check.log) |
| `npm run test:unit -- tests/unit/portfolio tests/unit/components` | PASS, 25 files / 228 tests, exit 0 | [unit.log](unit.log) |
| `npx playwright test tests/portfolio.spec.ts tests/motion-system.spec.ts --project=chromium --reporter=list` | PASS, 28 passed / 1 skipped, exit 0, 44.8s | [portfolio-motion.log](portfolio-motion.log) |
| `npx playwright test tests/account-workspace.spec.ts --project=cloud --reporter=list` | PASS, 66 tests, exit 0, 3.5m | [account-workspace.log](account-workspace.log) |
| `git diff --check` | PASS, exit 0, no output | [diff-check.log](diff-check.log) |

The skipped case is the PWA offline-revisit gate, explicitly restricted to `pwa-chromium`, outside the requested Chromium project. Full cross-app E2E was not added: no shared `SegmentedControl`, `MoneyAdjustments`, motion hook or `app-foundation.css` source changed. The requested motion suite itself exercises Main, Simulation and Portfolio.

Initial run: 24 passed, 4 failed, 1 skipped. Three motion cases reproduced the obsolete `금 금액` locator. One save-error case was interrupted by a Vite reload while the expectation was edited. A subsequent run passed the motion cases but had one `Execution context was destroyed` during `document.fonts.ready` while evidence JSON files were written in the watched repository. Capture output was moved to `/tmp`, then the exact complete command passed without retries or assertion relaxation. [Initial output](portfolio-motion-initial.log) and [interrupted run](portfolio-motion-interference.log) retain those failures; they are not counted as passing runs.

## Capture method and fixture

All after images were freshly captured through **Orca's embedded browser**, via public `orca` CLI, at a dedicated local test-harness Vite URL (`http://127.0.0.1:5195/IndividualSavingsFlowUI/apps/portfolio/`). This harness supplies the repository's local workspace adapter. Account behavior is separately covered by the cloud RPC fixture suite, not by these screenshots. Task 4 screenshots were not reused.

Each resize was followed by actual `innerWidth`/`innerHeight` measurement. Resizing occurred **after reload**, because Orca reload restores its native viewport. Fonts and dialog geometry were allowed to settle before capture. [Capture metrics](capture-metrics.json) record actual dimensions, dialog rectangles, horizontal overflow, scroll-body/footer geometry and button sizes. Before PNG dimensions were independently read from their image headers.

The comparison fixture is the same 800,000원 source-state fixture used before implementation: 글로벌 인덱스 400,000원 (50%, 성장), 채권 200,000원 (25%, 안정), 금 120,000원 (15%, 안정), automatic cash 80,000원 (10%). Clean captures retain those exact amounts. Dirty captures change only 글로벌 인덱스 to 350,000원 and cash to 130,000원. Error captures keep its uncommitted local input at 999,999원.

| Actual viewport | Before | Clean after | Dirty after | Error after |
| --- | --- | --- | --- | --- |
| 390×844 | [before](before-390-edit.png) | [clean](after-390-clean.png) | [dirty](after-390-dirty.png) | [error](after-390-error.png) |
| 768×1024 | [before](before-768-edit.png) | [clean](after-768-clean.png) | [dirty](after-768-dirty.png) | [error](after-768-error.png) |
| 1280×900 | [before](before-1280-edit.png) | [clean](after-1280-clean.png) | [dirty](after-1280-dirty.png) | [error](after-1280-error.png) |

Visual comparison: 390px previously exposed only the first full inline form and part of the next. It now shows the title, monthly amount, growth/stability summary, all three targets, cash and add action in the first screen. Dirty state reserves space for its status and actions. At 768px the same hierarchy remains a bottom sheet; desktop is a right panel with the inert result visible behind it. No measured document/dialog/body horizontal overflow; the clean three-target row and add controls have at least 44px height. Error text is beside its field and completion remains disabled until valid.

## Acceptance matrix

| Condition | Evidence and result |
| --- | --- |
| Reduced visible height | [390×600 error](after-390x600-error.png): item dialog is 528px (88%); amount, associated error, cancel and completion remain reachable. Body scroll is separate from the fixed header/footer. Real OS virtual keyboard was **not tested**; this is a reduced-height proxy. |
| Breakpoint with open input | [767](after-boundary-767.png), [768](after-boundary-768.png), [769](after-boundary-769.png), [focus measurements](boundary-focus.json): same open parent/item dialogs, parent inert, focused input and local `999,999` survive; sheet changes to panel at 769px. |
| Cash 100%, one target | [zero targets](after-390-0-targets.png), [one target](after-390-1-targets.png); cash and add entry remain available. Setup/revisit tests also cover the normal one-target journey. |
| Ten targets | 390px [clean](after-390-10-clean.png)/[dirty](after-390-10-dirty.png)/[error](after-390-10-error.png); 768px [clean](after-768-10-clean.png)/[dirty](after-768-10-dirty.png)/[error](after-768-10-error.png); desktop [clean](after-1280-10-clean.png)/[dirty](after-1280-10-dirty.png)/[error](after-1280-10-error.png). Long rows scroll within the body; summary and actions stay accessible. E2E covers dirty/error layout at 390/640/768/1280, return focus and scroll position, and cash error above footer. Orca captures show the maximum-count add restriction and reason. The apply behavior with an invalid cash field fails acceptance, as recorded below. |
| Long names and large money | [large amount](after-390-10-targets.png), [bottom/cash](after-390-10-targets-bottom.png): ten long Korean names, displayed monthly basis 1,000,000,000원 and 90,000,000원 per target remain readable without horizontal overflow. The 640px E2E is a 200%-desktop-width equivalent; **actual 200% browser zoom was not tested**. |
| Keyboard, pointer and touch | Automated pointer/keyboard paths cover entry, row selection, segmented choices, completion, discard, Tab cycling, Escape and focus return. Orca exercised Shift+Tab/Tab on the open item input. Control dimensions meet 44px; physical touchscreen gestures and native mobile IME were **not tested**. |
| Validation | [duplicate name](after-390-duplicate.png), [minimum amount](after-390-minimum.png), three-viewport over-allocation captures, [manual cash remainder](after-390-manual-unallocated.png). Inputs remain intact, errors are field-associated, and incomplete manual allocation explains why apply is disabled. Focused unit/E2E checks assert the linkage and corrected path. |
| Clean/dirty/save/failure/recovery | Unit checks cover no false dirty state, deferred saving copy and pending locks. Cloud suite covers delayed confirmation, failed draft save, revision conflict, retry, recovered unsent draft and read-only offline dialog. Local save-error E2E confirms final control remains above the error footer. |
| Motion | Normal/reduced browser suite preserves final semantic values and focus. Portfolio unit cases inject animation/scope initialization failures; shared component tests verify interrupted animation cleanup, partial-scope recovery and unmount cleanup. No animation callback gates persistence or focus. A separate real-device rapid-tapping stress run was not performed. |
| Main/Simulation/retained data | Portfolio/account regressions assert slice ownership, latest Main reads, preserved other-app data and retained locations/accountMap. No schema v5/protocol 5 or migration contract changed. |

## Unresolved acceptance finding

**P2 — invalid cash input does not block apply confirmation.** At every captured width, start with ten targets (72,000원 each; cash 80,000원), edit the first to 50,000원 and complete, then expand cash, type 900,000원 and blur. The field retains `900,000` and shows `투자금을 초과해 배분할 수 없습니다.`, while the draft summary still uses the previous valid automatic cash 102,000원. `적용` remains enabled and opens [the confirmation](after-1280-invalid-cash-apply.png) with `배분 적용` enabled and old cash 12.8%. Final save was not invoked.

This fails the approved requirement that invalid input preserve the editing context and explain/block application until resolved. Existing assertions cover cash error association, focus and containment but not this combined dirty-draft + invalid-raw-cash apply path. No production fix was made within the QA-only task. Next owner: Portfolio frontend/parent coordinator, starting with this finding and the approved spec; add a focused regression before changing the raw cash validation/apply boundary.

## Documentation and limits

Relative links in this document resolve. Its current-product claims were compared with [PRD](../../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [README](../../../../README.md), [DESIGN](../../../../DESIGN.md), and the approved spec. Main remains the owner of the five monthly amounts; Portfolio owns only its aggregate plan/draft. Retired Account Map UI remains absent while retained storage survives.

Only Chromium was exercised. Cloud tests use the fake Supabase RPC boundary, not live production accounts. Actual virtual keyboard, physical touch, real 200% browser zoom and PWA offline build verification remain explicit manual/release checks. Before images and the pre-existing untracked implementation plan are preserved, not staged by Task 5. The existing `package-lock.json` change is excluded.
