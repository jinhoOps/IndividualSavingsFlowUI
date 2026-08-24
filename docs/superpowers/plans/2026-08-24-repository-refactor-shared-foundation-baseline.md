# Shared Foundation Baseline

## Execution worktree and provenance

The baseline was executed in the isolated worktree `/Users/jinho/orca/IndividualSavingsFlowUI/.worktrees/refactor-shared-foundation` on branch `codex/refactor-shared-foundation`. Before baseline changes, the recorded command output was:

```text
## codex/refactor-shared-foundation
```

The baseline HEAD was `2119b7deb27c7c48b74d3f0b3028d23b4603252` (`2119b7d docs: plan shared refactor foundation`). `origin/main` at verification is `b1250aaca6251d4e40047de6c4fcca367373a44b` (`b1250aa fix(main): contain the review bar in its wide card`). `git merge-base 2119b7d origin/main` equals `b1250aaca6251d4e40047de6c4fcca367373a44b`, and `git rev-list --left-right --count 2119b7d...origin/main` returned `2 0`: the baseline commit contains the then-current `origin/main` plus two commits. The later documentation commits are descendants of this baseline and do not change source provenance.

## Commands and results

Baseline was captured on branch `codex/refactor-shared-foundation` at commit `2119b7d` (`docs: plan shared refactor foundation`). The worktree was clean before the checks. No source changes were made for this task.

