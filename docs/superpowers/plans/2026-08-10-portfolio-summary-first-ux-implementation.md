# Portfolio Summary-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portfolio를 기본 금액 숨김, `안정 N%` 요약, 비례 목록, 성장·안정 분류를 갖춘 summary-first 경험으로 변경합니다.

**Architecture:** 기존 Portfolio의 Main 읽기 전용 adapter와 draft/apply 상태 경계를 유지합니다. 배분 schema v2는 항목 분류를 소유하고 기존 v1 Portfolio 저장값과 분리해 새로 시작하며, 보기 설정은 배분과 분리된 localStorage repository가 소유합니다. 결과 UI는 도넛·표·tooltip을 하나의 접근 가능한 비례 목록으로 교체합니다.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5, CSS, Vitest, Testing Library, Playwright

## Global Constraints

- Main은 수정하지 않고 Portfolio는 최신 Main 투자금만 읽습니다.
- 원화 총액과 행 금액은 기본적으로 렌더링하지 않습니다.
- 현금은 항상 `안정`이며 별도 분류 control을 제공하지 않습니다.
- v1 Portfolio plan/draft는 읽거나 이관하거나 삭제하지 않습니다.
- 금·채권 관련 이름은 자동 추천일 뿐이며 사용자 지정이 항상 우선합니다.
- `ETF` 단독은 안정 추천 근거가 아닙니다.
- 결과 정렬은 표시만 변경하고 저장된 `order`와 계산을 바꾸지 않습니다.
- 모든 interactive target은 44px 이상이며 390px, 768px, desktop에서 가로 overflow가 없어야 합니다.
- 도넛, 중복 표, 큰 수정 CTA와 상시 `저장됨` 문구를 결과 화면에 남기지 않습니다.

---

## File Structure

- `src/portfolio/domain/model.ts`: schema v2, 항목 분류와 보기 설정 타입.
- `src/portfolio/domain/classification.ts`: 이름 기반 자동 추천과 안정 비중 순수 함수.
- `src/portfolio/domain/allocation.ts`: 새 항목 분류 기본값, 표시 정렬과 최대 비중 선택.
- `src/portfolio/domain/validation.ts`: strict v2 validation.
- `src/portfolio/infrastructure/portfolioRepository.ts`: v2 key만 읽고 저장하며 v1 key는 무시.
- `src/portfolio/infrastructure/portfolioPreferencesRepository.ts`: 별도 보기 설정 load/save와 invalid fallback.
- `src/portfolio/application/portfolioReducer.ts`: 분류 변경·자동 추천 복귀 action.
- `src/portfolio/application/bootstrap.ts`: v2 plan/draft 유지와 최신 Main 기반 신규 draft 생성.
- `src/journey/ui/AppManagementMenu.tsx`: menu 내부 switch/radio group을 위한 일반 control item.
- `src/portfolio/ui/PortfolioManagementMenu.tsx`: 금액 보기·정렬·reset 구성.
- `src/portfolio/ui/AllocationEditor.tsx`: 성장·안정 선택, 추천 상태, 현금 안정 표시.
- `src/portfolio/ui/PortfolioSummary.tsx`: summary-first hero와 비례 목록.
- `src/portfolio/ui/PortfolioApplyBar.tsx`: 확인 dialog의 안정·현금 요약.
- `src/portfolio/ui/PortfolioApp.tsx`: preference와 결과/오류/편집 진입 통합.
- `src/portfolio/ui/portfolio.css`: 선택 시안에 맞춘 반응형 시각 문법.
- `tests/unit/portfolio/*`: 도메인, v1 격리, preference, reducer, editor, summary, dialog 계약.
- `tests/unit/journey/AppManagementMenu.test.tsx`: 새 control item의 keyboard/focus 회귀.
- `tests/portfolio.spec.ts`: 실제 저장·편집·설정·반응형 사용자 흐름.
- `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`: Portfolio v2 상태 소유권과 인수 조건.

---

