# Shared UI Components and Portfolio Visual Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main·Simulation·Portfolio가 같은 React button·surface를 사용하고 Portfolio가 Main 시각 문법으로 390px·768px·desktop에서 깨지지 않게 표시되도록 한다.

**Architecture:** `src/components/common/`이 `Button`과 `Surface`를 소유하고 Main 기존 경로는 호환 re-export를 제공한다. 세 앱은 `app-foundation.css` 하나를 공통 기반으로 사용하며 앱별 CSS는 레이아웃과 고유 시각화만 소유한다. 데이터, 계산, 저장, navigation은 변경하지 않는다.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5, Tailwind CSS 4 alpha, Vitest, Testing Library, Playwright

## Global Constraints

- 기준: `docs/superpowers/specs/2026-08-06-shared-ui-components-and-portfolio-visual-repair-design.md`, Product PRD, `DESIGN.md`.
- Main·Simulation·Portfolio의 데이터·계산·저장·navigation 계약은 변경하지 않는다.
- Simulation 그래프와 Portfolio 도넛·표·tooltip 고유 표현을 유지한다.
- 주요 button과 input은 최소 44px이다.
- 390px, 768px와 desktop에서 가로 overflow를 만들지 않는다.
- 일반 content surface에는 shadow를 추가하지 않는다.
- Tailwind 또는 Vite 버전을 변경하지 않는다.
- 기존 `AGENTS.md`, `package-lock.json` 변경을 덮어쓰거나 함께 커밋하지 않는다.

---

### Task 1: 공통 Button·Surface 소유권 확립

**Files:**
- Create: `src/components/common/Button.tsx`
- Create: `src/components/common/Surface.tsx`
- Create: `tests/unit/components/Button.test.tsx`
- Create: `tests/unit/components/Surface.test.tsx`
- Modify: `src/main/ui/common/Button.tsx`
- Modify: `src/main/ui/common/Surface.tsx`
- Test: `tests/unit/main/Button.test.tsx`
- Test: `tests/unit/main/Surface.test.tsx`

**Interfaces:**
- Produces: `Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' })`
- Produces: `Surface(props: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'aside'; children?: ReactNode })`
- Produces: Main 기존 경로의 named re-export `Button`, `ButtonVariant`, `Surface`, `SurfaceProps`

- [ ] **Step 1: 새 공통 경로 실패 테스트 작성**

`tests/unit/components/Button.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../../../src/components/common/Button';

afterEach(cleanup);
describe('shared Button', () => {
  it('merges variant, custom class and native attributes', () => {
    render(<Button variant="primary" className="portfolio-action" disabled>적용</Button>);
    const button = screen.getByRole('button', { name: '적용' });
    expect(button).toHaveClass('ui-button', 'ui-button--primary', 'portfolio-action');
    expect(button).toBeDisabled();
  });
});
```

`tests/unit/components/Surface.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Surface } from '../../../src/components/common/Surface';

afterEach(cleanup);
describe('shared Surface', () => {
  it('renders requested element and merges classes', () => {
    render(<Surface as="section" className="portfolio-summary" aria-label="배분 요약">내용</Surface>);
    expect(screen.getByRole('region', { name: '배분 요약' })).toHaveClass('ui-surface', 'portfolio-summary');
  });
});
```

- [ ] **Step 2: RED 확인**

Run:

```bash
npx vitest run tests/unit/components/Button.test.tsx tests/unit/components/Surface.test.tsx
```

Expected: FAIL with missing `src/components/common/Button` and `Surface` modules.

- [ ] **Step 3: 최소 공통 구현과 Main re-export 작성**

`src/components/common/Button.tsx`는 기존 Main 구현을 옮긴다. `src/components/common/Surface.tsx`도 기존 Main 구현을 옮긴다. Main 호환 파일은 구현을 복제하지 않고 다음만 export한다.

```ts
export { Button, type ButtonVariant } from '../../../components/common/Button';
```

```ts
export { Surface, type SurfaceProps } from '../../../components/common/Surface';
```

- [ ] **Step 4: GREEN 확인**

```bash
npx vitest run tests/unit/components/Button.test.tsx tests/unit/components/Surface.test.tsx tests/unit/main/Button.test.tsx tests/unit/main/Surface.test.tsx
```

Expected: 4 files PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/common/Button.tsx src/components/common/Surface.tsx src/main/ui/common/Button.tsx src/main/ui/common/Surface.tsx tests/unit/components/Button.test.tsx tests/unit/components/Surface.test.tsx
git commit -m "refactor(ui): share button and surface"
```

---

### Task 2: Simulation 공통 React 컴포넌트 연결

**Files:**
- Modify: `src/simulation/ui/AdvancedSettings.tsx`
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Modify: `src/simulation/ui/ScenarioSetupStep.tsx`
- Modify: `src/simulation/ui/SimulationComparison.tsx`
- Modify: `src/simulation/ui/SimulationControls.tsx`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/StartingPrincipalStep.tsx`
- Create: `tests/unit/simulation/sharedComponents.test.ts`
- Test: `tests/unit/simulation/SimulationApp.test.tsx`
- Test: `tests/unit/simulation/SimulationControls.test.tsx`
- Test: `tests/unit/simulation/AdvancedSettings.test.tsx`
- Test: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: Task 1 `Button`, `Surface`
- Preserves: accessible name, button type, disabled, handler, section label, graph DOM

