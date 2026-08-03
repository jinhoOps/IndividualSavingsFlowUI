# Current Architecture

## Supported Runtime

The supported product is a React 19 and TypeScript multi-page Vite application.

```text
Main React app
  ├─ domain: model, validation, cashflow
  ├─ application: bootstrap, reducer
  ├─ infrastructure: repository, compatibility, backup, routes, retired-key purge
  └─ UI: setup, dashboard, editor, shared controls

Simulation React app
  ├─ domain: draft model, validation, compound projection
  ├─ application: Main-aware bootstrap
  ├─ infrastructure: Main reader and Simulation repository
  └─ UI: onboarding, result, graph, controls

Portfolio React app
  ├─ domain: allocation, cash, validation
  ├─ application: bootstrap and draft/apply state
  ├─ infrastructure: Main reader and Portfolio repository
  └─ UI: editor, donut, table, recovery

Journey React app
  └─ Account Map readiness
```

Main starts at `src/main/main.tsx`. Its domain owns five monthly scalar values and derives consumption, outflow, remaining money, deficit, and allocation percentages.

Simulation starts at `src/simulation/main.tsx` and directly reads the latest Main saving and investment. Portfolio starts at `src/portfolio/main.tsx`, directly reads only the latest Main investment, and owns its allocation. Account Map remains under `src/journey/` as the only readiness screen. Navigation between apps is URL-only.

## Data Ownership

- `src/main/domain/model.ts`: current `MainData` v2 contract.
- `src/main/application/`: draft/applied state transitions and startup outcomes.
- `src/main/infrastructure/mainRepository.ts`: current, pending, recovery, history, and compatibility resolution.
- `src/main/infrastructure/backup.ts`: validated current JSON import/export.
- `src/main/infrastructure/retiredStorage.ts`: best-effort deletion of the retired journey key without reading it.
- `src/simulation/domain/`: Simulation-owned draft, validation, and compound projection.
- `src/simulation/infrastructure/`: read-only Main source adapter and Simulation-only persistence.
- `src/portfolio/infrastructure/`: read-only Main source adapter and Portfolio-only persistence.
- `src/journey/routes.ts` and `src/journey/ui/`: URL routing, the shared launcher, and Account Map-only readiness.
- `src/core/storage/`: shared IndexedDB and compatibility infrastructure.

The [Journey Snapshot Retirement Spec](../../docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md) defines this navigation and storage boundary.

## Legacy Boundary

`apps/`, most of `shared/legacy/`, and old Step 1/2/3 browser tests describe retained implementations. They are migration evidence only. Do not import them into `src/main/` or `src/journey/` without an approved migration specification.

The ADRs describe decisions made during the previous implementation. If an ADR conflicts with the current PRD and runtime, treat it as decision history and create a new current decision before expanding the product.
