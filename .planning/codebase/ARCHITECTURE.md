# Current Architecture

## Supported Runtime

The supported product is a React 19 and TypeScript multi-page Vite application.

```text
Main React app
  ├─ domain: model, validation, cashflow
  ├─ application: bootstrap, reducer
  ├─ infrastructure: repository, compatibility, backup, routes
  └─ UI: setup, dashboard, editor, shared controls

Journey React apps
  ├─ Simulation readiness
  ├─ Portfolio readiness
  └─ Account Map readiness
```

Main starts at `src/main/main.tsx`. Its domain owns five monthly scalar values and derives consumption, outflow, remaining money, deficit, and allocation percentages.

The readiness entries under `src/entries/` mount components from `src/journey/`. They exchange only a minimal validated `JourneySnapshot`; they do not mount the old detailed apps.

## Data Ownership

- `src/main/domain/model.ts`: current `MainData` v2 contract.
- `src/main/application/`: draft/applied state transitions and startup outcomes.
- `src/main/infrastructure/mainRepository.ts`: current, pending, recovery, history, and compatibility resolution.
- `src/main/infrastructure/backup.ts`: validated current JSON import/export.
- `src/journey/domain/journeySnapshot.ts`: minimal cross-app handoff.
- `src/journey/infrastructure/journeyRepository.ts`: journey persistence.
- `src/core/storage/`: shared IndexedDB and compatibility infrastructure.

## Legacy Boundary

`apps/`, most of `shared/legacy/`, and old Step 1/2/3 browser tests describe retained implementations. They are migration evidence only. Do not import them into `src/main/` or `src/journey/` without an approved migration specification.

The ADRs describe decisions made during the previous implementation. If an ADR conflicts with the current PRD and runtime, treat it as decision history and create a new current decision before expanding the product.
