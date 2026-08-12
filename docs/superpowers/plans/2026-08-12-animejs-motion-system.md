# Anime.js 공통 모션 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anime.js 기반의 얇은 공통 모션 계층을 모든 현재 앱에 적용하고, Main 최초 설정과 `처음부터 다시`에는 실제 수입 비율을 보존하는 연속적인 현금흐름 조립 장면을 제공한다.

**Architecture:** 공통 계층은 motion token, lifecycle-safe Anime.js scope, 시각 숫자 보간과 600ms 지연 pending 표시만 소유한다. Main, Simulation, Portfolio와 Journey는 각자 geometry와 상태 의미를 유지하며 공통 계층을 사용한다. 구현은 공통 기반 → Main → Simulation → Portfolio → Journey/PWA의 독립 검토 gate로 진행한다.

**Tech Stack:** React 19, TypeScript, Anime.js 4, Vite 5 MPA/PWA, Vitest, Testing Library, Playwright

**Spec:** [Anime.js 공통 모션 시스템 설계](../specs/2026-08-12-animejs-motion-system-design.md)

## Global Constraints

- Main은 월 실수령액, 주거비, 생활비, 저축과 투자만 직접 소유하며 Simulation과 Portfolio는 Main에 write-back하지 않는다.
- Account Map은 readiness-only이며 workspace 제품 데이터를 읽거나 쓰지 않는다.
- 공통 모션 계층은 앱 고유 geometry, domain state, persistence와 navigation을 소유하지 않는다.
- 빠름 120ms, 보통 180ms, 강조 260ms와 reveal 이동 거리 4~8px을 사용한다.
- Main 최초 설정과 `처음부터 다시`는 같은 모션 preset을 사용하고, 적용된 계획의 수정은 전체 조립을 반복하지 않는다.
- Main 항목 너비는 항상 `항목 금액 ÷ 월 수입`이며 초과 overlay는 별도 금액 segment가 아니다.
- 초과분은 실제 비율로 panel 경계를 벗어나고 viewport 우측 16px 안전 여백에 닿을 때만 절단한다.
- 명시적 적용은 즉시 중복 제출을 차단하되 별도 `저장 중` 문구와 자동 저장 진행 상태는 600ms 이후에만 표시한다.
- 정상 자동 저장 성공의 상시 `저장됨` 표시는 제거하고 실패·복구·명시적 backup 결과는 유지한다.
- `prefers-reduced-motion: reduce`에서는 중간 프레임 없이 즉시 최종 상태를 제공한다.
- 모션은 focus, pointer, touch, keyboard, 첫 입력 가능 시점과 URL navigation을 지연하지 않는다.
- 검증 viewport는 390×844, 768×900과 1280×900이다.
- `npm run build`는 version을 변경하므로 bundle 측정과 계획 중 build 검증에는 `node ./node_modules/vite/bin/vite.js build`를 사용한다.

---

## 파일 구조

### 새 파일

- `src/components/motion/tokens.ts`: duration, easing과 reveal 거리 상수
- `src/components/motion/useAnimeScope.ts`: root-scoped Anime.js lifecycle과 reduced-motion 처리
- `src/components/motion/animateVisualNumber.ts`: `aria-hidden` 시각 숫자 보간
- `src/components/feedback/useDelayedPending.ts`: 600ms 지연 진행 상태
- `src/main/ui/setup/cashflowBarGeometry.ts`: 실제 수입 기준 segment와 viewport 절단 계산
- `tests/unit/components/useAnimeScope.test.tsx`: scope cleanup과 reduced-motion
- `tests/unit/components/animateVisualNumber.test.ts`: 숫자 보간 format 계약
- `tests/unit/components/useDelayedPending.test.tsx`: 즉시 busy와 지연 문구 분리
- `tests/unit/scripts/reportViteChunks.test.ts`: root HTML과 네 JS entry baseline 분리
- `tests/unit/main/cashflowBarGeometry.test.ts`: 실제 비율, 경계 초과와 절단 계산
- `tests/motion-system.spec.ts`: 앱별 모션, 접근성, viewport와 캡처 검증
- `scripts/report-vite-chunks.mjs`: Vite manifest에서 entry별 초기 chunk 크기를 출력

