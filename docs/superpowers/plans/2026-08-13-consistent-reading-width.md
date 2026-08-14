# Consistent App Reading Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main, Simulation과 Portfolio의 일반 본문을 공통 48rem 읽기 폭과 모바일 1rem 가드레일로 통일하면서 상단 앱 메뉴는 그대로 유지하고 Main 조립 시각화만 75rem까지 확장한다.

**Architecture:** `src/styles/app-foundation.css`가 `--ui-content-max-width`, `--ui-content-gutter`, `--ui-wide-visual-max-width`와 `.app-content-frame`, `.app-wide-visual`을 단일 소유한다. 각 앱은 상태별 최상위 본문에 frame을 명시적으로 적용하고, Main review의 AllocationBar 시각 stage만 assembly presentation에서 wide primitive를 소비한다. `AppShell`, launcher frame, journey launcher와 viewport overlay에는 공통 frame을 적용하지 않는다.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4 `@layer`, Vitest + Testing Library, Playwright, Vite

## Global Constraints

- 일반 앱 본문 최대 폭은 `48rem`이다.
- viewport 좌우 가드레일은 각각 최소 `1rem`이며 최상위 `.app-content-frame` 한 곳만 소유한다.
- Main 최초 setup과 `처음부터 다시` review의 조립 시각화 stage만 최대 `75rem`의 `.app-wide-visual`을 사용한다.
- `AppShell`, `.app-shell__launcher-frame`, `.journey-launcher`, launcher 표시 정책과 관리 popover 동작은 변경하지 않는다.
- launcher frame은 `max-width: 1200px`, 모바일 좌우 `20px`, 640px 이상 좌우 `32px`을 유지한다.
- sheet, panel, dialog, toast와 fixed apply bar는 viewport 기준 containment를 유지한다.
- Main deficit 막대의 실제 비율 연장과 viewport 밖에서만 절단되는 계약을 유지한다.
- 데이터 소유권, persistence schema, route, motion timing과 reduced-motion 계약을 변경하지 않는다.
- 390×844, 768×900과 1280×900에서 body horizontal overflow가 없어야 한다.
- 구현과 함께 `DESIGN.md`를 canonical 공통 읽기 폭 계약으로 갱신한다. PRD는 변경하지 않는다.

---

## File Map

- `src/styles/app-foundation.css`: 공통 폭 token과 `.app-content-frame`, `.app-wide-visual` primitive의 유일한 정의 위치
- `DESIGN.md`: 제품 전체 읽기 폭, 모바일 가드레일, Main wide 예외와 launcher 제외 계약
- `src/portfolio/ui/PortfolioApp.tsx`: 모든 Portfolio page-level 상태가 공통 frame을 명시적으로 소비
- `src/portfolio/ui/portfolio.css`: 기존 중복 `48rem`/gutter outer-width 선언 제거, 내부 surface 스타일만 유지
- `src/main/ui/MainApp.tsx`: loading, recovery와 setup page frame 적용
- `src/main/ui/dashboard/SummaryDashboard.tsx`: dashboard frame 적용과 중복 viewport padding 제거
- `src/main/ui/setup/SetupFlow.tsx`: review AllocationBar에 assembly presentation 전달
- `src/main/ui/setup/AllocationBar.tsx`: 48rem 표와 분리된 시각 stage, assembly-only wide class
- `src/main/ui/main.css`: AllocationBar visual-stage layout과 기존 overflow semantics 유지
- `src/simulation/ui/SimulationApp.tsx`: Main-required와 ready 상태에 page-level frame 적용
- `src/simulation/ui/simulation.css`: content/onboarding/recovery의 중복 outer-width와 desktop padding 제거
- `tests/unit/components/AppShell.test.tsx`: launcher가 frame primitive를 자동 소비하지 않는 비회귀
- `tests/unit/portfolio/PortfolioApp.test.tsx`: Portfolio page-level 상태의 공통 frame 사용
- `tests/unit/main/MainApp.test.tsx`: Main loading/recovery/setup frame과 launcher 표시 정책
- `tests/unit/main/SummaryDashboard.test.tsx`: dashboard frame과 overlay DOM 경계
- `tests/unit/main/AllocationBar.test.tsx`: standard/assembly presentation의 wide-stage 경계
- `tests/unit/simulation/SimulationApp.test.tsx`: Simulation recovery/onboarding/result frame 단일 소유권
- `tests/app-journey.spec.ts`: launcher의 기존 수치 geometry와 popover/focus 비회귀
- `tests/main-react.spec.ts`: 일반 dashboard 48rem, 최초/재시작 wide stage와 deficit containment
- `tests/simulation.spec.ts`: 48rem graph의 축·비교값·tooltip·overflow
- `tests/portfolio.spec.ts`: 공통 frame 이관 후 기존 48rem 결과 유지
- `tests/reading-width.spec.ts`: 세 viewport의 cross-app width matrix와 test-output screenshots

