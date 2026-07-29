# App Journey Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main을 홈으로 유지하며 신규 준비 화면까지 `Main → Simulation → Portfolio` 진입 흐름을 만들고 기존 동명 앱을 정상 런타임에서 격리한다.

**Architecture:** `src/journey`가 버전이 있는 최소 스냅샷, 전용 브라우저 저장소, 공통 런처와 준비 화면을 소유한다. Main은 적용된 데이터에서 월 투자 가능액을 계산해 스냅샷을 저장한 뒤 신규 Simulation 엔트리로 이동하며, 준비 화면은 같은 계약을 검증해 Portfolio까지 전달한다. 기존 `apps/*` URL은 유지하되 HTML 엔트리를 신규 React 코드로 교체하여 북마크와 PWA 경로를 보존하고 레거시 JavaScript를 번들에서 제외한다.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5 MPA, Tailwind CSS 4, Vitest, Testing Library, Playwright, vite-plugin-pwa

## Global Constraints

- Main은 현재 제품 기준선이자 기본 홈이다.
- Simulation, Portfolio, Account Map은 모두 신규 개발 예정이며 이번 범위에서는 준비 상태다.
- `JourneySnapshot.version`은 `1`이다.
- 금액 단위는 원이며 시각 단위는 Unix epoch millisecond다.
- 앱 간 계약에는 계좌, 상세 소비, 저축 상품, 종목 또는 사용자 식별 정보를 넣지 않는다.
- 신규 코드는 `apps/*` 레거시 JavaScript, `CompatibilityBridge`, 레거시 전역 객체와 레거시 저장 키를 참조하지 않는다.
- 기존 레거시 파일은 이번 작업에서 삭제하지 않는다.
- `/apps/main/`, `/apps/simulation/`, `/apps/portfolio/`, `/apps/account-map/` URL은 유지한다.
- 390px 화면에서 가로 overflow가 없어야 하며 터치 대상은 최소 44px이다.
- 상세 앱 요구사항 명세 전에는 계산·편집·독립 저장 기능을 준비 화면에 추가하지 않는다.

---

## File Structure

### 신규 파일

- `src/journey/domain/journeySnapshot.ts`: 계약 타입, 생성, 런타임 검증
- `src/journey/infrastructure/journeyRepository.ts`: 신규 전용 localStorage 읽기·쓰기
- `src/journey/routes.ts`: base URL에 안전한 앱 경로 생성
- `src/journey/ui/AppLauncher.tsx`: 네 목적지와 상태를 표시하는 공통 런처
- `src/journey/ui/JourneyEntryCard.tsx`: Main의 비활성·활성 Simulation CTA
- `src/journey/ui/ReadinessApp.tsx`: Simulation 및 Portfolio 준비 화면
- `src/journey/simulation.tsx`: 신규 Simulation React 엔트리
- `src/journey/portfolio.tsx`: 신규 Portfolio React 엔트리
- `src/journey/accountMap.tsx`: 신규 Account Map React 준비 엔트리
- `src/journey/ui/journey.css`: 런처, CTA, 준비 화면의 최소 공통 스타일
- `tests/unit/journey/journeySnapshot.test.ts`: 계약 생성·검증
- `tests/unit/journey/journeyRepository.test.ts`: 저장 성공·실패·손상 복구
- `tests/unit/journey/routes.test.ts`: 배포 base URL 경로
- `tests/unit/journey/AppLauncher.test.tsx`: 상태·접근성·모바일 메뉴
- `tests/unit/journey/JourneyEntryCard.test.tsx`: 최초 사용자와 적용 사용자 CTA
- `tests/unit/journey/ReadinessApp.test.tsx`: 정상·없음·손상·0원·적자 상태
- `tests/app-journey.spec.ts`: 실제 MPA 진입 흐름과 모바일 회귀
- `tests/unit/main/pwaRoutes.test.ts`: 신규 엔트리만 허용하는 PWA 경로 회귀 보강

### 수정 파일

