# Simulation Chart Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulation의 projection 표시값, chart geometry, 탐색·tooltip과 Anime.js SVG transition을 분리하면서 현재 계산과 사용자 경험을 보존한다.

**Architecture:** projection domain output을 먼저 명목/실질 독립 display series로 변환하고, geometry와 interaction은 그 모델만 소비한다. React는 브라우저 event lifecycle과 semantic SVG를 소유하고 chart 전용 motion adapter는 `aria-hidden` visual layer만 변경한다.

**Tech Stack:** React 19, TypeScript 5.5, Anime.js, SVG, Vitest 4, Testing Library, Playwright

**Spec:** [Simulation Chart Boundary Refactor Design](../specs/2026-09-01-simulation-chart-boundary-design.md)

## Global Constraints

- Simulation은 Main source를 읽기 전용으로 사용한다.
- projection 공식, 목표 headline, 명목/실질 의미, 최대 30년과 sampling을 변경하지 않는다.
- 3년 이하는 월별, 4~30년은 현재와 연말 point를 유지한다.
- compact tooltip은 기간·현재 계획·누적 납입원금, detailed tooltip은 현재 여섯 값을 유지한다.
- pointer/touch drag/keyboard와 dismiss 규칙, chart size, 축, 범례, 문구, CSS와 motion timing을 변경하지 않는다.
- semantic paths는 항상 final geometry이며 Anime.js는 `aria-hidden` motion layer만 바꾼다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `src/simulation/ui/chartSeries.ts` | ProjectionPoint를 명목/실질 독립 표시 point로 변환 |
| `src/simulation/ui/chartGeometry.ts` | 표시 series의 plot 좌표, path와 tick 계산 |
| `src/simulation/ui/chartInteraction.ts` | pointer/keyboard index와 tooltip placement 계산 |
| `src/simulation/ui/chartTooltipModel.ts` | compact/detailed values와 screen-reader status 생성 |
| `src/simulation/ui/chartMotionGeometry.ts` | path point resampling·interpolation |
| `src/simulation/ui/chartMotion.ts` | reveal clip과 motion SVG path final-state 적용 |
| `src/simulation/ui/GrowthChart.tsx` | browser events와 semantic SVG/tooltip 렌더링 |
| `tests/unit/simulation/*.test.ts(x)` | 순수 경계와 현재 chart 외부 동작 회귀 |

---

### Task 1: Projection display series

**Files:**
- Create: `src/simulation/ui/chartSeries.ts`
- Create: `tests/unit/simulation/chartSeries.test.ts`
- Modify: `src/simulation/ui/GrowthChart.tsx`

**Interfaces:**

```ts
export interface ChartSeriesPoint {
  month: number;
  currentPlanWon: number;
  allSavingsWon: number;
  principalWon: number;
  savingsWon: number;
  investmentWon: number;
  source: ProjectionPoint;
}

export function buildChartSeries(
  points: readonly ProjectionPoint[],
  amountMode: CompoundSimulationDraft['amountMode'],
): ChartSeriesPoint[];
```

- [ ] **Step 1: Write failing nominal/real mapping tests**

```ts
it('selects every displayed real value from one canonical point', () => {
  const [point] = buildChartSeries([projectionPoint], 'real');
  expect(point).toMatchObject({
    month: projectionPoint.month,
    currentPlanWon: projectionPoint.currentPlanRealWon,
    allSavingsWon: projectionPoint.allSavingsRealWon,
    principalWon: projectionPoint.contributedPrincipalRealWon,
    savingsWon: projectionPoint.savingsRealWon,
    investmentWon: projectionPoint.investmentRealWon,
  });
});
```

Add the equivalent nominal assertion and empty-input assertion.

- [ ] **Step 2: Run the new unit and verify failure**

Run: `npx vitest run tests/unit/simulation/chartSeries.test.ts`

Expected: FAIL because `chartSeries` does not exist.

- [ ] **Step 3: Implement the field mapping**