---

### Task 1: 공통 frame 규격과 Portfolio 기준선 이관

**Files:**
- Modify: `src/styles/app-foundation.css`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `DESIGN.md`
- Modify: `tests/unit/components/AppShell.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: 기존 `.app-shell__launcher-frame`, `.portfolio-content`, `.portfolio-recovery`
- Produces: CSS custom properties `--ui-content-max-width`, `--ui-content-gutter`, `--ui-wide-visual-max-width`; classes `.app-content-frame`, `.app-wide-visual`

- [ ] **Step 1: 공통 frame과 launcher 격리 unit test를 RED로 추가한다**

`tests/unit/components/AppShell.test.tsx`에서 AppShell이 frame을 자동 주입하지 않는 계약을 추가한다.

```tsx
it('keeps the launcher and arbitrary children outside the reading-width primitive', () => {
  render(<AppShell currentApp="main"><main data-testid="page-content">내용</main></AppShell>);

  expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
  expect(screen.getByTestId('page-content')).not.toHaveClass('app-content-frame');
});
```

`tests/unit/portfolio/PortfolioApp.test.tsx`의 ready, gated와 recovery fixture에 다음 assertion을 추가한다.

```tsx
expect(screen.getByTestId('portfolio-page-frame')).toHaveClass('app-content-frame');
expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
```

- [ ] **Step 2: focused unit을 실행해 RED를 확인한다**

Run:

```bash
npx vitest run tests/unit/components/AppShell.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
```

Expected: Portfolio에 `portfolio-page-frame`과 `app-content-frame`이 없어 FAIL한다. AppShell 격리 test는 현재 구조를 문서화하며 PASS할 수 있다.

- [ ] **Step 3: app-foundation에 공통 token과 primitive를 구현한다**

`src/styles/app-foundation.css`의 theme/component 경계에 다음 소유권을 추가한다. custom property는 기존 전역 theme selector에 두고 class는 `@layer components` 안에 둔다.

```css
--ui-content-max-width: 48rem;
--ui-content-gutter: 1rem;
--ui-wide-visual-max-width: 75rem;

.app-content-frame {
  box-sizing: border-box;
  width: min(
    calc(100% - var(--ui-content-gutter) - var(--ui-content-gutter)),
    var(--ui-content-max-width)
  );
  margin-inline: auto;
}

.app-wide-visual {
  box-sizing: border-box;
  width: min(
    calc(100vw - var(--ui-content-gutter) - var(--ui-content-gutter)),
    var(--ui-wide-visual-max-width)
  );
  max-width: none;
  margin-inline-start: max(
    calc(50% - 50vw + var(--ui-content-gutter)),
    calc(50% - 37.5rem)
  );
  margin-inline-end: 0;
}
```

`37.5rem`은 공통 wide max의 절반이며 이 primitive 안에서만 사용한다. 최종 wide centering 식은 48rem 부모와 viewport 양쪽에서 실제 중앙 정렬되는지를 browser test로 검증한다. `position`, `transform` 또는 `translate`는 fixed descendant containing block과 motion 상태를 바꿀 수 있으므로 사용하지 않는다.

- [ ] **Step 4: Portfolio page-level 상태를 공통 frame으로 이관한다**

`PortfolioApp.tsx`에서 ready/gated/stale/recovery의 최상위 읽기 wrapper에 다음 형태를 적용한다.

```tsx
<div
  className="app-content-frame portfolio-content"
  data-testid="portfolio-page-frame"
