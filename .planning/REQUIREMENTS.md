# Active Product Requirements

**Last reviewed:** 2026-08-03

This document tracks the supported baseline and transition obligations. Future ideas are explicitly non-committed until a separate PRD or feature specification is approved.

## Supported Main

- [x] **MAIN-01**: A user can create a monthly plan from net income, housing cost, living cost, saving, and investment.
- [x] **MAIN-02**: A user can leave and resume the quick setup without losing a valid draft.
- [x] **MAIN-03**: A user can review consumption, saving, investment, remaining money, or deficit from the same five-value model.
- [x] **MAIN-04**: A user can edit the current monthly values and explicitly apply a valid plan.
- [x] **MAIN-05**: Main persists the current plan locally and recovers compatible prior data without silently replacing newer valid data.
- [x] **MAIN-06**: A user can export and import the current Main data as validated JSON.
- [x] **MAIN-07**: A user can explicitly continue from an applied Main plan to detailed Simulation through URL-only navigation.
- [x] **MAIN-08**: Main remains usable at the required mobile and desktop breakpoints with accessible controls and state feedback.

## Supported Simulation and Journey

- [x] **JOURNEY-01**: The icon launcher exposes Main, Simulation, Portfolio, and Account Map; only Account Map carries a neutral-dot and accessible `준비 중` state.
- [x] **JOURNEY-02**: The current app uses an underline and `aria-current`, independently from Account Map readiness.
- [x] **JOURNEY-03**: Launcher links and CTAs navigate by URL without persisting an app-to-app transfer payload.
- [x] **JOURNEY-04**: Main removes the retired journey key without reading or migrating it, and removal failure does not block startup.
- [x] **SIM-01**: First-run Simulation guides starting principal and scenario settings in two stages; revisits open the result directly.
- [x] **SIM-02**: Simulation automatically syncs current Main saving and investment on entry without writing back to Main.
- [x] **SIM-03**: Duration supports 0–30 years and result amounts use the approved Korean integer-unit rounding.
- [x] **SIM-04**: The result prioritizes one sentence, a full-width graph, two comparisons, and equivalent pointer, touch, and keyboard detail.
- [x] **SIM-05**: Simulation owns and saves only its scenario draft, exposes low-emphasis save state, and confirms reset from its menu.
- [x] **PORT-01**: Portfolio reads the latest Main investment without write-back and owns one applied allocation plus draft.
- [x] **PORT-02**: Up to ten named targets and cash support amount or percentage editing with both values shown.
- [x] **PORT-03**: Main increases flow to cash, decreases preserve allocation ratios, and zero investment links to Main editing.
- [x] **PORT-04**: Result-first donut and table provide equivalent pointer, touch, keyboard, and responsive information.
- [x] **JOURNEY-05**: Account Map remains readiness-only without detailed editing, independent storage, or implicit Main write-back.

## Legacy Transition

- [ ] **MIG-01**: Each future app has a reviewed inventory; Portfolio is complete and Account Map remains.
- [ ] **MIG-02**: Every inventoried capability has an approved disposition; Portfolio is complete and Account Map remains.
- [ ] **MIG-03**: Each future app has an approved ownership boundary; Portfolio is complete and Account Map remains.
- [ ] **MIG-04**: Required old-data compatibility is demonstrated with fixtures and regression tests.
- [ ] **MIG-05**: Runtime imports, routes, selectors, storage keys, compatibility paths, and tests no longer reference a legacy implementation before it is deleted.
- [ ] **MIG-06**: Canonical product documents and user-facing copy are updated in the same change that alters a product boundary.

## Quality Requirements

- [x] **QUAL-01**: Current TypeScript and static validation are available through `npm run check`.
- [x] **QUAL-02**: Current Main, Simulation, and readiness journeys have focused Playwright coverage.
- [x] **QUAL-03**: Current detailed Simulation includes 390px, 768px, desktop, keyboard, focus, overflow, tooltip-containment, and touch-target evidence.
- [x] **QUAL-04**: Simulation identifies financial assumptions, inputs, limitations, and non-advisory status through progressive disclosure.

The current journey boundary is defined by the [Journey Snapshot Retirement Spec](../docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md).

## Future Discovery Candidates

The following are not current requirements and must not be marked complete from legacy evidence:

- Korean bank or card notification text capture
- household income and plan merge
- historical spending comparison
- housing-affordability scenarios
- editable Account Map relationships
