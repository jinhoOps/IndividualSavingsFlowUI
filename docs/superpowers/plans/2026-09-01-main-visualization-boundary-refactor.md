# Main Visualization Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main cashflow bar와 donut의 금융 의미, geometry, 상호작용, Anime.js DOM mutation을 분리하면서 현재 출력과 반응형 동작을 보존한다.

**Architecture:** `MainData`는 순수 semantic model로 변환되고 viewport와 결합해 geometry가 된다. React 컴포넌트는 측정·이벤트·markup만 소유하며 앱 전용 motion adapter가 geometry 사이의 시각 전환과 final-state 복구를 담당한다.

**Tech Stack:** React 19, TypeScript 5.5, Anime.js, Vitest 4, Testing Library, Playwright

**Spec:** [Main Visualization Boundary Refactor Design](../specs/2026-09-01-main-visualization-boundary-design.md)

## Global Constraints

- Main만 다섯 월간 금액을 편집한다.
- setup review와 dashboard `자세히 보기`의 현재 bar 표시 조건을 유지한다.
- 초과 bar는 실제 비율만큼 연장하고 viewport를 벗어날 때만 절단한다.
- donut visible arc 합은 100% 이하이되 실제 초과 의미와 문구는 유지한다.
- pointer, keyboard, touch, accessible name, DOM 읽기 순서, CSS selector, 색상과 motion timing을 변경하지 않는다.
- Anime.js 정상·reduced-motion·throw·cancel-failure 경로는 같은 final geometry를 남긴다.
- 각 task 시작 전 `git status --short`를 확인하고 관련 없는 변경을 stage하지 않는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `src/main/ui/setup/cashflowBarModel.ts` | Main cashflow에서 canonical bar allocation 의미 모델 생성 |
| `src/main/ui/setup/cashflowBarGeometry.ts` | 의미 모델과 viewport에서 연장·clipping geometry 계산 |
| `src/main/ui/setup/cashflowBarInteraction.ts` | hit target, clipped fallback, pointer/tooltip 위치의 순수 계산 |
| `src/main/ui/setup/allocationBarMotion.ts` | bar visual state와 Anime.js final-state commit |
| `src/main/ui/setup/AllocationBar.tsx` | 측정, 이벤트 상태와 semantic markup |
| `src/main/ui/dashboard/cashflowDonutGeometry.ts` | donut arc 순서·길이·offset 계산 |
| `src/main/ui/dashboard/cashflowDonutMotion.ts` | entering/current/exiting arc motion과 SVG final commit |
| `src/main/ui/dashboard/CashflowDonutSummary.tsx` | donut interaction과 semantic SVG/card markup |
| `tests/unit/main/*.test.ts(x)` | 순수 경계와 기존 외부 동작 회귀 |

---

### Task 1: Cashflow bar semantic model and geometry input boundary

**Files:**
- Create: `src/main/ui/setup/cashflowBarModel.ts`
- Create: `tests/unit/main/cashflowBarModel.test.ts`
- Modify: `src/main/ui/setup/cashflowBarGeometry.ts`
- Modify: `tests/unit/main/cashflowBarGeometry.test.ts`
- Modify: `src/main/ui/setup/AllocationBar.tsx`

**Interfaces:**
- Consumes: `MainData`, `calculateCashflow`, `percentageOfIncome`, `CashflowViewport`.
- Produces:

```ts
export type CashflowAllocationId = 'consumption' | 'saving' | 'investment' | 'remaining';

export interface CashflowBarAllocation {
  id: CashflowAllocationId;
  label: string;
  amountWon: number;
  percentage: number | null;
  startPercent: number;
  widthPercent: number;
}

export interface CashflowBarModel {
  incomeWon: number;
  deficitWon: number;
  allocations: CashflowBarAllocation[];
}

export function buildCashflowBarModel(data: MainData): CashflowBarModel;
export function createCashflowBarGeometry(
  model: CashflowBarModel,
  viewport: CashflowViewport,
): CashflowBarGeometry;
```

- [ ] **Step 1: Write failing semantic-model tests**

