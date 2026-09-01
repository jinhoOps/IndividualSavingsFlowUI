# Account Map Visualization Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Account Map의 의미 그래프, 결정적 responsive 배치, edge/detail geometry와 canvas 렌더링을 분리하면서 account-first UX와 저장 ownership을 보존한다.

**Architecture:** Main·Account Map 데이터는 viewport와 무관한 graph model로 변환되고 semantic zoom projection과 responsive layout을 거쳐 positioned graph가 된다. Edge/detail geometry와 canvas view model은 순수 파생이며 React는 측정·pan·zoom·interaction callback과 markup만 소유한다.

**Tech Stack:** React 19, TypeScript 5.5, Anime.js, SVG/CSS positioned nodes, Vitest 4, Testing Library, Playwright

**Spec:** [Account Map Visualization Boundary Refactor Design](../specs/2026-09-01-account-map-visualization-boundary-design.md)

## Global Constraints

- Account Map은 Main을 읽기 전용으로 사용하고 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- link는 월 계획 연결이며 거래·잔액·계좌 간 이체가 아니다.
- account-first canonical order, primary-income anchor, semantic zoom과 pan을 유지한다.
- amount는 node 순서에만 영향을 주며 node 크기와 edge 시각 weight를 변경하지 않는다.
- hover/focus는 static detail, 새 pin만 one-shot Anime.js, reduced motion은 즉시 final state다.
- 390px, 768px와 desktop에서 map/detail containment, focus order와 44px target을 유지한다.
- 기존 `mapLayout.ts` import가 여러 소비자에 있으므로 Phase 3 동안 compatibility re-export를 유지한다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `src/account-map/ui/accountMapGraph.ts` | truthful node/edge model, primary income와 canonical rank |
| `src/account-map/ui/accountMapLayoutPolicy.ts` | breakpoint, canvas/node dimensions와 grid/column capacity |
| `src/account-map/ui/accountMapLayout.ts` | canonical node placement와 positioned graph |
| `src/account-map/ui/accountMapEdgeGeometry.ts` | edge Bézier path와 amount label anchor |
| `src/account-map/ui/accountMapDetailGeometry.ts` | focused disclosure 위치와 canvas expansion |
| `src/account-map/ui/accountMapCanvasModel.ts` | connected/dimmed IDs, canonical rows, modal relations |
| `src/account-map/ui/mapLayout.ts` | Phase 3 compatibility re-export only |
| `src/account-map/ui/AccountMapCanvas.tsx` | measurement, pan/zoom/events와 DOM/SVG rendering |
| `tests/unit/account-map/*.test.ts(x)` | 순수 경계와 현재 canvas 외부 동작 회귀 |

---

### Task 1: Account Map graph model and zoom projection

**Files:**
- Create: `src/account-map/ui/accountMapGraph.ts`
- Create: `tests/unit/account-map/accountMapGraph.test.ts`
- Modify: `src/account-map/ui/mapLayout.ts`
- Modify: `tests/unit/account-map/mapLayout.test.ts`

**Interfaces:**

```ts
export interface AccountMapGraphSource {
  primaryIncomeLocationId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export function buildAccountMapGraphSource(
  applied: AccountMapApplied,
  locations: readonly FinancialLocation[],
  main: MainData,
): AccountMapGraphSource;
export function projectAccountMapGraph(
  source: AccountMapGraphSource,
  zoom: MapZoom,
): AccountMapGraph;
export function compareGraphNodes(left: GraphNode, right: GraphNode): number;
```

- [ ] **Step 1: Write failing source-model tests**

Move—not delete—the existing primary income, tie-break, no-anchor, purpose reference and unlinked-location assertions into `accountMapGraph.test.ts`. Add an explicit unfiltered-source assertion:

```ts
const source = buildAccountMapGraphSource(appliedWithTwoIncomeLocations, locations, main);
expect(source.primaryIncomeLocationId).toBe('salary-high');
expect(source.edges.filter(({ purposeId }) => purposeId === 'system:income')).toHaveLength(2);
```

- [ ] **Step 2: Run the new test and verify failure**

Run: `npx vitest run tests/unit/account-map/accountMapGraph.test.ts`

Expected: FAIL because `accountMapGraph` does not exist.

- [ ] **Step 3: Extract zoom-independent source construction**

Calculate active links, primary income, every active/unlinked location, system/custom purposes and status once. Preserve normalized Korean name and stable ID tie-breaks. Do not import viewport, React or storage.

- [ ] **Step 4: Implement semantic zoom projection**