### 주요 수정 파일

- `package.json`, `package-lock.json`: Anime.js production dependency
- `src/main/ui/setup/AllocationBar.tsx`, `src/main/ui/setup/SetupFlow.tsx`, `src/main/ui/main.css`: 하나의 Main 조립 visual model
- `src/main/ui/setup/FlowContextSummary.tsx`: 같은 실제 비율 overflow geometry
- `src/main/ui/dashboard/CashflowDonutSummary.tsx`, `src/main/ui/dashboard/CashflowSummary.tsx`: 수정 적용 후 작은 데이터 보간
- `src/main/ui/editor/ApplyBar.tsx`, `src/main/ui/MainApp.tsx`: 즉시 busy와 600ms 지연 진행 문구
- `src/simulation/ui/GrowthChart.tsx`, `src/simulation/ui/SimulationApp.tsx`, `src/simulation/ui/SaveIndicator.tsx`: graph 보간과 상시 저장 성공 제거
- `src/portfolio/ui/PortfolioSummary.tsx`, `src/portfolio/ui/portfolio.css`: 비율 막대와 목록 FLIP
- `src/journey/ui/AppLauncher.tsx`, `src/journey/ui/ReadinessApp.tsx`, `src/journey/ui/journey.css`: launcher·overlay·readiness reveal
- 관련 unit suite와 `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/app-journey.spec.ts`: 관찰 가능한 동작 갱신

---

### Task 1: 공통 모션·지연 피드백 기반과 bundle baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/motion/tokens.ts`
- Create: `src/components/motion/useAnimeScope.ts`
- Create: `src/components/motion/animateVisualNumber.ts`
- Create: `src/components/feedback/useDelayedPending.ts`
- Create: `tests/unit/components/useAnimeScope.test.tsx`
- Create: `tests/unit/components/animateVisualNumber.test.ts`
- Create: `tests/unit/components/useDelayedPending.test.tsx`
- Create: `tests/unit/scripts/reportViteChunks.test.ts`
- Create: `scripts/report-vite-chunks.mjs`

**Interfaces:**
- Produces: `MOTION_DURATION`, `MOTION_EASE`, `MOTION_DISTANCE_PX`
- Produces: `useAnimeScope<T extends HTMLElement>(setup, dependencies): RefObject<T | null>`
- Produces: `animateVisualNumber(element, from, to, format, duration?): void`
- Produces: `useDelayedPending(pending: boolean, delayMs?: number): boolean`

- [ ] **Step 1: Capture the pre-Anime.js production chunk baseline**

Run:

```bash
node ./node_modules/vite/bin/vite.js build --manifest
node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync("dist/.vite/manifest.json","utf8"));const r={rootHtmlBytes:fs.statSync("dist/index.html").size};for(const [,v] of Object.entries(m).filter(([,v])=>v.isEntry)){r[v.name]={entryBytes:fs.statSync("dist/"+v.file).size}}console.log(JSON.stringify(r,null,2))'
```

Expected: build exits 0 and prints `rootHtmlBytes` for the inline-redirect root `dist/index.html`, plus raw entry bytes for the four JavaScript entries `mainApp`, `simulation`, `portfolio` and `accountMap`. The root HTML is recorded separately and only the four JavaScript entry records participate in later bundle-delta comparisons. Save the output in the implementation handoff; do not commit `dist/`.

- [ ] **Step 2: Install Anime.js as a production dependency**

Run:

```bash
npm install animejs
```

Expected: `animejs` appears under `dependencies` and the lockfile changes without unrelated package upgrades.

- [ ] **Step 3: Write failing common-foundation tests**

Add tests with fake timers that assert:

