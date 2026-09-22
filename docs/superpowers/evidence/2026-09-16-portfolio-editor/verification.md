# Portfolio editor verification — 2026-09-16

**Status: Task 5 verification passed within the documented Chromium/local-harness scope.** The invalid-raw-cash finding is resolved and independently reverified; real-device/zoom/PWA limits remain listed below.

Task 5 verifies the [approved design](../../specs/2026-09-16-portfolio-editor-hierarchy-design.md). Final tested production commit: `57bc23ecec610e21df5c9d326265014dd9b28b90`, including cash-validation fixes `1c780797`, `11341b70`, and `57bc23ec`. Initial evidence used baseline `fdc68ec5f42a68ba1e257cd87bcb1ea9a8eb1b16`. The initial Task 5 test change replaces the retired inline gold textbox with row selection → item amount → 완료 in [motion-system.spec.ts](../../../../tests/motion-system.spec.ts); its amount, applied-state, motion, sorting, accessibility and reduced-motion assertions remain intact. No production source, shared component, storage contract or dependency change is included.

## Commands and results

Executed independently on **2026-09-16 KST**, against final commit `57bc23ec` for check/unit/Portfolio/motion, with the earlier account-suite run identified separately. Final runs were made without concurrent repository writes. Fresh check/unit/browser runs started at approximately 12:12 KST; subsequent Orca checks used the same commit.

| Exact command | Result | Output |
| --- | --- | --- |
| `npm run check` | PASS, source and unit TypeScript, exit 0 | [postfix-check.log](postfix-check.log) |
| `npm run test:unit -- tests/unit/portfolio tests/unit/components` | PASS, 25 files / 233 tests, exit 0 | [postfix-unit.log](postfix-unit.log) |
| `npx playwright test tests/portfolio.spec.ts tests/motion-system.spec.ts --project=chromium --reporter=list` | PASS, 31 passed / 1 skipped, exit 0, 47.5s | [postfix-portfolio-motion.log](postfix-portfolio-motion.log) |
| `npx playwright test tests/account-workspace.spec.ts --project=cloud --reporter=list` | PASS retained from initial baseline: 66 tests, exit 0, 3.5m | [account-workspace.log](account-workspace.log) |
| `git diff --check` | PASS, exit 0, no output | [diff-check.log](diff-check.log) |

The account suite was not repeated after the three follow-up fixes: their production diff is limited to local Portfolio validation state and action eligibility in `AllocationEditor`, `PortfolioApplyBar`, `PortfolioEditSurface`, and `PortfolioSetupFlow`. No repository adapter, account boundary, save/revision protocol, reducer, or storage source changed. The existing 66-test account run remains boundary evidence; fresh Portfolio tests exercise blocked confirmation, correction, final apply and Main preservation.

The skipped case is the PWA offline-revisit gate, explicitly restricted to `pwa-chromium`, outside the requested Chromium project. Full cross-app E2E was not added: no shared `SegmentedControl`, `MoneyAdjustments`, motion hook or `app-foundation.css` source changed. The requested motion suite itself exercises Main, Simulation and Portfolio.

Initial run: 24 passed, 4 failed, 1 skipped. Three motion cases reproduced the obsolete `금 금액` locator. One save-error case was interrupted by a Vite reload while the expectation was edited. A subsequent run passed the motion cases but had one `Execution context was destroyed` during `document.fonts.ready` while evidence JSON files were written in the watched repository. Capture output was moved to `/tmp`, then the exact complete command passed without retries or assertion relaxation. [Initial output](portfolio-motion-initial.log) and [interrupted run](portfolio-motion-interference.log) retain those failures; they are not counted as passing runs.

## Capture method and fixture

Initial `after-*` images are retained as dated diagnostic evidence from `fdc68ec5`; `final-*` images below were freshly recaptured after the fixes. All images were captured through **Orca's embedded browser**, via public `orca` CLI, at a dedicated local test-harness Vite URL (`http://127.0.0.1:5195/IndividualSavingsFlowUI/apps/portfolio/`). This harness supplies the repository's local workspace adapter. Account behavior is separately covered by the cloud RPC fixture suite, not by these screenshots. Task 4 screenshots were not reused.

