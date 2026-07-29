# Main Quick Setup UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Main’s item-and-account setup with a 2–3 minute scalar cashflow setup that keeps income, planned outflow, and remaining cash visible while the user enters data.

**Architecture:** Introduce a minimal `MainData` schema v2 and pure cashflow calculations, then adapt persistence, application state, setup UI, and dashboard in that order. Keep the existing cross-tab save lock and draft/apply transaction boundary, but remove v1 migration and legacy account projection from Main. Isolate formatted money editing and flow visualization into focused components.

**Tech Stack:** React 19.2.5, TypeScript 5.9.3 strict mode, Vite 5.4.21 MPA, Tailwind CSS 4.2.4, Vitest 4.1.5, jsdom 26.1.0, Testing Library, Playwright 1.60, vite-plugin-pwa 0.21.1, GitHub Actions Node 22

## Global Constraints

- Canonical Main data uses `schemaVersion: 2` and storage key `isf-main-v2`.
- Setup progress uses `isf-main-v2-setup-progress`.
- Do not migrate, delete, or project Main v1 data.
- Do not add account, allocation, item-name, or other-app fields to Main v2.
- Other-app adapters and Account Map integration remain out of scope.
- Keep the existing cross-tab save lock behavior and its adversarial tests.
- Keep all navigation and assets under Vite base `/IndividualSavingsFlowUI/`; never assume `/`.
- No new runtime dependency.
- Money fields show commas while editing and preserve caret through edits.
- Setup copy must match the approved design spec exactly.

---

## File Structure

**Create**

- `src/main/ui/setup/FlowContextSummary.tsx`: live income, planned amount, remaining amount, and single usage gauge.
- `src/main/ui/setup/AllocationBar.tsx`: final consumption, saving, investment, and remaining segmented bar.
- `tests/unit/main/FlowContextSummary.test.tsx`: live summary and percentage interaction coverage.
- `tests/unit/main/AllocationBar.test.tsx`: segmented final allocation coverage.

**Modify**

- `src/main/domain/model.ts`: scalar schema v2 and setup steps.
- `src/main/domain/cashflow.ts`: scalar totals, percentages, and deficit.
- `src/main/domain/money.ts`: digit normalization, formatting, adjustment, and caret mapping.
- `src/main/domain/validation.ts`: v2 shape and positive-income validation.
- `src/main/infrastructure/backup.ts`: schema v2 JSON import/export.
- `src/main/infrastructure/mainRepository.ts`: v2-only persistence while retaining save locking.
- `src/main/application/bootstrap.ts`: v2 load, progress resume, validation, and apply.
- `src/main/application/mainReducer.ts`: v2 setup state transitions.
- `src/main/ui/common/MoneyField.tsx`: controlled display string and caret-safe editing.
- `src/main/ui/setup/SetupFlow.tsx`: four data-entry stages, approved copy, summary, and review.
- `src/main/ui/MainApp.tsx`: new validation paths and setup behavior.
- `src/main/ui/dashboard/SummaryDashboard.tsx`: scalar v2 dashboard and editing.
- `src/main/ui/dashboard/CashflowSummary.tsx`: v2 summary values.
- `src/main/ui/main.css`: gauge, tooltip, suffix, and compact adjustment-button states.
- `tests/main-react.spec.ts`: new first-run and GitHub Pages route journey.
- Existing `tests/unit/main/*.test.ts(x)` files corresponding to modified modules.

**Delete after callers are removed**

- `src/main/infrastructure/legacyMigration.ts`
- `src/main/domain/sankey.ts`
- `src/main/ui/dashboard/CashflowSankey.tsx`
- `src/main/ui/editor/FinancialEditor.tsx`
- Tests dedicated only to those deleted modules.

---

### Task 1: Define Main v2 Domain Contract

**Files:**
- Modify: `src/main/domain/model.ts`
- Modify: `src/main/domain/cashflow.ts`
- Modify: `src/main/domain/validation.ts`
- Test: `tests/unit/main/model.test.ts`
- Test: `tests/unit/main/cashflow.test.ts`
- Test: `tests/unit/main/validation.test.ts`

