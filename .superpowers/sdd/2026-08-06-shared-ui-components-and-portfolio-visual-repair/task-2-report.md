# Task 2 Report — Simulation shared React components

## Scope

- Replaced Simulation's direct styled buttons with the shared `Button`, retaining each button's accessible name, `type`, disabled state, and handler.
- Replaced regular `section.ui-surface` containers with `Surface as="section"`, retaining labels and resulting section DOM.
- Kept the SimulationApp anchor CTA and management menu native as required.
- Kept SimulationComparison as its semantic `dl`: the supplied `Surface` only renders `section`, `div`, or `aside`, so replacing its `dl.ui-surface` would have changed its definition-list semantics.
- GrowthChart keeps its section ref through React 19 ref forwarding and its SVG/pointer/tooltip structure. Home/End now prevent browser scrolling, which had raced the chart's scroll-to-dismiss listener and intermittently cleared keyboard detail.

## TDD evidence

- RED: `npx vitest run tests/unit/simulation/sharedComponents.test.ts` failed as expected with 11 direct-markup/import guard failures.
- RED: the new GrowthChart Home/End keyboard test failed because neither key prevented the default scroll.
- GREEN: both guards and the keyboard behavior test pass after the component substitutions and key handling change.

## Verification

- `npx vitest run tests/unit/simulation/sharedComponents.test.ts tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationControls.test.tsx tests/unit/simulation/AdvancedSettings.test.tsx` — 5 files, 34 tests passed.
- `npm run check` — source and unit TypeScript checks passed.
- `npx playwright test tests/simulation.spec.ts --reporter=list --repeat-each=3` — 24 passed; includes mobile, tablet, and desktop graph containment and keyboard exploration.
- `git diff --check` — passed.

## Changed files

- `src/simulation/ui/AdvancedSettings.tsx`
- `src/simulation/ui/GrowthChart.tsx`
- `src/simulation/ui/ScenarioSetupStep.tsx`
- `src/simulation/ui/SimulationApp.tsx`
- `src/simulation/ui/SimulationControls.tsx`
- `src/simulation/ui/StartingPrincipalStep.tsx`
- `tests/unit/simulation/sharedComponents.test.ts`
- `tests/unit/simulation/GrowthChart.test.tsx`

## Concerns

None. `AGENTS.md` and `package-lock.json` were pre-existing user changes and are deliberately not staged.

## Fix round 1

- Removed the out-of-scope GrowthChart Home/End `preventDefault` behavior and its dedicated unit test. The shared `Surface` integration and its typed ref contract remain unchanged.
- Covering verification: `npx vitest run tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/sharedComponents.test.ts && npx playwright test tests/simulation.spec.ts --reporter=list` — 21 unit tests and 8 Playwright tests passed.