- `src/main/ui/MainApp.tsx`: 모든 Main 상태에 런처 배치, 활성 CTA의 스냅샷 저장 처리
- `src/main/ui/dashboard/SummaryDashboard.tsx`: 대시보드 여정 CTA 슬롯
- `tests/unit/main/MainApp.test.tsx`: 적용 데이터 기반 연결과 저장 실패
- `tests/unit/main/SummaryDashboard.test.tsx`: 대시보드 CTA 렌더링
- `apps/simulation/index.html`: 레거시 DOM을 신규 React root와 엔트리로 교체
- `apps/portfolio/index.html`: 레거시 DOM을 신규 React root와 엔트리로 교체
- `apps/account-map/index.html`: 레거시 DOM을 신규 React root와 엔트리로 교체
- `vite.config.ts`: 동일 URL의 신규 React 엔트리만 빌드하도록 유지·검증
- `src/main/infrastructure/pwaRoutes.ts`: 네 신규 MPA 목적지의 NetworkFirst 경로 유지

---

### Task 1: JourneySnapshot 계약과 저장소

**Files:**

- Create: `src/journey/domain/journeySnapshot.ts`
- Create: `src/journey/infrastructure/journeyRepository.ts`
- Test: `tests/unit/journey/journeySnapshot.test.ts`
- Test: `tests/unit/journey/journeyRepository.test.ts`

**Interfaces:**

- Consumes: `MainData`, `calculateCashflow(MainData)`
- Produces: `JourneySnapshot`, `createMainJourneySnapshot(data, now)`, `createPortfolioJourneySnapshot(snapshot, now)`, `parseJourneySnapshot(value)`, `JourneyRepository`, `BrowserJourneyRepository`

- [ ] **Step 1: 계약의 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import {
  createMainJourneySnapshot,
  createPortfolioJourneySnapshot,
  parseJourneySnapshot,
} from '../../../src/journey/domain/journeySnapshot';

describe('JourneySnapshot', () => {
  it('creates the Main to Simulation summary without detailed Main fields', () => {
    const snapshot = createMainJourneySnapshot({
      schemaVersion: 2,
      updatedAt: 10,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    }, 20);

    expect(snapshot).toEqual({
      version: 1,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: 1_100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    });
    expect(snapshot).not.toHaveProperty('monthlyNetIncomeWon');
  });

  it('preserves the amount and Main timestamp for Portfolio', () => {
    const source = parseJourneySnapshot({
      version: 1,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: -100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    });
    expect(createPortfolioJourneySnapshot(source!, 30)).toEqual({
      version: 1,
      sourceApp: 'simulation',
      sourceView: 'simulation-readiness',
      destinationApp: 'portfolio',
      monthlyInvestableAmountWon: -100_000,
      mainUpdatedAt: 10,
      createdAt: 30,
    });
  });

  it.each([
    null,
    {},
    { version: 2 },
    { version: 1, monthlyInvestableAmountWon: Number.NaN },
    { version: 1, monthlyInvestableAmountWon: 1.5 },
  ])('rejects invalid input %#', (value) => {
    expect(parseJourneySnapshot(value)).toBeNull();
  });
});
```

월 투자 가능액 공식은 `monthlyNetIncomeWon - monthlyHousingWon - monthlyLivingWon - monthlySavingWon`이다. 현재 월 투자액과 아직 배정하지 않은 잔액을 합친 값이며 적자면 음수다.

- [ ] **Step 2: 계약 테스트가 실패하는지 확인**

Run: `npx vitest run tests/unit/journey/journeySnapshot.test.ts`

Expected: FAIL with module resolution error for `journeySnapshot`.

- [ ] **Step 3: 최소 계약 구현**

```ts
import type { MainData } from '../../main/domain/model';

export const JOURNEY_SNAPSHOT_VERSION = 1 as const;

export type JourneySnapshot =
  | {
      version: 1;
      sourceApp: 'main';
      sourceView: 'dashboard';
      destinationApp: 'simulation';
      monthlyInvestableAmountWon: number;
      mainUpdatedAt: number;
      createdAt: number;
    }
  | {
      version: 1;
      sourceApp: 'simulation';
      sourceView: 'simulation-readiness';
      destinationApp: 'portfolio';
      monthlyInvestableAmountWon: number;
      mainUpdatedAt: number;
      createdAt: number;
    };