```tsx
function Probe({ pending, onSetup }: { pending: boolean; onSetup(): void }) {
  const root = useAnimeScope<HTMLDivElement>(() => onSetup(), []);
  const visiblePending = useDelayedPending(pending);
  return <div ref={root}>{visiblePending ? '저장 중' : 'idle'}</div>;
}

it('reveals pending only after 600ms', () => {
  const { rerender } = render(<Probe pending={false} onSetup={() => undefined} />);
  rerender(<Probe pending onSetup={() => undefined} />);
  expect(screen.getByText('idle')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(599));
  expect(screen.getByText('idle')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText('저장 중')).toBeInTheDocument();
});
```

Also assert `scope.revert()` on unmount, `reducedMotion` reaches setup as `true`, interrupted number animation starts from the current rendered value, and formatted visual values are `aria-hidden` at the consumer boundary.

- [ ] **Step 4: Run the new tests and verify RED**

Run:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx tests/unit/components/animateVisualNumber.test.ts tests/unit/components/useDelayedPending.test.tsx
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 5: Implement the minimal common modules**

Use these public constants and signatures:

```ts
export const MOTION_DURATION = { fast: 120, normal: 180, emphasis: 260 } as const;
export const MOTION_DISTANCE_PX = { subtle: 4, reveal: 8 } as const;
export const MOTION_EASE = { enter: 'out(3)', update: 'inOut(2)' } as const;

export interface MotionContext<T extends HTMLElement> {
  root: T;
  reducedMotion: boolean;
}

export function useAnimeScope<T extends HTMLElement>(
  setup: (context: MotionContext<T>) => void,
  dependencies: DependencyList,
): RefObject<T | null>;

export function useDelayedPending(pending: boolean, delayMs = 600): boolean;

export function animateVisualNumber(
  element: HTMLElement,
  from: number,
  to: number,
  format: (value: number) => string,
  duration?: number,
): void;
```

Implement `useAnimeScope` with `createScope({ root, mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' } })`, invoke setup inside `scope.add`, and call `scope.revert()` in the effect cleanup. `animateVisualNumber` must set the final formatted string immediately when reduced motion is active and otherwise animate a plain `{ value }` object without owning semantic text.

- [ ] **Step 6: Add the deterministic chunk reporter**

Implement `scripts/report-vite-chunks.mjs` to read `dist/.vite/manifest.json`, traverse each `isEntry` record and its static `imports`, and print JSON shaped as:

```json
{
  "rootHtmlBytes": 0,
  "mainApp": { "entryBytes": 0, "initialBytes": 0, "files": [] },
  "simulation": { "entryBytes": 0, "initialBytes": 0, "files": [] }
}
```

`rootHtmlBytes` is the raw size of the HTML-only inline redirect at `dist/index.html`; the remaining records are the four JavaScript entries from the manifest. Fail with a non-zero exit code when the manifest is missing. Do not gzip inside this script; raw bytes make before/after comparisons deterministic.

- [ ] **Step 7: Run foundation tests and source checks**

Run:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx tests/unit/components/animateVisualNumber.test.ts tests/unit/components/useDelayedPending.test.tsx
npx vitest run tests/unit/scripts/reportViteChunks.test.ts
npm run check
```

Expected: all selected tests PASS and both TypeScript checks exit 0.

- [ ] **Step 8: Commit the foundation gate**

```bash
git add package.json package-lock.json src/components/motion src/components/feedback tests/unit/components scripts/report-vite-chunks.mjs
git commit -m "feat(motion): add Anime.js foundation"
```

---

### Task 2: Main 실제 비율 cashflow geometry

**Files:**
- Create: `src/main/ui/setup/cashflowBarGeometry.ts`
- Create: `tests/unit/main/cashflowBarGeometry.test.ts`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Delete: `src/main/ui/setup/overflowPresentation.ts`
- Delete: `tests/unit/main/overflowPresentation.test.ts`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`

