# Portfolio Investment Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main의 최신 투자금을 최대 10개 자유 이름 투자 대상과 현금에 배분하고 금액·비율을 도넛과 표로 확인하는 상세 Portfolio 앱을 만든다.

**Architecture:** `src/portfolio/`가 순수 배분 domain, draft/apply application state, 최신 Main read adapter, Portfolio 전용 local repository와 React UI를 독립 소유한다. Main은 `monthlyInvestmentWon`의 유일한 원천이며 Portfolio는 정규화된 배분과 동기화 기준 금액만 저장한다. 기존 journey snapshot은 navigation 맥락만 유지하고 레거시 Portfolio runtime과 storage key는 사용하지 않는다.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5 MPA, Tailwind CSS 4 foundation, Vitest 4, Testing Library, Playwright 1.60, Vite PWA

## Global Constraints

- 승인 spec: `docs/superpowers/specs/2026-08-03-portfolio-allocation-design.md`
- Main의 `MainData` v2와 `monthlyInvestmentWon` 소유권을 변경하지 않고 Portfolio는 write-back하지 않는다.
- 활성 계획 하나만 지원하며 계좌, ticker, 시세, 수익률, 매수 주기와 snapshot history를 추가하지 않는다.
- 투자 대상은 자유 이름 최대 10개이며 현금은 제한에 포함하지 않는다.
- 비현금 금액 입력 최소값은 1,000원이고 내부 금액은 원 단위 안전 정수다.
- 결과 금액은 천 원 단위 반올림하고 비율은 정수 우선, 필요할 때 소수점 한 자리로 표시한다.
- 390px, 768px와 desktop에서 가로 overflow가 없어야 하며 주요 touch target은 최소 44px이다.
- pointer, touch와 keyboard는 동일한 도넛 상세를 제공하고 `prefers-reduced-motion`을 존중한다.
- 상단의 `한 달 투자금을 배분합니다` 외에는 월 표현을 반복하지 않는다.
- 신규 runtime은 `apps/portfolio/app.js`, `apps/portfolio/modules/**`, `IsfStorageHub`, `isf-rebuild-v1`, `isf-step3-portfolios-v2`, `isf-step3-snapshots-v1`을 읽거나 import하지 않는다.
- 사용자 변경과 Simulation 병합 내용을 보존하고 인접 리팩터링을 하지 않는다.

## File Structure

```text
src/portfolio/
  domain/model.ts                 schema와 item identity
  domain/allocation.ts            금액·비율·현금·동기화 계산
  domain/validation.ts            plan과 draft parser
  application/bootstrap.ts        Main + 저장 startup 결과
  application/portfolioReducer.ts draft/apply/cancel/reset 전이
  infrastructure/mainSourceRepository.ts  최신 Main read adapter
  infrastructure/portfolioRepository.ts   applied/draft 저장
  main.tsx                        Vite entry
  ui/PortfolioApp.tsx             앱 조립과 recovery
  ui/PortfolioSummary.tsx         result-first 요약
  ui/AllocationDonut.tsx          accessible SVG donut
  ui/AllocationTable.tsx          텍스트 결과
  ui/AllocationEditor.tsx         금액·비율 편집
  ui/PortfolioApplyBar.tsx         취소·적용 확인
  ui/PortfolioMenu.tsx             초기화 확인
  ui/format.ts                    천 원·비율 표시
  ui/portfolio.css                responsive·motion
tests/unit/portfolio/**
tests/portfolio.spec.ts
```

기존 변경 파일은 `src/journey/ui/AppLauncher.tsx`, `src/main/ui/MainApp.tsx`, `apps/portfolio/index.html`, 관련 unit/E2E, canonical 문서다. 교체 검증 후 레거시 Portfolio script/module/style과 `src/entries/step3.ts`만 삭제한다.

---

### Task 1: Deterministic Portfolio Domain

**Files:**
- Create: `src/portfolio/domain/model.ts`
- Create: `src/portfolio/domain/allocation.ts`
- Create: `src/portfolio/domain/validation.ts`
- Test: `tests/unit/portfolio/allocation.test.ts`
- Test: `tests/unit/portfolio/validation.test.ts`

**Interfaces:**
- Produces: `SHARE_SCALE`, `PortfolioItem`, `PortfolioPlan`, `PortfolioDraft`, `CashMode`, `InputMode`
- Produces: `createCashOnlyDraft`, `setItemAmount`, `setItemPercentage`, `removeItem`, `setCashAmount`, `enableAutomaticCash`, `syncPlanToInvestment`, `materializeAllocation`, `sortResultItems`
- Produces: `parsePortfolioPlan`, `parsePortfolioDraft`, `validateApplicableDraft`, `normalizePortfolioName`