### Task 1: 성장·안정 도메인 계약

**Files:**
- Modify: `src/portfolio/domain/model.ts`
- Create: `src/portfolio/domain/classification.ts`
- Modify: `src/portfolio/domain/allocation.ts`
- Create: `tests/unit/portfolio/classification.test.ts`
- Modify: `tests/unit/portfolio/allocation.test.ts`

**Interfaces:**
- Produces: `Classification = 'growth' | 'stable'`, `ClassificationOrigin = 'automatic' | 'user'`.
- Produces: `recommendClassification(name): Classification`, `stableShareUnits(value): number`.
- Produces: `setItemClassification(draft, id, classification, origin): PortfolioDraft`.
- Produces: `orderedResultItems(items, cash, mode)`와 `largestResultItem(items)`.

- [ ] **Step 1: 분류 추천과 안정 비중의 실패 테스트를 작성합니다**

```ts
it.each([
  ['금현물', 'stable'], ['KODEX 골드 ETF', 'stable'], ['미국 국채 ETF', 'stable'],
  ['KODEX 금선물 ETF', 'stable'], ['회사채', 'stable'], ['global bond', 'stable'], ['ETF', 'growth'],
  ['금융주 ETF', 'growth'], ['예금 대안', 'growth'], ['', 'growth'],
])('recommends %s as %s', (name, expected) => {
  expect(recommendClassification(name)).toBe(expected);
});

it('adds stable items and cash using integer share units', () => {
  expect(stableShareUnits({ items: [
    item('growth', 500_000), item('stable', 250_000),
  ], cashShareUnits: 250_000 })).toBe(500_000);
});
```

- [ ] **Step 2: focused test가 새 모듈 부재로 실패하는지 확인합니다**

Run: `npx vitest run tests/unit/portfolio/classification.test.ts tests/unit/portfolio/allocation.test.ts`

Expected: FAIL — `classification.ts` 또는 새 export를 찾지 못합니다.

- [ ] **Step 3: schema v2 타입과 순수 분류 함수를 구현합니다**

```ts
export const PORTFOLIO_SCHEMA_VERSION = 2 as const;
export type Classification = 'growth' | 'stable';
export type ClassificationOrigin = 'automatic' | 'user';

export interface PortfolioItem {
  id: string;
  name: string;
  shareUnits: number;
  order: number;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
}

export function recommendClassification(name: string): Classification {
  const normalized = normalizePortfolioName(name);
  const gold = /(^|[\s_\-/])(금(현물|선물)?|골드|gold)(?=$|[\s_\-/])/.test(normalized);
  const bond = /채권|국채|회사채|(^|[\s_\-/])bond(?=$|[\s_\-/])/.test(normalized);
  return gold || bond ? 'stable' : 'growth';
}

export function stableShareUnits(value: Pick<PortfolioPlan, 'items' | 'cashShareUnits'>): number {
  return value.items
    .filter((item) => item.classification === 'stable')
    .reduce((sum, item) => sum + item.shareUnits, value.cashShareUnits);
}
```

새 항목 identity에는 `classification: 'growth'`, `classificationOrigin: 'automatic'`을 넣고, 이름 변경은 origin이 `automatic`일 때만 `recommendClassification()`을 다시 적용합니다. 표시 정렬은 `ratio`에서 `shareUnits desc, order asc`, `input`에서 `order asc`를 사용하며 현금 동률은 투자 대상 뒤에 둡니다.

- [ ] **Step 4: 도메인 테스트 통과를 확인합니다**

Run: `npx vitest run tests/unit/portfolio/classification.test.ts tests/unit/portfolio/allocation.test.ts`

Expected: PASS

- [ ] **Step 5: 도메인 변경만 커밋합니다**

```bash
git add src/portfolio/domain/model.ts src/portfolio/domain/classification.ts src/portfolio/domain/allocation.ts tests/unit/portfolio/classification.test.ts tests/unit/portfolio/allocation.test.ts
git commit -m "feat(portfolio): add allocation classification"
```

