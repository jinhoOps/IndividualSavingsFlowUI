# Shared Foundation Baseline

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

## Inventory

| Candidate | Current owner | Consumers | Focused tests | Planned phase | Removal condition |
| --- | --- | --- | --- | --- | --- |
| `AppShell` and app launcher frame | `src/components/common/AppShell.tsx`, `src/journey/ui/AppLauncher.tsx` | Main, Simulation, Portfolio, Account Map, Readiness; launcher tests and app journey tests | `tests/unit/components/AppShell.test.tsx`, `tests/unit/journey/AppLauncher.test.tsx`, `tests/app-journey.spec.ts` | Phase 1 shared foundation | Preserve launcher order, `aria-current`, focus return, overlay containment, and all supported viewport checks after extraction. |
| `app-content-frame` | `src/styles/app-foundation.css` with markup in Main, Simulation, Portfolio, Account Map, and dashboard UIs | Four supported apps and Main review/setup/dashboard surfaces | `tests/reading-width.spec.ts`, app journey responsive coverage, Main/Portfolio/Simulation/Account Map E2E specs | Phase 1 shared foundation | Remove per-app frame duplication only after identical 390px/768px/1280px widths, overflow containment, and visualization visibility are proven. |
| Direct `ui-button` markup | `src/components/common/Button.tsx` defines the contract; direct class markup remains across Account Map, Journey, Simulation, Portfolio, and Main | Account Map setup/canvas/modal/picker, Journey entry/dialog, Simulation recovery, Portfolio controls, Main controls | App-specific E2E specs plus `tests/unit/components/Button.test.tsx` where applicable | Phase 1 shared foundation | Replace direct markup only when native button/link semantics, accessible names, variants, disabled states, and 44px targets remain unchanged. |
| `Surface` panel primitive | `src/components/common/Surface.tsx` | Existing common/UI consumers identified by CodeGraph and source imports | `tests/unit/components/Surface.test.tsx` and affected app focused tests | Phase 1 shared foundation | Extract only repeated panel semantics; no domain state or storage ownership may move into the primitive. |
| Toast/reveal final state | `src/components/common/Toast.tsx` | Toast feedback and its motion lifecycle | `tests/motion-system.spec.ts`, `tests/unit/components/useAnimeScope.test.tsx`, affected app feedback coverage | Phase 1 shared feedback/motion | Consolidate `setRevealFinalState` only after toast enter/exit, reduced-motion, and focus/status behavior match. |
| Duplicate `setRevealFinalState` helpers | Local helpers in `Toast.tsx`, `ReadinessApp.tsx`, and `ManagementConfirmationDialog.tsx` | Toast, readiness route, destructive management confirmation dialog | `tests/unit/journey/ReadinessApp.test.tsx`, `tests/unit/journey/AppManagementMenu.test.tsx`, `tests/motion-system.spec.ts` | Phase 1 shared motion | Remove local copies after a common lifecycle helper has equivalent reduced-motion and cleanup coverage in every caller. |
| `useReducedMotion` / `useAnimeScope` / motion tokens | `src/components/motion/*` | AppLauncher, Toast, management dialog/menu, Main, Simulation, Portfolio, Account Map motion consumers (CodeGraph reports 25 `useAnimeScope` callers) | `tests/unit/components/useAnimeScope.test.tsx`, motion-system E2E, app-specific reduced-motion tests | Phase 1 shared motion | Keep app-owned animation order and first-visit behavior; remove duplicate lifecycle wrappers only after reduced-motion and cleanup tests pass. |
| `animateVisualNumber` | `src/components/motion/animateVisualNumber.ts` | Main cashflow summary/donut, Simulation comparison, Portfolio summary (9 callers) | `tests/unit/components/animateVisualNumber.test.ts`, Main/Simulation/Portfolio focused specs | Phase 1 shared motion/formatting | Any formatter or animation extraction must preserve displayed rounding, reduced-motion completion, and visual summary semantics. |
| App orchestration entry files | `src/main/ui/MainApp.tsx`, `src/account-map/ui/AccountMapApp.tsx`, `src/portfolio/ui/PortfolioApp.tsx`, `src/simulation/ui/SimulationApp.tsx` and `src/*/main.tsx` | Each supported app’s domain/application/UI modules and shared AppShell | Main, Account Map, Portfolio, Simulation unit/E2E suites | Phase 2 application orchestration | Split only by command/result and view-model boundaries; app ownership, revision/conflict handling, and URL-only navigation must remain unchanged. |
| Workspace storage and legacy compatibility | `src/workspace/infrastructure/*`, `src/core/storage/*`, `src/main/infrastructure/retiredStorage.ts`, simulation validation/migration | Main, Simulation, Portfolio, Account Map; whole-workspace backup/import and compatibility tests | `tests/unit/main/mainRepository.test.ts`, workspace/storage tests, `tests/main-compat.spec.ts`, backup E2E | Phase 2/4, with compatibility gates | Do not change storage keys or delete compatibility data until parser, atomic import, raw preservation, and reference searches are green. |
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
