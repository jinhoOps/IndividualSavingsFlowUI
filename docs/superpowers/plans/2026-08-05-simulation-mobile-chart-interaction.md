# Simulation Mobile Chart Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 모바일 Simulation 그래프에 고정 크기 compact tooltip과 drag 탐색을 제공하고 긴 한국식 금액의 의도치 않은 줄바꿈을 막는다.

**Architecture:** GrowthChart가 반응형 표시 모드와 pointer 수명주기를 소유하고, 표시 전용 GrowthChartTooltip에 compact 또는 detailed variant를 전달한다. 선택점 기반 tooltip 방향은 순수 geometry 함수로 계산하며 CSS는 고정 치수, 한 줄 금액과 breakpoint별 표현만 담당한다.

**Tech Stack:** React 19, TypeScript 5.5, CSS, Vitest 4 + Testing Library, Playwright 1.60

## Global Constraints

- 승인 spec: docs/superpowers/specs/2026-08-05-simulation-mobile-chart-interaction-design.md
- 모바일 breakpoint는 기존 계약과 같은 max-width: 767px이다.
- 모바일 tooltip은 연도, 현재 계획 총액, 전부 저축 총액만 표시한다.
- 데스크톱 tooltip은 기존 여섯 정보를 유지하되 모든 화면에서 닫기 버튼을 제거한다.
- 손을 뗀 뒤 선택을 유지하고 그래프 밖 pointer, page scroll 또는 Escape에서 닫는다.
- 한국식 정수 금액과 기존 반올림 정책을 바꾸지 않는다.
- 그래프 높이, 축, 범례, 결과 순서, 계산, 저장과 Main 읽기 전용 경계를 바꾸지 않는다.
- 390px, 768px와 desktop에서 가로 overflow가 없어야 한다.

---

## File Structure

- Modify: src/simulation/ui/chartGeometry.ts — 선택점과 고정 tooltip 치수에서 충돌 없는 방향을 계산한다.
- Modify: src/simulation/ui/GrowthChartTooltip.tsx — compact/detailed 표시 variant와 닫기 버튼 없는 의미 구조를 렌더링한다.
- Modify: src/simulation/ui/GrowthChart.tsx — media query, touch drag 수명주기, scroll/outside/Escape 닫힘과 tooltip 배치를 조정한다.
- Modify: src/simulation/ui/simulation.css — 고정 compact 치수, 선택점 위 배치, nowrap과 비교 금액 밀도를 정의한다.
- Modify: tests/unit/simulation/chartGeometry.test.ts — 좌우·상단 충돌 방향을 검증한다.
- Modify: tests/unit/simulation/GrowthChart.test.tsx — variant 내용, drag 유지와 dismiss 동작을 검증한다.
- Modify: tests/simulation.spec.ts — 실제 390px touch drag, 고정 치수, containment와 줄바꿈을 검증한다.
- Modify: DESIGN.md — canonical UI 계약을 갱신한다.

### Task 1: Tooltip placement geometry

**Files:**
- Modify: src/simulation/ui/chartGeometry.ts
- Test: tests/unit/simulation/chartGeometry.test.ts

**Interfaces:**
- Consumes: SVG viewBox 좌표 anchorX, anchorY, chart와 tooltip 치수
- Produces: tooltipPlacement(input): { horizontal: 'left' | 'right'; vertical: 'above' | 'below' }

- [ ] **Step 1: Write failing boundary tests**

tests/unit/simulation/chartGeometry.test.ts에서 tooltipSide import와 기존 단일 테스트를 다음 계약으로 교체한다.

~~~ts
import {
  buildChartGeometry,
  tooltipPlacement,
} from '../../../src/simulation/ui/chartGeometry';

