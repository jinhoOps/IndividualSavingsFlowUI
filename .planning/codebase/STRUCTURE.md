# Repository Structure

```text
src/
  main/
    domain/           current Main data and calculations
    application/      bootstrap and reducer
    infrastructure/   persistence, compatibility, backup, routing, retired-key purge
    ui/               setup and dashboard experience
  simulation/
    domain/           current compound-growth draft and projection
    application/      Main-aware startup behavior
    infrastructure/   read-only Main source and Simulation persistence
    ui/               onboarding, result, graph, and controls
  portfolio/         current allocation domain, storage, app, donut, table, editor
  journey/
    routes.ts          URL-only app paths
    ui/                launcher and Account Map-only readiness UI
  core/               shared storage and types
  components/         small shared React components
  styles/             shared current styles
tests/
  unit/               Vitest current contracts
  main-react.spec.ts  supported Main browser behavior
  main-compat.spec.ts current compatibility behavior
  app-journey.spec.ts URL navigation, direct Main reads, purge, and readiness journey
  simulation.spec.ts  supported detailed Simulation behavior
  portfolio.spec.ts   supported detailed Portfolio behavior
apps/                 retained legacy detailed applications
shared/legacy/        retained legacy shared runtime
docs/
  adr/                decision history
  superpowers/        approved designs and execution plans
  ways-of-work/       canonical Product PRD
.planning/
  STATE.md            current runtime snapshot
  REQUIREMENTS.md     active and transition requirements
  ROADMAP.md          forward decision order
  codebase/           these navigation maps
```

Use `src/main/`, `src/simulation/`, and `src/portfolio/` for supported products, and `src/journey/` for shared navigation and Account Map readiness. Do not add supported behavior under retained legacy paths.

See the [Journey Snapshot Retirement Spec](../../docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md) for the removal of the former journey domain and persistence directories.