For overview, omit custom purposes and select one representative active link/location per visible system purpose, forcing `system:income` to use the source primary location. Default uses active links; detail includes suspended links currently allowed by baseline. Recompute visible location nodes without creating duplicates.

- [ ] **Step 5: Keep `mapLayout.ts` compatibility exports**

Re-export `GraphNode`, `GraphEdge`, `AccountMapGraph`, `MapZoom`, `buildAccountMapGraphSource`, `projectAccountMapGraph`, and provide the old wrapper:

```ts
export function buildAccountMapGraph(applied, locations, main, zoom) {
  return projectAccountMapGraph(
    buildAccountMapGraphSource(applied, locations, main),
    zoom,
  );
}
```

- [ ] **Step 6: Run graph and legacy layout tests**

Run:

```bash
npx vitest run tests/unit/account-map/accountMapGraph.test.ts tests/unit/account-map/mapLayout.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx
npm run check
```

Expected: all PASS with existing overview/default/detail topology unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/account-map/ui/accountMapGraph.ts src/account-map/ui/mapLayout.ts tests/unit/account-map/accountMapGraph.test.ts tests/unit/account-map/mapLayout.test.ts
git commit -m "refactor(account-map): separate graph model"
```

### Task 2: Responsive layout policy and deterministic placement

**Files:**
- Create: `src/account-map/ui/accountMapLayoutPolicy.ts`
- Create: `src/account-map/ui/accountMapLayout.ts`
- Create: `tests/unit/account-map/accountMapLayoutPolicy.test.ts`
- Create: `tests/unit/account-map/accountMapLayout.test.ts`
- Modify: `src/account-map/ui/mapLayout.ts`
- Modify: `tests/unit/account-map/mapLayout.test.ts`

**Interfaces:**

```ts
export interface AccountMapLayoutPolicy {
  direction: 'left-to-right' | 'top-to-bottom';
  width: number;
  minimumHeight: number;
  margin: number;
  nodeWidth: number;
  nodeHeight: number;
  columns: number;
}
export function createAccountMapLayoutPolicy(
  viewport: { width: number; height: number },
): AccountMapLayoutPolicy;
export function layoutAccountMap(
  graph: AccountMapGraph,
  viewport: { width: number; height: number },
  zoom: MapZoom,
): PositionedGraph;
```

- [ ] **Step 1: Write failing policy tests**

Assert 390px uses top-to-bottom with 16px margin and finite node widths, 768px remains top-to-bottom, 769px uses left-to-right with 28px margin, and all policies have node height 78 and width at most 210.

- [ ] **Step 2: Write failing placement tests**

Use the existing graph fixture to assert primary location first/top-left on desktop, first/topmost on mobile, purpose nodes on the right at desktop, fixed node dimensions for amount-only changes, no overlaps and byte-equivalent repeated output.

- [ ] **Step 3: Run new units and verify failure**

Run: `npx vitest run tests/unit/account-map/accountMapLayoutPolicy.test.ts tests/unit/account-map/accountMapLayout.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Extract policy arithmetic**

Move width clamp, breakpoint, margin, node dimension and grid column calculations unchanged from `mapLayout.ts`. The policy must use viewport only; it must not inspect amount or node identity.

- [ ] **Step 5: Extract mobile grid and desktop columns**

Move content-height, `placeGrid`, `placeColumns` and `placeSide` to `accountMapLayout.ts`. Sort with `compareGraphNodes()` before placement and return copied edges.

- [ ] **Step 6: Re-export layout types and function**

Keep `mapLayout.ts` as the compatibility path so `AccountMapCanvas` and connection-detail tests do not require a flag-day move.

- [ ] **Step 7: Run layout/canvas regressions**

Run:

```bash
npx vitest run tests/unit/account-map/accountMapLayoutPolicy.test.ts tests/unit/account-map/accountMapLayout.test.ts tests/unit/account-map/mapLayout.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx
npm run check
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/account-map/ui/accountMapLayoutPolicy.ts src/account-map/ui/accountMapLayout.ts src/account-map/ui/mapLayout.ts tests/unit/account-map/accountMapLayoutPolicy.test.ts tests/unit/account-map/accountMapLayout.test.ts tests/unit/account-map/mapLayout.test.ts
git commit -m "refactor(account-map): isolate responsive layout"
```

### Task 3: Edge and connection-detail geometry