Map without recalculating money. Keep `source` for compatibility while component consumers are migrated; later tasks must use named display fields for chart/tooltip/status.

- [ ] **Step 4: Make `GrowthChart` build one series**

Use:

```ts
const series = useMemo(
  () => buildChartSeries(result.points, amountMode),
  [amountMode, result.points],
);
```

Replace final summary and tooltip amount field selection with series values, but leave geometry signature unchanged until Task 2.

- [ ] **Step 5: Run mapping and component tests**

Run:

```bash
npx vitest run tests/unit/simulation/chartSeries.test.ts tests/unit/simulation/GrowthChart.test.tsx
npm run check
```

Expected: all PASS, including real-mode consistency and accessible summary.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/ui/chartSeries.ts src/simulation/ui/GrowthChart.tsx tests/unit/simulation/chartSeries.test.ts
git commit -m "refactor(simulation): define chart display series"
```

### Task 2: Pure chart geometry

**Files:**
- Modify: `src/simulation/ui/chartGeometry.ts`
- Modify: `tests/unit/simulation/chartGeometry.test.ts`
- Modify: `src/simulation/ui/GrowthChart.tsx`

**Interfaces:**

```ts
export interface ChartGeometryPoint extends ChartSeriesPoint {
  x: number;
  currentY: number;
  allSavingsY: number;
}

export function buildChartGeometry(
  series: readonly ChartSeriesPoint[],
  size?: { width: number; height: number },
): ChartGeometry;
```

- [ ] **Step 1: Change tests to pass display series and verify type failure**

Replace `buildChartGeometry(points, 'nominal')` with `buildChartGeometry(buildChartSeries(points, 'nominal'))`. Add an empty series assertion:

```ts
expect(buildChartGeometry([]).points).toEqual([]);
expect(buildChartGeometry([]).currentPlanPath).toBe('');
```

Run: `npx vitest run tests/unit/simulation/chartGeometry.test.ts`

Expected: FAIL at compile/runtime because the old signature still expects amount mode.

- [ ] **Step 2: Remove domain field selection from geometry**

Calculate `maxAmount` from `currentPlanWon` and `allSavingsWon`, retain plot values `{ left: 36, right: width - 24, top: 20, bottom: height - 36 }`, and preserve monthly tick interval 6 vs annual tick interval 60.

- [ ] **Step 3: Make empty and single-point geometry finite**

Use:

```ts
const maxMonth = Math.max(1, ...series.map(({ month }) => month));
const maxAmount = Math.max(
  1,
  ...series.flatMap(({ currentPlanWon, allSavingsWon }) => [currentPlanWon, allSavingsWon]),
);
```

Build area only when first/last/current path exist.

- [ ] **Step 4: Update `GrowthChart` caller**

Call `buildChartGeometry(series)` and use `ChartGeometryPoint` display fields for active tooltip and final summary.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/unit/simulation/chartSeries.test.ts tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx
npm run check
```

Expected: all PASS with identical path/tick expectations.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/ui/chartGeometry.ts src/simulation/ui/GrowthChart.tsx tests/unit/simulation/chartGeometry.test.ts
git commit -m "refactor(simulation): isolate chart geometry"
```

### Task 3: Chart interaction and tooltip models

**Files:**
- Create: `src/simulation/ui/chartInteraction.ts`
- Create: `src/simulation/ui/chartTooltipModel.ts`
- Create: `tests/unit/simulation/chartInteraction.test.ts`
- Create: `tests/unit/simulation/chartTooltipModel.test.ts`
- Modify: `src/simulation/ui/chartGeometry.ts`
- Modify: `src/simulation/ui/GrowthChart.tsx`

**Interfaces:**

```ts
export type ChartKeyIntent = 'home' | 'end' | 'previous' | 'next';
export function indexAtClientX(input: {
  clientX: number;
  bounds: Pick<DOMRect, 'left' | 'width'>;
  viewBoxWidth: number;
  plot: { left: number; right: number };
  pointCount: number;
}): number | null;
export function indexForKey(
  current: number | null,
  intent: ChartKeyIntent,
  pointCount: number,
): number | null;
export function tooltipPlacement(input: TooltipPlacementInput): TooltipPlacement;