**Interfaces:**
- Consumes: existing `calculateCashflow`, `percentageOfIncome` and `MainData`
- Produces: `createCashflowBarGeometry(data, viewport): CashflowBarGeometry`
- Produces: the same geometry for setup context and review; no second deficit scale

- [ ] **Step 1: Write failing geometry tests**

Define fixtures for normal 71.875%, exact 100%, 37.5% deficit with enough space, 200% deficit with insufficient space, zero income and a single consumption item over 100%. Assert this interface:

```ts
export interface CashflowBarGeometry {
  segments: Array<{
    id: 'consumption' | 'saving' | 'investment' | 'remaining';
    startPercent: number;
    widthPercent: number;
  }>;
  overflowPercent: number;
  desiredEndPercent: number;
  visibleEndPercent: number;
  clipped: boolean;
}

export interface CashflowViewport {
  barWidthPx: number;
  availableRightPx: number;
}
```

For income 3,200,000 and planned outflow 4,400,000, expect `overflowPercent: 37.5`, `desiredEndPercent: 137.5`, and segment widths equal to their actual income percentages. When `availableRightPx / barWidthPx * 100` is 20, expect `visibleEndPercent: 120` and `clipped: true` without modifying any segment width.

- [ ] **Step 2: Run geometry tests and verify RED**

Run:

```bash
npx vitest run tests/unit/main/cashflowBarGeometry.test.ts
```

Expected: FAIL because `cashflowBarGeometry.ts` does not exist.

- [ ] **Step 3: Implement the pure geometry**

Build segments in the fixed order `consumption → saving → investment → remaining`. Omit remaining during deficit. Calculate each width against income, calculate the viewport capacity separately, and never append an `overflow` segment:

```ts
const capacityPercent = viewport.barWidthPx > 0
  ? Math.max(0, viewport.availableRightPx / viewport.barWidthPx * 100)
  : 0;
const desiredEndPercent = 100 + overflowPercent;
const visibleEndPercent = Math.min(desiredEndPercent, 100 + capacityPercent);
```

Return a static empty geometry when income is zero or dimensions are non-finite.

- [ ] **Step 4: Run geometry tests and verify GREEN**

Run: `npx vitest run tests/unit/main/cashflowBarGeometry.test.ts`

Expected: PASS for normal, exact, unclipped deficit, clipped deficit and zero-income cases.

- [ ] **Step 5: Replace both old overflow consumers**

Use `ResizeObserver`, the bar's bounding rect and `document.documentElement.clientWidth - 16` to calculate `availableRightPx`. Render one visual strip with total intrinsic width `desiredEndPercent%` inside a clip layer ending at `visibleEndPercent%`. Keep table and tooltip percentages unchanged. Add `data-overflow-clipped` and render `+37.5% 초과` only when `clipped` is true; retain the exact existing `수입보다 N원 초과` status text for all deficits.

- [ ] **Step 6: Update component tests and verify old compression is gone**

Replace assertions for `--overflow-length`, intensity, droplets and `/5` compression with assertions that:

```tsx
expect(track).toHaveAttribute('data-desired-end-percent', '137.5');
expect(screen.queryByText('+37.5% 초과')).not.toBeInTheDocument();
// after constrained ResizeObserver fixture
expect(screen.getByText('+37.5% 초과')).toBeInTheDocument();
```

Run:

```bash
npx vitest run tests/unit/main/cashflowBarGeometry.test.ts tests/unit/main/AllocationBar.test.tsx tests/unit/main/FlowContextSummary.test.tsx
npm run check
```

Expected: all selected tests PASS and no import references `overflowPresentation`.

- [ ] **Step 7: Commit the geometry gate**

```bash
git add src/main/ui/setup tests/unit/main
git commit -m "fix(main): preserve actual deficit geometry"
```

---

### Task 3: Main initial/restart 조립과 수정 결과 보간