---

### Task 2: v2 저장 시작과 v1 격리

**Files:**
- Modify: `src/portfolio/domain/validation.ts`
- Modify: `src/portfolio/infrastructure/portfolioRepository.ts`
- Modify: `src/portfolio/application/bootstrap.ts`
- Modify: `tests/unit/portfolio/validation.test.ts`
- Modify: `tests/unit/portfolio/portfolioRepository.test.ts`
- Modify: `tests/unit/portfolio/bootstrap.test.ts`
- Modify: `tests/unit/portfolio/MemoryPortfolioRepository.ts`

**Interfaces:**
- Consumes: Task 1의 `PortfolioItem` v2와 분류 타입.
- Produces: `parsePortfolioPlan`·`parsePortfolioDraft`의 strict v2 결과.
- Produces: v2-only repository load와 최신 Main 기반 cash-only 신규 draft.

- [ ] **Step 1: v1 무시와 invalid v2 격리 테스트를 작성합니다**

```ts
it('ignores v1 allocation data and starts from current Main investment', () => {
  const loaded = repository.load();
  expect(loaded).toEqual({ applied: { status: 'empty' }, draft: { status: 'empty' } });
  const result = bootstrapPortfolio(foundMain(800_000), loaded, 10);
  expect(result).toMatchObject({ kind: 'ready', plan: null, draft: {
    schemaVersion: 2, items: [], cashShareUnits: 1_000_000, syncedInvestmentWon: 800_000,
  }});
});

it.each(['classification', 'classificationOrigin'])('rejects invalid v2 %s', (field) => {
  expect(parsePortfolioPlan(invalidV2(field))).toBeNull();
});
```

v1 key는 읽거나 삭제하지 않으며, malformed v2가 v1 값으로 fallback하지 않는 assertion을 포함합니다.

- [ ] **Step 2: repository/validation test가 실패하는지 확인합니다**

Run: `npx vitest run tests/unit/portfolio/validation.test.ts tests/unit/portfolio/portfolioRepository.test.ts tests/unit/portfolio/bootstrap.test.ts`

Expected: FAIL — repository가 아직 v1 key를 현재 저장값으로 읽거나 v2 타입 소비자가 갱신되지 않았습니다.

- [ ] **Step 3: strict v2 parser와 v2-only repository를 구현합니다**

```ts
const V2_APPLIED_KEY = 'isf-portfolio-allocation-v2';
const V2_DRAFT_KEY = 'isf-portfolio-allocation-draft-v2';
```

repository는 v2 key만 읽고 씁니다. v1 key는 읽거나 삭제하지 않습니다. v2가 없으면 bootstrap은 최신 Main 투자금으로 현금 100%인 새 v2 draft를 만들며, v2 invalid는 격리하고 v1으로 fallback하지 않습니다. `PortfolioApp`의 cash-only placeholder와 test fixture도 classification 필드를 가진 v2 타입으로 갱신합니다.

- [ ] **Step 4: v1 격리 test와 전체 Portfolio unit test를 실행합니다**

Run: `npx vitest run tests/unit/portfolio`

Expected: PASS

- [ ] **Step 5: migration 변경을 커밋합니다**

```bash
git add src/portfolio/domain/validation.ts src/portfolio/infrastructure/portfolioRepository.ts src/portfolio/application/bootstrap.ts tests/unit/portfolio/validation.test.ts tests/unit/portfolio/portfolioRepository.test.ts tests/unit/portfolio/bootstrap.test.ts tests/unit/portfolio/MemoryPortfolioRepository.ts
git commit -m "feat(portfolio): start fresh with v2 storage"
```

---

### Task 3: 별도 보기 설정과 관리 메뉴