export interface TooltipPlacement {
  horizontal: 'left' | 'right';
  vertical: 'above' | 'below';
}

export interface ChartTooltipModel {
  periodLabel: string;
  values: GrowthChartTooltipValues;
  status: string;
}
export function buildChartTooltipModel(
  point: ChartSeriesPoint,
  compact: boolean,
): ChartTooltipModel;
```

- [ ] **Step 1: Write failing pointer and keyboard tests**

Assert zero-width returns `null`; plot left/right map to first/last exact index; values outside clamp; Home/End select boundaries; Arrow from null selects first/last according to current behavior; zero points return `null`.

- [ ] **Step 2: Write failing tooltip-model tests**

```ts
expect(buildChartTooltipModel(point, true).status).toBe(
  '6개월, 현재 계획 총액 1,200만원, 누적 납입원금 900만원',
);
expect(buildChartTooltipModel(point, false).values).toMatchObject({
  currentPlanWon: point.currentPlanWon,
  allSavingsWon: point.allSavingsWon,
  principalWon: point.principalWon,
  savingsWon: point.savingsWon,
  investmentWon: point.investmentWon,
});
```

- [ ] **Step 3: Run the new units and verify failure**

Run: `npx vitest run tests/unit/simulation/chartInteraction.test.ts tests/unit/simulation/chartTooltipModel.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Move pure calculations**

Move `indexAt`, key clamping, `tooltipPlacement` and `activeStatus` logic into the new modules. Keep `getBoundingClientRect()`, pointer capture, media query and document/window listeners in `GrowthChart`.

- [ ] **Step 5: Wire the component**

Translate React key names to `ChartKeyIntent`, pass the SVG bounds to `indexAtClientX()`, and render tooltip/status from one `ChartTooltipModel` instance.

Clear a stale selection when a shorter result removes its point:

```ts
useEffect(() => {
  setActiveIndex((current) => (
    current !== null && current >= series.length ? null : current
  ));
}, [series.length]);
```

- [ ] **Step 6: Run all interaction regressions**

Run:

```bash
npx vitest run tests/unit/simulation/chartInteraction.test.ts tests/unit/simulation/chartTooltipModel.test.ts tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx
npm run check
```

Expected: all PASS, including monthly touch, yearly drag, Escape/outside/scroll and compact/detailed content.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/ui/chartInteraction.ts src/simulation/ui/chartTooltipModel.ts src/simulation/ui/chartGeometry.ts src/simulation/ui/GrowthChart.tsx tests/unit/simulation/chartInteraction.test.ts tests/unit/simulation/chartTooltipModel.test.ts
git commit -m "refactor(simulation): separate chart interaction model"
```

### Task 4: Chart motion geometry and DOM adapter

**Files:**
- Create: `src/simulation/ui/chartMotionGeometry.ts`
- Create: `src/simulation/ui/chartMotion.ts`
- Create: `tests/unit/simulation/chartMotionGeometry.test.ts`
- Create: `tests/unit/simulation/chartMotion.test.ts`
- Modify: `src/simulation/ui/GrowthChart.tsx`

**Interfaces:**

```ts
export interface VisualPathPoint { x: number; y: number }
export interface VisualChartGeometry {
  current: VisualPathPoint[];
  savings: VisualPathPoint[];
  bottom: number;
}
export interface ChartPaths { area: string; current: string; savings: string }
export function visualGeometry(geometry: ChartGeometry): VisualChartGeometry;
export function pathsForVisualGeometry(geometry: VisualChartGeometry): ChartPaths;
export function createPathTransition(
  previous: VisualChartGeometry,
  next: VisualChartGeometry,
): (progress: number) => VisualChartGeometry;