**Files:**
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/dashboard/CashflowSummary.tsx`
- Modify: `src/main/ui/dashboard/CashflowDonutSummary.tsx`
- Modify: `tests/unit/main/SetupFlow.test.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `tests/unit/main/CashflowDonutSummary.test.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: Task 1 motion foundation and Task 2 `CashflowBarGeometry`
- Produces: `SetupMotionPreset = 'initial-assembly' | 'none'`
- Produces: one persistent review track for assembly and final interaction

- [ ] **Step 1: Write failing journey-contract tests**

Extend `SetupFlowProps` with `motionPreset`. Assert both initial setup and restart pass `initial-assembly`, while dashboard editing never renders `SetupFlow`. Assert returning `review → saving-investment → review` in the same setup mount does not create a second assembly instance.

Add this component contract:

```ts
export type SetupMotionPreset = 'initial-assembly' | 'none';
```

Mock the `animejs` timeline module in the component test and assert `createTimeline` is called once for the setup mount. Do not add a test-only callback prop to production components.

- [ ] **Step 2: Run focused Main tests and verify RED**

Run:

```bash
npx vitest run tests/unit/main/SetupFlow.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/AllocationBar.test.tsx
```

Expected: FAIL because `motionPreset` and the single-instance contract do not exist.

- [ ] **Step 3: Implement the Main assembly timeline**

Remove `.setup-review-transition` and the duplicate temporary track. Attach `useAnimeScope` to the real review section and run one timeline for `initial-assembly`:

```ts
createTimeline({ defaults: { ease: MOTION_EASE.enter } })
  .add(track, { scaleX: [0, 1], duration: MOTION_DURATION.emphasis })
  .add(segmentElements, { opacity: [0, 1], duration: MOTION_DURATION.normal, delay: stagger(40) }, '<+=80')
  .add(contentElements, { opacity: [0, 1], y: [MOTION_DISTANCE_PX.reveal, 0], duration: MOTION_DURATION.normal }, '<');
