# Product Roadmap

This roadmap records decision order, not release promises or historical completion percentages. Work starts only after its product scope and acceptance criteria are approved.

## Now — Protect the Current Baseline

1. Keep Main’s five-value monthly cashflow model, quick setup, dashboard, persistence, backup, URL navigation, and retired-key purge reliable.
2. Keep detailed Simulation result-first, directly reading the latest Main without write-back, and reliable across its 0–30-year contract.
3. Keep detailed Portfolio directly linked to the latest Main and Account Map alone visibly readiness-only.
4. Align PRD, README, DESIGN, AGENTS, requirements, tests, and runtime claims.
5. Treat retained legacy code as migration evidence and prevent it from becoming an accidental product dependency.

## Next — Inventory Before Migration

For each future app, perform the following in order:

1. Inventory legacy user behavior, calculations, storage schemas, import/export formats, routes, selectors, and tests.
2. Classify each capability as migrate, redesign, defer, or remove.
3. Approve a new-app PRD or feature specification with ownership and compatibility boundaries.
4. Implement against the current architecture rather than reviving the legacy route.
5. Prove compatibility and regression coverage, remove all legacy references, then delete the corresponding legacy implementation.

The next destination is Account Map. Portfolio inventory, disposition, ownership, implementation, and legacy removal are complete.

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

The active app-navigation boundary follows the [Journey Snapshot Retirement Spec](../docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md); earlier journey plans remain decision history.
