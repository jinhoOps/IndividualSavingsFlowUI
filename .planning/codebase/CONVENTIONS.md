# Current Conventions

## Product Boundaries

- Keep the Main domain independent of React and storage.
- Keep `MainData` scalar and versioned; do not attach future-app state to it.
- Derive displayed totals through `src/main/domain/cashflow.ts`.
- Validate at application and import boundaries.
- Keep journey payloads minimal and validate them before display.
- Never make a readiness app write back to Main implicitly.

## TypeScript and React

- Prefer explicit exported interfaces for cross-file contracts.
- Use discriminated unions for state and result branches.
- Keep domain helpers pure and cover edge cases with table-driven unit tests.
- Preserve accessible names, keyboard behavior, focus return, and visible status text.
- Keep mobile and desktop representations behaviorally equivalent.

## Persistence

- Preserve current, pending, recovery, and history semantics in `mainRepository.ts`.
- Do not bypass repository conflict or compatibility handling with direct storage writes.
- Reject malformed imports without damaging the current valid plan.
- Add compatibility fixtures before changing a persisted schema.

## Legacy Work

- Inventory before reuse.
- Port behavior into the current boundary; do not connect a legacy controller to a current entry.
- Record migrate, redesign, defer, or remove disposition.
- Prove reference removal before deleting retained code.