```

Use `transformOrigin: 'left center'`. The intrinsic track already includes the actual overflow from Task 2, so the timeline must not calculate another deficit width. Store the played flag in a ref scoped to the setup mount. Under reduced motion, set final styles synchronously.

- [ ] **Step 4: Add welcome and step transition without replaying on input**

Animate welcome heading, description and CTA once per initial/restart setup mount. Animate step content after React commits, but do not attach animation to `MoneyField.onChange`; typing must update context geometry without a reveal sequence per keystroke.

- [ ] **Step 5: Add applied-result interpolation**

In dashboard components keep the previous applied values in refs. Animate visual-only number spans and SVG/bar geometry for 180–260ms after a successful applied-data change. Semantic text and accessible names must render the final value immediately. Do not animate opening the editor or draft changes before apply.

- [ ] **Step 6: Run unit tests and verify GREEN**

Run:

```bash
npx vitest run tests/unit/main/SetupFlow.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/AllocationBar.test.tsx tests/unit/main/CashflowDonutSummary.test.tsx
npm run check
```

Expected: PASS; no `.setup-review-transition` selector or timer fallback remains.

- [ ] **Step 7: Add Main Playwright timestamp and geometry assertions**

In `tests/main-react.spec.ts`, pause animations through `element.getAnimations({ subtree: true })` and capture start, mid-assembly, unclipped overflow, clipped overflow and final states at all three viewports. Assert:

```ts
expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
expect(actualOverflowRatio).toBeCloseTo(deficitWon / incomeWon, 3);
expect(extension.right).toBeLessThanOrEqual(document.documentElement.clientWidth - 16);
```

Also emulate reduced motion and assert there is no intermediate opacity/transform state.

- [ ] **Step 8: Run Main E2E and commit**

Run:

```bash
npx playwright test tests/main-react.spec.ts --grep "review|deficit|restart|reduced motion"
```

Expected: all selected tests PASS at 390, 768 and desktop fixtures.

```bash
git add src/main tests/unit/main tests/main-react.spec.ts
git commit -m "feat(main): animate cashflow assembly"
```

---

### Task 4: 저장 성공 제거와 600ms 진행 피드백

**Files:**
- Modify: `src/main/ui/editor/ApplyBar.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/simulation/ui/SaveIndicator.tsx`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`
- Modify: `tests/unit/simulation/SaveIndicator.test.tsx`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`

**Interfaces:**
- Consumes: `useDelayedPending(pending, 600)` from Task 1
- Produces: immediate `aria-busy`/disabled for explicit apply and delayed visible pending copy
- Produces: Simulation indicator only for delayed saving or error

- [ ] **Step 1: Write failing save-feedback tests**

Use fake timers. For Main, click apply and assert the button is disabled and the region has `aria-busy="true"` immediately, but neither `저장 중` nor `저장됨` is visible before 600ms. At 600ms assert `저장 중`; after resolve assert the dashboard result and no success label.

For Simulation, assert saved state renders no indicator, saving state remains empty through 599ms, shows `저장 중` at 600ms, and error immediately shows `자동 저장하지 못했어요` with `role="alert"`.

- [ ] **Step 2: Run save-feedback tests and verify RED**

Run:

```bash
npx vitest run tests/unit/main/SummaryDashboard.test.tsx tests/unit/simulation/SaveIndicator.test.tsx tests/unit/simulation/SimulationApp.test.tsx
```

Expected: FAIL because current components render immediate `저장 중` and Simulation renders `저장됨`.

- [ ] **Step 3: Implement explicit and automatic save contracts**

Keep state transitions and repository calls unchanged. Main buttons derive `disabled` and `aria-busy` from raw saving immediately; copy derives from `useDelayedPending`. Replace Simulation's `saved | saving | error` visual mapping with:

```tsx
if (state === 'error') return <p role="alert">자동 저장하지 못했어요</p>;
if (!delayedSaving) return null;
return <p role="status">저장 중</p>;
```

Do not remove recovery, cleanup-error or backup toast paths.

- [ ] **Step 4: Run tests, type checks and commit**

Run:

```bash
npx vitest run tests/unit/main/SummaryDashboard.test.tsx tests/unit/simulation/SaveIndicator.test.tsx tests/unit/simulation/SimulationApp.test.tsx
npm run check
```

Expected: PASS and `rg -n "저장됨" src/main src/simulation src/portfolio` returns no normal-success UI copy.

```bash
git add src/main/ui src/simulation/ui tests/unit/main tests/unit/simulation
git commit -m "fix(feedback): remove persistent saved status"
```

---

### Task 5: Simulation graph 데이터 전환

**Files:**
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Modify: `src/simulation/ui/SimulationComparison.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `tests/unit/simulation/GrowthChart.test.tsx`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: Task 1 scope and motion tokens
- Produces: Simulation-owned path/axis interpolation; tooltip behavior remains immediate

- [ ] **Step 1: Write failing graph-transition tests**

Rerender `GrowthChart` with a changed projection and assert semantic SVG paths receive final `d` values immediately while an animation is created from previous path geometry. Assert first result uses a 260ms draw reveal, tooltip-only active index changes create no graph transition, and reduced motion creates no intermediate path.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/simulation/GrowthChart.test.tsx`

Expected: FAIL because GrowthChart has no Anime.js scope or transition observation.

- [ ] **Step 3: Implement Simulation-owned interpolation**

Keep `chartGeometry.ts` pure. Store the previous geometry in a ref and animate a visual overlay path while committing the final semantic path immediately. Use `animateVisualNumber` for the two comparison values, with separate final semantic text available from the first render. Do not animate tooltip values or change touch capture, Escape and keyboard index behavior.

- [ ] **Step 4: Verify unit and browser behavior**

Run:

```bash
npx vitest run tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/SimulationApp.test.tsx
npx playwright test tests/simulation.spec.ts
npm run check
```

Expected: PASS; graph and comparison remain visible at 390px, compact tooltip stays contained, and reduced motion is immediate.

- [ ] **Step 5: Commit the Simulation gate**

```bash
git add src/simulation tests/unit/simulation tests/simulation.spec.ts
git commit -m "feat(simulation): animate projection changes"
```

---

### Task 6: Portfolio 비율·정렬 전환

**Files:**
- Modify: `src/portfolio/ui/PortfolioSummary.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/unit/portfolio/PortfolioSummary.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: Task 1 scope, tokens and visual number helper
- Produces: Portfolio-owned fill-width interpolation and keyed list FLIP

