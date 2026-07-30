# Product Roadmap

This roadmap records decision order, not release promises or historical completion percentages. Work starts only after its product scope and acceptance criteria are approved.

## Now — Protect the Current Baseline

1. Keep Main’s five-value monthly cashflow model, quick setup, dashboard, persistence, backup, and journey handoff reliable.
2. Keep Simulation, Portfolio, and Account Map visibly readiness-only.
3. Align PRD, README, DESIGN, AGENTS, requirements, tests, and runtime claims.
4. Treat retained legacy code as migration evidence and prevent it from becoming an accidental product dependency.

## Next — Inventory Before Migration

For each future app, perform the following in order:

1. Inventory legacy user behavior, calculations, storage schemas, import/export formats, routes, selectors, and tests.
2. Classify each capability as migrate, redesign, defer, or remove.
3. Approve a new-app PRD or feature specification with ownership and compatibility boundaries.
4. Implement against the current architecture rather than reviving the legacy route.
5. Prove compatibility and regression coverage, remove all legacy references, then delete the corresponding legacy implementation.

The recommended destination order is:

1. Simulation
2. Portfolio
3. Account Map

This sequence follows the intended user journey. It may change when an approved product decision provides stronger evidence.

## Later — Product Candidates

These are discovery candidates, not committed scope:

- paste-based Korean bank or card spending capture
- household merge preview using two Main datasets
- comparison with prior spending snapshots
- housing-affordability scenarios using income, debt, DSR, and LTV assumptions
- richer account relationships after Account Map ownership is specified

Each candidate requires its own problem framing, user evidence, data contract, privacy review, and acceptance criteria before implementation.

## Release Gate

Any supported-product expansion must:

- preserve or deliberately migrate the current Main data contract
- state which app owns the new data
- distinguish current behavior from future intent in all canonical documents
- pass type checks and affected unit and browser tests
- include responsive and accessibility evidence for user-facing changes