export function createMainJourneySnapshot(data: MainData, now = Date.now()): JourneySnapshot {
  return {
    version: JOURNEY_SNAPSHOT_VERSION,
    sourceApp: 'main',
    sourceView: 'dashboard',
    destinationApp: 'simulation',
    monthlyInvestableAmountWon:
      data.monthlyNetIncomeWon
      - data.monthlyHousingWon
      - data.monthlyLivingWon
      - data.monthlySavingWon,
    mainUpdatedAt: data.updatedAt,
    createdAt: now,
  };
}
```

`parseJourneySnapshot`은 정확한 source/destination 조합, 유한한 안전 정수 금액, 음수가 아닌 안전 정수 timestamp를 모두 확인한다. `createPortfolioJourneySnapshot`은 금액과 `mainUpdatedAt`만 보존하고 source와 destination을 교체한다.

- [ ] **Step 4: 저장소 실패 테스트 작성**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserJourneyRepository,
  JOURNEY_STORAGE_KEY,
} from '../../../src/journey/infrastructure/journeyRepository';

beforeEach(() => localStorage.clear());

describe('BrowserJourneyRepository', () => {
  it('round-trips one valid snapshot through its dedicated key', () => {
    const repository = new BrowserJourneyRepository();
    const snapshot = {
      version: 1 as const,
      sourceApp: 'main' as const,
      sourceView: 'dashboard' as const,
      destinationApp: 'simulation' as const,
      monthlyInvestableAmountWon: 1_100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    };
    repository.save(snapshot);
    expect(repository.load()).toEqual({ status: 'found', snapshot });
    expect(JOURNEY_STORAGE_KEY).toBe('isf-journey-snapshot-v1');
  });

  it('returns invalid for malformed storage without throwing', () => {
    localStorage.setItem(JOURNEY_STORAGE_KEY, '{broken');
    expect(new BrowserJourneyRepository().load()).toEqual({ status: 'invalid' });
  });
});
```

`load()` 반환 타입은 `{ status: 'found'; snapshot: JourneySnapshot } | { status: 'empty' } | { status: 'invalid' }`로 고정한다.

- [ ] **Step 5: 저장소 테스트 실패 확인 후 구현**

Run: `npx vitest run tests/unit/journey/journeyRepository.test.ts`

Expected: FAIL because `journeyRepository` does not exist.

`BrowserJourneyRepository.save()`은 `localStorage.setItem` 실패를 삼키지 않는다. 호출 화면이 탐색을 중단하고 오류를 표시할 수 있도록 원래 오류를 전파한다. `load()`는 JSON 파싱 또는 계약 검증 실패를 `{ status: 'invalid' }`로 변환한다.

- [ ] **Step 6: 계약과 저장소 테스트 통과 확인**

Run: `npx vitest run tests/unit/journey/journeySnapshot.test.ts tests/unit/journey/journeyRepository.test.ts`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/journey/domain/journeySnapshot.ts src/journey/infrastructure/journeyRepository.ts tests/unit/journey/journeySnapshot.test.ts tests/unit/journey/journeyRepository.test.ts
git commit -m "feat(journey): add snapshot contract"
```

---

### Task 2: 배포 경로와 공통 앱 런처

**Files:**

- Create: `src/journey/routes.ts`
- Create: `src/journey/ui/AppLauncher.tsx`
- Create: `src/journey/ui/journey.css`
- Test: `tests/unit/journey/routes.test.ts`
- Test: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**

- Consumes: Vite `import.meta.env.BASE_URL`
- Produces: `appPath(app)`, `AppLauncher({ currentApp })`

- [ ] **Step 1: 경로와 런처 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import { appPath } from '../../../src/journey/routes';

describe('appPath', () => {
  it('keeps every destination under the configured base', () => {
    expect(appPath('main', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(appPath('simulation', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/simulation/');
  });
});
```

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(cleanup);