- [ ] **Step 1: Write failing allocation tests**

```ts
it('uses unallocated investment as automatic cash', () => {
  const draft = setItemAmount(createCashOnlyDraft(200_000, 1),
    { id: 'asset-1', name: '미국 인덱스', order: 0 }, 120_000);
  expect(materializeAllocation(draft, 200_000)).toMatchObject({
    items: [{ id: 'asset-1', amountWon: 120_000 }],
    cashAmountWon: 80_000,
    totalAmountWon: 200_000,
  });
});

it('blocks amounts beyond remaining investment', () => {
  const draft = setItemAmount(createCashOnlyDraft(200_000, 1),
    { id: 'asset-1', name: '인덱스', order: 0 }, 150_000);
  expect(() => setItemAmount(draft,
    { id: 'asset-2', name: '배당', order: 1 }, 60_000))
    .toThrow('allocation-exceeds-investment');
});

it('puts increases into cash and scales decreases by ratio', () => {
  const original = setItemAmount(createCashOnlyDraft(200_000, 1),
    { id: 'asset-1', name: '인덱스', order: 0 }, 120_000);
  const increased = syncPlanToInvestment(original, 300_000, 2);
  expect(materializeAllocation(increased, 300_000)).toMatchObject({
    items: [{ amountWon: 120_000 }], cashAmountWon: 180_000,
  });
  const decreased = syncPlanToInvestment(increased, 150_000, 3);
  expect(materializeAllocation(decreased, 150_000)).toMatchObject({
    items: [{ amountWon: 60_000 }], cashAmountWon: 90_000,
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/allocation.test.ts`

Expected: FAIL because Portfolio domain files do not exist.

- [ ] **Step 3: Define exact contracts and minimal calculation**

```ts
export const PORTFOLIO_SCHEMA_VERSION = 1 as const;
export const SHARE_SCALE = 1_000_000 as const;
export type CashMode = 'automatic' | 'manual';
export type InputMode = 'amount' | 'percentage';

export interface PortfolioItem {
  id: string;
  name: string;
  shareUnits: number;
  order: number;
}

export interface PortfolioDraft {
  schemaVersion: 1;
  items: PortfolioItem[];
  cashShareUnits: number;
  cashMode: CashMode;
  inputMode: InputMode;
  syncedInvestmentWon: number;
  updatedAt: number;
  isApplicable: boolean;
}

export interface PortfolioPlan extends Omit<PortfolioDraft, 'inputMode' | 'isApplicable'> {
  appliedAt: number;
}

export interface MaterializedItem extends PortfolioItem {
  amountWon: number;
  percentage: number;
}
export interface MaterializedAllocation {
  items: MaterializedItem[];
  cashAmountWon: number;
  cashPercentage: number;
  totalAmountWon: number;
}

export function createCashOnlyDraft(investmentWon: number, now: number): PortfolioDraft;
export function syncPlanToInvestment<T extends PortfolioPlan | PortfolioDraft>(value: T, nextInvestmentWon: number, now: number): T;
export function materializeAllocation(value: PortfolioPlan | PortfolioDraft, investmentWon: number): MaterializedAllocation;
```

Use integer `shareUnits` totaling `SHARE_SCALE`. Convert amount with `Math.round(amountWon * SHARE_SCALE / investmentWon)`, reject unsafe/negative/over-limit inputs, positive non-cash amounts below 1,000 won, duplicate normalized names and more than ten items. Assign every division remainder to cash. Increase sync materializes old non-cash amounts, preserves them and adds delta to cash. Decrease sync scales every old amount by `new / old`, rounds non-cash items and assigns the final remainder to cash.

- [ ] **Step 4: Add failing parser and identity tests**

```ts
expect(normalizePortfolioName('  US   INDEX ')).toBe('us index');
expect(parsePortfolioPlan({
  schemaVersion: 1,
  items: [
    { id: 'a', name: '미국  인덱스', shareUnits: 400_000, order: 0 },
    { id: 'b', name: '미국 인덱스', shareUnits: 400_000, order: 1 },
  ],
  cashShareUnits: 200_000,
  cashMode: 'automatic', syncedInvestmentWon: 100_000,
  appliedAt: 1, updatedAt: 1,
})).toBeNull();
```

- [ ] **Step 5: Implement strict validation**