**Files:**
- Modify: `src/portfolio/domain/model.ts`
- Create: `src/portfolio/infrastructure/portfolioPreferencesRepository.ts`
- Modify: `src/journey/ui/AppManagementMenu.tsx`
- Modify: `src/portfolio/ui/PortfolioManagementMenu.tsx`
- Create: `tests/unit/portfolio/portfolioPreferencesRepository.test.ts`
- Modify: `tests/unit/journey/AppManagementMenu.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioDialogs.test.tsx`

**Interfaces:**
- Produces: `PortfolioViewPreferences { showAmounts: boolean; sortMode: 'ratio' | 'input' }`.
- Produces: `PortfolioPreferencesRepository.load(): PortfolioViewPreferences`, `.save(value): PortfolioWriteResult`.
- Produces: `AppManagementItem`의 `control` variant와 Portfolio 설정 callback.

- [ ] **Step 1: preference 기본값·저장 실패·menu semantics 테스트를 작성합니다**

```ts
expect(repository.load()).toEqual({ showAmounts: false, sortMode: 'ratio' });
expect(repository.save({ showAmounts: true, sortMode: 'input' })).toEqual({ status: 'saved' });
expect(reloaded.load()).toEqual({ showAmounts: true, sortMode: 'input' });

expect(screen.getByRole('switch', { name: '금액 보기' })).not.toBeChecked();
expect(screen.getByRole('radio', { name: '비율순' })).toBeChecked();
fireEvent.click(screen.getByRole('radio', { name: '입력순' }));
expect(onPreferencesChange).toHaveBeenCalledWith({ showAmounts: false, sortMode: 'input' });
```

invalid JSON·unknown key·storage exception은 모두 기본값을 반환하며 배분 저장 오류 callback을 호출하지 않는 경우를 포함합니다.

- [ ] **Step 2: preference와 control item 부재로 test가 실패하는지 확인합니다**

Run: `npx vitest run tests/unit/portfolio/portfolioPreferencesRepository.test.ts tests/unit/journey/AppManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: FAIL

- [ ] **Step 3: 별도 repository와 공통 menu control variant를 구현합니다**

```ts
export const DEFAULT_PORTFOLIO_VIEW_PREFERENCES = {
  showAmounts: false,
  sortMode: 'ratio',
} as const;

export type AppManagementItem = ExistingItems
  | { kind: 'control'; id: string; content: ReactNode };
```

`AppManagementMenu`는 control content를 `role="group"`인 비파괴 영역으로 렌더링하고 내부 switch/radio 조작 때 popover를 닫지 않습니다. `PortfolioManagementMenu` 순서는 앱 아이콘 안내 → `보기 설정` group → separator → reset입니다.

- [ ] **Step 4: 설정과 공통 메뉴 회귀 test를 실행합니다**

Run: `npx vitest run tests/unit/portfolio/portfolioPreferencesRepository.test.ts tests/unit/journey/AppManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: PASS

- [ ] **Step 5: 보기 설정 변경을 커밋합니다**

```bash
git add src/portfolio/domain/model.ts src/portfolio/infrastructure/portfolioPreferencesRepository.ts src/journey/ui/AppManagementMenu.tsx src/portfolio/ui/PortfolioManagementMenu.tsx tests/unit/portfolio/portfolioPreferencesRepository.test.ts tests/unit/journey/AppManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
git commit -m "feat(portfolio): add view preferences"
```

---

### Task 4: 분류 편집과 적용 확인