describe('AppLauncher', () => {
  it('marks Main current and every future app readying', () => {
    render(<AppLauncher currentApp="main" />);
    expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Main.*사용 중/ })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Simulation 준비 중', 'Portfolio 준비 중', 'Account Map 준비 중']) {
      expect(screen.getByText(name)).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/journey/routes.test.ts tests/unit/journey/AppLauncher.test.tsx`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: 최소 경로와 런처 구현**

`appPath`는 `'main' | 'simulation' | 'portfolio' | 'account-map'`만 받고 base의 앞뒤 slash를 정규화한다. `AppLauncher`는 `<nav aria-label="ISF 앱">` 안에 네 링크를 렌더링한다. 현재 앱 링크에 `aria-current="page"`와 `사용 중`, 나머지 링크에 `준비 중` 텍스트를 함께 표시한다.

모바일은 CSS로 768px 미만에서 `<details>` 기반 축약 메뉴를 사용하고, 데스크톱은 네 링크를 가로로 표시한다. 두 표현을 동시에 DOM에 중복하지 않고 동일 `<details>`를 breakpoint에 따라 열린 형태처럼 배치하여 중복 접근성 이름을 피한다.

- [ ] **Step 4: 스타일 구현**

`src/journey/ui/journey.css`에 다음 계약을 둔다.

```css
.journey-launcher a,
.journey-launcher summary,
.journey-action {
  min-height: 44px;
}

.journey-launcher {
  min-width: 0;
}

@media (min-width: 768px) {
  .journey-launcher summary {
    display: none;
  }

  .journey-launcher details > ul {
    display: flex;
  }
}
```

나머지 색상과 surface는 `src/styles/globals.css`와 기존 `ui-button`, Tailwind 토큰을 재사용한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/journey/routes.test.ts tests/unit/journey/AppLauncher.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/journey/routes.ts src/journey/ui/AppLauncher.tsx src/journey/ui/journey.css tests/unit/journey/routes.test.ts tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): add shared app launcher"
```

---

### Task 3: 신규 준비 화면

**Files:**

- Create: `src/journey/ui/ReadinessApp.tsx`
- Create: `src/journey/simulation.tsx`
- Create: `src/journey/portfolio.tsx`
- Create: `src/journey/accountMap.tsx`
- Test: `tests/unit/journey/ReadinessApp.test.tsx`

**Interfaces:**

- Consumes: `JourneyRepository.load()`, `createPortfolioJourneySnapshot`, `appPath`, `AppLauncher`
- Produces: `ReadinessApp({ destination, repository?, now?, navigate? })`

- [ ] **Step 1: 준비 화면 실패 테스트 작성**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessApp } from '../../../src/journey/ui/ReadinessApp';

afterEach(cleanup);

const validMainSnapshot = {
  version: 1 as const,
  sourceApp: 'main' as const,
  sourceView: 'dashboard' as const,
  destinationApp: 'simulation' as const,
  monthlyInvestableAmountWon: 1_100_000,
  mainUpdatedAt: 10,
  createdAt: 20,
};

describe('ReadinessApp', () => {
  it('shows a connected negative amount without treating it as an error', () => {
    render(<ReadinessApp destination="simulation" repository={{
      load: () => ({
        status: 'found',
        snapshot: {
          version: 1,
          sourceApp: 'main',
          sourceView: 'dashboard',
          destinationApp: 'simulation',
          monthlyInvestableAmountWon: -100_000,
          mainUpdatedAt: 10,
          createdAt: 20,
        },
      }),
      save: vi.fn(),
    }} />);
    expect(screen.getByRole('status')).toHaveTextContent('연결되었습니다');
    expect(screen.getByText('월 투자 가능액 -10만 원')).toBeVisible();
  });

  it.each([
    [{ status: 'empty' as const }, 'Main에서 계획을 먼저 완성해 주세요'],
    [{ status: 'invalid' as const }, '연결 정보를 확인하지 못했습니다'],
  ])('offers Main recovery for %o', (result, message) => {
    render(<ReadinessApp destination="simulation" repository={{
      load: () => result,
      save: vi.fn(),
    }} />);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main으로 이동' })).toHaveAttribute('href', expect.stringContaining('/apps/main/'));
  });

  it('saves the Portfolio handoff before navigation', () => {
    const save = vi.fn();
    const navigate = vi.fn();
    render(<ReadinessApp destination="simulation" now={() => 30} navigate={navigate} repository={{
      load: () => ({ status: 'found', snapshot: validMainSnapshot }),
      save,
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Portfolio로 이어가기' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      sourceApp: 'simulation',
      destinationApp: 'portfolio',
      createdAt: 30,
    }));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/apps/portfolio/'));
  });
});
```

같은 파일에 다음 경계 테스트를 작성한다.

```tsx
it('accepts zero as a connected amount', () => {
  render(<ReadinessApp destination="simulation" repository={{
    load: () => ({
      status: 'found',
      snapshot: { ...validMainSnapshot, monthlyInvestableAmountWon: 0 },
    }),
    save: vi.fn(),
  }} />);
  expect(screen.getByRole('status')).toHaveTextContent('연결되었습니다');
  expect(screen.getByText('월 투자 가능액 0원')).toBeVisible();
});

it('rejects a snapshot for another destination', () => {
  render(<ReadinessApp destination="portfolio" repository={{
    load: () => ({ status: 'found', snapshot: validMainSnapshot }),
    save: vi.fn(),
  }} />);
  expect(screen.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
});

it('stops navigation when the Portfolio handoff cannot be saved', () => {
  const navigate = vi.fn();
  render(<ReadinessApp destination="simulation" navigate={navigate} repository={{
    load: () => ({ status: 'found', snapshot: validMainSnapshot }),
    save: () => { throw new Error('quota'); },
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Portfolio로 이어가기' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Main 데이터는 변경되지 않았습니다');
  expect(navigate).not.toHaveBeenCalled();
});

it('does not load journey data for Account Map', () => {
  const load = vi.fn();
  render(<ReadinessApp destination="account-map" repository={{ load, save: vi.fn() }} />);
  expect(screen.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
  expect(load).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/journey/ReadinessApp.test.tsx`

Expected: FAIL because `ReadinessApp` is missing.

- [ ] **Step 3: 최소 준비 화면 구현**

`ReadinessApp`은 `destination: 'simulation' | 'portfolio' | 'account-map'`을 받는다.

- Simulation은 `destinationApp === 'simulation'`인 스냅샷만 연결 성공으로 인정한다.
- Portfolio는 `destinationApp === 'portfolio'`인 스냅샷만 인정한다.
- Account Map은 이번 범위에서 스냅샷을 읽지 않는다.
- 금액 표시는 기존 `formatDashboardWon`을 재사용하지 않고 `src/journey`에 작은 원화 formatter를 두어 Main UI에 역의존하지 않는다.
- Simulation의 다음 버튼만 저장을 수행한다.
- 저장 예외 발생 시 `연결 정보를 저장하지 못했습니다. Main 데이터는 변경되지 않았습니다.`를 표시하고 이동하지 않는다.
- 모든 화면에 `AppLauncher`와 Main 복구 링크를 둔다.

- [ ] **Step 4: 엔트리 파일 구현**

각 엔트리는 `StrictMode`, `MainErrorBoundary`, `ReadinessApp`, `journey.css`를 사용한다. `simulation.tsx`, `portfolio.tsx`, `accountMap.tsx`는 destination prop만 다르다.

```tsx
createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <ReadinessApp destination="simulation" />
    </MainErrorBoundary>
  </StrictMode>,
);
```

각 엔트리는 `registerSW({ immediate: true })`를 호출한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/journey/ReadinessApp.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/journey/ui/ReadinessApp.tsx src/journey/simulation.tsx src/journey/portfolio.tsx src/journey/accountMap.tsx tests/unit/journey/ReadinessApp.test.tsx
git commit -m "feat(journey): add readiness screens"
```

---

### Task 4: 레거시 라우트 격리

**Files:**

- Modify: `apps/simulation/index.html`
- Modify: `apps/portfolio/index.html`
- Modify: `apps/account-map/index.html`
- Modify: `vite.config.ts`
- Modify: `src/main/infrastructure/pwaRoutes.ts`
- Modify: `tests/unit/main/pwaRoutes.test.ts`
- Create: `tests/unit/journey/entryIsolation.test.ts`

**Interfaces:**

- Consumes: Task 3의 세 React 엔트리
- Produces: 기존 URL에서 신규 준비 화면만 로드하는 MPA 빌드

- [ ] **Step 1: 격리 실패 테스트 작성**

`tests/unit/journey/entryIsolation.test.ts`는 세 HTML 파일을 문자열로 읽어 다음을 검증한다.

```ts
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it.each([
  ['simulation', '../../src/journey/simulation.tsx'],
  ['portfolio', '../../src/journey/portfolio.tsx'],
  ['account-map', '../../src/journey/accountMap.tsx'],
])('%s loads only its new React entry', async (app, entry) => {
  const html = await readFile(new URL(`../../../apps/${app}/index.html`, import.meta.url), 'utf8');
  expect(html).toContain('<div id="root"></div>');
  expect(html).toContain(`src="${entry}"`);
  expect(html).not.toMatch(/shared\/|modules\/|src\/entries\//);
  expect(html).not.toContain('<app-header');
  expect(html).not.toContain('<data-hub-modal');
});
```

`pwaRoutes.test.ts`에는 Main, Simulation, Portfolio, Account Map URL이 일치하고 다른 `apps/legacy/` URL은 일치하지 않는 표 기반 테스트를 추가한다.

- [ ] **Step 2: 격리 테스트 실패 확인**

Run: `npx vitest run tests/unit/journey/entryIsolation.test.ts tests/unit/main/pwaRoutes.test.ts`

Expected: FAIL because current HTML contains legacy entry scripts and DOM.

- [ ] **Step 3: 세 HTML을 최소 신규 shell로 교체**

각 HTML은 locale, viewport, 해당 목적지 title/description, manifest/icon, `<div id="root"></div>`, 하나의 신규 React module script만 보존한다. 레거시 custom element, stylesheet, inline DOM과 script를 모두 제거한다.

- [ ] **Step 4: Vite와 PWA 입력 확인**

`vite.config.ts`의 MPA input key와 URL은 유지한다. HTML이 신규 엔트리를 가리키므로 별도 alias나 레거시 entry를 추가하지 않는다. `createMpaNavigationCaching` 정규식은 네 목적지만 허용하고 테스트로 이를 고정한다.

- [ ] **Step 5: 정적 격리와 빌드 검증**

Run:

```bash
npx vitest run tests/unit/journey/entryIsolation.test.ts tests/unit/main/pwaRoutes.test.ts
npx vite build
rg -n "src/entries/step2|src/entries/account-map|apps/(simulation|portfolio|account-map)/(app|modules|styles)" dist
```

Expected:

- Vitest PASS.
- Vite build exits 0.
- final `rg` exits 1 with no matches.

`npm run build`는 버전 파일을 변경하므로 이 검증에서는 사용하지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add apps/simulation/index.html apps/portfolio/index.html apps/account-map/index.html vite.config.ts src/main/infrastructure/pwaRoutes.ts tests/unit/main/pwaRoutes.test.ts tests/unit/journey/entryIsolation.test.ts
git commit -m "refactor(apps): isolate legacy entrypoints"
```

---

### Task 5: Main 런처와 Simulation CTA

**Files:**

- Create: `src/journey/ui/JourneyEntryCard.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Test: `tests/unit/journey/JourneyEntryCard.test.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`

**Interfaces:**

- Consumes: `AppLauncher`, `JourneyEntryCard`, `createMainJourneySnapshot`, `JourneyRepository`, `appPath('simulation')`
- Produces: `MainApp({ repository?, journeyRepository?, navigate?, now? })`

- [ ] **Step 1: CTA 컴포넌트 실패 테스트 작성**

```tsx
it('keeps the CTA visible but disabled before a Main plan exists', () => {
  render(<JourneyEntryCard enabled={false} onContinue={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
  expect(screen.getByText('Main 계획을 먼저 입력해 주세요.')).toBeVisible();
});

it('enables the CTA after a Main plan exists', () => {
  const onContinue = vi.fn();
  render(<JourneyEntryCard enabled onContinue={onContinue} />);
  fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));
  expect(onContinue).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Main 통합 실패 테스트 작성**

`MainApp.test.tsx`의 mock `SummaryDashboard`가 `journeyEntry`를 렌더링하게 확장하고 다음을 검증한다.

```tsx
it('stores the applied Main summary before opening Simulation', async () => {
  const save = vi.fn();
  const navigate = vi.fn();
  render(<MainApp
    repository={repository({ status: 'current', data: data(3_000_000), original: null })}
    journeyRepository={{ load: vi.fn(), save }}
    navigate={navigate}
    now={() => 50}
  />);
  await screen.findByRole('heading', { name: 'dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    sourceApp: 'main',
    destinationApp: 'simulation',
    createdAt: 50,
  }));
  expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/apps/simulation/'));
});
```

같은 파일에 다음 통합 테스트를 작성한다.

```tsx
it('shows the launcher and disabled CTA during first setup', async () => {
  render(<MainApp repository={repository({ status: 'empty', data: null, original: null })} />);
  await screen.findByRole('heading', { name: 'setup:welcome' });
  expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
});

it('does not navigate when journey storage fails', async () => {
  const navigate = vi.fn();
  render(<MainApp
    repository={repository({ status: 'current', data: data(3_000_000), original: null })}
    journeyRepository={{ load: vi.fn(), save: () => { throw new Error('quota'); } }}
    navigate={navigate}
  />);
  await screen.findByRole('heading', { name: 'dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Main 계획은 변경되지 않았습니다');
  expect(navigate).not.toHaveBeenCalled();
});

it('stores a negative investable amount for an applied deficit plan', async () => {
  const save = vi.fn();
  render(<MainApp
    repository={repository({
      status: 'current',
      data: data(1_000_000, {
        monthlyHousingWon: 800_000,
        monthlyLivingWon: 500_000,
        monthlySavingWon: 100_000,
      }),
      original: null,
    })}
    journeyRepository={{ load: vi.fn(), save }}
    navigate={vi.fn()}
  />);
  await screen.findByRole('heading', { name: 'dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    monthlyInvestableAmountWon: -400_000,
  }));
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run tests/unit/journey/JourneyEntryCard.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx`

Expected: FAIL because CTA and injected journey dependencies are missing.

- [ ] **Step 4: CTA와 Main 통합 구현**

`MainAppProps`를 다음과 같이 확장한다.

```ts
export interface MainAppProps {
  repository?: MainRepository;
  journeyRepository?: JourneyRepository;
  navigate?(href: string): void;
  now?(): number;
}
```

기본값은 `BrowserJourneyRepository`, `(href) => window.location.assign(href)`, `Date.now`다.

`MainApp`은 loading, recovery, setup, dashboard 모든 상태 위에 `AppLauncher currentApp="main"`을 렌더링한다. setup에는 `enabled={state.applied !== null}`을 전달한다. dashboard에는 `SummaryDashboard`의 `journeyEntry` prop으로 같은 CTA를 전달한다.

`continueToSimulation` 순서:

1. 현재 `state.applied` 존재 확인
2. `createMainJourneySnapshot(state.applied, now())`
3. `journeyRepository.save(snapshot)`
4. 성공했을 때만 `navigate(appPath('simulation'))`
5. 실패하면 `연결 정보를 저장하지 못했습니다. Main 계획은 변경되지 않았습니다.` alert 표시

- [ ] **Step 5: Main 단위 테스트 통과 확인**

Run: `npx vitest run tests/unit/journey/JourneyEntryCard.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx`

Expected: PASS.

- [ ] **Step 6: 타입 검사**

Run: `npm run check`

Expected: both TypeScript checks exit 0.

- [ ] **Step 7: 커밋**

```bash
git add src/journey/ui/JourneyEntryCard.tsx src/main/ui/MainApp.tsx src/main/ui/dashboard/SummaryDashboard.tsx tests/unit/journey/JourneyEntryCard.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx
git commit -m "feat(main): connect app journey entry"
```

---

### Task 6: 실제 흐름, 모바일, 빌드 격리 검증

**Files:**

- Create: `tests/app-journey.spec.ts`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**

- Consumes: 완성된 Main, 준비 화면, localStorage 계약, 기존 MPA URL
- Produces: 데스크톱·모바일 사용자 흐름과 격리 회귀 증거

- [ ] **Step 1: E2E 실패 테스트 작성**

```ts
import { expect, test } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: 10,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

test('connects Main through Simulation readiness to Portfolio readiness', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  await page.goto('apps/main/');

  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();

  await page.reload();
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();
  await page.getByRole('button', { name: 'Portfolio로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
});
```

같은 spec에 다음 시나리오를 실제 assertion으로 작성한다.

```ts
test('requires Main input before journey navigation', async ({ page }) => {
  await page.goto('apps/main/');
  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
});

test('recovers from missing and malformed journey storage', async ({ page }) => {
  await page.goto('apps/simulation/');
  await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('isf-journey-snapshot-v1', '{broken'));
  await page.reload();
  await expect(page.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
});

test('legacy app DOM is absent from product routes', async ({ page }) => {
  for (const app of ['simulation', 'portfolio', 'account-map']) {
    await page.goto(`apps/${app}/`);
    await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
    await expect(page.getByText('준비 중', { exact: false }).first()).toBeVisible();
  }
});
```

- [ ] **Step 2: E2E 실패 확인**

Run: `npx playwright test tests/app-journey.spec.ts --reporter=list`

Expected: FAIL before the integrated flow is present.

- [ ] **Step 3: 모바일 검증 추가**

390×844 touch context에서 다음을 검증한다.

```ts
test.describe('mobile app journey', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps launcher and CTA usable without horizontal overflow', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }, appliedMain);
    await page.goto('apps/main/');
    const action = page.getByRole('button', { name: 'Simulation으로 이어가기' });
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    await action.tap();
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
});
```

- [ ] **Step 4: focused E2E 통과 확인**

Run: `npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts --reporter=list`

Expected: PASS.

- [ ] **Step 5: 전체 검증**

Run:

```bash
npm run check
npm run test:unit
npx playwright test --reporter=list
npx vite build
rg -n "src/entries/step2|src/entries/account-map|apps/(simulation|portfolio|account-map)/(app|modules|styles)" dist
git diff --check
```

Expected:

- TypeScript checks PASS.
- 전체 Vitest PASS.
- 전체 Playwright PASS.
- Vite build PASS.
- `rg` exits 1 with no legacy runtime matches.
- `git diff --check` exits 0.

- [ ] **Step 6: 커밋**

```bash
git add tests/app-journey.spec.ts tests/main-react.spec.ts
git commit -m "test(journey): cover connected app entry"
```

---

## 완료 후 검토

구현 완료 후 `superpowers:requesting-code-review`로 다음을 확인한다.

- 승인된 설계의 모든 완료 기준 충족
- 월 투자 가능액 공식과 음수 처리 일관성
- Main 저장 실패와 journey 저장 실패의 분리
- 신규 엔트리의 레거시 runtime 참조 부재
- 키보드, 390px touch target, overflow
- URL base가 GitHub Pages와 개발 서버에서 모두 정확함

리뷰 수정 후 `superpowers:verification-before-completion`을 실행하고 `superpowers:finishing-a-development-branch`로 통합 방식을 결정한다. Orca 워크트리는 사용자 승인 없이 삭제하지 않는다.