**Interfaces:**
- Produces: `MainData`, `SetupStep`, `createEmptyMainData()`, `CashflowSummary`, `calculateCashflow(data)`, `percentageOfIncome(amountWon, incomeWon)`, `validateMainData(data)`.
- Consumes: no infrastructure or React modules.

- [ ] **Step 1: Replace old fixtures with failing schema v2 tests**

```ts
const data: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

expect(calculateCashflow(data)).toEqual({
  incomeWon: 3_200_000,
  housingWon: 800_000,
  livingWon: 1_000_000,
  consumptionWon: 1_800_000,
  savingWon: 300_000,
  investmentWon: 200_000,
  plannedOutflowWon: 2_300_000,
  remainingWon: 900_000,
  deficitWon: 0,
});
expect(percentageOfIncome(1_800_000, 3_200_000)).toBeCloseTo(56.25);
expect(percentageOfIncome(1, 0)).toBeNull();
```

Add validation cases for income `0`, each negative field, exact 100%, and over 100%. Assert over 100% remains valid.

- [ ] **Step 2: Run the domain tests and verify schema mismatch failures**

Run: `npx vitest run tests/unit/main/model.test.ts tests/unit/main/cashflow.test.ts tests/unit/main/validation.test.ts`

Expected: FAIL because schema v2 scalar fields and `percentageOfIncome` do not exist.

- [ ] **Step 3: Implement the minimal v2 model and calculations**

```ts
export type SetupStep = 'welcome' | 'income' | 'housing' | 'living' | 'saving-investment' | 'review';

export interface MainData {
  schemaVersion: 2;
  updatedAt: number;
  monthlyNetIncomeWon: number;
  monthlyHousingWon: number;
  monthlyLivingWon: number;
  monthlySavingWon: number;
  monthlyInvestmentWon: number;
}

export function percentageOfIncome(amountWon: number, incomeWon: number): number | null {
  return incomeWon > 0 ? (amountWon / incomeWon) * 100 : null;
}
```

Validation permits every non-negative safe integer but requires `monthlyNetIncomeWon > 0`.

- [ ] **Step 4: Run domain tests**

Run: `npx vitest run tests/unit/main/model.test.ts tests/unit/main/cashflow.test.ts tests/unit/main/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/model.ts src/main/domain/cashflow.ts src/main/domain/validation.ts tests/unit/main/model.test.ts tests/unit/main/cashflow.test.ts tests/unit/main/validation.test.ts
git commit -m "refactor(main): define scalar v2 cashflow"
```

### Task 2: Add Caret-Safe Money Editing

**Files:**
- Modify: `src/main/domain/money.ts`
- Modify: `src/main/ui/common/MoneyField.tsx`
- Test: `tests/unit/main/money.test.ts`
- Test: `tests/unit/main/MoneyField.test.tsx`

**Interfaces:**
- Consumes: `valueWon: number`, `onChange(valueWon: number): void`.
- Produces: `formatWonInput(valueWon)`, `normalizeMoneyEdit(raw, selectionStart)`, `adjustWon(valueWon, deltaWon)`, and the existing `MoneyField` React API extended with adjustment controls.

- [ ] **Step 1: Write failing pure caret and adjustment tests**

```ts
expect(normalizeMoneyEdit('3,020,000', 4)).toEqual({
  valueWon: 3_020_000,
  displayValue: '3,020,000',
  caret: 4,
});
expect(normalizeMoneyEdit('3,200,000', 3)).toMatchObject({
  valueWon: 3_200_000,
  caret: 3,
});
expect(adjustWon(50_000, -100_000)).toBe(0);
expect(adjustWon(3_000_000, 500_000)).toBe(3_500_000);
```

Add cases for insertion before a comma, backward deletion, selected replacement, pasted Korean/space text, empty input, and unsafe integers.

- [ ] **Step 2: Run money tests and verify failure**

Run: `npx vitest run tests/unit/main/money.test.ts tests/unit/main/MoneyField.test.tsx`

