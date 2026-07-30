# Active Product Requirements

**Last reviewed:** 2026-07-30

This document tracks the supported baseline and transition obligations. Future ideas are explicitly non-committed until a separate PRD or feature specification is approved.

## Supported Main

- [x] **MAIN-01**: A user can create a monthly plan from net income, housing cost, living cost, saving, and investment.
- [x] **MAIN-02**: A user can leave and resume the quick setup without losing a valid draft.
- [x] **MAIN-03**: A user can review consumption, saving, investment, remaining money, or deficit from the same five-value model.
- [x] **MAIN-04**: A user can edit the current monthly values and explicitly apply a valid plan.
- [x] **MAIN-05**: Main persists the current plan locally and recovers compatible prior data without silently replacing newer valid data.
- [x] **MAIN-06**: A user can export and import the current Main data as validated JSON.
- [x] **MAIN-07**: A user can explicitly continue from an applied Main plan to the Simulation readiness route.
- [x] **MAIN-08**: Main remains usable at the required mobile and desktop breakpoints with accessible controls and state feedback.

## Supported Journey Readiness

- [x] **JOURNEY-01**: The launcher identifies Main as `사용 중` and Simulation, Portfolio, and Account Map as `준비 중`.
- [x] **JOURNEY-02**: Product availability and the user’s current location are communicated as separate states.
- [x] **JOURNEY-03**: Simulation readiness can show validated Main connection state, investment capacity, and update time.
- [x] **JOURNEY-04**: Portfolio readiness continues the same minimal journey contract.
- [x] **JOURNEY-05**: Readiness routes do not expose detailed editing, independent product storage, or implicit Main write-back.

## Legacy Transition

- [ ] **MIG-01**: Each future app has a reviewed inventory of relevant legacy behavior, calculations, schemas, compatibility paths, and tests.
- [ ] **MIG-02**: Every inventoried capability has an approved disposition: migrate, redesign, defer, or remove.
- [ ] **MIG-03**: Each future app has an approved data-ownership and import/write-back boundary before detailed implementation.
- [ ] **MIG-04**: Required old-data compatibility is demonstrated with fixtures and regression tests.
- [ ] **MIG-05**: Runtime imports, routes, selectors, storage keys, compatibility paths, and tests no longer reference a legacy implementation before it is deleted.
- [ ] **MIG-06**: Canonical product documents and user-facing copy are updated in the same change that alters a product boundary.

## Quality Requirements

- [x] **QUAL-01**: Current TypeScript and static validation are available through `npm run check`.
- [x] **QUAL-02**: Current Main and readiness journeys have focused Playwright coverage.
- [ ] **QUAL-03**: Every future user-facing feature includes 390px, 768px, desktop, keyboard, focus, overflow, and touch-target evidence appropriate to its surface.
- [ ] **QUAL-04**: Financial assumptions and estimates identify their inputs, limitations, and non-advisory status near the result.

## Future Discovery Candidates

The following are not current requirements and must not be marked complete from legacy evidence:

- Korean bank or card notification text capture
- household income and plan merge
- historical spending comparison
- housing-affordability scenarios
- detailed Simulation strategy comparison
- saved Portfolio construction and allocation
- editable Account Map relationships