>
```

직접 렌더되는 `RecoveryPanel`의 `Surface`에도 `app-content-frame`과 동일 test id를 적용한다. 이미 `.portfolio-content` 안에 있는 stale recovery surface에는 frame을 중첩하지 않는다.

`portfolio.css`에서는 아래 outer width 소유권을 제거한다.

```css
.portfolio-content, .portfolio-recovery {
  width: min(100% - 2rem, 48rem);
  margin-inline: auto;
}
```

`.portfolio-content`의 block padding과 `.portfolio-recovery`의 surface padding은 유지한다.

- [ ] **Step 5: DESIGN에 canonical 계약을 추가한다**

`DESIGN.md`의 Layout/Responsive에 다음 내용을 명시한다.

```markdown
- 일반 앱 본문은 공통 `48rem` 최대 읽기 폭과 viewport 좌우 `1rem` 가드레일을 사용한다.
- viewport 가드레일은 page-level content frame 한 곳만 소유하며 outer padding과 중첩하지 않는다.
- Main 최초·재시작 review의 조립 시각화만 `75rem` wide 예외를 사용할 수 있다.
- launcher와 viewport overlay는 본문 읽기 폭 규격에서 제외한다.
```

- [ ] **Step 6: Portfolio unit과 browser 기준선을 검증한다**

Run:

```bash
npx vitest run tests/unit/components/AppShell.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
npx playwright test tests/portfolio.spec.ts
npm run check
```

Expected: unit과 Portfolio Playwright 모두 PASS하고, 390px/768px/desktop에서 기존 Portfolio geometry가 유지된다.

- [ ] **Step 7: Task 1을 커밋한다**

```bash
git add DESIGN.md src/styles/app-foundation.css src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css tests/unit/components/AppShell.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/portfolio.spec.ts
git commit -m "feat(layout): define shared reading width"
```

---

### Task 2: Main 일반 frame과 assembly-only wide stage

**Files:**
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: Task 1 `.app-content-frame`, `.app-wide-visual`
- Produces: `AllocationBarProps.presentation?: 'standard' | 'assembly'`; `.allocation-bar__visual-stage`

- [ ] **Step 1: Main 상태별 frame unit test를 RED로 추가한다**

`tests/unit/main/MainApp.test.tsx`에서 loading, recovery와 setup의 page-level main을 `data-testid="main-page-frame"`로 찾고 다음을 확인한다.

```tsx
expect(screen.getByTestId('main-page-frame')).toHaveClass('app-content-frame');
```

setup fixture에서는 기존 launcher 부재도 함께 유지한다.

```tsx
expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
```

`tests/unit/main/SummaryDashboard.test.tsx`에는 다음 assertion을 추가한다.

```tsx
expect(screen.getByTestId('main-dashboard-frame')).toHaveClass('app-content-frame');
```

- [ ] **Step 2: AllocationBar presentation test를 RED로 추가한다**

`tests/unit/main/AllocationBar.test.tsx`에 standard와 assembly rendering을 각각 추가한다.

```tsx
const { rerender } = render(<AllocationBar data={balancedData} />);
expect(screen.getByTestId('allocation-visual-stage')).not.toHaveClass('app-wide-visual');
expect(screen.getByRole('table', { name: '월 자금 항목' })).not.toHaveClass('app-wide-visual');

rerender(<AllocationBar data={balancedData} presentation="assembly" />);
expect(screen.getByTestId('allocation-visual-stage')).toHaveClass('app-wide-visual');
expect(screen.getByRole('table', { name: '월 자금 항목' })).not.toHaveClass('app-wide-visual');
```

- [ ] **Step 3: Main focused unit을 실행해 RED를 확인한다**

Run:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/AllocationBar.test.tsx
```

Expected: page-frame test ids, common classes와 `presentation` prop이 없어 FAIL한다.

- [ ] **Step 4: Main page-level frame을 구현한다**

`MainApp.tsx`의 loading, recovery와 setup main에 `app-content-frame`과 `data-testid="main-page-frame"`을 적용한다. 기존 `w-full max-w-3xl px-5 sm:px-8`처럼 viewport 여백을 중복 소유한 utility는 제거하고 block padding만 유지한다.

```tsx
<main
  className="app-content-frame min-h-dvh py-8 sm:py-12"
  data-testid="main-page-frame"
>
```

RecoveryView도 outer main이 frame을 소유하고 내부 Surface는 `w-full max-w-xl`을 유지한다.

`SummaryDashboard.tsx` root는 다음 책임만 갖는다.