Expected: FAIL because caret normalization and adjustment controls are absent.

- [ ] **Step 3: Implement digit-relative caret mapping**

Count digits before the browser caret, format the sanitized digits with `ko-KR`, then place the caret after the same digit count in the formatted string. Keep the display string local during editing; synchronize from `valueWon` only when the external numeric value changes. Restore selection in `useLayoutEffect`.

```ts
const adjustmentButtons = [
  { label: '−10만', deltaWon: -100_000 },
  { label: '+10만', deltaWon: 100_000 },
  { label: '+50만', deltaWon: 500_000 },
] as const;
```

Render `원` outside the input and add an `초기화` button that emits `0`.

- [ ] **Step 4: Run money unit and component tests**

Run: `npx vitest run tests/unit/main/money.test.ts tests/unit/main/MoneyField.test.tsx`

Expected: PASS, including caret assertions using `selectionStart`.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/money.ts src/main/ui/common/MoneyField.tsx tests/unit/main/money.test.ts tests/unit/main/MoneyField.test.tsx
git commit -m "feat(main): improve money entry controls"
```

### Task 3: Persist Main v2 Without Legacy Projection

**Files:**
- Modify: `src/main/infrastructure/mainRepository.ts`
- Modify: `src/main/infrastructure/backup.ts`
- Delete: `src/main/infrastructure/legacyMigration.ts`
- Test: `tests/unit/main/mainRepository.test.ts`
- Test: `tests/unit/main/backup.test.ts`
- Delete: `tests/unit/main/legacyMigration.test.ts`

**Interfaces:**
- Consumes: schema v2 `MainData`.
- Produces: unchanged `MainRepository` method surface using v2 values and `MigrationResult` renamed to `MainLoadResult`.
- Preserves: `BrowserMainSaveLock` and all cross-tab exclusion behavior.

- [ ] **Step 1: Replace repository expectations with v2-only failing tests**

Test these exact storage rules:

```ts
expect(storage.getItem('isf-main-v2')).toBe(JSON.stringify(saved));
expect(storage.getItem('isf-main-v1')).toBe(v1Raw);
expect(storage.getItem('isf-rebuild-v1')).toBe(legacyRaw);
expect(storage.getItem('isf-main-v2-setup-progress')).toContain('"step":"housing"');
```

Cover: no v2 starts empty even when v1 exists; valid v2 loads; malformed v2 returns failed load; save timestamps and history remain monotonic; pending recovery remains explicit; fallback cross-tab lock tests remain unchanged.

- [ ] **Step 2: Run repository and backup tests**

Run: `npx vitest run tests/unit/main/mainRepository.test.ts tests/unit/main/backup.test.ts`

Expected: FAIL on old keys, schema v1 parsing, and legacy writes.

- [ ] **Step 3: Remove legacy projection while retaining transaction safety**

Set:

```ts
const MAIN_KEY = 'isf-main-v2';
const PENDING_KEY = 'isf-main-v2-pending';
const SETUP_PROGRESS_KEY = 'isf-main-v2-setup-progress';
const DISMISSED_RECOVERY_KEY = 'isf-main-v2-dismissed-recovery';
```

Delete reads and writes for `isf-main-v1`, `isf-rebuild-v1`, and `isf-step1-active`. Keep pending-before-current ordering, history persistence, rollback checks, ownership assertions, and the bakery fallback lock. Validate backup JSON with `isMainDataShape`.

- [ ] **Step 4: Run repository, backup, and lock tests**

Run: `npx vitest run tests/unit/main/mainRepository.test.ts tests/unit/main/backup.test.ts`

Expected: PASS with every `BrowserMainSaveLock` test retained.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mainRepository.ts src/main/infrastructure/backup.ts tests/unit/main/mainRepository.test.ts tests/unit/main/backup.test.ts
git rm src/main/infrastructure/legacyMigration.ts tests/unit/main/legacyMigration.test.ts
git commit -m "refactor(main): persist v2 without legacy data"
```