Require exact v1 fields, safe timestamps, unique IDs, trimmed/collapsed/lowercase comparison names, unique contiguous order and exact plan total. Drafts may remain below 100% only in manual cash mode and parser must recompute `isApplicable`. Automatic cash always equals the remainder.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:unit -- tests/unit/portfolio/allocation.test.ts tests/unit/portfolio/validation.test.ts && npm run check`

Expected: PASS.

```bash
git add src/portfolio/domain tests/unit/portfolio
git commit -m "feat(portfolio): add allocation domain"
```

---

### Task 2: Main Source, Persistence, and Bootstrap

**Files:**
- Create: `src/portfolio/infrastructure/mainSourceRepository.ts`
- Create: `src/portfolio/infrastructure/portfolioRepository.ts`
- Create: `src/portfolio/application/bootstrap.ts`
- Test: `tests/unit/portfolio/mainSourceRepository.test.ts`
- Test: `tests/unit/portfolio/portfolioRepository.test.ts`
- Test: `tests/unit/portfolio/bootstrap.test.ts`
- Create: `tests/unit/portfolio/MemoryPortfolioRepository.ts`

**Interfaces:**
- Consumes: Task 1 models, parsers and sync
- Produces: `PortfolioMainSourceRepository`, `PortfolioRepository`, `bootstrapPortfolio`, `PortfolioBootstrapResult`
- Produces for later component tests: `createMemoryPortfolioRepository({ applied?, draft? })`

- [ ] **Step 1: Write failing Main source tests**

```ts
const main = {
  schemaVersion: 2, updatedAt: 10,
  monthlyNetIncomeWon: 3_000_000, monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000, monthlySavingWon: 400_000,
  monthlyInvestmentWon: 250_000,
};
storage.setItem('isf-main-v2', JSON.stringify(main));
expect(new BrowserPortfolioMainSourceRepository(() => storage).load()).toEqual({
  status: 'found', source: { monthlyInvestmentWon: 250_000, mainUpdatedAt: 10 },
});
storage.clear();
storage.setItem('isf-rebuild-v1', JSON.stringify({ monthlyInvest: 999_000 }));
expect(new BrowserPortfolioMainSourceRepository(() => storage).load())
  .toEqual({ status: 'empty' });
```

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/mainSourceRepository.test.ts tests/unit/portfolio/portfolioRepository.test.ts`

Expected: FAIL with unresolved modules.

- [ ] **Step 3: Implement narrow current-only repositories**

```ts
export const PORTFOLIO_APPLIED_KEY = 'isf-portfolio-allocation-v1';
export const PORTFOLIO_DRAFT_KEY = 'isf-portfolio-allocation-draft-v1';
export interface PortfolioRepository {
  load(): PortfolioStorageLoadResult;
  saveApplied(plan: PortfolioPlan): PortfolioWriteResult;
  saveDraft(draft: PortfolioDraft): PortfolioWriteResult;
  clearDraft(): PortfolioWriteResult;
  clearAll(): PortfolioWriteResult;
}
```

Load applied and draft independently so one malformed value cannot discard the other. Catch every storage failure. Seed both legacy Portfolio keys in tests, call load/save/clear and assert their raw strings are unchanged.

Create `MemoryPortfolioRepository.ts` as a test-only implementation of the exact repository interface. Its factory accepts optional applied/draft fixtures, records calls, mutates only its in-memory current keys, and can be configured so the next write returns `{ status: 'unavailable' }`. Later component tests import this helper instead of inventing partial repository mocks.

- [ ] **Step 4: Write bootstrap branch tests**

```ts
const plan: PortfolioPlan = {
  schemaVersion: 1,
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000, cashMode: 'automatic',
  syncedInvestmentWon: 200_000, appliedAt: 1, updatedAt: 1,
};
const savedStorage: PortfolioStorageLoadResult = {
  applied: { status: 'found', plan },
  draft: { status: 'empty' },
};
expect(bootstrapPortfolio({ status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 2 } }, savedStorage, 3))
  .toMatchObject({ kind: 'investment-required', preservedPlan: plan });
expect(bootstrapPortfolio({ status: 'found', source: { monthlyInvestmentWon: 300_000, mainUpdatedAt: 2 } }, savedStorage, 3))
  .toMatchObject({ kind: 'ready', shouldPersistApplied: true });
```

- [ ] **Step 5: Implement discriminated startup outcomes**

