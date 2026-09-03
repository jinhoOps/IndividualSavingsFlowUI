# Phase 4 Task 5 Report: current browser fixtures and supported-behavior replacement

Date: 2026-09-03

Status: complete (fixture/evidence correction round 1 appended below)

## Outcome

Task 5's normal current-browser journeys seed the canonical `isf-workspace-v3`
document with v3-valid slices. The cited Main evidence now does the same.
Retired `isf-workspace-v1` remains in explicitly named migration fixtures:
Account Map's `migrates a v1 workspace without touching its protected slices`,
its two migration-collision cases, and Simulation's `migrated v2 high-principal
workspace completes the goal without changing Main`. The existing Task 4 sentinel,
`retired journey snapshot survives Main startup and a current edit`, remains
in the selected browser command and passed.

No product runtime code changed. Main remains the owner of the five monthly
amounts. Simulation reads Main as a source; Portfolio retains aggregate-only
current fixtures; Account Map fixture writes remain limited to Account Map and
locations.

## Legacy disposition reconciliation

Every row in `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`
continues to be either `retired by approved spec; no replacement`, a non-case,
or `replaced by current suite`. Each supported replacement row now gives an
exact current test title. The owned current evidence is:

- Main responsive layout and overflow: `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` and `shares the exact reading frame across result apps at 390px`.
- Main restart/setup: `Main brand intro restart preserves the applied plan and writes restart welcome progress`.
- Current pearl tooltip behavior is separately covered by `keeps pearl single-line tooltips contained for visual and clipped fallback targets at 390px`; it is not a replacement for the retired Sankey line-broken tooltip.
- Account Map navigation: `keeps Account Map usable at mobile, tablet, and desktop widths` and `separates app navigation and the right-aligned management tool across viewports`.
- Current Main draft persistence: `dashboard edit persists only the v2 scalar plan`.

No retired sanitizer, Sankey, household-budget, Financial Detail Modal, preset,
old renderer, or location-scoped Portfolio behavior was copied into current
coverage.

## TDD and fixture evidence

This task is fixture/evidence normalization rather than a product behavior
addition. Existing browser tests were run against real current routes after
each fixture update. During the final browser run, the existing Simulation
768px geometry assertion initially failed intermittently: the immediately-read
input control bottom was `902.9375` against the `901` tolerance. Repeating the
unchanged test three times yielded one failure and two passes. The failing run
showed that the input itself was visible while its parent control was still
2.9375px below the viewport: the test had scrolled the leaf input, then
asserted the parent control. The owning test now scrolls and observes that
parent control directly before its geometry assertions. The five-repeat
verification passed 5/5; the final selected suite passed with the same check
at 768px.

## Verification

```text
$ npx playwright test tests/account-map.spec.ts --grep "canonical map|overview node|Main reference" --reporter=list
3 passed

$ npx playwright test tests/account-map.spec.ts --grep "spending location to investing" --reporter=list
1 passed

$ npx playwright test tests/app-journey.spec.ts --grep "connects Main directly|revisits Simulation" --reporter=list
2 passed

$ npx playwright test tests/portfolio.spec.ts --reporter=list
17 passed

$ npx playwright test tests/simulation.spec.ts --grep "768px 계산 기준" --reporter=list --repeat-each=5
5 passed

$ npx playwright test tests/app-journey.spec.ts tests/account-map.spec.ts tests/portfolio.spec.ts tests/simulation.spec.ts tests/motion-system.spec.ts tests/reading-width.spec.ts tests/tooltip-contract.spec.ts tests/retired-storage-isolation.spec.ts --reporter=list
93 passed, 1 skipped, exit 0