### Task 4: Adapt Application State to the Four Input Stages

**Files:**
- Modify: `src/main/application/bootstrap.ts`
- Modify: `src/main/application/mainReducer.ts`
- Modify: `src/main/ui/MainApp.tsx`
- Test: `tests/unit/main/bootstrap.test.ts`
- Test: `tests/unit/main/mainReducer.test.ts`
- Test: `tests/unit/main/MainApp.test.tsx`

**Interfaces:**
- Consumes: Task 1 `SetupStep` and Task 3 `MainRepository`.
- Produces: setup resume, apply, cancel, restart, recovery, and validation focus using scalar paths.

- [ ] **Step 1: Rewrite failing state-flow tests**

Assert setup sequence:

```ts
expect(state.setupStep).toBe('welcome');
expect(setupStepForIssue('monthlyNetIncomeWon')).toBe('income');
expect(setupStepForIssue('monthlyHousingWon')).toBe('housing');
expect(setupStepForIssue('monthlyLivingWon')).toBe('living');
expect(setupStepForIssue('monthlySavingWon')).toBe('saving-investment');
```

Retain tests proving applied and draft data remain separate, cancel restores applied data, progress-save failure does not block editing, and save rejection does not replace applied data.

- [ ] **Step 2: Run application tests**

Run: `npx vitest run tests/unit/main/bootstrap.test.ts tests/unit/main/mainReducer.test.ts tests/unit/main/MainApp.test.tsx`

Expected: FAIL on removed item paths and account stage.

- [ ] **Step 3: Update application transitions and validation routing**

Use the ordered stages:

```ts
['welcome', 'income', 'housing', 'living', 'saving-investment', 'review']
```

Remove migration-specific status branches. Preserve recovery for malformed v2 and pending v2. Keep progress persistence before stage transitions.

- [ ] **Step 4: Run application tests**

Run: `npx vitest run tests/unit/main/bootstrap.test.ts tests/unit/main/mainReducer.test.ts tests/unit/main/MainApp.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/bootstrap.ts src/main/application/mainReducer.ts src/main/ui/MainApp.tsx tests/unit/main/bootstrap.test.ts tests/unit/main/mainReducer.test.ts tests/unit/main/MainApp.test.tsx
git commit -m "refactor(main): adopt v2 setup state"
```

### Task 5: Build Live Summary and Allocation Bars

**Files:**
- Create: `src/main/ui/setup/FlowContextSummary.tsx`
- Create: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Create: `tests/unit/main/FlowContextSummary.test.tsx`
- Create: `tests/unit/main/AllocationBar.test.tsx`

**Interfaces:**
- Consumes: Task 1 `MainData`, `calculateCashflow`, and `percentageOfIncome`.
- Produces: `<FlowContextSummary data={draft} />` and `<AllocationBar data={draft} />`.

- [ ] **Step 1: Write failing accessible visualization tests**

```tsx
render(<FlowContextSummary data={cashflowFixture} />);
expect(screen.getByText('월 수입 320만 원')).toBeVisible();
expect(screen.getByText('현재 계획 230만 원')).toBeVisible();
expect(screen.getByText('남는 돈 90만 원')).toBeVisible();
expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '71.875');

render(<AllocationBar data={cashflowFixture} />);
expect(screen.getByLabelText('소비 56.3%')).toBeVisible();
expect(screen.getByLabelText('저축 9.4%')).toBeVisible();
expect(screen.getByLabelText('투자 6.3%')).toBeVisible();
expect(screen.getByLabelText('남는 돈 28.1%')).toBeVisible();
```

Add 0-income, exact-100%, and deficit cases. Assert tooltip text is only the formatted percentage.

- [ ] **Step 2: Run visualization tests**

