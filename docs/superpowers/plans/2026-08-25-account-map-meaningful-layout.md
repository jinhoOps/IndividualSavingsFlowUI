# Account Map Meaningful Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Account Map layout toggle with one deterministic account-first relationship map and reveal a truthful, animated monthly connection composition only after an account is pinned.

**Architecture:** `mapLayout.ts` remains the pure graph-to-geometry boundary, but it derives one canonical account-left/purpose-right desktop layout and a matching mobile order. `AccountMapCanvas` consumes that view model, exposes a non-modal account connection detail, and never writes a presentation selection. The existing workspace `layout` field remains parser/backup-compatible but becomes inert UI data.

**Tech Stack:** React 18, TypeScript, Vitest, Playwright, Anime.js, CSS custom properties.

**Spec:** [Account Map Meaningful Layout Design](../specs/2026-08-25-account-map-meaningful-layout-design.md)

## Global Constraints

- Main owns its five monthly values; Account Map may write only `workspace.locations` and `workspace.accountMap`.
- Keep `AccountMapApplied.layout` parser and backup compatibility. Do not migrate, delete, or normalize legacy values merely because this UI no longer exposes a layout choice.
- A purpose-location link is a monthly-plan connection, not a balance, transaction, or account-to-account transfer. Do not add arrows, synthetic flow data, duplicate nodes, or persisted coordinates.
- Amount changes node order only. It must not change an ordinary node's dimensions, edge thickness, or edge emphasis.
- Retain overview/default/detail semantic zoom, archive/restore, modal edit/recovery behavior, and Main/Simulation/Portfolio deep-equality guarantees.
- At 390px, 768px, and desktop widths keep the map, detail surface, modal, focus order, and 44px controls within their containing surface. Honor `prefers-reduced-motion: reduce`.

---

## File Structure

- `src/account-map/ui/mapLayout.ts`: graph metadata, primary-income choice, overview representative selection, canonical deterministic geometry.
- `src/account-map/ui/accountMapConnectionDetail.ts`: pure location-link aggregation for the non-modal detail.
- `src/account-map/ui/AccountMapCanvas.tsx`: canonical map controls, accessible labels/table order, transient/pinned detail rendering, pin-only animation lifecycle.
- `src/account-map/ui/motion.ts`: remove obsolete layout-transition animation and add the constrained detail-row animation adapter.
- `src/account-map/ui/account-map.css`: contained light detail card and its responsive/reduced-motion presentation; remove layout-toggle rules.
- `src/account-map/ui/AccountMapApp.tsx` and `src/account-map/application/reducer.ts`: remove only the now-unreachable layout-change UI event/write path.
- `tests/unit/account-map/{mapLayout,accountMapConnectionDetail,AccountMapCanvas,motion,reducer,AccountMapApp}.test.ts(x)`: deterministic behavior, interaction, motion, and removed-write-path regression coverage.
- `tests/account-map.spec.ts`: supported responsive browser flow and visual containment coverage.
- `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`, `DESIGN.md`, `docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md`: current contract wording only; historical plans stay unchanged.

### Task 1: Build the canonical account-first graph layout

**Files:**
- Modify: `src/account-map/ui/mapLayout.ts`
- Test: `tests/unit/account-map/mapLayout.test.ts`

**Interfaces:**
- Consumes: `AccountMapApplied.links`, `FinancialLocation[]`, `MainData`, and `MapZoom`.
- Produces: `AccountMapGraph.primaryIncomeLocationId: string | null`, `GraphNode.isPrimaryIncome?: boolean`, and `layoutAccountMap(graph, viewport, zoom): PositionedGraph` without a `MapLayout` parameter.

- [ ] **Step 1: Write failing graph-layout tests**

Add fixtures with two active `system:income` links where the larger link is not first in storage. Assert that `buildAccountMapGraph(..., 'overview')` includes that location as the income representative, marks it `isPrimaryIncome`, and still does so after reversing link storage order. Add equal-value fixtures asserting normalized `shortName`, then location ID tie order. Add a no-active-income fixture asserting `primaryIncomeLocationId === null` and a normal `system:income` purpose node.