**Files:**
- Modify: `src/portfolio/application/portfolioReducer.ts`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/PortfolioApplyBar.tsx`
- Modify: `tests/unit/portfolio/portfolioReducer.test.ts`
- Modify: `tests/unit/portfolio/AllocationEditor.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`

**Interfaces:**
- Consumes: Task 1의 추천·안정 계산 함수.
- Produces: `draft-classification-changed`와 `draft-classification-auto-enabled` reducer action.
- Produces: 항목별 `성장 / 안정` radio group과 `자동 추천 사용` action.

- [ ] **Step 1: automatic 재추천과 user override 실패 테스트를 작성합니다**

```ts
state = portfolioReducer(state, { type: 'draft-name-changed', id: 'a', name: '국채 ETF', now: 2 });
expect(state.draft.items[0]).toMatchObject({ classification: 'stable', classificationOrigin: 'automatic' });
state = portfolioReducer(state, { type: 'draft-classification-changed', id: 'a', classification: 'growth', now: 3 });
state = portfolioReducer(state, { type: 'draft-name-changed', id: 'a', name: '금현물', now: 4 });
expect(state.draft.items[0]).toMatchObject({ classification: 'growth', classificationOrigin: 'user' });
state = portfolioReducer(state, { type: 'draft-classification-auto-enabled', id: 'a', now: 5 });
expect(state.draft.items[0]).toMatchObject({ classification: 'stable', classificationOrigin: 'automatic' });
```

Editor test는 fieldset/legend, 상태 문구의 live-region 인지, 현금 `안정` 텍스트와 control 부재를 검증합니다. 확인 dialog는 투자 대상 수 → 안정 비중 → 현금 비중 순서를 검증합니다.

- [ ] **Step 2: reducer/editor focused test가 실패하는지 확인합니다**

Run: `npx vitest run tests/unit/portfolio/portfolioReducer.test.ts tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL

- [ ] **Step 3: reducer action과 접근 가능한 분류 UI를 구현합니다**

```ts
| { type: 'draft-classification-changed'; id: string; classification: Classification; now: number }
| { type: 'draft-classification-auto-enabled'; id: string; now: number }
```

직접 radio 선택은 origin을 `user`로 바꾸고, 자동 추천 복귀는 현재 이름을 즉시 재평가합니다. 빈 새 항목은 growth/automatic으로 시작합니다. 현금 section에는 `분류 안정`을 읽히게 하되 radio를 렌더링하지 않습니다.

- [ ] **Step 4: 편집·reducer·dialog test 통과를 확인합니다**

Run: `npx vitest run tests/unit/portfolio/portfolioReducer.test.ts tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: PASS

- [ ] **Step 5: 분류 편집 변경을 커밋합니다**

```bash
git add src/portfolio/application/portfolioReducer.ts src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/PortfolioApplyBar.tsx tests/unit/portfolio/portfolioReducer.test.ts tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
git commit -m "feat(portfolio): edit growth and stable classes"
```

---

### Task 5: Summary-first 결과 화면

**Files:**
- Rewrite: `src/portfolio/ui/PortfolioSummary.tsx`
- Delete: `src/portfolio/ui/AllocationDonut.tsx`
- Delete: `src/portfolio/ui/AllocationTable.tsx`
- Delete: `src/portfolio/ui/tooltipPosition.ts`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Create: `tests/unit/portfolio/PortfolioSummary.test.tsx`
- Delete: `tests/unit/portfolio/AllocationDonut.test.tsx`

**Interfaces:**
- Consumes: `PortfolioViewPreferences`, 표시 정렬, 최대 항목, 안정 비중.
- Produces: `PortfolioSummary({ investmentWon, allocation, preferences, onEdit })`.

- [ ] **Step 1: 금액 off/on과 표시 순서의 실패 테스트를 작성합니다**

```tsx
render(<PortfolioSummary investmentWon={800_000} allocation={allocation} preferences={{ showAmounts: false, sortMode: 'ratio' }} onEdit={onEdit} />);
expect(screen.getByRole('heading', { name: '안정 50%' })).toBeVisible();
expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
expect(screen.queryByText(/800,000원/)).not.toBeInTheDocument();
expect(screen.queryByRole('img', { name: /도넛/ })).not.toBeInTheDocument();
expect(screen.queryByRole('table')).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: '배분 수정' })).toHaveClass('portfolio-summary__edit');
```

별도 case에서 showAmounts on이면 `이번 달 투자금 800,000원`, `안정 50%`, 모든 행의 원화 금액을 확인합니다. ratio/input 정렬, 최대 항목 동률에서 현재 보기 순서 우선, 투자 대상과 현금 동률에서 투자 대상 우선을 검증합니다.

- [ ] **Step 2: 기존 도넛·표 구현 때문에 test가 실패하는지 확인합니다**

Run: `npx vitest run tests/unit/portfolio/PortfolioSummary.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL — 기본 금액과 도넛·표가 렌더링됩니다.