```ts
export type PortfolioBootstrapResult =
  | { kind: 'ready'; plan: PortfolioPlan | null; draft: PortfolioDraft; shouldPersistApplied: boolean; persistenceAvailable: boolean }
  | { kind: 'investment-required'; preservedPlan: PortfolioPlan | null; reason: 'zero-investment' }
  | { kind: 'stale-main'; plan: PortfolioPlan; draft: PortfolioDraft | null; persistenceAvailable: boolean }
  | { kind: 'main-required'; reason: 'empty' | 'invalid' | 'unavailable' };
```

Unavailable Main plus valid plan returns `stale-main` without rescaling. Positive Main prefers a valid draft, synchronizes plan and draft with Task 1 rules, and creates a cash-only draft when no plan exists.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:unit -- tests/unit/portfolio/mainSourceRepository.test.ts tests/unit/portfolio/portfolioRepository.test.ts tests/unit/portfolio/bootstrap.test.ts && npm run check`

Expected: PASS.

```bash
git add src/portfolio/infrastructure src/portfolio/application/bootstrap.ts tests/unit/portfolio
git commit -m "feat(portfolio): persist Main-linked plans"
```

---

### Task 3: Draft, Apply, Cancel, and Reset State

**Files:**
- Create: `src/portfolio/application/portfolioReducer.ts`
- Test: `tests/unit/portfolio/portfolioReducer.test.ts`

**Interfaces:**
- Consumes: bootstrap result and Task 1 edit functions
- Produces: `PortfolioState`, `PortfolioAction`, `createPortfolioState`, `portfolioReducer`

- [ ] **Step 1: Write failing reducer tests**

```ts
const readyWithoutPlan: Extract<PortfolioBootstrapResult, { kind: 'ready' }> = {
  kind: 'ready', plan: null, draft: createCashOnlyDraft(200_000, 1),
  shouldPersistApplied: false, persistenceAvailable: true,
};
const readyWithPlan: Extract<PortfolioBootstrapResult, { kind: 'ready' }> = {
  ...readyWithoutPlan, plan, draft: draftFromPlan(plan),
};
expect(createPortfolioState(readyWithoutPlan).view).toBe('edit');
expect(createPortfolioState(readyWithPlan).view).toBe('result');
const changed = portfolioReducer(createPortfolioState(readyWithPlan),
  { type: 'draft-item-amount-changed', id: 'a', amountWon: 50_000, now: 2 });
expect(changed.applied).toEqual(readyWithPlan.plan);
expect(changed.dirty).toBe(true);
expect(portfolioReducer(changed, { type: 'cancel-edit' }).draft)
  .toEqual(draftFromPlan(changed.applied!));
```

- [ ] **Step 2: Run reducer test and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts`

Expected: FAIL because reducer does not exist.

- [ ] **Step 3: Implement pure transitions**

Support actions for edit open, item add/remove/name/amount/percentage, cash edit, automatic cash, input mode, cancel, apply success, save failure and confirmed reset. Dirty means semantic draft difference, not opening edit. Repository effects remain in `PortfolioApp`. Invalid input records a field error without changing applied data.

- [ ] **Step 4: Test reset and save-failure preservation**

Assert confirmed reset produces an applied cash-only plan for current Main investment, unconfirmed reset does nothing, and `save-failed` preserves both previous applied plan and editable draft.

- [ ] **Step 5: Run and commit**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts tests/unit/portfolio/allocation.test.ts && npm run check`

Expected: PASS.

```bash
git add src/portfolio/application/portfolioReducer.ts tests/unit/portfolio/portfolioReducer.test.ts
git commit -m "feat(portfolio): add allocation edit state"
```

---

### Task 4: Result Formatting, Donut, and Table

**Files:**
- Create: `src/portfolio/ui/format.ts`
- Create: `src/portfolio/ui/AllocationDonut.tsx`
- Create: `src/portfolio/ui/AllocationTable.tsx`
- Create: `src/portfolio/ui/PortfolioSummary.tsx`
- Test: `tests/unit/portfolio/format.test.ts`
- Test: `tests/unit/portfolio/AllocationDonut.test.tsx`

**Interfaces:**
- Consumes: `materializeAllocation` and `sortResultItems`
- Produces: `formatPortfolioWon`, `formatAllocationPercent`, `AllocationDonut`, `AllocationTable`, `PortfolioSummary`

- [ ] **Step 1: Write failing formatter tests**

```ts
it.each([[10_499, '10,000원'], [10_500, '11,000원'], [1_234_567, '1,235,000원']])(
  'rounds %i to thousand won', (value, expected) => {
    expect(formatPortfolioWon(value)).toBe(expected);
  });