Run: `npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement accessible bars**

`FlowContextSummary` uses a native meter role or an equivalent element with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. Clamp visual width to 100 while retaining true percentage in accessible text. Tooltip opens on hover, focus, and click/tap and contains only values such as `71.9%`.

`AllocationBar` renders labeled segments. For deficit, render consumption, saving, and investment proportionally against planned outflow while separately announcing the amount over income; never render a negative remaining segment.

- [ ] **Step 4: Run visualization tests**

Run: `npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/setup/FlowContextSummary.tsx src/main/ui/setup/AllocationBar.tsx src/main/ui/main.css tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
git commit -m "feat(main): show live cashflow context"
```

### Task 6: Replace Setup Content and Stages

**Files:**
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Test: `tests/unit/main/SetupFlow.test.tsx`

**Interfaces:**
- Consumes: Task 2 `MoneyField`, Task 5 summary components, v2 `MainData`.
- Produces: approved start, income, housing, living, saving-investment, and review forms.

- [ ] **Step 1: Write failing setup journey tests**

Cover exact headings and labels:

```ts
expect(screen.getByRole('heading', { name: '한 달에 실제로 들어오는 돈은 얼마인가요?' })).toBeVisible();
expect(screen.getByLabelText('월 실수령액')).toHaveValue('3,200,000');
expect(screen.getByText('월세 또는 전세대출 이자, 관리비, 공과금을 합친 금액')).toBeVisible();
expect(screen.getByText('식비, 교통비, 경조사비 등 최근 몇 달의 평균')).toBeVisible();
expect(screen.getByText('정해둔 금액이 없다면 건너뛰어도 돼요.')).toBeVisible();
```

Assert no account, allocation, income-name, or item-name control exists. Assert the live summary appears after the income step and updates on every field change. Assert income 0 blocks forward navigation, other 0 values do not, and review invokes `onApply`.

- [ ] **Step 2: Run SetupFlow tests**

Run: `npx vitest run tests/unit/main/SetupFlow.test.tsx`

Expected: FAIL on old steps, old copy, and old item controls.

- [ ] **Step 3: Implement approved setup flow**

Use scalar updates:

```ts
onChange({ ...draft, monthlyHousingWon: amountWon });
onChange({ ...draft, monthlyLivingWon: amountWon });
onChange({ ...draft, monthlySavingWon: amountWon });
onChange({ ...draft, monthlyInvestmentWon: amountWon });
```

Keep one form per stage, heading focus on stage change, exact invalid-field focus after apply, disabled controls during save, previous navigation, and progress persistence through `MainApp`.

- [ ] **Step 4: Run setup and money component tests**

Run: `npx vitest run tests/unit/main/SetupFlow.test.tsx tests/unit/main/MoneyField.test.tsx tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/setup/SetupFlow.tsx tests/unit/main/SetupFlow.test.tsx
git commit -m "feat(main): add four-step quick setup"
```

### Task 7: Simplify the Applied Main Dashboard

**Files:**
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/dashboard/CashflowSummary.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Delete: `src/main/domain/sankey.ts`
- Delete: `src/main/ui/dashboard/CashflowSankey.tsx`
- Delete: `src/main/ui/editor/FinancialEditor.tsx`
- Delete: `tests/unit/main/sankey.test.ts`
- Delete: `tests/unit/main/CashflowSankey.test.tsx`
- Delete: `tests/unit/main/FinancialEditor.test.tsx`
- Delete: `tests/unit/main/SummaryDashboardBoundary.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`

**Interfaces:**
- Consumes: v2 `MainData`, `CashflowSummary`, `MoneyField`, and `AllocationBar`.
- Produces: dashboard displaying and editing the five canonical values without account or item controls.

- [ ] **Step 1: Write failing v2 dashboard tests**

Assert the dashboard prioritizes:

```ts
expect(screen.getByText('월 실수령액')).toBeVisible();
expect(screen.getByText('월 소비')).toBeVisible();
expect(screen.getByText('남는 돈')).toBeVisible();
expect(screen.getByLabelText(/소비 56\\.3%/)).toBeVisible();
expect(screen.queryByText(/계좌|배분|Sankey/)).not.toBeInTheDocument();
```

Retain draft/apply/cancel, restart setup, backup import/export, dirty-exit warning, mobile dialog focus trap, save failure, and exact validation focus tests using scalar field labels.

- [ ] **Step 2: Run dashboard tests**

Run: `npx vitest run tests/unit/main/SummaryDashboard.test.tsx`

Expected: FAIL because the dashboard expects item collections and accounts.

- [ ] **Step 3: Replace item editors with five scalar fields**

Keep applied values visible until apply succeeds. Edit a cloned scalar draft in the existing modal/desktop editor boundary. Remove account cards, account menu entries, Sankey boundary, item add/remove, allocations, and item naming.

- [ ] **Step 4: Remove dead modules and run Main UI tests**

Run: `npx vitest run tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/backup.test.ts`

Expected: PASS with no imports from deleted modules.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/dashboard/CashflowSummary.tsx src/main/ui/MainApp.tsx tests/unit/main/SummaryDashboard.test.tsx
git rm src/main/domain/sankey.ts src/main/ui/dashboard/CashflowSankey.tsx src/main/ui/editor/FinancialEditor.tsx tests/unit/main/sankey.test.ts tests/unit/main/CashflowSankey.test.tsx tests/unit/main/FinancialEditor.test.tsx tests/unit/main/SummaryDashboardBoundary.test.tsx
git commit -m "refactor(main): focus dashboard on cashflow"
```