- [ ] **Step 1: 공통 컴포넌트 architecture guard 작성**

`tests/unit/simulation/sharedComponents.test.ts`는 `readFileSync`로 위 대상 파일을 읽고 다음을 확인한다.

```ts
expect(source).not.toMatch(/<button[^>]+className="ui-button/);
expect(source).not.toMatch(/<section[^>]+ui-surface/);
expect(source).toMatch(/components\/common\/(Button|Surface)/);
```

각 파일에 필요한 컴포넌트만 검사한다. `SimulationApp`의 anchor CTA와 management menu는 native 구조를 유지하므로 guard 대상에서 제외한다.

- [ ] **Step 2: RED 확인**

```bash
npx vitest run tests/unit/simulation/sharedComponents.test.ts
```

Expected: FAIL because Simulation uses direct `ui-button` and `ui-surface` markup.

- [ ] **Step 3: 일반 button·surface 최소 교체**

- native `<button>`은 `Button`으로 바꾸고 기존 class 의미에 맞춰 variant를 전달한다.
- 일반 `<section className="... ui-surface">`는 `Surface as="section"`으로 바꾼다.
- anchor CTA는 기존 `<a className="ui-button ...">`를 유지한다.
- `GrowthChart` SVG·pointer·keyboard·tooltip markup은 변경하지 않는다.
- 기존 class, handler, disabled, `type`, accessible name을 보존한다.

- [ ] **Step 4: GREEN과 E2E 확인**

```bash
npx vitest run tests/unit/simulation/sharedComponents.test.ts tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationControls.test.tsx tests/unit/simulation/AdvancedSettings.test.tsx
npx playwright test tests/simulation.spec.ts --reporter=list
```

Expected: 모두 PASS. 그래프 회귀 0건.

- [ ] **Step 5: 커밋**

```bash
git add src/simulation/ui tests/unit/simulation/sharedComponents.test.ts
git commit -m "refactor(simulation): use shared ui components"
```

---

### Task 3: Portfolio markup 공통화

**Files:**
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/PortfolioSummary.tsx`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/PortfolioApplyBar.tsx`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/unit/portfolio/AllocationEditor.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioDialogs.test.tsx`

**Interfaces:**
- Consumes: Task 1 `Button`, `Surface`
- Produces: `.portfolio-summary.ui-surface`, `.portfolio-editor.ui-surface`, `.portfolio-recovery.ui-surface`, `.portfolio-apply-bar.ui-surface`, variant buttons
- Preserves: reducer action, repository call, dialog focus, roles, accessible names

- [ ] **Step 1: Portfolio 공통 class 실패 테스트 추가**

기존 tests에 다음 계약을 추가한다.

```tsx
expect(screen.getByRole('heading', { name: /투자금/ }).closest('section')).toHaveClass('ui-surface', 'portfolio-summary');
expect(screen.getByRole('button', { name: '배분 수정' })).toHaveClass('ui-button', 'ui-button--primary');
expect(screen.getByRole('button', { name: '투자 대상 추가' })).toHaveClass('ui-button', 'ui-button--secondary');
expect(screen.getByRole('complementary', { name: '배분 변경' })).toHaveClass('ui-surface');
expect(screen.getByRole('dialog', { name: '투자 배분 적용' })).toHaveClass('ui-surface');
```

- [ ] **Step 2: RED 확인**

```bash
npx vitest run tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
```

Expected: FAIL on missing `ui-surface`, `ui-button` or variant class.

- [ ] **Step 3: panel·action 최소 교체**

- summary, editor, recovery, Apply Bar wrapper에 `Surface` 사용.
- toolbar, editor, Apply Bar, dialog button에 `Button` 사용.
- `PortfolioDialog`는 native `<dialog>`를 유지하고 `className="portfolio-dialog ui-surface"` 적용.
- reset은 existing `AppManagementMenu` tone 계약 유지.
- ref, focus attribute, disabled, handler, button type 보존.

- [ ] **Step 4: GREEN 확인**

```bash
npx vitest run tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
```

Expected: 3 files PASS. focus regression 0건.

- [ ] **Step 5: 커밋**

```bash
git add src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/PortfolioSummary.tsx src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/PortfolioApplyBar.tsx src/portfolio/ui/PortfolioDialog.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
git commit -m "refactor(portfolio): use shared ui components"
```

---

### Task 4: Portfolio CSS와 모바일 레이아웃 복구

**Files:**
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `src/portfolio/ui/PortfolioSummary.tsx`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: Task 3 common class markup
- Preserves: `.portfolio-donut*`, `.portfolio-table*`, `.portfolio-tooltip*`, tooltip positioning
- Produces: 390px·768px single-column, 900px+ summary two-column, contained Apply Bar·dialog

`tests/portfolio.spec.ts`의 type import에 `Locator`를 추가한다.

```ts
import { expect, test, type Locator, type Page } from '@playwright/test';
```

- [ ] **Step 1: 실패하는 Playwright 시각 계약 추가**

기존 viewport loop에 추가:

```ts
const summary = page.locator('.portfolio-summary');
await expect(summary).toHaveClass(/ui-surface/);
expect(await summary.evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px');
for (const control of await page.locator('.portfolio-content button:visible, .portfolio-content input:visible').all()) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}
```

390px editor test 추가:

```ts
await page.setViewportSize({ width: 390, height: 844 });
await seedMain(page, 200_000);
await page.goto('apps/portfolio/');
await page.getByRole('button', { name: '투자 대상 추가' }).click();
const rowBox = await page.locator('.portfolio-editor__row').first().boundingBox();
expect(rowBox).not.toBeNull();
expect(rowBox!.x).toBeGreaterThanOrEqual(16);
expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(374);
expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
```

Apply Bar와 dialog containment도 같은 test에서 확인한다.

```ts
const assertContained = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(16);
  expect(box!.x + box!.width).toBeLessThanOrEqual(374);
};