it.each([[25, '25%'], [33.3, '33.3%']])('formats compact percent', (value, expected) => {
  expect(formatAllocationPercent(value)).toBe(expected);
});
```

- [ ] **Step 2: Write failing equivalent-detail tests**

```tsx
render(<PortfolioSummary investmentWon={200_000} allocation={allocation} />);
const segment = screen.getByRole('button', { name: '미국 인덱스 120,000원 60%' });
fireEvent.pointerEnter(segment, { clientX: 120, clientY: 80 });
expect(screen.getByRole('tooltip')).toHaveTextContent('미국 인덱스');
expect(screen.getByRole('row', { name: /미국 인덱스/ })).toHaveAttribute('data-active', 'true');
fireEvent.pointerLeave(screen.getByLabelText('투자 배분 도넛'));
expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
fireEvent.focus(segment);
fireEvent.keyDown(segment, { key: 'ArrowRight' });
expect(screen.getByRole('tooltip')).toHaveTextContent('현금');
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/format.test.ts tests/unit/portfolio/AllocationDonut.test.tsx`

Expected: FAIL with missing UI modules.

- [ ] **Step 4: Implement accessible SVG donut and linked table**

Keep one `activeId` in `PortfolioSummary`. Pointer coordinates place a fixed-position tooltip, but values always come from the selected segment. Touch/click and keyboard focus anchor to the segment centroid. Arrow keys cycle sorted segments, Escape clears, and cash stays last. The table always renders name, rounded amount and percentage, and its hover/focus sets the same `activeId`. Use accessible buttons/group labels and never infer money from pointer geometry.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/unit/portfolio/format.test.ts tests/unit/portfolio/AllocationDonut.test.tsx && npm run check`

Expected: PASS.

```bash
git add src/portfolio/ui/format.ts src/portfolio/ui/AllocationDonut.tsx src/portfolio/ui/AllocationTable.tsx src/portfolio/ui/PortfolioSummary.tsx tests/unit/portfolio/format.test.ts tests/unit/portfolio/AllocationDonut.test.tsx
git commit -m "feat(portfolio): show allocation summary"
```

---

### Task 5: Allocation Editor and Apply Boundary

**Files:**
- Create: `src/portfolio/ui/AllocationEditor.tsx`
- Create: `src/portfolio/ui/PortfolioApplyBar.tsx`
- Create: `src/portfolio/ui/PortfolioMenu.tsx`
- Test: `tests/unit/portfolio/AllocationEditor.test.tsx`

**Interfaces:**
- Consumes: `PortfolioDraft`, reducer actions, `validateApplicableDraft`
- Produces: controlled editor, dirty apply bar and reset menu

- [ ] **Step 1: Write failing editor tests**

```tsx
render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction} />);
fireEvent.click(screen.getByRole('radio', { name: '비율' }));
expect(onAction).toHaveBeenCalledWith({ type: 'input-mode-changed', mode: 'percentage' });
expect(screen.getByText('120,000원')).toBeVisible();
expect(screen.getByText('60%')).toBeVisible();

render(<AllocationEditor draft={{ ...draft, cashMode: 'manual' }} investmentWon={200_000} onAction={vi.fn()} />);
expect(screen.getByText('현금 직접 배분 중')).toBeVisible();
expect(screen.getByRole('button', { name: '현금 자동 배분 켜기' })).toBeVisible();
expect(screen.getByText('남은 투자금을 현금으로 자동 배분합니다')).toBeVisible();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/AllocationEditor.test.tsx`

Expected: FAIL because editor components do not exist.

- [ ] **Step 3: Implement controlled editing**

Use one accessible `금액 / 비율` radio group. Each row has visible name label, numeric field, computed counterpart and text delete button. Preserve raw numeric text until blur, then parse a safe number. Keep cash last; its edit switches to manual. Show field-local reasons for over-allocation, duplicate normalized names, positive values below 1,000 won, unsafe integers and empty names. Disable add at ten items with `투자 대상은 최대 10개까지 추가할 수 있습니다`.

- [ ] **Step 4: Implement explicit apply and reset confirmations**