Create `cashflowBarModel.test.ts` with exact normal, exact-income and deficit cases:

```ts
it('keeps canonical allocations and excludes negative remaining from a deficit', () => {
  const model = buildCashflowBarModel({
    monthlyNetIncomeWon: 3_100_000,
    monthlyHousingWon: 700_000,
    monthlyLivingWon: 900_000,
    monthlySavingWon: 800_000,
    monthlyInvestmentWon: 900_000,
  });

  expect(model.deficitWon).toBe(200_000);
  expect(model.allocations.map(({ id }) => id)).toEqual([
    'consumption', 'saving', 'investment',
  ]);
  expect(model.allocations.map(({ startPercent, widthPercent }) => ({ startPercent, widthPercent })))
    .toEqual([
      { startPercent: 0, widthPercent: 1600 / 31 },
      { startPercent: 1600 / 31, widthPercent: 800 / 31 },
      { startPercent: 2400 / 31, widthPercent: 900 / 31 },
    ]);
});
```

Also assert a non-deficit model appends `remaining` and zero income produces `null` semantic percentages with finite zero widths.

- [ ] **Step 2: Run the new test and verify failure**

Run: `npx vitest run tests/unit/main/cashflowBarModel.test.ts`

Expected: FAIL because `cashflowBarModel` does not exist.

- [ ] **Step 3: Implement the semantic model**

Implement `buildCashflowBarModel()` by calling `calculateCashflow(data)` once, appending allocations in `consumption → saving → investment → remaining` order, omitting `remaining` when `deficitWon > 0`, and accumulating `startPercent` from finite `percentageOfIncome()` results.

```ts
const percentage = percentageOfIncome(amountWon, cashflow.incomeWon);
const widthPercent = percentage ?? 0;
const allocation = { id, label, amountWon, percentage, startPercent, widthPercent };
startPercent += widthPercent;
```

- [ ] **Step 4: Change geometry to consume the model**

Remove `MainData`, `calculateCashflow` and `percentageOfIncome` imports from `cashflowBarGeometry.ts`. Derive overflow and capacity only from `model` and viewport:

```ts
const overflowPercent = model.incomeWon > 0
  ? model.deficitWon / model.incomeWon * 100
  : 0;
const desiredEndPercent = 100 + overflowPercent;
const capacityPercent = viewport.barWidthPx > 0
  ? Math.max(0, viewport.availableRightPx / viewport.barWidthPx * 100)
  : 0;
const visibleEndPercent = Math.min(desiredEndPercent, 100 + capacityPercent);
```

Return model allocation `{ id, startPercent, widthPercent }` values unchanged.

- [ ] **Step 5: Update callers and tests without weakening assertions**

In `AllocationBar`, memoize or synchronously build one model per render, pass it to geometry, and use its allocations/deficit for table semantics. Update `cashflowBarGeometry.test.ts` fixtures to call `buildCashflowBarModel(data)` before geometry; keep every existing expected percentage and clipping assertion.

- [ ] **Step 6: Run focused tests and type checks**

Run:

```bash
npx vitest run tests/unit/main/cashflowBarModel.test.ts tests/unit/main/cashflowBarGeometry.test.ts tests/unit/main/AllocationBar.test.tsx
npm run check
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/ui/setup/cashflowBarModel.ts src/main/ui/setup/cashflowBarGeometry.ts src/main/ui/setup/AllocationBar.tsx tests/unit/main/cashflowBarModel.test.ts tests/unit/main/cashflowBarGeometry.test.ts
git commit -m "refactor(main): separate cashflow bar model"
```

### Task 2: Cashflow bar interaction boundary