Add geometry assertions at `1280×900` that every location is in the left column, every purpose is in the right column, and the primary income location is the first/top-left location. At `390×844` and `768×1024`, assert the primary location is the first positioned node, locations precede purposes, all nodes remain non-overlapping, and repeating the call returns byte-equal geometry.

- [ ] **Step 2: Run the focused test to prove the current implementation lacks the contract**

Run: `npx vitest run tests/unit/account-map/mapLayout.test.ts`

Expected: FAIL because overview currently selects the first stored link and `layoutAccountMap` still accepts purpose/account layout selection.

- [ ] **Step 3: Add graph metadata and deterministic representative selection**

In `buildAccountMapGraph`, derive `primaryIncomeLocationId` from all active income links before filtering for zoom. Select the overview `system:income` representative by this ID; leave non-income overview representative behavior unchanged. Add `isPrimaryIncome` to the matching location graph node.

Add an explicit deterministic comparator:

```ts
primary income location
→ remaining locations by active-link amount descending, count descending, normalized shortName, id
→ system purposes in system-purpose order
→ custom purposes by parent system-purpose order, target descending, normalized name, id
→ status nodes
```

Carry the custom-purpose parent/order information in the graph view model rather than inferring it from an opaque custom ID.

- [ ] **Step 4: Replace the dual layout geometry with one canonical layout**

Delete `MapLayout`, the layout argument to `layoutAccountMap`, `nodeRank`, and purpose/account branching. On desktop, `placeColumns` must always place location nodes on the left and purpose nodes on the right, with status nodes centered as today. On mobile, call the existing grid placement with the canonical comparator order. Keep existing responsive width, minimum height, 44px minimum node-height, and no-overlap safeguards.

- [ ] **Step 5: Run focused graph-layout tests**

Run: `npx vitest run tests/unit/account-map/mapLayout.test.ts`

Expected: PASS, including primary-income, overview, tie, no-anchor, desktop, and mobile assertions.

- [ ] **Step 6: Commit the pure layout change**

```bash
git add src/account-map/ui/mapLayout.ts tests/unit/account-map/mapLayout.test.ts
git commit -m "feat(account-map): rank canonical map layout"
```

### Task 2: Remove the layout toggle and its presentation write path

**Files:**
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/application/reducer.ts`
- Modify: `src/account-map/ui/motion.ts`
- Test: `tests/unit/account-map/AccountMapCanvas.test.tsx`
- Test: `tests/unit/account-map/reducer.test.ts`
- Test: `tests/unit/account-map/AccountMapApp.test.tsx`
- Test: `tests/unit/account-map/motion.test.ts`

**Interfaces:**
- Consumes: the canonical `layoutAccountMap(graph, viewport, zoom)` result from Task 1.
- Produces: an `AccountMapCanvas` surface with only semantic zoom controls; no `onLayoutChange` prop, `layout-changed` reducer event, `layout-change` recovery action, or `animateMapLayout` export.

- [ ] **Step 1: Write failing UI/reducer tests for the removed behavior and compatibility boundary**

Replace assertions that find `목적 중심`, `계좌 중심`, or `지도 정렬` with assertions that none are rendered and that zoom controls remain. Delete the reducer test that switches layout; retain node-focus/background tests and assert those state transitions leave the legacy `applied.layout` value unchanged. In `AccountMapApp` tests, assert rendering an applied workspace with `layout: 'purpose'` and one with `layout: 'account'` produces the same canonical account-first node order without a save request.

Update motion tests to stop importing `animateMapLayout`; preserve the shared-element modal tests.

- [ ] **Step 2: Run the focused tests to verify they fail on the current UI**

Run: `npx vitest run tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/reducer.test.ts tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts`

Expected: FAIL because the toolbar exposes the two buttons and the app persists a layout change.

- [ ] **Step 3: Delete only the presentation-selection path**

Remove the layout-control markup, `changeLayout`, `layoutAnimating`, `onLayoutChange` prop, its `AccountMapApp` save callback, the reducer `layout-changed` event/case, `layout-change` manual recovery action, and `animateMapLayout`. Update `layoutAccountMap` callers for the Task 1 signature. Do not remove `layout` from domain types, migration validation, workspace backups, applied fixtures, or ordinary map-edit save payloads.

- [ ] **Step 4: Keep canonical accessible reading order**

Render the linear table with fixed headers `계좌·보관처`, `목적`, `월 금액`, `상태`. Derive its rows by canonical location order, then each linked purpose order, rather than `applied.layout` or raw edge storage order. Keep the table screen-reader-only and outside the tab sequence.

- [ ] **Step 5: Run focused UI/reducer/motion tests**

Run: `npx vitest run tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/reducer.test.ts tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts`

Expected: PASS, with legacy persisted values readable but no UI mutation or stale-recovery branch for a layout change.

- [ ] **Step 6: Commit the toggle removal**

```bash
git add src/account-map/ui/AccountMapCanvas.tsx src/account-map/ui/AccountMapApp.tsx src/account-map/application/reducer.ts src/account-map/ui/motion.ts tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/reducer.test.ts tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts
git commit -m "refactor(account-map): remove layout selection"
```

### Task 3: Add the truthful pinned account connection detail

**Files:**
- Create: `src/account-map/ui/accountMapConnectionDetail.ts`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/motion.ts`
- Modify: `src/account-map/ui/account-map.css`
- Create: `tests/unit/account-map/accountMapConnectionDetail.test.ts`
- Test: `tests/unit/account-map/AccountMapCanvas.test.tsx`
- Test: `tests/unit/account-map/motion.test.ts`