**Files:**
- Create: `src/account-map/ui/accountMapEdgeGeometry.ts`
- Create: `src/account-map/ui/accountMapDetailGeometry.ts`
- Create: `tests/unit/account-map/accountMapEdgeGeometry.test.ts`
- Create: `tests/unit/account-map/accountMapDetailGeometry.test.ts`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`

**Interfaces:**

```ts
export interface AccountMapEdgeGeometry {
  path: string;
  amountAnchor: { left: number; top: number };
}
export function buildAccountMapEdgeGeometry(
  purpose: PositionedNode,
  location: PositionedNode,
): AccountMapEdgeGeometry;

export interface ConnectionDetailPosition {
  left: number;
  top: number;
  maxBlockSize: number;
  canvasHeight: number;
}
export function positionConnectionDetail(
  node: PositionedNode,
  nodes: readonly PositionedNode[],
  canvas: Pick<PositionedGraph, 'width' | 'height'>,
  pan: { x: number; y: number },
): ConnectionDetailPosition;
```

- [ ] **Step 1: Write failing edge geometry tests**

```ts
expect(buildAccountMapEdgeGeometry(purpose, location)).toEqual({
  path: 'M 700 139 C 450 139, 450 339, 200 339',
  amountAnchor: { left: 450, top: 339 },
});
```

Use fixture coordinates that reproduce current center-point and label formulas.

- [ ] **Step 2: Write failing detail containment tests**

Cover adjacent-right placement, left fallback, mobile clamping, overlap rejection, pan-adjusted node rectangles and canvas-below expansion. Assert every returned `left/top` is finite and the detail right edge is within `canvas.width - 16`.

- [ ] **Step 3: Run new units and verify failure**

Run: `npx vitest run tests/unit/account-map/accountMapEdgeGeometry.test.ts tests/unit/account-map/accountMapDetailGeometry.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Extract exact geometry calculations**

Move endpoint center, cubic path, amount anchor, rectangle overlap, node rectangle and detail candidate selection unchanged. Clamp detail width to `canvas.width - 32` and detail height to available canvas height without returning negative values.

- [ ] **Step 5: Wire `AccountMapCanvas`**

Build geometry once per visible edge and use `geometry.path` plus `geometry.amountAnchor`. Replace the component-local detail/rectangle functions with the imported pure helper.

- [ ] **Step 6: Run geometry and canvas tests**

Run:

```bash
npx vitest run tests/unit/account-map/accountMapEdgeGeometry.test.ts tests/unit/account-map/accountMapDetailGeometry.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx
npm run check
```

Expected: all PASS, including detail containment and pan behavior.

- [ ] **Step 7: Commit**

```bash
git add src/account-map/ui/accountMapEdgeGeometry.ts src/account-map/ui/accountMapDetailGeometry.ts src/account-map/ui/AccountMapCanvas.tsx tests/unit/account-map/accountMapEdgeGeometry.test.ts tests/unit/account-map/accountMapDetailGeometry.test.ts
git commit -m "refactor(account-map): separate map geometry"
```

### Task 4: Canvas interaction view model

**Files:**
- Create: `src/account-map/ui/accountMapCanvasModel.ts`
- Create: `tests/unit/account-map/accountMapCanvasModel.test.ts`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `tests/unit/account-map/AccountMapCanvas.test.tsx`

**Interfaces:**

```ts
export interface AccountMapCanvasModel {
  nodeById: ReadonlyMap<string, PositionedNode>;
  canonicalRows: GraphEdge[];
  connectedIds: ReadonlySet<string>;
  focusedId: string | null;
  focusedNode?: PositionedNode;
  pinnedLocationId: string | null;
}
export interface AccountMapModalRelation {
  label: string;
  amountWon: number;
  status: GraphEdge['status'];
  suspendedReason?: 'location-archived' | 'user';
  linkId: string;
  purposeId: string;
  purposeTargetWon?: number;
  locationId: string;
  remainder: boolean;
  replacementCandidate?: boolean;
}
export function buildAccountMapCanvasModel(
  graph: PositionedGraph,
  interaction: MapInteractionState,
): AccountMapCanvasModel;
export function buildAccountMapModalRelations(
  graph: PositionedGraph,
  applied: AccountMapApplied,
  modalNodeId: string | null,
): AccountMapModalRelation[];
export function withDisplayedPercents<Row extends { percent: number }>(
  rows: readonly Row[],
): Array<Row & { displayPercent: number }>;
```

- [ ] **Step 1: Write failing canonical model tests**

Assert canonical rows group by positioned location order then purpose order, focus includes both endpoints of matching edges, an unrelated node is absent from `connectedIds`, and only a pinned location produces `pinnedLocationId`. Assert modal relations preserve suspended reasons, remainder flags and replacement candidates for other active locations connected to the same purpose.

