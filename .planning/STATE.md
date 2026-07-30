# Current Project State

**Last reviewed:** 2026-07-30

## Product Baseline

- Main is the only supported detailed product.
- Simulation, Portfolio, and Account Map are future apps. Their supported routes currently provide readiness and journey continuity only.
- Retained legacy implementations are temporary evidence for feature and data-contract migration. They are not supported product routes or foundations for new work.

## Current Main Contract

Main stores five monthly scalar values in the v2 model:

- net income
- housing cost
- living cost
- saving
- investment

From those values Main derives consumption, planned outflow, remaining money or deficit, and the allocation percentages shown during setup and on the dashboard.

Current user-facing capabilities:

- resumable quick setup
- monthly cashflow summary and allocation visualization
- editing the five monthly values from the current Main experience
- local persistence with compatibility recovery
- JSON export and import
- explicit Main-to-Simulation journey handoff

Main does not currently provide itemized accounts, category rows, household budgeting, actual-spend capture, Sankey, or long-term projection. Those concepts may exist in retained legacy code and documents but are not current product behavior.

## Readiness Routes

- Simulation shows connection state, Main investment capacity, and Main update time.
- Portfolio continues the minimal readiness journey from Simulation.
- Account Map is readiness-only and does not read, edit, store, or write back a detailed map.

## Transition State

- Legacy runtime sources remain in the repository until each destination has an approved feature inventory and migration/removal specification.
- Deletion requires a disposition for each useful behavior and data contract, compatibility evidence, reference removal, and regression verification.
- Historical GSD phase and milestone documents were retired because their completion claims no longer described the supported product.

## Evidence

- Product scope: [Product PRD](../docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- Active requirements: [Requirements](REQUIREMENTS.md)
- Forward order: [Roadmap](ROADMAP.md)
- Runtime model: [`src/main/domain/model.ts`](../src/main/domain/model.ts)
- Current Main behavior: [`tests/main-react.spec.ts`](../tests/main-react.spec.ts)
- Readiness journey: [`tests/app-journey.spec.ts`](../tests/app-journey.spec.ts)
