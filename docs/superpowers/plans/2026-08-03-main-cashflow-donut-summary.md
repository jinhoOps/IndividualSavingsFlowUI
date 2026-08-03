# Main Cashflow Donut Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main 첫 화면에 월소득 대비 소비·저축·투자·잔여 비율 도넛을 추가하고 기존 금액 카드와 AllocationBar 상세를 명확한 계층으로 재배치한다.

**Architecture:** 순수 계산은 새 `cashflowInsight` 모듈이 소유하고 SVG 도넛 렌더링과 상호작용은 `CashflowDonutSummary`가 소유한다. `SummaryDashboard`는 도넛, 네 금액 카드, Simulation CTA, 접힌 AllocationBar 상세 순서만 조합하며 저장 schema와 Financial Detail Modal 계약은 바꾸지 않는다.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, Orca Browser

## Global Constraints

- 도넛 비율의 분모는 실제 월소득이다.
- 소비는 따뜻한 색상, 저축·투자는 서로 다른 차가운 색상, 잔여는 옅은 회색을 사용한다.
- 중앙에는 큰 합계 비율과 작은 `저축·투자` 문구만 기본 표시한다.
- 계획 총액이 100%를 초과해도 실제 텍스트 비율을 재정규화하지 않는다.
- 기존 AllocationBar, 표와 초과 애니메이션은 접힌 상세 영역에서 유지한다.
- 일반 재무 편집은 Financial Detail Modal만 사용한다.
- 새 저장 schema, 세금, 수수료와 구간별 시각 변화는 추가하지 않는다.
- 390px, 768px와 desktop에서 가로 overflow가 없어야 하며 터치 대상은 최소 44px이다.

---

### Task 1: Cashflow Insight Calculations

**Files:**
- Create: `src/main/domain/cashflowInsight.ts`
- Create: `tests/unit/main/cashflowInsight.test.ts`

**Interfaces:**
- Consumes: `MainData`, `calculateCashflow()`, `percentageOfIncome()`
- Produces:

```ts
export type SavingsInvestmentBand =
  | 'under-50' | 'under-60' | 'under-70'
  | 'under-80' | 'under-90' | 'at-least-90';

export type InvestmentSavingBand =
  | 'unset' | 'below-1-to-3' | 'near-1-to-3'
  | 'near-1-to-2' | 'near-1-to-1'
  | 'near-2-to-1' | 'near-3-to-1' | 'above-3-to-1';

export interface DonutAllocation {
  id: 'consumption' | 'saving' | 'investment' | 'remaining';
  label: '소비' | '저축' | '투자' | '남는 돈';
  amountWon: number;
  percentage: number;
  displayPercentage: number;
}

export interface CashflowInsight {
  allocations: DonutAllocation[];
  savingsInvestmentPercentage: number | null;
  savingsInvestmentBand: SavingsInvestmentBand | null;
  investmentSavingRatio: number | null;
  investmentSavingBand: InvestmentSavingBand;
  isOverIncome: boolean;
}

export function classifySavingsInvestmentBand(percentage: number): SavingsInvestmentBand;
export function classifyInvestmentSavingBand(savingWon: number, investmentWon: number): InvestmentSavingBand;
export function calculateCashflowInsight(data: MainData): CashflowInsight;
```

- [ ] **Step 1: Write the failing band tests**

```ts
it.each([
  [49.9, 'under-50'], [50, 'under-60'], [59.9, 'under-60'],
  [60, 'under-70'], [80, 'under-90'], [90, 'at-least-90'],
])('classifies savings and investment total %s', (percentage, expected) => {
  expect(classifySavingsInvestmentBand(percentage)).toBe(expected);
});

it.each([
  [100, 0, 'below-1-to-3'], [0, 100, 'above-3-to-1'], [0, 0, 'unset'],
  [120, 40, 'near-1-to-3'], [100, 50, 'near-1-to-2'],
  [100, 100, 'near-1-to-1'], [50, 100, 'near-2-to-1'],
  [40, 120, 'near-3-to-1'],
])('classifies saving %s and investment %s', (savingWon, investmentWon, expected) => {
  expect(classifyInvestmentSavingBand(savingWon, investmentWon)).toBe(expected);
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npx vitest run tests/unit/main/cashflowInsight.test.ts`

Expected: FAIL because `cashflowInsight` exports do not exist.

- [ ] **Step 3: Implement the classifiers**