export interface MotionPaths {
  area: SVGPathElement;
  current: SVGPathElement;
  savings: SVGPathElement;
}
export function findMotionPaths(root: HTMLElement): MotionPaths | null;
export function setVisualFrame(
  paths: MotionPaths,
  geometry: VisualChartGeometry,
  geometryRef: { current: VisualChartGeometry | null },
): void;
export function setRevealWidth(
  clip: SVGRectElement,
  width: number,
  widthRef: { current: number },
): void;
```

- [ ] **Step 1: Write failing resampling/interpolation tests**

Use a 2-point previous curve and 4-point next curve. Assert transition at `0` preserves the full prior curve after resampling, transition at `1` equals next, and all path strings stay finite.

- [ ] **Step 2: Run motion geometry test and verify failure**

Run: `npx vitest run tests/unit/simulation/chartMotionGeometry.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extract pure visual geometry unchanged**

Move `visualGeometry`, path building, `createPathTransition`, `resample`, interpolation and path formatting. Clamp interpolation progress to the caller-provided Anime.js state behavior; do not alter point count or path syntax.

- [ ] **Step 4: Write and implement DOM adapter tests**

Build an HTML root with three SVG paths and a clip rect. Assert `findMotionPaths`, `setVisualFrame` and `setRevealWidth` apply exact `d` and width values and update refs. Return `null` when any motion path is absent.

- [ ] **Step 5: Keep Anime.js lifecycle in `GrowthChart` but use the adapter**

The `useAnimeScope` callback retains first-reveal semantics. Add a `motionGenerationRef`; increment it for every geometry transition and cleanup, and ignore `onUpdate`/`onComplete` from an older generation. Call the extracted functions and catch Anime.js exceptions by committing target geometry and final reveal width.

- [ ] **Step 6: Run all motion tests**

Run:

```bash
npx vitest run tests/unit/simulation/chartMotionGeometry.test.ts tests/unit/simulation/chartMotion.test.ts tests/unit/simulation/GrowthChart.test.tsx
npm run check
```

Expected: all PASS, including StrictMode replay, partial reveal update, interrupted/shorter path transition, unrelated rerender, reduced motion and Anime.js failure.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/ui/chartMotionGeometry.ts src/simulation/ui/chartMotion.ts src/simulation/ui/GrowthChart.tsx tests/unit/simulation/chartMotionGeometry.test.ts tests/unit/simulation/chartMotion.test.ts
git commit -m "refactor(simulation): isolate chart motion"
```

### Task 5: Simulation chart integration verification

**Files:**
- Verify: `tests/simulation.spec.ts`
- Verify: `src/simulation/ui/GrowthChart.tsx`
- Verify: `src/simulation/ui/GrowthChartTooltip.tsx`

**Interfaces:**
- Consumes: Tasks 1–4 boundaries.
- Produces: a fully verified Simulation chart unit with unchanged product semantics.

- [ ] **Step 1: Run the complete Simulation unit surface**

Run:

```bash
npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/chartSeries.test.ts tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/chartInteraction.test.ts tests/unit/simulation/chartTooltipModel.test.ts tests/unit/simulation/chartMotionGeometry.test.ts tests/unit/simulation/chartMotion.test.ts tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/SimulationApp.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run Simulation browser regression**

Run: `npx playwright test tests/simulation.spec.ts`

Expected: PASS with only repository-documented conditional skips.

- [ ] **Step 3: Verify required viewport and series cases**

At 390×844, 768×1024 and 1280×900 cover a 3-year monthly series and a 30-year annual series in nominal and real mode. Assert no document overflow, chart/legend/ticks visible, compact tooltip contained, detailed tooltip contained, and touch/keyboard select the exact first and last periods.

- [ ] **Step 4: Run repository checks**

Run:

```bash
npm run check
npm run test:unit
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Record the verification evidence**

Record the exact unit/E2E counts, documented skips, monthly/yearly and nominal/real viewport results, and build/check exit status in the task handoff. Do not create an empty commit.