```tsx
<main
  className="app-content-frame relative grid min-h-dvh gap-6 py-7 sm:py-10"
  data-testid="main-dashboard-frame"
  aria-labelledby="summary-dashboard-title"
>
```

overlay DOM은 root의 형제로 재배치하지 않는다. frame에 transform/overflow를 추가하지 않으므로 기존 fixed viewport containment를 유지한다.

- [ ] **Step 5: AllocationBar의 visual stage와 표를 분리한다**

`AllocationBarProps`를 다음처럼 확장한다.

```ts
interface AllocationBarProps {
  data: MainData;
  presentation?: 'standard' | 'assembly';
}
```

root section이 현재 `onBlur` 경계를 소유하게 하고, flow bar·clipped overflow label·PercentageTooltip만 visual stage에 둔다. 표는 stage 뒤의 48rem root에 남긴다.

```tsx
const visualStageClassName = presentation === 'assembly'
  ? 'allocation-bar__visual-stage app-wide-visual'
  : 'allocation-bar__visual-stage';
```

현재 `.flow-bar-wrapper` 안에서 다음 세 요소를 `.allocation-bar__visual-stage`로 이동한다: `.flow-bar`, 조건부 `.cashflow-bar__overflow-label`, `PercentageTooltip`. `.allocation-table`은 visual stage 밖에서 root `.allocation-bar`의 직접 자식으로 둔다. 표의 label target으로 focus가 이동할 때 tapped state가 조기에 해제되지 않도록 기존 `onBlur` containment handler는 visual wrapper가 아니라 root section으로 이동한다. pointer/touch/keyboard tooltip behavior는 기존 test를 그대로 통과해야 한다.

`SetupFlow.tsx`의 ReviewStep만 다음을 전달한다.

```tsx
<AllocationBar data={draft} presentation="assembly" />
```

Dashboard와 다른 소비자는 prop을 생략해 standard 48rem stage를 유지한다.

- [ ] **Step 6: main.css에 visual-stage layout만 추가한다**

`.allocation-bar__visual-stage`는 `position: relative; min-width: 0;`만 소유한다. 기존 `.flow-bar-wrapper`, tooltip과 overflow label의 absolute 기준이 visual stage 이동 후 동일하도록 필요한 selector를 stage 아래로 좁힌다. 앱별 CSS에 `48rem`, `75rem` 또는 breakout 계산을 복제하지 않는다.

- [ ] **Step 7: Main unit과 browser를 검증한다**

Run:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/AllocationBar.test.tsx
npx playwright test tests/main-react.spec.ts
npm run check
```

Expected: 모든 test가 PASS한다. 최초 setup과 재시작 review는 같은 wide stage를 사용하고 dashboard AllocationBar는 48rem 안에 남는다. deficit target·tooltip·table keyboard behavior와 mobile editor containment가 유지된다.

- [ ] **Step 8: Task 2를 커밋한다**

```bash
git add src/main/ui/MainApp.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/setup/SetupFlow.tsx src/main/ui/setup/AllocationBar.tsx src/main/ui/main.css tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/AllocationBar.test.tsx tests/main-react.spec.ts
git commit -m "feat(main): apply shared reading frame"
```

---

### Task 3: Simulation frame 단일 소유권과 48rem 그래프

**Files:**
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: Task 1 `.app-content-frame`
- Produces: `data-testid="simulation-page-frame"` on every page-level Simulation state

- [ ] **Step 1: Simulation 상태별 frame unit test를 RED로 추가한다**

`tests/unit/simulation/SimulationApp.test.tsx`의 Main-required, onboarding과 saved-result fixtures에서 다음을 확인한다.

```tsx
expect(screen.getByTestId('simulation-page-frame')).toHaveClass('app-content-frame');
expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
```

onboarding 내부 Surface가 frame을 중복 소비하지 않는지 확인한다.

```tsx
expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }).closest('section'))
  .not.toHaveClass('app-content-frame');
```

- [ ] **Step 2: Simulation unit을 실행해 RED를 확인한다**

Run:

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx
```

Expected: `simulation-page-frame`이 없어 FAIL한다.

- [ ] **Step 3: Simulation page frame을 구현한다**

ready/onboarding/result 상태는 현재 `.simulation-content` div 하나가 page frame을 소유한다.