**Interfaces:**
- Consumes: `PositionedGraph`, a location node ID, transient/pinned interaction state, and `reducedMotion`.
- Produces: `summarizeLocationConnectionDetail(graph, locationId): { totalWon: number; rows: readonly { purposeId: string; label: string; amountWon: number; percent: number }[] } | null` and `animateConnectionDetail(root, options): AnimationHandle`.

- [ ] **Step 1: Write failing pure aggregation tests**

Create `accountMapConnectionDetail.test.ts`. Build a graph with active and suspended edges, repeated purpose IDs, and a zero-total location. Assert that only active edges are included, matching purpose IDs aggregate before percentage calculation, rows use canonical purpose order, and rounded displayed percentages sum to 100. Assert that a location with no active links returns the explicit empty detail rather than a divide-by-zero percentage.

- [ ] **Step 2: Run the aggregation test to verify it fails**

Run: `npx vitest run tests/unit/account-map/accountMapConnectionDetail.test.ts`

Expected: FAIL because no pure account-detail summarizer exists.

- [ ] **Step 3: Implement the pure summary module**

Create `summarizeLocationConnectionDetail`. Resolve purpose labels from `graph.nodes`, aggregate active `GraphEdge.amountWon` values by `purposeId`, calculate each percentage against the active-link total, and return rows in the same system/custom purpose order from Task 1. Represent an empty active-link set with `totalWon: 0` and `rows: []`; do not use `NaN`, `Infinity`, or a fake 100% row.

- [ ] **Step 4: Write failing Canvas and motion tests**

Add Canvas tests that hover/focus a location and find a static `월 연결 구성` disclosure plus `월 계획 연결 기준 · 실제 잔액·거래·계좌 간 이동이 아님`. Verify the first click pins it without opening the modal and the second click still opens the existing modal. Verify purpose nodes retain their current detail behavior.

Mock `animateConnectionDetail` and assert it runs once for a newly pinned location, never for hover/focus alone, and receives `reducedMotion: true` without animating in reduced-motion tests. Assert the final percentage text is present before the animation callback completes.

- [ ] **Step 5: Implement detail rendering and pin-only motion**

Render the detail inside `.account-map-canvas` after nodes, anchored to the focused/pinned location but clamped to the canvas bounds. For transient focus/hover, render final static percentages. For a newly pinned location, call `animateConnectionDetail` from an effect keyed by pinned location ID; cancel it on unpin, target change, and unmount. Do not animate node geometry, map edges, or focus movement.

Add `animateConnectionDetail` in `motion.ts` to animate only `[data-account-map-connection-weight]` elements from `scaleX(0)` to their supplied final percentage with a short stagger. Its reduced-motion branch must clear inline motion styles and call `onComplete` synchronously.

- [ ] **Step 6: Add contained, light detail styling**