Apply bar appears only when dirty. `취소` immediately restores applied data. `적용` opens `투자 배분 적용` dialog summarizing item count, 투자금 and 현금 비중; confirm is disabled until exact validation succeeds. `처음부터 다시` lives in `PortfolioMenu` and requires confirmation. Test that simply entering edit is not dirty and both dialogs return focus to their triggers.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit -- tests/unit/portfolio/AllocationEditor.test.tsx && npm run check`

Expected: PASS.

```bash
git add src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/PortfolioApplyBar.tsx src/portfolio/ui/PortfolioMenu.tsx tests/unit/portfolio/AllocationEditor.test.tsx
git commit -m "feat(portfolio): add allocation editor"
```

---

### Task 6: Portfolio App, Zero Gate, and Main Deep Link

**Files:**
- Create: `src/portfolio/ui/PortfolioApp.tsx`
- Create: `src/portfolio/main.tsx`
- Create: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `apps/portfolio/index.html`
- Modify: `tests/unit/journey/entryIsolation.test.ts`
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5, current error boundary, AppLauncher and routes
- Produces: detailed Portfolio route and one-time `?edit=investment` Main contract

- [ ] **Step 1: Write failing app composition tests**

```tsx
const mainFound: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 1 } }),
};
const zeroMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 1 } }),
};
const emptyRepository = createMemoryPortfolioRepository();
const savedRepository = createMemoryPortfolioRepository({ applied: plan });
render(<PortfolioApp mainSourceRepository={mainFound} repository={emptyRepository} now={() => 1} />);
expect(screen.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();

render(<PortfolioApp mainSourceRepository={zeroMain} repository={savedRepository} now={() => 1} />);
expect(screen.getByTestId('portfolio-gated-content')).toHaveClass('portfolio-content--blurred');
expect(screen.getByRole('link', { name: 'Main에서 투자금 설정' }))
  .toHaveAttribute('href', expect.stringContaining('?edit=investment'));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/main/MainApp.test.tsx`

Expected: FAIL because PortfolioApp and Main edit intent do not exist.

- [ ] **Step 3: Implement Portfolio composition and persistence effects**

Construct repositories once and bootstrap once. Draft actions save draft; apply validates, saves applied, clears draft, then dispatches success. Any failed write keeps the previous applied plan and shows `role="alert"` with retry. Stale Main shows the saved result plus `이전 Main 기준`, retry and Main links without silent rescaling. Zero investment preserves saved data beneath the purpose-specific blur overlay; obscured controls are inert and non-focusable. Without a saved plan, show a neutral placeholder rather than invented assets.

- [ ] **Step 4: Add one-time Main investment edit intent**

CTA URL is `appPath('main') + '?edit=investment'`. Main reads `URLSearchParams`, opens the existing Financial Detail Modal only for `edit=investment` with an applied plan, focuses `monthlyInvestmentWon`, and immediately removes the query with `history.replaceState`. Invalid values do nothing. Add tests for opening, focus, consumption-once and normal dashboard entry.

- [ ] **Step 5: Replace readiness entry and availability copy**

Update Portfolio metadata and script:

```html
<title>투자 배분 Portfolio | ISF</title>
<meta name="description" content="Main의 투자금을 대상별 금액과 비율로 배분하는 Portfolio" />
<script type="module" src="../../src/portfolio/main.tsx"></script>
```

`main.tsx` imports `app-foundation.css` and `portfolio.css`, mounts `PortfolioApp` inside the current error boundary, and registers the PWA service worker. AppLauncher marks Main, Simulation and Portfolio `사용 중`; Account Map remains `준비 중`.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/entryIsolation.test.ts && npm run check`

Expected: PASS.

```bash
git add src/portfolio src/main/ui/MainApp.tsx src/journey/ui/AppLauncher.tsx apps/portfolio/index.html tests/unit/portfolio tests/unit/main/MainApp.test.tsx tests/unit/journey
git commit -m "feat(portfolio): connect detailed app"
```

---

### Task 7: Responsive Motion and Browser Contract

**Files:**
- Create: `src/portfolio/ui/portfolio.css`
- Create: `tests/portfolio.spec.ts`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Consumes: complete Portfolio DOM and accessible names
- Produces: supported E2E contract at 390px, 768px and desktop

- [ ] **Step 1: Write failing first-run, apply, revisit and sync tests**

```ts
test('creates one allocation and revisits result-first', async ({ page }) => {
  await seedMain(page, { monthlyInvestmentWon: 200_000 });
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('미국 인덱스');
  await page.getByLabel('미국 인덱스 금액').fill('120000');
  await expect(page.getByRole('row', { name: /현금.*80,000원.*40%/ })).toBeVisible();
  await page.getByRole('button', { name: '적용' }).click();
  await page.getByRole('dialog', { name: '투자 배분 적용' })
    .getByRole('button', { name: '적용' }).click();
  await page.reload();
  await expect(page.getByText('한 달 투자금을 배분합니다')).toBeVisible();
});
```

Seed a 200,000-won applied plan with 120,000-won asset and 80,000-won cash. Change Main to 300,000 and assert 120,000/180,000. Then change Main to 150,000 and assert 60,000/90,000.

- [ ] **Step 2: Add input, cash, recovery and isolation tests**

Cover amount/percentage preservation, manual cash apply disabled below 100%, `현금 자동 배분 켜기`, duplicate names, ten-item limit, delete-to-cash, cancel, draft resume, confirmed reset, storage failure, corrupt draft and zero gate. Capture `isf-main-v2` before/after and assert byte equality. Seed both legacy Portfolio keys and assert byte equality after every flow.

- [ ] **Step 3: Add pointer, touch, keyboard and viewport tests**

For 390×844, 768×900 and 1280×900 assert `html.scrollWidth <= innerWidth`, donut/table visibility, tooltip containment, and visible primary controls at least 44px. Move the mouse between two points on one segment: tooltip position changes but displayed amount does not. Verify touch selection, ArrowRight/Escape, linked table focus and reduced-motion transition durations at most `0.01s`.

- [ ] **Step 4: Run E2E and verify RED**

Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list`

Expected: FAIL on missing responsive styles or incomplete behavior.

- [ ] **Step 5: Implement responsive and motion CSS**

Use Pearl canvas, flat white panels and `var(--line)` borders. Desktop may use donut/table columns; 768px and below use one column. Keep table padding compact without horizontal scroll. Active segment moves outward 2–4px, inactive segments reduce opacity, and linked row receives a background. Tooltip fade/scale is 120–180ms and fixed-position coordinates clamp to viewport gutters. Reduced motion removes transforms/transitions while retaining outline, text and selection state.

- [ ] **Step 6: Update app journey expectations**

Portfolio is now detailed and `사용 중`; Account Map alone remains readiness-only. Verify Portfolio reads latest Main rather than journey amount, Main/Simulation/Account Map data remains unchanged, and legacy Portfolio selectors/scripts never appear on the route.

- [ ] **Step 7: Run focused suites and commit**

Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list && npm run test:unit -- tests/unit/portfolio tests/unit/journey tests/unit/main/MainApp.test.tsx`

Expected: PASS.

```bash
git add src/portfolio/ui/portfolio.css tests/portfolio.spec.ts tests/app-journey.spec.ts
git commit -m "test(portfolio): cover allocation journey"
```

---

### Task 8: Canonical Boundary and Legacy Portfolio Removal

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `.planning/REQUIREMENTS.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`
- Modify: `.planning/codebase/ARCHITECTURE.md`
- Modify: `.planning/codebase/STRUCTURE.md`
- Modify: `.planning/codebase/TESTING.md`
- Modify: `README.md`
- Modify: `DESIGN.md`
- Delete: `apps/portfolio/app.js`
- Delete: `apps/portfolio/styles.css`
- Delete: `apps/portfolio/modules/calculator.js`
- Delete: `apps/portfolio/modules/chart-builder.js`
- Delete: `apps/portfolio/modules/dom.js`
- Delete: `apps/portfolio/modules/snapshot-manager.js`
- Delete: `apps/portfolio/modules/state.js`
- Delete: `apps/portfolio/modules/step1-connector.js`
- Delete: `src/entries/step3.ts`
- Test: `tests/unit/portfolio/legacyIsolation.test.ts`

**Interfaces:**
- Consumes: passing replacement and compatibility evidence
- Produces: Main + Simulation + Portfolio baseline, Account Map next state and no legacy Portfolio runtime

- [ ] **Step 1: Update current product claims**

State Main, Simulation and Portfolio are detailed products; Account Map is readiness-only. Document one Portfolio allocation plan/draft, latest Main read and no write-back. Mark only Portfolio-specific MIG-01/02/03 evidence complete. Replace DESIGN's obsolete period confirmation with item count, 투자금 and 현금 비중. Name Account Map as the next spec/migration target. Do not rewrite historical specs/plans.

- [ ] **Step 2: Add failing runtime-isolation test**

```ts
for (const forbidden of [
  'apps/portfolio/app.js',
  'apps/portfolio/modules',
  'src/entries/step3.ts',
  'isf-step3-portfolios-v2',
  'isf-step3-snapshots-v1',
  'IsfStorageHub',
  'isf-rebuild-v1',
]) {
  expect(currentPortfolioRuntime).not.toContain(forbidden);
}
```

Build `currentPortfolioRuntime` from the current Portfolio entry and recursively imported `src/portfolio/**` text. Storage-key non-contact remains covered by repository fixtures.

- [ ] **Step 3: Prove replacement before deletion**

Run:

```bash
npm run check
npm run test:unit -- tests/unit/portfolio tests/unit/journey/entryIsolation.test.ts
npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list
rg -n "apps/portfolio/(app\.js|modules|styles\.css)|src/entries/step3\.ts|isf-step3-(portfolios-v2|snapshots-v1)" src tests apps shared scripts package.json public
```

Expected: tests PASS. Search results are limited to scheduled legacy files and deliberate non-contact fixtures. Stop and investigate any Account Map/shared consumer before deletion.

- [ ] **Step 4: Delete exact obsolete files**

Use `git rm` only for files listed in this task. Preserve `apps/portfolio/index.html`, `src/portfolio/**`, historical docs and unrelated compatibility code.

- [ ] **Step 5: Verify references and compatibility after deletion**

Run:

```bash
rg -n "apps/portfolio/(app\.js|modules|styles\.css)|src/entries/step3\.ts" src tests apps shared scripts package.json public
rg -n "isf-step3-(portfolios-v2|snapshots-v1)" src tests apps shared scripts package.json public
npm run check
npm run test:unit -- tests/unit/portfolio tests/unit/journey tests/unit/main
npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts tests/account-map.spec.ts --reporter=list
```

Expected: first search exits 1. Storage-key search finds deliberate non-contact fixtures only. All tests PASS, including Account Map isolation.

- [ ] **Step 6: Check doc claims and links**

Run:

```bash
rg -n "Portfolio.*준비 중|Portfolio readiness|Portfolio와 Account Map.*준비" README.md DESIGN.md .planning docs/ways-of-work
rg -n "Main.*Simulation.*Portfolio|Account Map.*준비" README.md DESIGN.md .planning/STATE.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
git diff --check
```

Expected: current documents do not call Portfolio readiness-only; Account Map remains future/readiness. Relative links and diff whitespace are valid.

- [ ] **Step 7: Commit docs and removal**

```bash
git add README.md DESIGN.md .planning docs/ways-of-work src tests apps/portfolio
git commit -m "refactor(portfolio): retire legacy runtime"
```

---

### Task 9: Full Verification and Integration Readiness

**Files:**
- Verify only; if a failure exposes a Portfolio regression, modify only its owning file

**Interfaces:**
- Consumes: completed detailed Portfolio app
- Produces: current evidence ready for integration

- [ ] **Step 1: Inspect final scope**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -10
```

Expected: only Portfolio, explicit Main/journey integration, tests, canonical docs and proven-obsolete Portfolio files changed. Preserve unrelated user changes.

- [ ] **Step 2: Run static and unit verification**

Run:

```bash
npm run check
npm run test:unit
```

Expected: all TypeScript checks and unit tests PASS.

- [ ] **Step 3: Run complete browser verification**

Run: `npm run test:e2e -- --reporter=list`

Expected: all active Main, Simulation, Portfolio, Account Map and shared journey tests PASS; intentional legacy skips remain skips.

- [ ] **Step 4: Build PWA and verify Portfolio output**

Run:

```bash
npm run build
test -f dist/apps/portfolio/index.html
rg -n "Portfolio" dist/apps/portfolio/index.html dist/assets
```

Expected: build exits 0 and generated route contains the current Portfolio entry without legacy module URLs. `npm run build` bumps version files; inspect and preserve overlapping user changes.

- [ ] **Step 5: Perform final visual inspection**

At 390px, 768px and desktop verify result-first order, edit containment, donut/table visibility, pointer/touch/keyboard feedback, tooltip containment, zero gate, Main deep-link focus, no horizontal overflow and 44px controls. Record screenshots or trace paths as evidence.

- [ ] **Step 6: Commit expected version artifacts only when changed**

```bash
git add package.json package-lock.json public/manifest.webmanifest shared/legacy/sw.js shared/core/utils.js
git commit -m "chore(release): sync Portfolio version"
```

Skip when those files did not change. Inspect every diff before staging.

- [ ] **Step 7: Hand off evidence**

Report changed files by responsibility, exact check/unit/E2E counts, intentional skips, remaining Account Map migration risk, commit range and branch status. Do not merge or push unless the user explicitly requests it at execution completion.