```tsx
<div
  className="app-content-frame simulation-content"
  data-testid="simulation-page-frame"
>
```

Main-required 상태는 직접 렌더되는 recovery Surface가 frame을 소유한다.

```tsx
<Surface
  as="section"
  className="app-content-frame simulation-recovery"
  data-testid="simulation-page-frame"
>
```

`simulation-onboarding-step`에는 frame을 적용하지 않는다. 이 Surface는 page frame 내부의 카드다.

- [ ] **Step 4: 중복 width와 desktop padding을 제거한다**

`simulation.css`의 아래 공동 outer-width 선언을 제거한다.

```css
.simulation-content,
.simulation-recovery,
.simulation-onboarding-step {
  width: min(calc(100% - clamp(1.5rem, 4vw, 3rem)), 70rem);
  margin: clamp(1.25rem, 4vw, 3.5rem) auto;
}
```

대신 block spacing만 분리한다.

```css
.simulation-content,
.simulation-recovery {
  margin-block: clamp(1.25rem, 4vw, 3.5rem);
}
```

`@media (min-width: 768px)`의 `.simulation-content { padding-inline: clamp(1rem, 4vw, 3rem); }`는 frame gutter와 중첩되므로 제거한다. `.simulation-onboarding-step`의 surface 내부 padding과 `max-width: 56rem`은 page outer gutter가 아니므로 유지해도 되지만, 48rem 부모 안에서 의미 없는 max-width는 제거해 CSS 소유권을 단순화한다.

- [ ] **Step 5: Simulation graph·tooltip browser assertion을 보강한다**

`tests/simulation.spec.ts`의 390/768/desktop responsive test에서 다음 geometry를 추가한다.

```ts
const frame = page.getByTestId('simulation-page-frame');
const box = await frame.boundingBox();
expect(box).not.toBeNull();
expect(box!.x).toBeGreaterThanOrEqual(16);
expect(box!.width).toBeLessThanOrEqual(768);
expect(Math.abs((viewport.width - box!.width) / 2 - box!.x)).toBeLessThan(1);
```

기존 graph SVG, axis label, comparison values와 tooltip viewport containment assertion을 삭제하거나 완화하지 않는다.

- [ ] **Step 6: Simulation 검증을 실행한다**

Run:

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/GrowthChart.test.tsx
npx playwright test tests/simulation.spec.ts
npm run check
```

Expected: 모두 PASS하고 graph, axis, comparison과 tooltip이 세 viewport에서 보인다.

- [ ] **Step 7: Task 3을 커밋한다**

```bash
git add src/simulation/ui/SimulationApp.tsx src/simulation/ui/simulation.css tests/unit/simulation/SimulationApp.test.tsx tests/simulation.spec.ts
git commit -m "feat(simulation): use shared reading frame"
```

---

### Task 4: Cross-app width matrix와 launcher 비회귀 gate

**Files:**
- Create: `tests/reading-width.spec.ts`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Consumes: `.app-content-frame`, `.app-wide-visual`, `main-page-frame`, `main-dashboard-frame`, `simulation-page-frame`, `portfolio-page-frame`
- Produces: 세 viewport cross-app screenshot/geometry evidence

- [ ] **Step 1: cross-app width test를 작성한다**

`tests/reading-width.spec.ts`에 390×844, 768×900, 1280×900 matrix를 만든다. 각 viewport에서 seeded workspace로 Main dashboard, Simulation result와 Portfolio result를 방문하고 frame geometry를 수집한다.

```ts
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

function expectReadingFrame(
  viewportWidth: number,
  box: { x: number; width: number },
): void {
  const expectedWidth = Math.min(viewportWidth - 32, 768);
  expect(Math.abs(box.width - expectedWidth)).toBeLessThan(1);
  expect(Math.abs(box.x - (viewportWidth - expectedWidth) / 2)).toBeLessThan(1);
}
```

각 앱에서 다음을 확인한다.

```ts
expectReadingFrame(viewport.width, frameBox!);
expect(await page.evaluate(() => document.documentElement.scrollWidth))
  .toBeLessThanOrEqual(viewport.width);