it('keeps a fixed tooltip inside horizontal and top chart edges', () => {
  expect(tooltipPlacement({
    anchorX: 620, anchorY: 120,
    chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
  })).toEqual({ horizontal: 'left', vertical: 'above' });
  expect(tooltipPlacement({
    anchorX: 120, anchorY: 120,
    chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
  })).toEqual({ horizontal: 'right', vertical: 'above' });
  expect(tooltipPlacement({
    anchorX: 120, anchorY: 40,
    chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
  })).toEqual({ horizontal: 'right', vertical: 'below' });
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run:

~~~bash
npx vitest run tests/unit/simulation/chartGeometry.test.ts
~~~

Expected: FAIL because tooltipPlacement is not exported.

- [ ] **Step 3: Implement the pure placement function**

Replace tooltipSide in src/simulation/ui/chartGeometry.ts with:

~~~ts
export interface TooltipPlacementInput {
  anchorX: number;
  anchorY: number;
  chartWidth: number;
  tooltipWidth: number;
  tooltipHeight: number;
  gap?: number;
}

export function tooltipPlacement({
  anchorX,
  anchorY,
  chartWidth,
  tooltipWidth,
  tooltipHeight,
  gap = 12,
}: TooltipPlacementInput): {
  horizontal: 'left' | 'right';
  vertical: 'above' | 'below';
} {
  return {
    horizontal: anchorX + gap + tooltipWidth > chartWidth ? 'left' : 'right',
    vertical: anchorY - gap - tooltipHeight < 0 ? 'below' : 'above',
  };
}
~~~

- [ ] **Step 4: Run geometry tests and verify GREEN**

~~~bash
npx vitest run tests/unit/simulation/chartGeometry.test.ts
~~~

Expected: all tests PASS.

- [ ] **Step 5: Commit geometry contract**

~~~bash
git add src/simulation/ui/chartGeometry.ts tests/unit/simulation/chartGeometry.test.ts
git commit -m "feat(simulation): constrain chart tooltip placement"
~~~

### Task 2: Responsive tooltip content and touch lifecycle

**Files:**
- Modify: src/simulation/ui/GrowthChartTooltip.tsx
- Modify: src/simulation/ui/GrowthChart.tsx
- Test: tests/unit/simulation/GrowthChart.test.tsx

**Interfaces:**
- Consumes: Task 1 tooltipPlacement, existing GrowthChartTooltipValues, window.matchMedia('(max-width: 767px)')
- Produces: GrowthChartTooltip prop variant: 'compact' | 'detailed'; touch selection that persists after pointerup

- [ ] **Step 1: Add matchMedia test control**

At the top of tests/unit/simulation/GrowthChart.test.tsx, add:

~~~ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let compactViewport = false;

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches: compactViewport,
    media: '(max-width: 767px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  compactViewport = false;
  vi.unstubAllGlobals();
  cleanup();
});
~~~

- [ ] **Step 2: Replace obsolete repeated-tap test with failing compact-content test**

~~~ts
it('shows only two comparison totals in compact mode without a close button', () => {
  compactViewport = true;
  render(<GrowthChart result={result} amountMode="nominal" />);
  fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
    key: 'Home',
  });

  expect(screen.getByText('현재 계획 총액')).toBeVisible();
  expect(screen.getByText('전부 저축 총액')).toBeVisible();
  expect(screen.queryByText('누적 납입원금')).not.toBeInTheDocument();
  expect(screen.queryByText('저축 잔액')).not.toBeInTheDocument();
  expect(screen.queryByText('투자 잔액')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
});
~~~

- [ ] **Step 3: Add failing detailed-content and touch lifecycle tests**

~~~ts
it('keeps detailed desktop values but removes the close button', () => {
  render(<GrowthChart result={result} amountMode="nominal" />);
  fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
    key: 'Home',
  });
  expect(screen.getByText('누적 납입원금')).toBeVisible();
  expect(screen.getByText('저축 잔액')).toBeVisible();
  expect(screen.getByText('투자 잔액')).toBeVisible();
  expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    /0년, 현재 계획 총액 .* 전부 저축 총액/,
  );
});