- [ ] **Step 3: 하나의 비례 목록과 연필 edit trigger로 교체합니다**

```tsx
<header className="portfolio-summary__hero">
  <p>이번 달 투자금</p>
  <div className="portfolio-summary__headline">
    <h1>{preferences.showAmounts ? `이번 달 투자금 ${formatPortfolioWon(investmentWon)}` : `안정 ${stablePercent}`}</h1>
    <button type="button" className="portfolio-summary__edit" aria-label="배분 수정" onClick={onEdit}>
      <PencilIcon aria-hidden="true" />
    </button>
  </div>
  {preferences.showAmounts ? <p>안정 {stablePercent}</p> : null}
  <p>{largest.name}에 {formatAllocationPercent(largest.percentage)}를 배분해요</p>
</header>
```

각 행은 이름 → 비율 → 선택적 금액 순서의 accessible text를 갖고, 막대는 `aria-hidden="true"`입니다. 기존 도넛·표·tooltip 모듈과 import를 제거합니다. 아이콘은 저장소의 기존 아이콘 라이브러리/공통 아이콘 문법을 사용하고 새 inline SVG를 만들지 않습니다.

- [ ] **Step 4: summary와 전체 Portfolio unit test를 실행합니다**

Run: `npx vitest run tests/unit/portfolio`

Expected: PASS

- [ ] **Step 5: summary-first 결과를 커밋합니다**

```bash
git add -A src/portfolio/ui tests/unit/portfolio
git commit -m "feat(portfolio): show summary-first allocation"
```

---

### Task 6: 앱 통합, 반응형 시각 문법과 제품 문서

**Files:**
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/portfolio.spec.ts`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`

**Interfaces:**
- Consumes: Task 2 v2-only repository, Task 3 preferences, Task 4 editor, Task 5 summary.
- Produces: 저장 설정이 연결된 완성 Portfolio 사용자 흐름과 v2 PRD 인수 조건.

- [ ] **Step 1: 새 사용자 흐름의 Playwright assertion을 먼저 작성합니다**

```ts
await expect(page.getByRole('heading', { name: '안정 50%' })).toBeVisible();
await expect(page.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
await expect(page.getByText(/원$/)).toHaveCount(0);
await page.getByRole('button', { name: '관리 메뉴' }).click();
await page.getByRole('switch', { name: '금액 보기' }).check();
await expect(page.getByRole('heading', { name: '이번 달 투자금 800,000원' })).toBeVisible();
await page.getByRole('radio', { name: '입력순' }).check();
```

기존 `keeps donut, table...` test를 390×844, 768×900, 1280×900의 summary/list, 44px target, overflow, reduced-motion 검사로 교체합니다. 200% zoom과 긴 한글 이름 case도 추가합니다.

- [ ] **Step 2: E2E가 새 UI 부재로 실패하는지 확인합니다**

Run: `npx playwright test tests/portfolio.spec.ts`

Expected: FAIL — 설정 persistence, 새 요약 또는 분류 UI가 아직 완전히 연결되지 않았습니다.

- [ ] **Step 3: preference 상태·저장 실패 격리와 결과 오류 표시를 통합합니다**

`PortfolioApp`은 preference repository를 dependency로 주입 가능하게 하고 초기 load를 state로 보관합니다. 설정 save가 unavailable이어도 현재 session state는 변경하며 배분의 `saveState`는 바꾸지 않습니다. 결과 toolbar는 제거하고 `saveState === 'error' | 'cleanup-error'`일 때만 summary 가까운 alert를 렌더링합니다. stale/zero-investment placeholder도 새 summary props를 사용합니다.

- [ ] **Step 4: 승인 시안에 맞춰 CSS를 교체합니다**

