# Account Map Force Layout Design

## Goal
Account Map node placement should feel like a light force-directed graph: related nodes pull toward a useful distance, crowded nodes push away, and spacing remains fluid based on relationship lines.

## Design
Use deterministic force relaxation inside the existing SVG renderer. Keep the current semantic initial layout: income sources on the left, accounts in the middle, external targets on the right. After seeding those positions, run a bounded fixed-iteration pass with three forces:

- Link attraction keeps connected nodes near a target distance derived from their columns.
- Node repulsion prevents overlap and preserves readable spacing.
- Column anchoring gently keeps each node near its semantic lane so the map stays legible.

The algorithm must not use randomness or animation. The same draft should produce the same coordinates every render, which keeps Playwright tests stable.

## Components
- `apps/account-map/modules/map-renderer.js`: update `computePositions()` to accept relationships and apply deterministic relaxation.
- `tests/account-map.spec.ts`: add layout assertions that rendered nodes do not overlap and that linked nodes are neither collapsed nor excessively far apart.

## Testing
Run TypeScript checks and focused Account Map Playwright coverage:

- `npm run check`
- `npx playwright test tests/account-map.spec.ts`

## Scope
No new dependency, no D3 runtime, and no animated simulation loop. The map supports persisted manual node dragging and an explicit auto-layout reset.