Use exact anchors `1/3`, `1/2`, `1`, `2`, `3`. Use arithmetic midpoint boundaries `5/12`, `3/4`, `3/2`, `5/2` for the middle five bands. Values below `1/3` and above `3` use the two outside bands. Return `unset` only when both amounts are zero.

- [ ] **Step 4: Add failing aggregate insight tests**

```ts
expect(calculateCashflowInsight(appliedData)).toMatchObject({
  savingsInvestmentPercentage: 15.625,
  savingsInvestmentBand: 'under-50',
  investmentSavingRatio: 2 / 3,
  investmentSavingBand: 'near-1-to-2',
  isOverIncome: false,
});
expect(calculateCashflowInsight(zeroIncome).savingsInvestmentPercentage).toBeNull();
expect(calculateCashflowInsight(deficitData).isOverIncome).toBe(true);
```

Assert normal allocations `56.25`, `9.375`, `6.25`, `28.125`. For deficit data, actual-income percentages are kept and rendering clips cumulative segments at 100% in consumption → saving → investment order; no negative remaining segment is returned.

- [ ] **Step 5: Implement `calculateCashflowInsight` and verify GREEN**

Run: `npx vitest run tests/unit/main/cashflowInsight.test.ts tests/unit/main/cashflow.test.ts`

Expected: PASS. Keep presentation copy and CSS out of this module.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/main/domain/cashflowInsight.ts tests/unit/main/cashflowInsight.test.ts
git commit -m "feat(main): calculate cashflow insights"
```

---

### Task 2: Interactive Donut Summary

**Files:**
- Create: `src/main/ui/dashboard/CashflowDonutSummary.tsx`
- Create: `tests/unit/main/CashflowDonutSummary.test.tsx`
- Modify: `src/main/ui/main.css`

**Interfaces:**
- Consumes: `MainData`, `calculateCashflowInsight()`, `formatDashboardWon()`
- Produces: `CashflowDonutSummary({ data }: { data: MainData })`

- [ ] **Step 1: Write failing component tests**

```tsx
render(<CashflowDonutSummary data={appliedData} />);
expect(screen.getByRole('img', { name: /소비 56\.3%.*저축 9\.4%.*투자 6\.3%.*남는 돈 28\.1%/ })).toBeVisible();
expect(screen.getByText('15.6%')).toBeVisible();
expect(screen.getByText('저축·투자')).toBeVisible();
for (const label of ['소비', '저축', '투자', '남는 돈']) {
  expect(screen.getByRole('button', { name: new RegExp(`${label} 상세 정보`) })).toBeVisible();
}
```

Add separate tests for focus/tap detail text, zero-income guidance and deficit `소득 초과` text.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible SVG donut**

Render a decorative SVG ring with `pathLength="100"`. Each circle uses `strokeDasharray`, cumulative `strokeDashoffset` and a `-90deg` rotation. Four adjacent legend buttons own hover, focus and tap behavior so zero-width and tiny segments remain reachable with 44px targets. One shared tooltip renders `종류 · 금액 · 비율`.

Use stable classes:

```txt
cashflow-donut
cashflow-donut__chart
cashflow-donut__segment--consumption
cashflow-donut__segment--saving
cashflow-donut__segment--investment
cashflow-donut__segment--remaining
cashflow-donut__center
cashflow-donut__legend
```

CSS colors:

```css
--donut-consumption: #ea7a3b;
--donut-saving: #2f8f83;
--donut-investment: #3f6f9f;
--donut-remaining: rgb(148 163 184 / 28%);
```

Center renders the formatted percentage and small `저축·투자`. Add small `소득 초과` only for deficit. If income is zero, skip SVG and render `월소득을 입력해주세요.` Reduced motion disables segment transitions.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx`