| Command | Exit status | Result | Generated-file changes |
| --- | ---: | --- | --- |
| `npm run check` | 0 | TypeScript source and unit-project checks passed. | None |
| `npm run test:unit` | 0 | 96 test files passed; 1,088 tests passed. Node emitted the expected localStorage experimental warnings. | None |
| `npm run test:e2e` | 1 | 126 passed, 4 failed, 61 skipped out of 191 tests. Failures were pre-existing baseline failures: one deficit geometry assertion (`actualOverflowRatio`, expected 2 and received -1) and three Main assembly-width assertions expecting `app-wide-visual` but receiving `allocation-bar__visual-stage`. | Playwright produced test-result artifacts under the ignored test-results directory. |
| `npm run build` | 0 | Vite production build passed (1,986 modules transformed); PWA generated `dist/sw.js` and Workbox assets. | The build bumped version `0.11.94` to `0.11.95` in `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, and `shared/legacy/sw.js`; those generated edits were reverted before this document was committed. |
| `git status --short` | 0 | After reverting build-generated edits, only this baseline document is intended to be staged. | None retained |
| `git diff --check` | 0 | No whitespace errors. | None |

The E2E skips are intentional in the existing suite (including the PWA offline revisit and legacy/step1 audit cases); they were not changed by this task. The E2E failures are classified as baseline concerns, not refactor regressions.

### E2E failure and skip references

Re-run with `npm run test:e2e` from this worktree. The four failures were:

- `tests/main-react.spec.ts:1008` — `review assembly captures timed deficit geometry and reduced motion`; `actualOverflowRatio` expected `2`, received `-1`.
- `tests/reading-width.spec.ts:404` at 390px — `keeps first and restart Main assembly widths identical at 390px`; `allocation-visual-stage` lacked the expected `app-wide-visual` class.
- `tests/reading-width.spec.ts:404` at 768px — same parameterized title and class mismatch.
- `tests/reading-width.spec.ts:404` at 1280px — same parameterized title and class mismatch.

The 61 skips are existing conditional/audit skips, not newly introduced skips. The concise source list is `tests/motion-system.spec.ts:263` (PWA offline revisit) and the legacy/step1 audit and Phase 09/10 cases in `tests/step1.spec.ts` (reported skipped ranges include lines 77–332, 416–527, 718–751, 812–1264, 1385–1428, 1720–3179); the passing/skipped counts above are the complete run result.

## Inventory

| Candidate | Current owner | Consumers | Focused tests | Planned phase | Removal condition |
| --- | --- | --- | --- | --- | --- |
| `AppShell` and app launcher frame | `src/components/common/AppShell.tsx`, `src/journey/ui/AppLauncher.tsx` | Main, Simulation, Portfolio, Account Map, Readiness; launcher tests and app journey tests | `tests/unit/components/AppShell.test.tsx`, `tests/unit/journey/AppLauncher.test.tsx`, `tests/app-journey.spec.ts`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/account-map.spec.ts` | Phase 1 shared foundation | Preserve launcher order, `aria-current`, focus return, overlay containment, and all supported viewport checks after extraction. |
| `app-content-frame` | `src/styles/app-foundation.css` with markup in Main, Simulation, Portfolio, Account Map, and dashboard UIs | Four supported apps and Main review/setup/dashboard surfaces | `tests/reading-width.spec.ts`, `tests/app-journey.spec.ts`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/account-map.spec.ts` | Phase 1 shared foundation | Remove per-app frame duplication only after identical 390px/768px/1280px widths, overflow containment, and visualization visibility are proven. |
| Direct `ui-button` markup | `src/components/common/Button.tsx` defines the contract; direct class markup remains across Account Map, Journey, Simulation, Portfolio, and Main | Account Map setup/canvas/modal/picker, Journey entry/dialog, Simulation recovery, Portfolio controls, Main controls | `tests/unit/components/Button.test.tsx`, `tests/unit/main/Button.test.tsx`, `tests/account-map.spec.ts`, `tests/app-journey.spec.ts`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts` | Phase 1 shared foundation | Replace direct markup only when native button/link semantics, accessible names, variants, disabled states, and 44px targets remain unchanged. |
| `Surface` panel primitive | `src/components/common/Surface.tsx` | Existing common/UI consumers identified by CodeGraph and source imports | `tests/unit/components/Surface.test.tsx`, `tests/unit/main/Surface.test.tsx`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/account-map.spec.ts` | Phase 1 shared foundation | Extract only repeated panel semantics; no domain state or storage ownership may move into the primitive. |
| Toast/reveal final state | `src/components/common/Toast.tsx` | Toast feedback and its motion lifecycle | `tests/motion-system.spec.ts`, `tests/unit/components/useAnimeScope.test.tsx`, `tests/unit/components/useReducedMotion.test.tsx`, `tests/main-react.spec.ts`, `tests/account-map.spec.ts` | Phase 1 shared feedback/motion | Consolidate `setRevealFinalState` only after toast enter/exit, reduced-motion, and focus/status behavior match. |
| Duplicate `setRevealFinalState` helpers | Local helpers in `Toast.tsx`, `ReadinessApp.tsx`, and `ManagementConfirmationDialog.tsx` | Toast, readiness route, destructive management confirmation dialog | `tests/unit/journey/ReadinessApp.test.tsx`, `tests/unit/journey/AppManagementMenu.test.tsx`, `tests/motion-system.spec.ts`, `tests/app-journey.spec.ts` | Phase 1 shared motion | Remove local copies after a common lifecycle helper has equivalent reduced-motion and cleanup coverage in every caller. |
| `useReducedMotion` / `useAnimeScope` / motion tokens | `src/components/motion/*` | AppLauncher, Toast, management dialog/menu, Main, Simulation, Portfolio, Account Map motion consumers (CodeGraph reports 25 `useAnimeScope` callers) | `tests/unit/components/useAnimeScope.test.tsx`, `tests/unit/components/useReducedMotion.test.tsx`, `tests/motion-system.spec.ts`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/account-map.spec.ts` | Phase 1 shared motion | Keep app-owned animation order and first-visit behavior; remove duplicate lifecycle wrappers only after reduced-motion and cleanup tests pass. |
| `animateVisualNumber` | `src/components/motion/animateVisualNumber.ts` | Main cashflow summary/donut, Simulation comparison, Portfolio summary (9 callers) | `tests/unit/components/animateVisualNumber.test.ts`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts` | Phase 1 shared motion/formatting | Any formatter or animation extraction must preserve displayed rounding, reduced-motion completion, and visual summary semantics. |
| App orchestration entry files | `src/main/ui/MainApp.tsx`, `src/account-map/ui/AccountMapApp.tsx`, `src/portfolio/ui/PortfolioApp.tsx`, `src/simulation/ui/SimulationApp.tsx` and `src/*/main.tsx` | Each supported app’s domain/application/UI modules and shared AppShell | `tests/main-react.spec.ts`, `tests/account-map.spec.ts`, `tests/portfolio.spec.ts`, `tests/simulation.spec.ts`, `tests/unit/account-map/AccountMapManagementMenu.test.tsx`, `tests/unit/simulation/SimulationManagementMenu.test.tsx`, `tests/app-journey.spec.ts` | Phase 2 application orchestration | Split only by command/result and view-model boundaries; app ownership, revision/conflict handling, and URL-only navigation must remain unchanged. |
| Workspace storage and legacy compatibility | `src/workspace/infrastructure/*`, `src/core/storage/*`, `src/main/infrastructure/retiredStorage.ts`, simulation validation/migration | Main, Simulation, Portfolio, Account Map; whole-workspace backup/import and compatibility tests | `tests/unit/main/mainRepository.test.ts`, `tests/main-compat.spec.ts`, `tests/main-react.spec.ts`, `tests/account-map.spec.ts`, `tests/portfolio.spec.ts`, `tests/simulation.spec.ts` | Phase 2/4, with compatibility gates | Do not change storage keys or delete compatibility data until parser, atomic import, raw preservation, and reference searches are green. |
| `apps/main/modules` legacy runtime surface | `apps/main/modules/*.js` (legacy modules) and references in `tests/step1.spec.ts`, compatibility tests, and legacy entry paths | Legacy harness/audit tests and explicit dynamic imports; supported React Main route must remain separate | `tests/step1.spec.ts`, `tests/main-compat.spec.ts` | Phase 4 legacy disposition | For each module, document migrate/re-design/hold/retire, prove replacement and old-data compatibility, remove runtime imports/routes/selectors/storage references, then rerun full checks. |

## Intentional exceptions

- Direct `ui-button` classes in current app UIs are recorded as candidates, not automatically considered defects: several are links, icon/action controls, or app-specific controls whose semantics must be preserved before any wrapper extraction.
- `legacyPhaseA` in the workspace schema and legacy storage keys are compatibility data explicitly retained by the PRD and approved refactor design. Their presence is not evidence that the supported runtime should reuse the legacy UI.
- `apps/main/modules` references in `tests/step1.spec.ts` and compatibility tests are intentional audit/compatibility coverage until Phase 4 has replacement and rollback evidence.
- CodeGraph reported that its index is from the parent worktree (`/Users/jinho/orca/IndividualSavingsFlowUI`) rather than this isolated worktree. The result was used for symbol/call-path orientation and cross-checked with focused on-disk `rg` searches; no index rebuild was run because the repository instructions reserve rebuilds for the graph owner.
- The build’s version bump is an existing script side effect. It was recorded above and reverted; `dist/` and Playwright result artifacts are generated and not part of this baseline commit.

## Follow-up risks

- The baseline E2E suite is not fully green: the four failures must be understood before claiming later refactor regressions or completion. The geometry failure may indicate a pre-existing deficit calculation/fixture issue; the three width failures indicate a class/visual-stage contract mismatch.
- Shared frame/button extraction can silently change app-specific spacing, focus order, link semantics, or 44px touch targets. Each phase should compare the existing responsive suites at 390px, 768px, and 1280px.
- Motion helper consolidation can alter first-visit/restart timing and reduced-motion synchronous final states. Preserve app-owned choreography and use focused motion tests before broad extraction.
- Storage and legacy cleanup carry the highest compatibility risk. Keep `legacyPhaseA`, old keys, and explicit fixtures until each item has a documented disposition and atomic backup/import evidence.
- Large orchestration files, especially `MainApp.tsx` and `AccountMapApp.tsx`, mix bootstrap, commands, view-model assembly, and rendering. Splitting by line count rather than responsibility would violate the approved module rules.

## Task 2 shared frame browser evidence — 2026-08-24

This focused browser verification ran in `/Users/jinho/orca/IndividualSavingsFlowUI/.worktrees/refactor-shared-foundation` on `codex/refactor-shared-foundation` after the shared-frame extraction commit `cb0b400de99ec5f73cdaa28ac548c60ff6e2c2c6`.

| Command | Exit status | Result |
| --- | ---: | --- |
| `npm run test:e2e -- tests/reading-width.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts tests/account-map.spec.ts tests/motion-system.spec.ts` | 1 | 113 passed, 3 failed, 1 skipped out of 117 tests. The single skip is the existing PWA-only offline revisit test. |

The only failures exactly match three of the recorded baseline failures, all from `tests/reading-width.spec.ts:404`/the `allocation-visual-stage` assertion at 390px, 768px, and 1280px: the element still lacks the expected `app-wide-visual` class. No new failures occurred. The previously recorded `tests/main-react.spec.ts:1008` deficit-geometry failure passed in this focused re-run, so it is not a frame-extraction regression and remains a baseline-flakiness/investigation concern rather than evidence of a changed contract.

The passing selected coverage supplies fresh evidence for the shared frame's unchanged responsive boundary: `app-journey` passed its Main launcher geometry/canvas cases at 390px, 768px, and 1280px; `reading-width` passed the cross-result-app reading-width cases at those three viewports; Account Map passed contained states with 44px actions, pointer/touch scroll behavior, focus parity, and the 390px long-title containment case; Simulation passed contained high-principal result/goal cases plus focus and chart semantic visibility; Portfolio passed focus restoration and the 768px focused-sheet containment case; Main passed the live dashboard required-viewport containment, focus, and visualization cases; and `motion-system` passed mobile/tablet/desktop cross-app semantic, focus, reduced-motion, overflow-clipping, and visualization checks.

No source, CSS, storage, URL, or navigation changes were made while collecting this evidence. Playwright generated only ignored `test-results/` artifacts.

## Task 5 final verification and handoff — 2026-08-24

This final verification was refreshed in `/Users/jinho/orca/IndividualSavingsFlowUI/.worktrees/refactor-shared-foundation` on `codex/refactor-shared-foundation` at `b66596e` (`test(main): align wide review assertion`). The shared-foundation source commits are `cb0b400`, `47780c2`, `dd2a4cc`, `51ba211`, `f8954f3`, and `b66596e`; this document records their final verification only.

| Command | Exit status | Exact result | Generated-file disposition |
| --- | ---: | --- | --- |
| `npm run check` | 0 | `tsc --noEmit` and `tsc --noEmit -p tsconfig.unit.json` passed. | None. |
| `npm run test:unit` | 0 | 99 test files passed; 1,093 tests passed. `f8954f3` updates the stale Simulation shared-component architecture assertion for `AppContentFrame`. Node emitted its expected localStorage experimental warning. | None. |
| `npm run test:e2e -- tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts tests/account-map.spec.ts tests/reading-width.spec.ts tests/motion-system.spec.ts` | 0 | 116 passed, 1 skipped out of 117. `b66596e` corrects the stale reading-width expectation: `b1250aa` intentionally puts `app-wide-visual` on the enclosing `.allocation-bar` review card, while the visual stage and table remain contained inside it. The PWA offline revisit remains intentionally skipped. | Playwright produced ignored `test-results/` output only. |
| `npm run build` | 0 | Vite completed with 1,988 modules transformed; PWA generated `dist/sw.js` and Workbox assets. | The build changed version `0.11.94` to `0.11.95` in `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, and `shared/legacy/sw.js`. Those four generated edits were inspected and restored before the documentation commit; `dist/` remains generated output. |
| `git diff --check` | 0 | No whitespace errors before the documentation change and after restoring build-generated version changes. | None. |

### Responsive, accessibility, and motion evidence

The isolated supported-flow run supplies deterministic coverage at 390×844, 768×1024, and 1280×900. It passed the Main launcher geometry/canvas checks at all three widths; reading-width checks for the shared result-app frame at all three widths; Account Map's all-state containment, 44px action targets, pointer/touch scroll, focus parity, and 390px long-title containment; Simulation's contained mobile/tablet/desktop entry and result, graph semantics, focus, touch drag and tooltip behavior; Portfolio's required-width summary, 44px/focus behavior, mobile sheet/panel containment and focus restoration; and Main's contained dashboard/review, visualization, keyboard flow, focus ring, and touch-target coverage.

`tests/motion-system.spec.ts` passed its mobile, tablet, and desktop cross-app motion cases; those assert semantic/focus retention, overflow clipping, visual final state, and reduced-motion behavior. The supported app-journey tests also passed reduced-motion synchronous final-state checks for Account Map launcher reveals and the Main mobile editor. A one-off Playwright smoke harness then seeded representative supported state, visited Main, Simulation, Portfolio, and Account Map map surfaces, and generated/inspected 12 full-page screenshots at the exact required viewports in `test-results/task5-manual/`. Its geometry output recorded document width equal to viewport width for all 12 surfaces; `app-content-frame` widths of 358/736/768px for Main, Simulation, and Account Map (Portfolio 358/720/768px); launcher outside the frame; 0 unnamed buttons; 0 visible buttons below 44px; and a successful programmatic focus check. The inspected screenshots show no clipped frame, launcher, map, chart, or primary action. Thus the shared frame keeps its horizontal gutter, the launcher remains outside the reading-width primitive, supported controls retain accessible names/focus/touch behavior, and reduced motion leaves tested content in a visible final state.

### Intentional exceptions and remaining boundaries

- Direct `ui-button` markup remains intentional where native link semantics, icon/action semantics, or app-specific styling must be preserved; it is not a blanket migration target.
- `AppContentFrame` is the shared reading-width primitive; the launcher is deliberately excluded. Main review retains its approved wide-visual exception.
- `setMotionFinalState` now centralizes only the simple opacity-plus-vertical-translate fallback used by Toast, Readiness, and destructive management confirmation. Keep the other local motion finalizers until a later plan preserves their distinct contracts: Main setup's multi-element initial/assembly styles, Main dashboard's horizontal editor fallback, Portfolio dialog's modal/sheet/panel property cleanup, Portfolio summary's numerical/card choreography, and the launcher/management-menu-specific lifecycles.
- `legacyPhaseA`, migration/backup parsing, `purgeRetiredStorage`, legacy PWA route exclusions, `apps/main/modules` dynamic-import/fetch coverage in `tests/step1.spec.ts`, and `tests/main-compat.spec.ts` remain Phase 4 evidence. They were neither deleted nor repurposed as a supported runtime path.

### Next plan inputs and unresolved verification

1. `MainApp`: split bootstrap/repository effects, setup/review command boundaries, dashboard view models, and app-owned motion without changing the five Main-owned monthly values or wide-review contract.
2. `AccountMapApp`: separate command/recovery orchestration from map/setup rendering; later split graph model, responsive layout, and placement while retaining Main read-only and Account Map-only writes to `workspace.locations` and `workspace.accountMap`.
3. `PortfolioApp`: separate repository/plan commands from summary/edit surfaces; retain Portfolio slice ownership and its separation from Account Map locations.
4. `SimulationApp`: separate onboarding/projection command and summary/chart view models; retain the Main-read-only source, compound-growth meaning, and the existing app frame.

The source/type, full unit, and supported-flow E2E gates are green, with the documented intentional PWA skip. No storage, ownership, URL, navigation, or legacy-disposition verification was broadened in this task.