- [ ] **Step 2: Write failing displayed-percent tests**

```ts
expect(withDisplayedPercents([
  { id: 'a', percent: 33.4 },
  { id: 'b', percent: 33.3 },
  { id: 'c', percent: 33.3 },
]).map(({ displayPercent }) => displayPercent)).toEqual([34, 33, 33]);
```

Also assert empty rows stay empty and a single row becomes 100.

- [ ] **Step 3: Run new unit and verify failure**

Run: `npx vitest run tests/unit/account-map/accountMapCanvasModel.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Extract pure view-model derivation**

Move `nodeById`, node order, canonical rows, focused/connected IDs, pinned-location selection, modal relation derivation and percentage rounding. Do not move React refs, stale-target effect, callbacks, modal state or DOM event handling.

- [ ] **Step 5: Wire the component and preserve detail source**

Continue building `activeDetailGraph` at detail zoom so overview focus summarizes zoom-hidden active links. Use `summarizeLocationConnectionDetail()` and then `withDisplayedPercents()` from the new module.

- [ ] **Step 6: Run canvas behavior tests**

Run:

```bash
npx vitest run tests/unit/account-map/accountMapCanvasModel.test.ts tests/unit/account-map/accountMapConnectionDetail.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx
npm run check
```

Expected: all PASS, including canonical table, overview hidden links, focus/pin/modal stages and purpose behavior.

- [ ] **Step 7: Commit**

```bash
git add src/account-map/ui/accountMapCanvasModel.ts src/account-map/ui/AccountMapCanvas.tsx tests/unit/account-map/accountMapCanvasModel.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx
git commit -m "refactor(account-map): extract canvas view model"
```

### Task 5: Account Map integration, motion and ownership verification

**Files:**
- Verify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/motion.ts`
- Verify: `tests/account-map.spec.ts`
- Modify: `tests/unit/account-map/motion.test.ts`
- Verify: `tests/unit/account-map/commands.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 boundaries and existing `animateConnectionDetail()`.
- Produces: verified Account Map visualization unit with unchanged data ownership.

- [ ] **Step 1: Add the Anime.js throw final-state assertion**

In `motion.test.ts`, mock Anime.js `animate` to throw and assert every `[data-account-map-connection-weight]` element retains its final CSS custom property and the completion callback runs exactly once. Do not add an initial hidden semantic state.

- [ ] **Step 2: Run the focused motion test and verify failure**

Run: `npx vitest run tests/unit/account-map/motion.test.ts`

Expected: FAIL because `animateConnectionDetail()` currently lets the Anime.js exception escape.

- [ ] **Step 3: Commit the final detail state on Anime.js failure**

Wrap connection-detail animation creation in `try/catch`. If any `animate()` call throws, cancel animations already created, remove transient transform/will-change styles from every weight, call `options.onComplete()` once, and return the no-op animation handle.

- [ ] **Step 4: Run the complete Account Map unit surface**

Run:

```bash
npx vitest run tests/unit/account-map/accountMapGraph.test.ts tests/unit/account-map/accountMapLayoutPolicy.test.ts tests/unit/account-map/accountMapLayout.test.ts tests/unit/account-map/accountMapEdgeGeometry.test.ts tests/unit/account-map/accountMapDetailGeometry.test.ts tests/unit/account-map/accountMapCanvasModel.test.ts tests/unit/account-map/mapLayout.test.ts tests/unit/account-map/accountMapConnectionDetail.test.ts tests/unit/account-map/motion.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/commands.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run Account Map browser regression**

Run: `npx playwright test tests/account-map.spec.ts`

Expected: PASS with only repository-documented conditional skips.

- [ ] **Step 6: Verify required viewports and interaction states**

At 390×844, 768×1024 and 1280×900 assert no document overflow, primary income first slot, fixed node dimensions after amount changes, neutral edge styles, overview/default/detail visibility, pan containment, static hover/focus detail, one-shot pin detail, second-activation modal and 44px controls.

- [ ] **Step 7: Verify storage ownership**

Run command/repository focused tests and assert every Account Map save keeps serialized `main`, `simulation` and `portfolio` before/after values deeply equal while changing only allowed location/accountMap fields.

- [ ] **Step 8: Run repository checks**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run build
git diff --check
```

Expected: all commands exit 0; existing documented skips remain explicit.

- [ ] **Step 9: Commit the motion fallback**

```bash
git add src/account-map/ui/motion.ts tests/unit/account-map/motion.test.ts
git commit -m "test(account-map): lock visualization boundaries"
```