### Task 8: Verify the Full Journey and GitHub Pages Build

**Files:**
- Modify: `tests/main-react.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: complete Main v2 UI.
- Produces: browser-level proof for first run, resume, apply, edit, and repository-base routing.

- [ ] **Step 1: Replace old Main journey with failing v2 E2E tests**

Use repository-relative navigation:

```ts
await page.goto('apps/main/');
await page.getByRole('button', { name: '다음' }).click();
await page.getByLabel('월 실수령액').fill('3200000');
await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
```

Continue through housing `800000`, living `1000000`, saving `300000`, investment `200000`. Assert live summary `남는 돈 90만 원`, final four segments, saved `isf-main-v2`, direct refresh, and dashboard totals. Add a mobile test for tap percentage, a keyboard-only journey, and an interrupted setup reload at `housing`.

- [ ] **Step 2: Run the focused E2E test and verify failure**

Run: `npx playwright test tests/main-react.spec.ts`

Expected: FAIL until old selectors and v1 storage assertions are removed.

- [ ] **Step 3: Update E2E fixtures and README wording**

Use only schema v2 fixtures in Main tests. Keep Vite base and `apps/main/` relative URLs. Change the README Main description to `Main은 월 실수령액, 소비, 저축, 투자와 남는 돈을 한눈에 보여줍니다.` Remove claims that Main owns account input, account Sankey, or Network Map. Do not document future adapter behavior as implemented.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run check
npm run test:unit
npx playwright test tests/main-react.spec.ts
npm run build
```

Expected:

- TypeScript source and unit configs: PASS
- Vitest: 0 failures
- Main Playwright spec: 0 failures
- Vite build: exit 0
- Generated Main output exists at `dist/apps/main/index.html`
- Built asset URLs contain `/IndividualSavingsFlowUI/`

Because `npm run build` bumps version files, inspect and include only expected version changes.

- [ ] **Step 5: Commit**

```bash
git add tests/main-react.spec.ts README.md package.json package-lock.json public/manifest.webmanifest shared/legacy/sw.js shared/core/utils.js
git commit -m "test(main): verify v2 quick setup"
```

Omit unchanged files from `git add`. Before committing, verify `git status --short` contains no generated or unrelated files.

---

## Final Review Gate

- [ ] Compare every requirement in `docs/superpowers/specs/2026-07-29-main-quick-setup-ux-design.md` with the implemented UI and tests.
- [ ] Run `rg -n "account|allocation|isf-main-v1|isf-rebuild-v1" src/main tests/unit/main tests/main-react.spec.ts` and classify every remaining match; no Main v2 ownership or migration path may remain.
- [ ] Run `git diff --check`.
- [ ] Run the full verification commands from Task 8 on the final commit.
- [ ] Request a code review before push or merge.