Add `.account-map-connection-detail` styles with the existing panel/background tokens, border, shadow, readable foreground text, `max-inline-size`, and a clamped position within the canvas. Give each percentage row a small internal weight track/fill that is visible only in the detail, not a map edge or node-size signal. Remove all black tooltip-like treatment. In the mobile media query, use a full-width inset panel that stays above map controls and below the card boundary. In reduced-motion media rules, disable the detail fill transition.

- [ ] **Step 7: Run focused detail tests**

Run: `npx vitest run tests/unit/account-map/accountMapConnectionDetail.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/motion.test.ts`

Expected: PASS for aggregation, semantic copy, interaction parity, pin-only motion, and reduced-motion final state.

- [ ] **Step 8: Commit detail and motion**

```bash
git add src/account-map/ui/accountMapConnectionDetail.ts src/account-map/ui/AccountMapCanvas.tsx src/account-map/ui/motion.ts src/account-map/ui/account-map.css tests/unit/account-map/accountMapConnectionDetail.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/motion.test.ts
git commit -m "feat(account-map): reveal pinned connection composition"
```

### Task 4: Document the current contract and prove responsive behavior

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md`
- Modify: `tests/account-map.spec.ts`

**Interfaces:**
- Consumes: the canonical rendered map, linear table, pin detail, and storage compatibility from Tasks 1–3.
- Produces: current product documents and supported browser regression coverage that name only one account-first layout.

- [ ] **Step 1: Write failing Account Map browser assertions**

In `tests/account-map.spec.ts`, seed two income-linked locations with the larger link second in storage. At each viewport `390×844`, `768×1024`, and `1280×900`, assert that no `목적 중심`/`계좌 중심` button exists, the primary income account is first in map focus order, and the account-first relationship table begins with it.

At desktop and mobile, hover/focus then pin the primary account. Assert static detail before pin, the connection-not-transfer copy, visible final percentages, no horizontal document overflow, and that the detail rectangle stays within `.account-map-canvas`. With reduced motion, assert the same final content without waiting for animation. Keep existing modal second-activation and archive/recovery coverage.

- [ ] **Step 2: Run the focused browser spec after the preceding implementation tasks**

Run: `npx playwright test tests/account-map.spec.ts --reporter=list`

Expected: PASS. Tasks 1–3 already supply the canonical layout and detail; this run proves the real supported browser surface satisfies the new assertions.

- [ ] **Step 3: Amend current product documents without rewriting history**

In the PRD Account Map requirements, replace the purpose/account layout choice with the one account-first map and clarify that focused percentages are monthly-plan connection composition, not transfers. In `DESIGN.md`, replace toggle-dependent linear-table order with canonical account-first order and retain all 390px/768px/desktop, focus, touch, and no-write-back language. Amend only map-presentation clauses in the 2026-08-13 approved design to point to the newer approved design; do not alter historical plan files.

- [ ] **Step 4: Run focused and complete verification**

Run:

```bash
npm run check
npx vitest run tests/unit/account-map
npx playwright test tests/account-map.spec.ts --reporter=list
npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list
git diff --check
```

Expected: every command exits 0. If a cross-app assertion fails, fix only a regression caused by this feature; do not broaden the Account Map write boundary.

- [ ] **Step 5: Commit documentation and regression evidence**

```bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md DESIGN.md docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md tests/account-map.spec.ts
git commit -m "test(account-map): cover canonical map experience"
```

## Plan Self-Review

- Spec coverage: Task 1 covers primary-income ranking, overview preservation, no-anchor behavior, fixed visual weight, canonical desktop/mobile placement, and deterministic geometry. Task 2 removes the toggle and write/recovery path while preserving serialized compatibility. Task 3 covers truthful composition copy, interaction parity, pin-only Anime.js motion, and contained responsive detail. Task 4 updates active documents and exercises 390px, 768px, desktop, accessibility, and cross-app regressions.
- Placeholder scan: no task delegates unspecified error handling or testing; every command, file, interface, and expected behavior is named.
- Type consistency: `primaryIncomeLocationId`, `isPrimaryIncome`, `layoutAccountMap(graph, viewport, zoom)`, `summarizeLocationConnectionDetail`, and `animateConnectionDetail` are introduced in Task 1/3 before later tasks consume them.