$ npm run check
tsc --noEmit
tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
exit 0
```

The one selected skip is the existing `PWA offline revisit keeps all app routes
and final motion state available` case. Its body intentionally skips outside
the `pwa-chromium` project; this selected Chromium run has no PWA project.

## Changed files

- `tests/app-journey.spec.ts`: v3 current journey fixtures, current Simulation draft schema, and preserved Task 4 retired-key sentinel.
- `tests/account-map.spec.ts`: v3 current fixtures; explicit v1 migration and collision seeding remains separate.
- `tests/portfolio.spec.ts`: v3 aggregate Portfolio fixtures without retired location-scoped plans.
- `tests/simulation.spec.ts`: v3 fixtures and stable post-scroll geometry observation.
- `tests/motion-system.spec.ts`, `tests/reading-width.spec.ts`, `tests/tooltip-contract.spec.ts`: v3 current fixtures.
- `docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md`: exact owning test-title evidence for every supported legacy row.

## Commit

- `test: move legacy coverage to supported journeys` (commit hash is recorded in the Task 5 handoff after this report is committed).

## Fix round 1: retired fixture and tooltip disposition correction

The initial source audit found ordinary current journeys seeding and asserting
standalone retired records: Simulation seeded `isf-main-v2` and
`isf-simulation-compound-v1`; Portfolio seeded those plus the retired Portfolio
and Step 3 records; and the Main-to-Simulation journeys seeded the retired
journey snapshot and Simulation record. These were fixture defects, not
supported product behavior. The before-cleanup real browser command

```text
$ npx playwright test tests/simulation.spec.ts tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list
47 passed

$ npx playwright test tests/main-react.spec.ts --grep "live dashboard keeps|keeps a compact legend|dashboard edit persists|dashboard deficit" --reporter=list
4 passed
```

confirmed that the bad fixture condition was invisible to those current flows,
which is precisely why it could not remain as ordinary-journey evidence.

The green cleanup removes every such seed and assertion from the cited
Simulation, Portfolio, and cross-app journeys. The only retained
`isf-journey-snapshot-v1` use is the explicitly named Task 4 non-null sentinel,
`retired journey snapshot survives Main startup and a current edit`.
The cited Main tests now seed a v3 document with the valid empty v3 Account Map
slice. The disposition row for `renders merged Sankey tooltip details as
line-broken safe text` is now `retired by approved spec; no replacement`;
single-line pearl tooltip coverage is no longer offered as a false equivalent.

This was fixture/evidence cleanup, so no product behavior was added. A focused
browser red/green did catch two test-fixture/assertion issues while validating
the cleanup:

- Red: changing only the cited Main key/version left its old Account Map shape
  in the v3 seed; 3 of 4 focused Main tests failed because the invalid document
  did not render the dashboard. Green: replacing that inherited slice with
  `{ applied: null, draft: null }` made the same group pass 4/4.
- Red: the post-cleanup three-suite run produced one existing Simulation desktop
  geometry failure (`903.34375 > 901`). The initial wrapper-based correction
  passed a focused 9/9 repeat but failed again in the full browser group; that
  reproduction showed the parent wrapper's decorative height cannot fully
  scroll into the desktop viewport even while its actionable number input is
  visible. Green: the live visibility assertion now targets that actual input,
  while the existing child-containment and shortcut-control checks remain.

## Fix round 1 verification

```text
$ npx playwright test tests/simulation.spec.ts --grep "계산 기준에서 기존 모아둔 돈" --reporter=list --repeat-each=3
9 passed

$ npx playwright test tests/main-react.spec.ts --grep "live dashboard keeps|keeps a compact legend|dashboard edit persists|dashboard deficit" --reporter=list
4 passed
```

Final correction-round verification:

```text
$ npx playwright test tests/app-journey.spec.ts tests/account-map.spec.ts tests/portfolio.spec.ts tests/simulation.spec.ts tests/motion-system.spec.ts tests/reading-width.spec.ts tests/tooltip-contract.spec.ts tests/retired-storage-isolation.spec.ts --reporter=list
93 passed, 1 skipped, exit 0

$ npm run check
tsc --noEmit
tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
exit 0
```

The one skip remains the existing PWA-only offline revisit case outside the
selected Chromium project.

## Concerns

No product or compatibility concern remains. The final selected command has
one intentional project-specific PWA skip as described above. Node/Playwright
emitted the existing `module.register()` deprecation and `NO_COLOR`/
`FORCE_COLOR` environment warnings; neither affected command success.
