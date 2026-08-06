# Main-Aligned AppShell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main·Simulation·Portfolio·Account Map이 Main의 현재 launcher geometry와 공통 radial canvas를 공유하도록 한다.

**Architecture:** `src/components/common/AppShell.tsx`가 page root와 launcher frame만 소유하고 `AppLauncher`에 현재 앱과 management menu를 전달한다. `app-foundation.css`가 Main 기준 20px·32px·1200px frame을 정의한다. 각 앱 content wrapper는 기존 폭·grid·spacing을 유지한다.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5, Tailwind CSS 4 alpha, Vitest, Testing Library, Playwright

## Global Constraints

- 기준 spec: `docs/superpowers/specs/2026-08-06-main-aligned-app-shell-design.md`.
- 구현 시작 전 최신 `main`의 launcher navigation·overflow·management 변경을 현재 작업 branch에 반영한다.
- Main launcher geometry는 mobile 20px, 640px 이상 32px, top 20px, outer max-width 1200px다.
- `AppLauncher` 자체의 navigation, overflow, tooltip, management와 focus 동작은 변경하지 않는다.
- 앱별 content 최대 폭, grid, spacing, graph, donut, table과 readiness 정보 구조를 유지한다.
- 데이터, 계산, 저장, route, dependency와 앱 간 상태 소유권을 변경하지 않는다.
- 기존 사용자 변경 `AGENTS.md`, `package-lock.json`과 별도 `.planning` 변경을 덮어쓰거나 작업 커밋에 포함하지 않는다.

---

### Task 1: 공통 AppShell 컴포넌트와 Main geometry 계약

**Files:**
- Create: `src/components/common/AppShell.tsx`
- Create: `tests/unit/components/AppShell.test.tsx`
- Modify: `src/styles/app-foundation.css`

**Interfaces:**
- Consumes: `JourneyApp` from `src/journey/routes.ts`, `AppLauncher` from `src/journey/ui/AppLauncher.tsx`
- Produces: `AppShell({ currentApp, managementMenu, showLauncher = true, children }: AppShellProps)`
- Produces: `.app-shell`, `.app-shell__launcher-frame`

- [ ] **Step 1: AppShell rendering 계약 실패 테스트 작성**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../../src/components/common/AppShell';

afterEach(cleanup);