Each resize was followed by actual `innerWidth`/`innerHeight` measurement. Resizing occurred **after reload**, because Orca reload restores its native viewport. Fonts and dialog geometry were allowed to settle before capture. [Capture metrics](capture-metrics.json) record actual dimensions, dialog rectangles, horizontal overflow, scroll-body/footer geometry and button sizes. Before PNG dimensions were independently read from their image headers.

The comparison fixture is the same 800,000원 source-state fixture used before implementation: 글로벌 인덱스 400,000원 (50%, 성장), 채권 200,000원 (25%, 안정), 금 120,000원 (15%, 안정), automatic cash 80,000원 (10%). Clean captures retain those exact amounts. Dirty captures change only 글로벌 인덱스 to 350,000원 and cash to 130,000원. Error captures keep its uncommitted local input at 999,999원.

| Actual viewport | Before | Clean after | Dirty after | Error after |
| --- | --- | --- | --- | --- |
| 390×844 | 원본 미보관 | [clean](after-390-clean.png) | [dirty](after-390-dirty.png) | [error](after-390-error.png) |
| 768×1024 | 원본 미보관 | [clean](after-768-clean.png) | [dirty](after-768-dirty.png) | [error](after-768-error.png) |
| 1280×900 | 원본 미보관 | [clean](after-1280-clean.png) | [dirty](after-1280-dirty.png) | [error](after-1280-error.png) |

Visual comparison: 390px previously exposed only the first full inline form and part of the next. It now shows the title, monthly amount, growth/stability summary, all three targets, cash and add action in the first screen. Dirty state reserves space for its status and actions. At 768px the same hierarchy remains a bottom sheet; desktop is a right panel with the inert result visible behind it. No measured document/dialog/body horizontal overflow; the clean three-target row and add controls have at least 44px height. Error text is beside its field and completion remains disabled until valid.

## Acceptance matrix

| Condition | Evidence and result |
| --- | --- |
| Reduced visible height | [390×600 error](after-390x600-error.png): item dialog is 528px (88%); amount, associated error, cancel and completion remain reachable. Body scroll is separate from the fixed header/footer. Real OS virtual keyboard was **not tested**; this is a reduced-height proxy. |
| Breakpoint with open input | [767](after-boundary-767.png), [768](after-boundary-768.png), [769](after-boundary-769.png), [focus measurements](boundary-focus.json): same open parent/item dialogs, parent inert, focused input and local `999,999` survive; sheet changes to panel at 769px. |
| Cash 100%, one target | [zero targets](after-390-0-targets.png), [one target](after-390-1-targets.png); cash and add entry remain available. Setup/revisit tests also cover the normal one-target journey. |
| Ten targets | 390px [clean](after-390-10-clean.png)/[dirty](after-390-10-dirty.png)/[error](after-390-10-error.png); 768px [clean](after-768-10-clean.png)/[dirty](after-768-10-dirty.png)/[error](after-768-10-error.png); desktop [clean](after-1280-10-clean.png)/[dirty](after-1280-10-dirty.png)/[error](after-1280-10-error.png). Long rows scroll within the body; summary and actions stay accessible. E2E covers dirty/error layout at 390/640/768/1280, return focus and scroll position, and cash error above footer. Orca captures show the maximum-count add restriction and reason. The original error images show the discovered apply defect; the final post-fix evidence below supersedes that behavior. |
| Long names and large money | [large amount](after-390-10-targets.png), [bottom/cash](after-390-10-targets-bottom.png): ten long Korean names, displayed monthly basis 1,000,000,000원 and 90,000,000원 per target remain readable without horizontal overflow. The 640px E2E is a 200%-desktop-width equivalent; **actual 200% browser zoom was not tested**. |
| Keyboard, pointer and touch | Automated pointer/keyboard paths cover entry, row selection, segmented choices, completion, discard, Tab cycling, Escape and focus return. Orca exercised Shift+Tab/Tab on the open item input. Control dimensions meet 44px; physical touchscreen gestures and native mobile IME were **not tested**. |
| Validation | [duplicate name](after-390-duplicate.png), [minimum amount](after-390-minimum.png), three-viewport over-allocation captures, [manual cash remainder](after-390-manual-unallocated.png). Inputs remain intact, errors are field-associated, and incomplete manual allocation explains why apply is disabled. Focused unit/E2E checks assert the linkage and corrected path. |
| Clean/dirty/save/failure/recovery | Unit checks cover no false dirty state, deferred saving copy and pending locks. Cloud suite covers delayed confirmation, failed draft save, revision conflict, retry, recovered unsent draft and read-only offline dialog. Local save-error E2E confirms final control remains above the error footer. |
| Motion | Normal/reduced browser suite preserves final semantic values and focus. Portfolio unit cases inject animation/scope initialization failures; shared component tests verify interrupted animation cleanup, partial-scope recovery and unmount cleanup. No animation callback gates persistence or focus. A separate real-device rapid-tapping stress run was not performed. |
| Main/Simulation/retained data | Portfolio/account regressions assert slice ownership, latest Main reads, preserved other-app data and retained locations/accountMap. No schema v5/protocol 5 or migration contract changed. |

