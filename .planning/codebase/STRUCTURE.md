# Repository Structure

```text
src/
  main/
    domain/           current Main data and calculations
    application/      bootstrap and reducer
    infrastructure/   persistence, compatibility, backup, routing
    ui/               setup and dashboard experience
  journey/
    domain/           minimal JourneySnapshot
    infrastructure/   journey persistence
    ui/               launcher and readiness UI
  entries/            readiness page entry points
  core/               shared storage and types
  components/         small shared React components
  styles/             shared current styles
tests/
  unit/               Vitest current contracts
  main-react.spec.ts  supported Main browser behavior
  main-compat.spec.ts current compatibility behavior
  app-journey.spec.ts supported readiness journey
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

Use `src/main/` for supported Main changes and `src/journey/` for readiness contracts. Do not add supported behavior under `apps/`; those paths are temporary migration assets.