await page.screenshot({
  path: testInfo.outputPath(`${app}-${viewport.name}-reading-width.png`),
});
```

desktop에서 세 앱 frame은 모두 768px이어야 한다. 390px에서는 모두 358px이어야 한다.

- [ ] **Step 2: Main assembly wide exception test를 추가한다**

같은 spec에서 empty Main 최초 review와 applied Main의 `처음부터 다시` review를 각각 만든다. 두 `.allocation-bar__visual-stage` geometry가 같고 일반 frame보다 넓으며 viewport gutter를 유지하는지 확인한다.

```ts
expect(firstAssembly.width).toBe(restartAssembly.width);
expect(firstAssembly.width).toBeGreaterThan(readingFrame.width);
expect(firstAssembly.x).toBeGreaterThanOrEqual(16);
expect(firstAssembly.x + firstAssembly.width).toBeLessThanOrEqual(viewport.width - 16 + 1);
```

1280px에서는 wide stage가 1200px, 768px 이하에서는 viewport minus 32px이므로 일반 frame과 같을 수 있다. `toBeGreaterThan` assertion은 desktop에만 적용한다. deficit fixture에서는 existing `data-desired-end-percent`, `data-visible-end-percent`, clipped target containment도 함께 확인한다.

- [ ] **Step 3: launcher 수치 계약을 기존 app-journey test에 고정한다**

`tests/app-journey.spec.ts`의 `sharedShellViewports`와 현재 geometry assertion을 유지한다. 새 frame test 도입 때문에 값을 바꾸지 않는다.

관리 popover test에 다음 containment를 명시한다.

```ts
const popover = page.locator('.journey-management__popover');
const popoverBox = await popover.boundingBox();
expect(popoverBox!.x).toBeGreaterThanOrEqual(16);
expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport.width - 16 + 1);
```

Escape 후 trigger focus return과 `aria-expanded="false"` assertion도 그대로 유지한다.

- [ ] **Step 4: focused cross-app browser gate를 실행한다**

Run:

```bash
npx playwright test tests/reading-width.spec.ts tests/app-journey.spec.ts
```

Expected: 3 viewport width matrix, Main first/restart assembly와 launcher/popover tests가 모두 PASS한다. screenshot은 `test-results/` 아래에만 생성된다.

- [ ] **Step 5: 전체 검증을 실행한다**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e
git diff --check
git status --short
```

Expected: TypeScript, 805개 이상의 unit과 전체 Playwright가 0 failure로 PASS한다. `test-results/`, screenshot, trace와 build output은 추적되지 않는다.

- [ ] **Step 6: 공통 규격·금지 대상 reference scan을 실행한다**

Run:

```bash
rg -n "ui-content-max-width|ui-content-gutter|ui-wide-visual-max-width|37\.5rem" src
rg -n "48rem|75rem" src/main src/simulation src/portfolio
git diff -- src/components/common/AppShell.tsx src/journey src/styles/app-foundation.css
```

Expected:

- 공통 token과 wide half-width 계산은 `app-foundation.css`에만 정의된다.
- Main, Simulation과 Portfolio의 변경된 outer-width 파일에는 새 `48rem`/`75rem` 선언이 없고 `.app-content-frame`/`.app-wide-visual` class만 소비한다. 기능적으로 무관한 기존 `48rem` 값이 검색되면 selector와 용도를 보고 별도로 판정한다.
- `AppShell.tsx`와 `src/journey/**`에는 diff가 없다.
- `app-foundation.css` diff는 새 frame token/primitive뿐이며 launcher selector 선언은 변경되지 않는다.

- [ ] **Step 7: 최종 integration gate를 커밋한다**

```bash
git add tests/reading-width.spec.ts tests/app-journey.spec.ts
git commit -m "test: verify shared reading width"
```

---

## Final Handoff Checklist

- [ ] 변경 파일과 공통 frame 소유권을 요약한다.
- [ ] Main·Simulation·Portfolio의 상태별 적용 지점을 기록한다.
- [ ] Main 최초/재시작 assembly stage가 같은 wide 예외임을 보고한다.
- [ ] launcher selector 무변경과 수치 geometry 검증 결과를 보고한다.
- [ ] 390×844, 768×900, 1280×900 screenshot 경로와 overflow 결과를 기록한다.
- [ ] unit, 전체 E2E, type check와 diff check의 정확한 pass/fail 수치를 기록한다.
- [ ] 남은 시각·browser 측정 위험이 있으면 재현 명령과 다음 소유자를 명시한다.