## Resolved cash-validation finding and final recheck

**Historical P2, now resolved — invalid cash input did not block apply confirmation.** Initial reproduction at every captured width: start with ten targets (72,000원 each; cash 80,000원), edit the first to 50,000원 and complete, then expand cash, type 900,000원 and blur. The field retained `900,000` and showed `투자금을 초과해 배분할 수 없습니다.`, while the draft summary still used the previous valid automatic cash 102,000원. `적용` remained enabled and opened [the confirmation](after-1280-invalid-cash-apply.png) with `배분 적용` enabled and old cash 12.8%. Final save was not invoked.

The implementation follow-up now keeps the raw cash error local across unrelated valid edits, lifts its validity to block both applied-editor `적용` and setup `배분 확인`, and clears the lifted block when the editor unmounts. The QA task made no production changes.

Independent post-fix Orca checks reproduce the same ten-target error at actual 390×844, 768×1024 and 1280×900, retain `900,000` and its linked field error after a valid target rename, and verify `적용` is disabled with no confirmation open. Correcting to 102,000 clears the error and enables apply. Setup similarly preserves the rejection across a valid target rename, automatic cash reset clears the block, and back → re-enter remount discards the raw invalid text without retaining a stale block. Focused unit tests additionally inject an error into an already open apply confirmation and setup review: the final confirm action is disabled and the apply callback is not invoked. The new Playwright cases also complete corrected/reset apply and assert saved target name, Main amount preservation, and cash-only setup completion.

| Final actual viewport | Clean same 800k/three-target fixture | Ten-target cash error blocked |
| --- | --- | --- |
| 390×844 | [clean](final-390-clean.png) | [blocked](final-390-cash-blocked.png) |
| 768×1024 | [clean](final-768-clean.png) | [blocked](final-768-cash-blocked.png) |
| 1280×900 | [clean](final-1280-clean.png) | [blocked](final-1280-cash-blocked.png) |

Additional final evidence: [corrected cash](final-390-cash-corrected.png), [setup blocked after unrelated edit](final-390-setup-cash-blocked.png), [automatic reset](final-390-setup-reset.png), [setup remount](final-390-setup-remount.png), [scenario assertions](cash-validation-checks.json), and [final viewport/geometry metrics](postfix-capture-metrics.json). Prior failure captures are retained intentionally and do not describe current behavior.

## Documentation and limits

Relative links in this document resolve. Its current-product claims were compared with [PRD](../../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [README](../../../../README.md), [DESIGN](../../../../DESIGN.md), and the approved spec. Main remains the owner of the five monthly amounts; Portfolio owns only its aggregate plan/draft. Retired Account Map UI remains absent while retained storage survives.

Only Chromium was exercised. Cloud tests use the fake Supabase RPC boundary, not live production accounts. Actual virtual keyboard, physical touch, real 200% browser zoom and PWA offline build verification remain explicit manual/release checks. The original report said the before images and implementation plan were left untracked by Task 5. The 2026-09-22 documentation audit found neither in Git history nor the retained local execution archive; their broken links have been removed. Final after-image evidence remains available. The existing `package-lock.json` change is excluded.