it('drags through touch years, keeps release selection, and closes on scroll', () => {
  compactViewport = true;
  const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
  const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
  Object.defineProperty(chart, 'getBoundingClientRect', {
    value: () => ({ left: 0, width: 680 }),
  });
  Object.defineProperty(chart, 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(chart, 'releasePointerCapture', { value: vi.fn() });

  fireEvent.pointerDown(chart, { pointerId: 7, pointerType: 'touch', clientX: 36 });
  fireEvent.pointerMove(chart, { pointerId: 7, pointerType: 'touch', clientX: 656 });
  fireEvent.pointerUp(chart, { pointerId: 7, pointerType: 'touch', clientX: 656 });
  expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('20년');

  fireEvent.scroll(window);
  expect(container.querySelector('.growth-chart__tooltip')).not.toBeInTheDocument();
});
~~~

- [ ] **Step 4: Run component tests and verify RED**

~~~bash
npx vitest run tests/unit/simulation/GrowthChart.test.tsx
~~~

Expected: compact test sees detailed fields, touch move does not update, scroll does not dismiss, and close button remains.

- [ ] **Step 5: Make tooltip variant explicit**

Change GrowthChartTooltip props to accept:

~~~ts
variant: 'compact' | 'detailed';
placement: { horizontal: 'left' | 'right'; vertical: 'above' | 'below' };
anchorPercent: number;
anchorYPercent: number;
~~~

Render shared year and two totals for both variants. Render 누적 납입원금, 저축 잔액, 투자 잔액 only for detailed. Remove onClose and the 닫기 button. Use classes growth-chart__tooltip--compact or --detailed, --left or --right, --above or --below. Set CSS variables --tooltip-anchor-x and --tooltip-anchor-y from the two percentages. GrowthChart renders a separate sr-only role=status sentence containing only 선택 연도, 현재 계획 총액 and 전부 저축 총액; remove aria-live from the visual aside so detailed fields are not announced as duplicate live updates.

- [ ] **Step 6: Add media-query state and pointer lifecycle to GrowthChart**

Add this local hook:

~~~ts
function useCompactTooltip(): boolean {
  const query = '(max-width: 767px)';
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}
~~~

Add touchPointerRef = useRef<number | null>(null). On touch pointerdown, store pointerId, call setPointerCapture, and select without toggling. On matching touch pointermove, update the selected index. On pointerup, clear the ref and release capture without clearing activeIndex. On pointercancel, clear the ref while preserving activeIndex. Keep non-touch pointermove behavior.

Extend the active-selection effect:

~~~ts
const dismiss = () => setActiveIndex(null);
window.addEventListener('scroll', dismiss, { passive: true });
return () => {
  document.removeEventListener('pointerdown', dismissOutside);
  window.removeEventListener('scroll', dismiss);
};
~~~

Call Task 1 geometry with anchorY = Math.min(activeGeometry.currentY, activeGeometry.allSavingsY), detailed size 240 × 230, compact size 192 × 112, and x/y percentages based on the 680 × 285 viewBox.

- [ ] **Step 7: Run component tests and verify GREEN**

~~~bash
npx vitest run tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/chartGeometry.test.ts
~~~

Expected: all tests PASS.

- [ ] **Step 8: Commit interaction behavior**

~~~bash
git add src/simulation/ui/GrowthChart.tsx src/simulation/ui/GrowthChartTooltip.tsx tests/unit/simulation/GrowthChart.test.tsx
git commit -m "feat(simulation): refine mobile chart exploration"
~~~

### Task 3: Fixed tooltip density and no-wrap amounts

**Files:**
- Modify: src/simulation/ui/simulation.css
- Test: tests/simulation.spec.ts

**Interfaces:**
- Consumes: Task 2 variant and placement classes, --tooltip-anchor-x, --tooltip-anchor-y
- Produces: 192px × 112px compact tooltip, stable detailed tooltip, nowrap comparison values

- [ ] **Step 1: Add failing mobile E2E contract**

Add a test named mobile keeps compact tooltip stable while dragging. It must:
- set viewport to 390 × 844;
- open the first result;
- fill 기간 숫자 with 30 so the endpoints are 0년 and 30년;
- dispatch touch pointerdown near the first graph point;
- assert .growth-chart__tooltip--compact contains 현재 계획 총액 and 전부 저축 총액 only;
- assert no 상세값 or button;
- record boundingBox;
- dispatch matching pointermove and pointerup near the last point;
- assert 30년 and identical width/height;
- assert tooltip strong, span and b nodes occupy one line;
- scroll and assert the tooltip closes.

Use this exact size comparison:

~~~ts
const firstSize = await tooltip.boundingBox();
// dispatch pointermove and pointerup
const lastSize = await tooltip.boundingBox();
expect(lastSize?.width).toBe(firstSize?.width);
expect(lastSize?.height).toBe(firstSize?.height);
~~~

In the existing shared viewport test, assert tooltipBox.y is within graphBox.y and graphBox.y + graphBox.height. For .simulation-comparison dd, assert scrollWidth <= clientWidth and rendered height is no more than 1.25 × computed line-height.

- [ ] **Step 2: Run mobile E2E and verify RED**

~~~bash
npx playwright test tests/simulation.spec.ts --grep "mobile"
~~~

Expected: FAIL because compact class, fixed size, drag and nowrap rules do not exist.

- [ ] **Step 3: Implement fixed anchor placement CSS**

Replace old cursor-side and mobile full-width tooltip rules with:

~~~css
.growth-chart__tooltip {
  position: absolute;
  z-index: 4;
  left: var(--tooltip-anchor-x);
  top: var(--tooltip-anchor-y);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 1rem;
  background: rgb(255 255 255 / 97%);
  box-shadow: var(--shadow-float);
}

.growth-chart__tooltip--detailed {
  width: 15rem;
  min-height: 14.375rem;
  padding: 1rem;
}

.growth-chart__tooltip--compact {
  width: 12rem;
  height: 7rem;
  padding: .625rem .75rem;
}

.growth-chart__tooltip--left { transform: translateX(calc(-100% - .75rem)); }
.growth-chart__tooltip--right { transform: translateX(.75rem); }
.growth-chart__tooltip--above { translate: 0 calc(-100% - .75rem); }
.growth-chart__tooltip--below { translate: 0 .75rem; }
~~~

Compact rows use a two-column grid. Tooltip labels and amounts use white-space: nowrap. Compact values use font-size: clamp(.78rem, 3.3vw, .95rem). Remove the existing max-width: 767px rule that stretches tooltip from left: .5rem to right: .5rem.

- [ ] **Step 4: Prevent arbitrary comparison amount wrapping**

Replace overflow-wrap: anywhere on .simulation-comparison dd with:

~~~css
.simulation-comparison dd {
  min-width: 0;
  white-space: nowrap;
  font-size: clamp(1.1rem, 4vw, 2.5rem);
  letter-spacing: -.025em;
}
~~~

At max-width: 767px, use font-size: clamp(1rem, 5.2vw, 1.35rem). Keep two columns, order and surrounding gap unchanged.

- [ ] **Step 5: Run focused E2E and verify GREEN**

~~~bash
npx playwright test tests/simulation.spec.ts --grep "mobile|tablet|desktop"
~~~

Expected: 390px compact drag and all viewport containment tests PASS.

- [ ] **Step 6: Commit responsive styles and browser contract**

~~~bash
git add src/simulation/ui/simulation.css tests/simulation.spec.ts
git commit -m "style(simulation): stabilize mobile chart density"
~~~

### Task 4: Canonical contract and regression verification

**Files:**
- Modify: DESIGN.md

**Interfaces:**
- Consumes: completed Tasks 1–3 behavior
- Produces: canonical UI contract matching runtime and browser tests

- [ ] **Step 1: Update Simulation design contract**

Replace the generic graph tooltip sentence in DESIGN.md with:

~~~md
- 그래프는 기본 상태를 절제하고 desktop pointer·keyboard 탐색에서는 연도와 현재 계획·전부 저축·납입원금·저축·투자 잔액을 상세 카드로 보여줍니다.
- 767px 이하 touch 탐색은 누른 채 연도를 이동하고 손을 뗀 뒤 선택을 유지합니다. 고정 크기 compact tooltip은 연도·현재 계획 총액·전부 저축 총액만 한 줄로 보여주며 그래프 밖 touch나 scroll에서 닫힙니다.
- 그래프 tooltip은 닫기 버튼을 두지 않으며 Escape와 그래프 밖 pointer로 닫힙니다.
- 한국식 정수 금액은 tooltip과 비교 영역에서 임의 글자 단위로 줄바꿈하지 않습니다.
~~~

- [ ] **Step 2: Run static and focused unit verification**

~~~bash
npm run check
npx vitest run tests/unit/simulation/GrowthChart.test.tsx tests/unit/simulation/chartGeometry.test.ts
~~~

Expected: both commands exit 0.

- [ ] **Step 3: Run full Simulation browser verification**

~~~bash
npx playwright test tests/simulation.spec.ts --reporter=list
~~~

Expected: all Simulation tests PASS, including 390px, 768px and desktop cases.

- [ ] **Step 4: Perform explicit visual checks**

At 390px, 768px and 1280px verify:
- no document horizontal overflow;
- compact tooltip stays over the selected point, inside graph bounds, without hiding most of the graph;
- compact size stays identical at 0년 and 30년;
- Korean amounts and labels remain one line;
- desktop detailed card retains all six information items;
- focus ring, Home·End·Arrow keys and Escape remain usable.

Record any unavailable manual check as an unresolved verification item rather than claiming it passed.

- [ ] **Step 5: Check final diff and commit documentation**

~~~bash
git diff --check
git status --short
~~~

Expected: no whitespace errors; only planned files are modified.

~~~bash
git add DESIGN.md
git commit -m "docs(simulation): define responsive chart details"
~~~