`portfolio.css`에서 donut/table/tooltip rule을 제거하고 다음 계약을 구현합니다.

```css
.portfolio-summary { width: min(100%, 48rem); margin-inline: auto; }
.portfolio-summary__headline { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.portfolio-summary__edit { min-width: 44px; min-height: 44px; }
.portfolio-allocation-list { margin: 1.5rem 0 0; padding: 0; list-style: none; }
.portfolio-allocation-row { padding-block: 1rem; border-top: 1px solid var(--line); }
.portfolio-allocation-row__track { overflow: hidden; height: .5rem; background: color-mix(in srgb, var(--line) 55%, transparent); border-radius: 999px; }
.portfolio-allocation-row__fill { width: var(--allocation-width); height: 100%; background: var(--allocation-color); }
@media (max-width: 768px) {
  .portfolio-content { width: min(100% - 2rem, 48rem); }
  .portfolio-editor__row { grid-template-columns: minmax(0, 1fr); }
}
```

실제 class 이름은 Task 5 markup과 정확히 일치시킵니다. 390px에서 목록 4개가 읽히도록 불필요한 상하 여백을 줄이고, desktop에서도 content max-width 48rem을 유지합니다.

- [ ] **Step 5: PRD의 오래된 Portfolio 인수 조건을 v2 계약으로 갱신합니다**

`결과 우선 도넛·표`를 `비율 우선 요약·비례 목록·기본 금액 숨김`으로 바꾸고 다음 항목을 명시합니다: 성장/안정 분류 소유권, 현금 안정, 자동 추천보다 사용자 지정 우선, v1 Portfolio 저장값 비이관, 별도 보기 설정, Main read-only/no write-back.

- [ ] **Step 6: 정적·unit·focused E2E 검증을 실행합니다**

Run: `npm run check`

Expected: PASS

Run: `npm run test:unit -- tests/unit/portfolio tests/unit/journey/AppManagementMenu.test.tsx`

Expected: PASS

Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts`

Expected: PASS

- [ ] **Step 7: Product Design 비교 QA를 수행합니다**

Playwright 사용 승인은 이 디자인 세션에서 이미 받았습니다. 선택 시안 `/Users/jinho/.codex/generated_images/019fd4cb-220c-77c3-8228-057e79269eeb/exec-9a07df2b-d42c-49d9-9e14-e22eec7827b9.png`과 구현 screenshot을 같은 viewport로 나란히 비교합니다.

Capture: 390×844 금액 off 결과, 390×844 편집, 768×900 결과, 1280×900 결과, 관리 메뉴 open, 금액 on 결과.

Check: AppShell 위치, Pearl canvas, content max-width, hero 위계, 4개 행 가시성, 44px target, overlay containment, focus ring, 긴 이름, 200% zoom, 가로 overflow 없음.

- [ ] **Step 8: 문서 링크와 diff 위생을 확인합니다**

Run: `test -f docs/superpowers/specs/2026-08-10-portfolio-summary-first-ux-design.md && test -f DESIGN.md && git diff --check`

Expected: exit 0, whitespace error 없음

- [ ] **Step 9: 통합 변경을 커밋합니다**

```bash
git add src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css tests/portfolio.spec.ts docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
git commit -m "feat(portfolio): complete summary-first experience"
```

---

## Final Verification

- [ ] Run: `npm run check`
- [ ] Run: `npm run test:unit`
- [ ] Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts`
- [ ] Search: `rg -n "AllocationDonut|AllocationTable|tooltipPosition|투자 배분 도넛|portfolio-table|저장됨" src/portfolio tests/unit/portfolio tests/portfolio.spec.ts`
- [ ] Confirm: 검색 결과에 제거 대상 runtime import·selector·copy가 없습니다.
- [ ] Run: `git status --short`
- [ ] Confirm: 사용자 소유 `AGENTS.md`, `package-lock.json` 변경을 stage하거나 덮어쓰지 않았습니다.