describe('AppShell', () => {
  it('renders the shared launcher frame and content', () => {
    render(<AppShell currentApp="main"><main>내용</main></AppShell>);
    expect(screen.getByTestId('app-shell')).toHaveClass('app-shell');
    expect(screen.getByTestId('app-shell-launcher')).toHaveClass('app-shell__launcher-frame');
    expect(screen.getByRole('link', { name: /자금 흐름/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toHaveTextContent('내용');
  });

  it('omits the launcher and empty frame in focused flows', () => {
    render(<AppShell currentApp="main" showLauncher={false}><main>설정</main></AppShell>);
    expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npx vitest run tests/unit/components/AppShell.test.tsx
```

Expected: FAIL because `src/components/common/AppShell` does not exist.

- [ ] **Step 3: 최소 AppShell 구현**

```tsx
import type { ReactNode } from 'react';
import { AppLauncher } from '../../journey/ui/AppLauncher';
import type { JourneyApp } from '../../journey/routes';

export interface AppShellProps {
  currentApp: JourneyApp;
  managementMenu?: ReactNode;
  showLauncher?: boolean;
  children: ReactNode;
}

export function AppShell({
  currentApp,
  managementMenu,
  showLauncher = true,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell" data-testid="app-shell">
      {showLauncher ? (
        <div className="app-shell__launcher-frame" data-testid="app-shell-launcher">
          <AppLauncher currentApp={currentApp} managementMenu={managementMenu} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
```

`app-foundation.css`:

```css
.app-shell {
  min-height: 100dvh;
  color: var(--ink);
}

.app-shell__launcher-frame {
  box-sizing: border-box;
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding: 20px 20px 0;
}

@media (min-width: 640px) {
  .app-shell__launcher-frame { padding-inline: 32px; }
}
```

`.app-shell`에는 background를 지정하지 않는다.

- [ ] **Step 4: GREEN 확인**

```bash
npx vitest run tests/unit/components/AppShell.test.tsx tests/unit/journey/AppLauncher.test.tsx
npm run check
```

Expected: AppShell와 launcher unit PASS, TypeScript PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/common/AppShell.tsx src/styles/app-foundation.css tests/unit/components/AppShell.test.tsx
git commit -m "feat(ui): add main-aligned app shell"
```

---

### Task 2: Main과 Account Map을 AppShell로 이동

**Files:**
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/journey/ReadinessApp.test.tsx`

**Interfaces:**
- Consumes: Task 1 `AppShell`
- Preserves: Main setup launcher 숨김, Main management menu, Account Map readiness·management contract

- [ ] **Step 1: shared shell 사용 실패 테스트 추가**

Main dashboard test:

```tsx
expect(screen.getByTestId('app-shell')).toBeInTheDocument();
expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
```

Main setup test:

```tsx
expect(screen.getByTestId('app-shell')).toBeInTheDocument();
expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
```

Account Map readiness test:

```tsx
expect(screen.getByTestId('app-shell')).toBeInTheDocument();
expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
```

- [ ] **Step 2: RED 확인**

```bash
npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/journey/ReadinessApp.test.tsx
```

Expected: FAIL because current wrappers do not render `.app-shell`.

- [ ] **Step 3: Main·Readiness 최소 이동**

- `MainAppShell`의 private wrapper 구현을 제거하고 공통 `AppShell`을 사용한다.
- dashboard/recovery는 `currentApp="main"`, management menu 전달.
- setup/restart setup은 `showLauncher={false}`.
- `ReadinessApp`의 launcher와 outer wrapper를 `AppShell currentApp="account-map"`으로 교체한다.
- readiness content class, copy와 management menu는 유지한다.

- [ ] **Step 4: GREEN과 focused E2E 확인**

```bash
npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/journey/ReadinessApp.test.tsx
npx playwright test tests/main-react.spec.ts tests/app-journey.spec.ts --reporter=list
```

Expected: unit와 Main/journey E2E PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/main/ui/MainApp.tsx src/journey/ui/ReadinessApp.tsx tests/unit/main/MainApp.test.tsx tests/unit/journey/ReadinessApp.test.tsx
git commit -m "refactor(ui): share main and readiness shell"
```

---

### Task 3: Simulation과 Portfolio를 AppShell로 이동

**Files:**
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`

**Interfaces:**
- Consumes: Task 1 `AppShell`
- Preserves: Simulation/Portfolio management, recovery, onboarding/result, content width and visualization
- Removes: `.portfolio-launcher`, shell-level solid backgrounds, launcher-positioning shell padding

- [ ] **Step 1: 공통 shell·background 실패 테스트 추가**

Simulation과 Portfolio ready/recovery unit에 추가:

```tsx
expect(screen.getByTestId('app-shell')).toBeInTheDocument();
expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
```

source architecture guard:

```ts
expect(simulationCss).not.toMatch(/\.simulation-shell[^}]*background:/s);
expect(portfolioCss).not.toMatch(/\.portfolio-shell[^}]*background:/s);
expect(portfolioSource).not.toContain('portfolio-launcher');
```

- [ ] **Step 2: RED 확인**

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/simulation/sharedComponents.test.ts
```

Expected: FAIL because the apps still own launcher wrappers/background.

- [ ] **Step 3: Simulation·Portfolio 최소 이동**

- 두 앱의 정상·recovery root를 `AppShell`로 감싼다.
- 앱의 `<main>`은 content semantics와 app-specific class를 유지한다.
- Simulation shell에서 page background를 제거하고 launcher 위치를 만들던 outer padding을 content 쪽으로 제한한다.
- Portfolio shell의 background와 hard-coded `#0f172a` color를 제거한다.
- `.portfolio-launcher` markup과 CSS를 제거한다.
- content max-width `70rem`·`72rem`, margin, graph/donut/table 규칙은 유지한다.

- [ ] **Step 4: GREEN 확인**

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/simulation/sharedComponents.test.ts
npx playwright test tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list
```

Expected: unit, Simulation 390/768/desktop, Portfolio 390/768/desktop PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/simulation/ui/SimulationApp.tsx src/simulation/ui/simulation.css src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css tests/unit/simulation/SimulationApp.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/simulation/sharedComponents.test.ts
git commit -m "refactor(ui): share simulation and portfolio shell"
```

---

### Task 4: 네 경로 geometry·canvas 회귀 검증

**Files:**
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: `.app-shell`, `.app-shell__launcher-frame`
- Produces: cross-route geometry and canvas contract at 390px, 768px, 1280px

- [ ] **Step 1: cross-route Playwright 계약 추가**

Main data와 각 상세 앱 상태를 seed한 뒤 각 viewport에서 네 route를 순회한다.

```ts
const geometries = [];
for (const route of ['apps/main/', 'apps/simulation/', 'apps/portfolio/', 'apps/account-map/']) {
  await page.goto(route);
  const frame = page.getByTestId('app-shell-launcher');
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  geometries.push({ x: box!.x, y: box!.y, width: box!.width });
  expect(await page.getByTestId('app-shell').evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundImage))
    .not.toBe('none');
}
expect(new Set(geometries.map((value) => JSON.stringify(value))).size).toBe(1);
```

viewport별 expected frame:

- 390px: `x=0`, `width=390`; launcher content begins at 20px through frame padding.
- 768px: `x=0`, `width=768`; launcher content begins at 32px.
- 1280px: `x=40`, `width=1200`; launcher content begins at 72px.

frame 자체보다 실제 `.journey-launcher` bounding box도 비교해 padding 계약을 검증한다.

- [ ] **Step 2: RED 확인**

```bash
npx playwright test tests/app-journey.spec.ts --grep "shares Main launcher geometry" --reporter=list
```

Expected: FAIL before all routes use common shell or while solid backgrounds remain.

- [ ] **Step 3: geometry 차이가 있으면 AppShell CSS만 최소 조정**

- 앱별 content CSS를 바꾸지 않는다.
- launcher frame은 Task 1의 `box-sizing: border-box` 계약을 유지한다.
- background assertion 실패 시 앱 root의 page-level background 선언만 제거한다.

- [ ] **Step 4: focused·전체 검증**

```bash
npm run check
npm run test:unit
npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list
npm run test:e2e -- --reporter=dot
git diff --check
```

Expected: TypeScript PASS, unit failures 0, full E2E unexpected/flaky 0, whitespace errors 0.

- [ ] **Step 5: 커밋**

```bash
git add tests/app-journey.spec.ts tests/main-react.spec.ts src/styles/app-foundation.css
git commit -m "test(ui): lock shared app shell geometry"
```