- [ ] **Step 1: Write failing Portfolio transition tests**

Rerender with changed percentages and sort mode. Assert list semantics, accessible percentage and DOM order switch immediately, while keyed rows animate from previous bounding rects and fills animate from previous widths. Assert a new item reveals without moving focus and reduced motion skips transforms.

- [ ] **Step 2: Run Portfolio tests and verify RED**

Run:

```bash
npx vitest run tests/unit/portfolio/PortfolioSummary.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
```

Expected: FAIL because rows and fills only use static CSS variables.

- [ ] **Step 3: Implement Portfolio-owned transitions**

Capture row rects by stable item ID in `useLayoutEffect`, render final order immediately, and animate each moved row from `translateY(previous.top - next.top)` to zero over 180ms. Animate fill `scaleX` from the previous percentage and visual ratio text with `animateVisualNumber`; keep final semantic ratio text available immediately. Do not animate draft keystrokes outside the result summary.

- [ ] **Step 4: Verify Portfolio and commit**

Run:

```bash
npx vitest run tests/unit/portfolio/PortfolioSummary.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
npx playwright test tests/portfolio.spec.ts
npm run check
```

Expected: PASS with result-first hierarchy, 44px edit target, sheet focus and 390px containment unchanged.

```bash
git add src/portfolio tests/unit/portfolio tests/portfolio.spec.ts
git commit -m "feat(portfolio): animate allocation changes"
```

---

### Task 7: Journey launcher, 공통 overlay와 Account Map readiness