Expected: PASS for normal, zero-income, deficit, focus and tap cases.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/main/ui/dashboard/CashflowDonutSummary.tsx src/main/ui/main.css tests/unit/main/CashflowDonutSummary.test.tsx
git commit -m "feat(main): add cashflow donut"
```

---

### Task 3: Dashboard Information Hierarchy

**Files:**
- Modify: `src/main/ui/dashboard/CashflowSummary.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`

**Interfaces:**
- Consumes: `CashflowDonutSummary`, `CashflowSummary`, `AllocationBar`, `journeyEntry`
- Produces: DOM order `도넛 → 네 편집 카드 → journeyEntry → 접힌 상세`

- [ ] **Step 1: Write failing dashboard tests**

```ts
expect(screen.queryByRole('button', { name: '월 실수령액 편집' })).not.toBeInTheDocument();
expect(screen.getByRole('region', { name: '월 자금 구성 요약' })).toBeVisible();
expect(screen.getByRole('button', { name: '월 소비 편집' })).toBeVisible();
expect(screen.getByRole('button', { name: '남는 돈 편집' })).toBeVisible();
expect(screen.getByRole('button', { name: '월 저축 편집' })).toBeVisible();
expect(screen.getByRole('button', { name: '월 투자 편집' })).toBeVisible();
expect(screen.getByText('자세히 보기').closest('details')).not.toHaveAttribute('open');
expect(screen.queryByRole('table', { name: '월 자금 항목' })).not.toBeVisible();
```

Open the native `details` summary and assert AllocationBar's table appears. Compare DOM positions so donut precedes cards, cards precede Simulation CTA, and Simulation precedes detail.

- [ ] **Step 2: Run dashboard tests and verify RED**

Run: `npx vitest run tests/unit/main/SummaryDashboard.test.tsx`

Expected: FAIL because income card exists, donut is absent and AllocationBar is expanded.

- [ ] **Step 3: Implement the approved hierarchy**

Remove only the income `MetricButton` from `CashflowSummary`; keep income in domain data and editor. In `SummaryDashboard`, render:

```tsx
<CashflowDonutSummary data={applied} />
<CashflowSummary summary={summary} disabled={saving} onEdit={openEditor} />
{journeyEntry === undefined ? null : journeyEntry}
<details className="allocation-details">
  <summary>자세히 보기</summary>
  <Surface as="section" aria-labelledby="cashflow-allocation-title">...</Surface>
</details>
```

Do not alter backup status, dirty/apply state or editor fields.

- [ ] **Step 4: Run dashboard and AllocationBar tests and verify GREEN**

Run: `npx vitest run tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/AllocationBar.test.tsx`

Expected: PASS with modal editing and AllocationBar behavior unchanged.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/main/ui/dashboard/CashflowSummary.tsx src/main/ui/dashboard/SummaryDashboard.tsx tests/unit/main/SummaryDashboard.test.tsx
git commit -m "feat(main): prioritize donut summary"
```

---

### Task 4: End-to-End and Responsive Verification

**Files:**
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: browser coverage for summary order, details disclosure and existing edit/save flow

- [ ] **Step 1: Write failing Main E2E assertions**

```ts
await expect(page.getByRole('region', { name: '월 자금 구성 요약' })).toBeVisible();
await expect(page.getByText('15.6%')).toBeVisible();
await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toHaveCount(0);
const details = page.getByText('자세히 보기').locator('..');
await expect(details).not.toHaveAttribute('open', '');
await page.getByText('자세히 보기').click();
await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
```

Keep edit/save coverage by opening Financial Detail Modal from `월 소비 편집` instead of the removed income card.

- [ ] **Step 2: Run focused E2E and verify RED**

Run the focused Main suite against an isolated Vite port so another worktree server cannot be reused.

Expected: donut and disclosure assertions FAIL before integration.

- [ ] **Step 3: Update only stale public-flow selectors and verify GREEN**

Do not weaken storage, modal lifecycle, setup 6/6 animation or overflow assertions. Update only selectors affected by the removed income card and collapsed AllocationBar.

- [ ] **Step 4: Run full automated verification**

```bash
npm run check
npx vitest run
npx vite build
git diff --check
```

Expected: type checks pass, all unit tests pass, production build succeeds and diff check reports no errors.

- [ ] **Step 5: Verify responsive UI in Orca Browser**

At 390×844, 768×900 and desktop verify no horizontal overflow; donut precedes cards and Simulation; center copy does not collide; legend targets are at least 44px; edit cards remain readable; details reveal the existing bar, table and overflow treatment; modal remains contained; reduced-motion has no donut transition.

- [ ] **Step 6: Review, commit and integrate**

After review reports no Critical or Important findings:

```bash
git add tests/main-react.spec.ts
git commit -m "test(main): cover donut summary flow"
```

Merge into `main`, rerun `npm run check`, `npx vitest run`, `npx vite build`, then push only when the merged tree is green. Preserve the Orca-managed worktree.