await assertContained(page.getByRole('complementary', { name: '배분 변경' }));
await page.getByRole('button', { name: '적용' }).click();
await assertContained(page.getByRole('dialog', { name: '투자 배분 적용' }));
```

- [ ] **Step 2: RED 확인**

```bash
npx playwright test tests/portfolio.spec.ts --reporter=list
```

Expected: FAIL on common surface/button or 390px editor/overlay contract.

- [ ] **Step 3: foundation 중복 제거와 desktop CSS 구현**

`portfolio.css`의 `@import '../../styles/globals.css';`를 삭제한다. 다음 구조를 구현한다.

```css
.portfolio-summary,
.portfolio-editor,
.portfolio-recovery { padding: 1.5rem; }

.portfolio-toolbar,
.portfolio-summary__hero,
.portfolio-editor__mode,
.portfolio-editor__computed { min-width: 0; }

.portfolio-editor__row {
  grid-template-columns: minmax(0, 1.4fr) minmax(9rem, 1fr) auto auto;
  align-items: end;
}

.portfolio-table th,
.portfolio-table td {
  word-break: keep-all;
  white-space: nowrap;
}
```

toolbar는 status와 primary action을 양끝 정렬한다. editor mode는 44px radio 선택 영역, computed는 금액·비율을 구분한다.

- [ ] **Step 4: mobile·overlay CSS 구현**

`PortfolioSummary`에서 table을 `<div className="portfolio-table-wrap">`로 감싼다. 767px 이하 editor row는 단일 열이다. table은 wrapper 폭, 글자 크기와 padding으로 containment하며 내용 숨김이나 임의 금액 줄바꿈을 사용하지 않는다.

```css
.portfolio-apply-bar {
  inset: auto max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  padding: .75rem;
  box-shadow: var(--shadow-float);
}

.portfolio-dialog {
  width: min(calc(100vw - 2rem), 28rem);
  max-height: calc(100dvh - 2rem);
  overflow: auto;
}

.portfolio-dialog::backdrop { background: rgb(16 34 32 / 35%); }
```

도넛·tooltip·reduced-motion 규칙은 유지한다.

- [ ] **Step 5: GREEN 확인**

```bash
npx vitest run tests/unit/portfolio
npx playwright test tests/portfolio.spec.ts --reporter=list
```

Expected: Portfolio unit와 Playwright 전체 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/portfolio/ui/portfolio.css src/portfolio/ui/PortfolioSummary.tsx tests/portfolio.spec.ts
git commit -m "fix(portfolio): restore responsive visuals"
```

---

### Task 5: 전체 검증

**Files:**
- Verify: `DESIGN.md`
- Verify: approved spec
- Verify: current diff

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: 최신 검증 증거와 남은 위험

- [ ] **Step 1: 타입 검사**

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 2: 전체 unit**

```bash
npm run test:unit
```

Expected: failures 0.

- [ ] **Step 3: 영향 E2E**

```bash
npx playwright test tests/portfolio.spec.ts tests/simulation.spec.ts --reporter=list
```

Expected: failures 0; Portfolio 390px·768px·desktop와 Simulation graph 포함.

- [ ] **Step 4: diff 검증**

```bash
git diff --check
git status --short
git diff -- src/components/common src/main/ui/common src/simulation/ui src/portfolio/ui tests/unit tests/portfolio.spec.ts tests/simulation.spec.ts
```

Expected: whitespace error 0. 데이터·계산·저장·navigation 파일 변경 없음. 기존 `AGENTS.md`, `package-lock.json`은 작업 커밋에 포함되지 않음.

- [ ] **Step 5: 검증 전용 빈 커밋 금지**

검증 중 실제 수정이 없다면 새 커밋을 만들지 않는다. 테스트 기대값 수정이 필요하면 해당 production 변경 task로 되돌려 함께 커밋한다.