**Files:**
- Create: `src/main/ui/setup/cashflowBarInteraction.ts`
- Create: `tests/unit/main/cashflowBarInteraction.test.ts`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`

**Interfaces:**
- Consumes: `CashflowBarAllocation`, `CashflowBarGeometry`, bar bounds and pointer client X.
- Produces:

```ts
export function pointerPercentage(clientX: number, bounds: Pick<DOMRect, 'left' | 'width'>): number;
export function allocationCenter(allocation: CashflowBarAllocation): number;
export function visibleSegmentPercentage(
  allocation: CashflowBarAllocation,
  visibleEndPercent: number,
): number;
export function hasIndependentTarget(visiblePercent: number, barWidthPx: number): boolean;
export function isSegmentClipped(
  allocation: CashflowBarAllocation,
  visibleEndPercent: number,
): boolean;
```

- [ ] **Step 1: Write failing pure interaction tests**

```ts
it('clamps pointer positions and routes clipped or sub-44px segments to fallback targets', () => {
  expect(pointerPercentage(50, { left: 100, width: 200 })).toBe(0);
  expect(pointerPercentage(400, { left: 100, width: 200 })).toBe(100);
  expect(hasIndependentTarget(4, 680)).toBe(false);
  expect(hasIndependentTarget(8, 680)).toBe(true);
  expect(isSegmentClipped(
    { id: 'investment', label: '투자', amountWon: 1, percentage: 30, startPercent: 90, widthPercent: 30 },
    110,
  )).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/unit/main/cashflowBarInteraction.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move the exact helper behavior from `AllocationBar`**

Use `MIN_INTERACTIVE_SIZE_PX = 44`, clamp percentages to `0..100`, calculate visible width as `max(0, min(segmentEnd, visibleEnd) - start)`, and define clipping as `startPercent + widthPercent > visibleEndPercent`.

- [ ] **Step 4: Replace component-local helpers with imports**

Keep component state precedence `hovered → focused → tapped` and current event handlers unchanged. Pass `bar.getBoundingClientRect()` to `pointerPercentage()` instead of passing the element.

- [ ] **Step 5: Run pure and component interaction tests**

Run:

```bash
npx vitest run tests/unit/main/cashflowBarInteraction.test.ts tests/unit/main/AllocationBar.test.tsx
npm run check
```

Expected: all PASS, including zero-width, adjacent narrow, clipped fallback and end-contained tooltip cases.

- [ ] **Step 6: Commit**

```bash
git add src/main/ui/setup/cashflowBarInteraction.ts src/main/ui/setup/AllocationBar.tsx tests/unit/main/cashflowBarInteraction.test.ts tests/unit/main/AllocationBar.test.tsx
git commit -m "refactor(main): isolate cashflow bar interaction"
```

### Task 3: Allocation bar motion adapter

**Files:**
- Create: `src/main/ui/setup/allocationBarMotion.ts`
- Create: `tests/unit/main/allocationBarMotion.test.ts`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`

**Interfaces:**
- Consumes: `CashflowBarGeometry`, bar root, previous mutable state, target IDs.
- Produces the existing functions as exports:

```ts
export interface AllocationBarMotionState {
  consumption: number;
  saving: number;
  investment: number;
  remaining: number;
  desiredEndPercent: number;
  visibleEndPercent: number;
  animation?: JSAnimation;
}

export function createBarMotionState(geometry: CashflowBarGeometry): AllocationBarMotionState;
export function applyBarMotionState(root: HTMLElement, state: AllocationBarMotionState): void;
export function commitFinalBarMotion(
  state: AllocationBarMotionState,
  target: AllocationBarMotionState,
  root: HTMLElement,
  targetIds: CashflowAllocationId[],
  setVisualSegmentIds: (ids: CashflowAllocationId[]) => void,
): void;
```

- [ ] **Step 1: Write failing final-state tests**

Create a root containing `.cashflow-bar__clip`, `.allocation-bar__visual-track` and segment nodes. Assert `applyBarMotionState()` writes the final clip, track and segment widths for a 137.5% desired end clipped to 118%, and `commitFinalBarMotion()` clears `animation` and returns the React visual IDs through `setVisualSegmentIds`.

- [ ] **Step 2: Run the motion unit and verify failure**

Run: `npx vitest run tests/unit/main/allocationBarMotion.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Extract state construction and DOM commit unchanged**

Move the existing relative strip/segment calculations and DOM writes from `AllocationBar.tsx` into the adapter. Do not move ResizeObserver, React state setters or event handlers. Keep `attemptMotion()` guards in the component orchestration and call adapter final commit on animation throw/cancel failure/reduced motion.

- [ ] **Step 4: Preserve exiting and restored segment behavior**

Keep `visualSegmentIds` in React so exiting `remaining` remains mounted until its width reaches zero. The adapter must never remove DOM nodes; it only applies final state.

- [ ] **Step 5: Run motion failure and lifecycle tests**

Run:

```bash
npx vitest run tests/unit/main/allocationBarMotion.test.ts tests/unit/main/AllocationBar.test.tsx
npm run check
```

Expected: all PASS, including animation creation failure, cancellation failure, restored exiting segment, reduced motion and unmount cancellation.

- [ ] **Step 6: Commit**

```bash
git add src/main/ui/setup/allocationBarMotion.ts src/main/ui/setup/AllocationBar.tsx tests/unit/main/allocationBarMotion.test.ts tests/unit/main/AllocationBar.test.tsx
git commit -m "refactor(main): extract allocation bar motion"
```

### Task 4: Donut geometry and motion boundaries

**Files:**
- Create: `src/main/ui/dashboard/cashflowDonutGeometry.ts`
- Create: `src/main/ui/dashboard/cashflowDonutMotion.ts`
- Create: `tests/unit/main/cashflowDonutGeometry.test.ts`
- Create: `tests/unit/main/cashflowDonutMotion.test.ts`
- Modify: `src/main/ui/dashboard/CashflowDonutSummary.tsx`
- Modify: `tests/unit/main/CashflowDonutSummary.test.tsx`

**Interfaces:**
- Consumes: canonical `DonutAllocation[]` from `calculateCashflowInsight()`.
- Produces:

```ts
export interface DonutSegmentGeometry {
  id: DonutAllocation['id'];
  visiblePercentage: number;
  dashoffset: number;
}
export const DONUT_ALLOCATION_IDS: readonly DonutAllocation['id'][];
export function createDonutSegmentGeometry(
  allocations: readonly DonutAllocation[],
): DonutSegmentGeometry[];
export function exitingDonutSegment(id: DonutAllocation['id']): DonutSegmentGeometry;
export function mergeDonutAllocationIds(
  previousIds: readonly DonutAllocation['id'][],
  currentIds: readonly DonutAllocation['id'][],
): DonutAllocation['id'][];

export interface DonutSegmentMotionState {
  visiblePercentage: number;
  dashoffset: number;
  animation?: JSAnimation;
}
export function setCircleGeometry(
  circle: SVGCircleElement,
  geometry: Pick<DonutSegmentMotionState, 'visiblePercentage' | 'dashoffset'>,
): void;
export function commitFinalDonutGeometry(
  renderedIds: DonutAllocation['id'][],
  targetIds: DonutAllocation['id'][],
  targetById: Map<DonutAllocation['id'], DonutSegmentGeometry>,
  circles: Map<DonutAllocation['id'], SVGCircleElement>,
  states: Map<DonutAllocation['id'], DonutSegmentMotionState>,
): void;
```

- [ ] **Step 1: Write failing geometry tests**

```ts
it('clips visible arcs at 100 while retaining canonical order', () => {
  const geometry = createDonutSegmentGeometry([
    { id: 'consumption', label: '소비', amountWon: 60, percentage: 60, displayPercentage: 60 },
    { id: 'saving', label: '저축', amountWon: 30, percentage: 30, displayPercentage: 30 },
    { id: 'investment', label: '투자', amountWon: 25, percentage: 25, displayPercentage: 25 },
  ]);
  expect(geometry).toEqual([
    { id: 'consumption', visiblePercentage: 60, dashoffset: -0 },
    { id: 'saving', visiblePercentage: 30, dashoffset: -60 },
    { id: 'investment', visiblePercentage: 10, dashoffset: -90 },
  ]);
});
```

Also test exiting geometry and canonical merge order.

- [ ] **Step 2: Run geometry tests and verify failure**

Run: `npx vitest run tests/unit/main/cashflowDonutGeometry.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extract pure donut geometry**

Move `createDonutSegmentGeometry`, `exitingDonutSegment`, ID merge and canonical ID constant without changing their arithmetic. Keep actual over-income allocation data in `cashflowInsight`; geometry clips only visible arcs.

- [ ] **Step 4: Write failing motion final-commit tests**

Create SVG circles for active and exiting IDs, call `commitFinalDonutGeometry()`, and assert `stroke-dasharray`, `stroke-dashoffset`, state deletion for exiting IDs and `animation === undefined` for active IDs.

- [ ] **Step 5: Extract SVG mutation and final commit**

Move `setCircleGeometry`, `commitFinalDonutSegment` and `commitFinalDonutGeometry` to `cashflowDonutMotion.ts`. Keep Anime.js lifecycle orchestration and React `visualSegmentIds` in the component.

- [ ] **Step 6: Run donut units and component regressions**

Run:

```bash
npx vitest run tests/unit/main/cashflowDonutGeometry.test.ts tests/unit/main/cashflowDonutMotion.test.ts tests/unit/main/donutHitTest.test.ts tests/unit/main/CashflowDonutSummary.test.tsx
npm run check
```

Expected: all PASS, including over-income clipping, center detail, hit-test, exiting/restored arcs and all failure fallbacks.

- [ ] **Step 7: Commit**

```bash
git add src/main/ui/dashboard/cashflowDonutGeometry.ts src/main/ui/dashboard/cashflowDonutMotion.ts src/main/ui/dashboard/CashflowDonutSummary.tsx tests/unit/main/cashflowDonutGeometry.test.ts tests/unit/main/cashflowDonutMotion.test.ts tests/unit/main/CashflowDonutSummary.test.tsx
git commit -m "refactor(main): separate donut geometry and motion"
```

### Task 5: Main visualization integration verification

**Files:**
- Verify: `tests/main-react.spec.ts`
- Verify: `tests/main-compat.spec.ts`
- Verify: `src/main/ui/setup/AllocationBar.tsx`
- Verify: `src/main/ui/dashboard/CashflowDonutSummary.tsx`
- Verify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Verify: `src/main/ui/setup/SetupFlow.tsx`

**Interfaces:**
- Consumes: all Task 1–4 public functions.
- Produces: a fully verified Main visualization unit with no product behavior change.

- [ ] **Step 1: Run the complete Main unit surface**

Run:

```bash
npx vitest run tests/unit/main/cashflow.test.ts tests/unit/main/cashflowInsight.test.ts tests/unit/main/cashflowBarModel.test.ts tests/unit/main/cashflowBarGeometry.test.ts tests/unit/main/cashflowBarInteraction.test.ts tests/unit/main/allocationBarMotion.test.ts tests/unit/main/AllocationBar.test.tsx tests/unit/main/cashflowDonutGeometry.test.ts tests/unit/main/cashflowDonutMotion.test.ts tests/unit/main/donutHitTest.test.ts tests/unit/main/CashflowDonutSummary.test.tsx tests/unit/main/SetupFlow.test.tsx tests/unit/main/SummaryDashboard.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run Main browser regression**

Run: `npx playwright test tests/main-react.spec.ts tests/main-compat.spec.ts`

Expected: PASS with only repository-documented conditional skips.

- [ ] **Step 3: Inspect the three required viewports**

At 390×844, 768×1024 and 1280×900 verify setup review and dashboard details for a normal plan and a 137.5%/200% plan. Assert in Playwright that `document.documentElement.scrollWidth === document.documentElement.clientWidth`, `.allocation-bar` stays contained except the intentional visible overflow within viewport capacity, and donut/bar/tooltips are visible.

- [ ] **Step 4: Run repository checks**

Run:

```bash
npm run check
npm run test:unit
npm run build
git diff --check
```

Expected: all commands exit 0. Do not include generated version-only changes in the refactor commit unless the repository build contract requires them.

- [ ] **Step 5: Record the verification evidence**

Record the exact unit/E2E counts, documented skips, three viewport results and build/check exit status in the task handoff. Do not create an empty commit.