**Files:**
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Modify: `src/journey/ui/ManagementConfirmationDialog.tsx`
- Modify: `src/components/common/Toast.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`
- Modify: `src/portfolio/ui/PortfolioEditSurface.tsx`
- Modify: `src/journey/ui/journey.css`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`
- Modify: `tests/unit/journey/ReadinessApp.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioDialogs.test.tsx`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Consumes: Task 1 scope and reveal tokens
- Produces: small launcher/overlay transitions without route delay or workspace access

- [ ] **Step 1: Write failing Journey tests**

Assert current-line, overflow menu, confirmation dialog, Main mobile editor, Portfolio modal/sheet and toast use fast/normal tokens. Menu/dialog DOM and `aria-expanded`/`aria-modal` update immediately; Escape/outside close returns focus without waiting for exit animation. Assert readiness content reveals once per mount and Account Map still makes zero storage reads/writes using the existing repository/storage spies.

- [ ] **Step 2: Run Journey tests and verify RED**

Run:

```bash
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
```

Expected: FAIL because these components do not use the shared motion scope.

- [ ] **Step 3: Implement small Journey motion**

Animate only the current line, menu/dialog/sheet/toast reveal opacity and 4–8px translation. Bottom sheets retain their approved vertical direction and side panels retain their horizontal direction, capped at 8px visual travel. State, DOM visibility, navigation href, focus trap/restoration and touch long-press suppression remain synchronous. Exit animation must not keep an otherwise closed overlay interactive. Under reduced motion, set final opacity and transform before paint.

- [ ] **Step 4: Verify Journey and commit**

Run:

```bash
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
npx playwright test tests/app-journey.spec.ts
npm run check
```

Expected: PASS; current app remains directly visible, overflow stays inside 16px gutters, and readiness route remains data-isolated.

```bash
git add src/journey src/components/common/Toast.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/portfolio/ui/PortfolioDialog.tsx src/portfolio/ui/PortfolioEditSurface.tsx tests/unit/journey tests/unit/main/SummaryDashboard.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx tests/app-journey.spec.ts
git commit -m "feat(journey): add restrained shared motion"
```

---

### Task 8: 통합 Playwright 캡처, bundle과 PWA 검증

**Files:**
- Create: `tests/motion-system.spec.ts`
- Create: `playwright.pwa.config.ts`

**Interfaces:**
- Consumes: all previous tasks
- Produces: final cross-app evidence and before/after chunk report

- [ ] **Step 1: Add cross-app motion tests**

Build fixtures for Main normal/unclipped/clipped deficit, Main edit apply, Simulation projection change, Portfolio allocation/sort and Account Map readiness. At 390×844, 768×900 and 1280×900 capture named screenshots into Playwright output, not committed source directories:

```ts
await page.screenshot({ path: testInfo.outputPath(`${app}-${viewport.width}-${phase}.png`) });
```

Assert no document overflow, final accessible values are present before animation completion, focus remains usable, and reduced motion has no intermediate state.

- [ ] **Step 2: Run all source and unit verification**

Run:

```bash
npm run check
npm run test:unit
```

Expected: TypeScript checks exit 0 and all Vitest suites PASS with 0 failures.

- [ ] **Step 3: Run complete E2E verification**

Run:

```bash
npm run test:e2e
```

Expected: all supported Playwright specs PASS with 0 failures, including `tests/motion-system.spec.ts`.

- [ ] **Step 4: Build and report post-Anime.js chunks**

Run:

```bash
node ./node_modules/vite/bin/vite.js build --manifest
node scripts/report-vite-chunks.mjs
rg -n "from ['\"]animejs|from ['\"]animejs/" src
```

Expected: build exits 0. Record `rootHtmlBytes` separately, and compare only the four JavaScript entries' `initialBytes` with the Task 1 baseline. The import scan contains only approved core/scope/timeline imports and no draggable or scroll-observer import. Record the exact delta in the handoff; investigate unexpected shared chunk growth before proceeding.

- [ ] **Step 5: Verify PWA offline revisit**

Create `playwright.pwa.config.ts` with `testMatch: 'motion-system.spec.ts'`, `serviceWorkers: 'allow'`, one Chromium worker and a `vite preview --host 127.0.0.1` web server on a workspace-derived fixed port. Serve `dist/`, visit Main, Simulation, Portfolio and Account Map online once, wait for `navigator.serviceWorker.controller`, set the context offline, revisit each route and assert its main heading and final motion state render. Restore online mode in `finally`.

Expected: every current app loads offline without a failed Anime.js chunk request.

- [ ] **Step 6: Run reference and cleanliness checks**

Run:

```bash
rg -n "setup-review-transition|overflowPresentation|flow-overflow-droplet|저장됨" src tests
git diff --check
git status --short
```

Expected: no obsolete Main transition/compression or normal-success copy remains; only intentional historical/document/test references are reported. `git diff --check` exits 0 and only planned files are modified.

- [ ] **Step 7: Commit final integration evidence**

```bash
git add tests/motion-system.spec.ts playwright.pwa.config.ts
git commit -m "test: verify shared motion experience"
```

Do not commit `dist/`, Playwright output, screenshots or trace files.

---

## 최종 인계 체크리스트

- [ ] 변경 파일과 각 앱의 motion ownership을 요약한다.
- [ ] `npm run check`, `npm run test:unit`, `npm run test:e2e`의 실제 통과 수를 기록한다.
- [ ] 390px, 768px와 desktop 캡처 위치를 기록한다.
- [ ] Anime.js 도입 전후 entry별 raw byte delta를 기록한다.
- [ ] PWA online 최초 로드와 offline 재방문 결과를 기록한다.
- [ ] 남은 위험이 있으면 해당 재현 명령과 다음 소유자를 명시한다.
