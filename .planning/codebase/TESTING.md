# Current Testing Map

## Static Checks

```bash
npm run check
```

This runs TypeScript checks for source and unit-test configurations.

## Unit Tests

```bash
npm run test:unit
```

- `tests/unit/main/`: current Main domain, state, persistence, setup, dashboard, responsive presentation, and components.
- `tests/unit/journey/`: current readiness routes, launcher, snapshot, persistence, and isolation.
- `tests/unit/core/`: shared storage behavior.

## Supported Browser Flows

```bash
npx playwright test tests/main-react.spec.ts
npx playwright test tests/main-compat.spec.ts
npx playwright test tests/app-journey.spec.ts
```

These files are the primary browser evidence for the current supported product.

Other Step 1, Simulation, Portfolio, or Account Map browser tests may cover retained legacy implementations. Run them only when inventorying or migrating that capability; do not use their passing state as evidence that the feature is currently supported.

## Change Guidance

- Domain change: unit tests plus `main-react.spec.ts`.
- Persistence/schema change: repository and backup unit tests, `main-compat.spec.ts`, and compatibility fixtures.
- Journey change: journey unit tests and `app-journey.spec.ts`.
- UI change: focused unit/browser tests plus 390px, 768px, desktop, keyboard, focus, overflow, and touch-target evidence.
- Legacy deletion: reference search, compatibility proof, affected current tests, and the relevant legacy migration tests.
