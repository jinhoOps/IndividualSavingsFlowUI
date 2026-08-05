# Focused Money Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main 편집기에서는 현재 포커스된 금액 필드만 빠른 조정을 표시하고, Simulation 시작 자산에는 큰 금액용 네 개의 빠른 조정 버튼을 제공한다.

**Architecture:** 공용 Main `MoneyField`는 기본 상시 노출을 유지하면서 선택적인 `focused` 노출 모드를 CSS `:focus-within`으로 제공한다. Simulation은 시작 자산 단계의 기존 로컬 정수 상태를 그대로 사용하고, 전용 4열 버튼 행이 같은 상태를 0원 하한으로 증감한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4/CSS, Vitest + Testing Library, Playwright

## Global Constraints

- Main setup의 기존 빠른 조정 동작은 변경하지 않는다.
- Main과 Simulation 저장 schema 및 앱 간 데이터 소유권은 변경하지 않는다.
- Simulation 버튼 순서는 `-1000만`, `-100만`, `+100만`, `+1000만`이다.
- Simulation 차감 결과는 0원보다 작아지지 않는다.
- 390px에서 네 버튼은 한 줄이고 각 터치 대상 높이는 최소 44px이다.
- 사용자 및 다른 작업자의 관련 없는 변경을 보존한다.

---

### Task 1: Main 포커스 기반 빠른 조정

**Files:**
- Modify: `tests/unit/main/MoneyField.test.tsx`
- Modify: `src/main/ui/common/MoneyField.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: 기존 `MoneyFieldProps`와 `onChange(valueWon: number): void`
- Produces: `adjustmentsVisibility?: 'always' | 'focused'`; 생략 시 `always`

- [ ] **Step 1: 단위 실패 테스트 작성**

`MoneyField.test.tsx`에 기본 모드는 기존 클래스를 유지하고 focused 모드는 루트에 `money-field--focused-adjustments`를 추가하는 테스트를 작성한다.

```tsx
it('marks only opt-in fields for focus-based adjustment visibility', () => {
  const { rerender } = render(
    <MoneyField id="amount" label="금액" valueWon={0} onChange={vi.fn()} />,
  );
  expect(screen.getByLabelText('금액').closest('.money-field'))
    .not.toHaveClass('money-field--focused-adjustments');

  rerender(
    <MoneyField
      id="amount"
      label="금액"
      valueWon={0}
      adjustmentsVisibility="focused"
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('금액').closest('.money-field'))
    .toHaveClass('money-field--focused-adjustments');
});
```

- [ ] **Step 2: 단위 테스트 RED 확인**

Run: `npm run test:unit -- tests/unit/main/MoneyField.test.tsx`

Expected: FAIL — `adjustmentsVisibility` prop 또는 focused 클래스가 없다.

- [ ] **Step 3: 최소 컴포넌트·스타일 구현**

`MoneyFieldProps`에 선택 속성을 추가하고 루트 클래스를 조건부로 구성한다.

```tsx
adjustmentsVisibility?: 'always' | 'focused';

export function MoneyField({
  adjustmentsVisibility = 'always',
  ...props
}: MoneyFieldProps) {
  return (
    <div className={adjustmentsVisibility === 'focused'
      ? 'money-field money-field--focused-adjustments'
      : 'money-field'}>
      {/* 기존 내용 */}
    </div>
  );
}
```

`main.css`에서 opt-in 필드만 숨기고 `:focus-within`일 때 표시한다.

```css
.money-field--focused-adjustments > .money-field__adjustments {
  display: none;
}

.money-field--focused-adjustments:focus-within > .money-field__adjustments {
  display: flex;
}
```

`SummaryDashboard.tsx`의 다섯 `MoneyField`에만 아래 속성을 지정한다.

```tsx
adjustmentsVisibility="focused"
```

- [ ] **Step 4: 단위 테스트 GREEN 확인**

Run: `npm run test:unit -- tests/unit/main/MoneyField.test.tsx`

Expected: PASS

- [ ] **Step 5: Main 사용자 동작 E2E 실패 테스트 작성**

`tests/main-react.spec.ts`에서 적용된 계획을 연 뒤 편집기를 열고 CSS 가시성을 검사한다. 첫 입력 포커스 시 해당 필드의 `.money-field__adjustments`만 보이고, 다음 입력 포커스 시 표시 대상이 바뀌며, setup의 버튼은 별도 회귀에서 계속 표시됨을 확인한다.

```ts
const fields = page.locator('[aria-labelledby="cashflow-editor-title"] .money-field');
await fields.nth(0).getByRole('textbox').focus();
await expect(fields.nth(0).locator('.money-field__adjustments')).toBeVisible();
await expect(fields.nth(1).locator('.money-field__adjustments')).toBeHidden();
await fields.nth(1).getByRole('textbox').focus();
await expect(fields.nth(0).locator('.money-field__adjustments')).toBeHidden();
await expect(fields.nth(1).locator('.money-field__adjustments')).toBeVisible();
```

- [ ] **Step 6: Main E2E RED 확인 후 selector/fixture만 보정**

Run: `npx playwright test tests/main-react.spec.ts --grep "편집 중인 금액" --reporter=list`

Expected: 구현 전 상태에서는 여러 필드의 조정 영역이 동시에 보여 FAIL. 테스트 fixture 진입 문제만 고치고 제품 기대값은 유지한다.

- [ ] **Step 7: Main E2E GREEN 확인**

Run: `npx playwright test tests/main-react.spec.ts --grep "편집 중인 금액" --reporter=list`

Expected: PASS

- [ ] **Step 8: Main 변경 커밋**

```bash
git add tests/unit/main/MoneyField.test.tsx src/main/ui/common/MoneyField.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/main.css tests/main-react.spec.ts
git commit -m "feat(main): focus money adjustments"
```

### Task 2: Simulation 시작 자산 빠른 조정

**Files:**
- Modify: `tests/unit/simulation/SimulationOnboarding.test.tsx`
- Modify: `src/simulation/ui/StartingPrincipalStep.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: `StartingPrincipalStep({ onContinue(initialInvestmentWon: number): void })`
- Produces: 시작 자산 입력과 같은 `rawAmount` 상태를 갱신하는 네 개의 button; 저장 계약 변화 없음

- [ ] **Step 1: Simulation 증감 실패 테스트 작성**

`SimulationOnboarding.test.tsx`에서 시작 자산 입력을 연 뒤 네 버튼의 실제 결과와 0원 하한을 검증한다. 기대값은 각 클릭 뒤 입력값의 리터럴로 확인한다.

```tsx
fireEvent.click(screen.getByRole('button', { name: '있어요' }));
const input = screen.getByRole('textbox', { name: '현재 모아둔 투자금' });
fireEvent.change(input, { target: { value: '5000000' } });
fireEvent.click(screen.getByRole('button', { name: '-1000만' }));
expect(input).toHaveValue('0');
fireEvent.click(screen.getByRole('button', { name: '+100만' }));
expect(input).toHaveValue('1000000');
fireEvent.click(screen.getByRole('button', { name: '+1000만' }));
expect(input).toHaveValue('11000000');
fireEvent.click(screen.getByRole('button', { name: '-100만' }));
expect(input).toHaveValue('10000000');
```

- [ ] **Step 2: Simulation 단위 테스트 RED 확인**

Run: `npm run test:unit -- tests/unit/simulation/SimulationOnboarding.test.tsx`

Expected: FAIL — 네 빠른 조정 버튼이 없다.

- [ ] **Step 3: 최소 증감 구현**

`StartingPrincipalStep.tsx`에 버튼 정의와 0원 하한 조정 함수를 두고 입력 아래 4열 영역을 렌더링한다.

```tsx
const principalAdjustments = [
  { label: '-1000만', deltaWon: -10_000_000 },
  { label: '-100만', deltaWon: -1_000_000 },
  { label: '+100만', deltaWon: 1_000_000 },
  { label: '+1000만', deltaWon: 10_000_000 },
] as const;

function adjustPrincipal(rawAmount: string, deltaWon: number): string {
  const current = Number(rawAmount);
  const safeCurrent = Number.isSafeInteger(current) && current >= 0 ? current : 0;
  return String(Math.max(0, safeCurrent + deltaWon));
}
```

```tsx
<div className="simulation-principal-adjustments">
  {principalAdjustments.map(({ label, deltaWon }) => (
    <button key={label} type="button" className="ui-button ui-button--secondary"
      onClick={() => setRawAmount((value) => adjustPrincipal(value, deltaWon))}>
      {label}
    </button>
  ))}
</div>
```

`simulation.css`에서 전체 행을 form의 양 열에 걸치고 4열을 유지한다.

```css
.simulation-principal-adjustments {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .375rem;
}

.simulation-principal-adjustments .ui-button {
  min-width: 0;
  min-height: 44px;
  padding-inline: .25rem;
  white-space: nowrap;
}
```

- [ ] **Step 4: Simulation 단위 테스트 GREEN 확인**

Run: `npm run test:unit -- tests/unit/simulation/SimulationOnboarding.test.tsx`

Expected: PASS

- [ ] **Step 5: 390px 레이아웃 E2E 실패 테스트 작성**

`tests/simulation.spec.ts`에서 390px로 시작 자산 입력을 연 뒤 네 버튼의 y 좌표가 같고 각각 높이가 44px 이상이며 문서 가로 overflow가 없는지 확인한다.

```ts
const buttons = ['-1000만', '-100만', '+100만', '+1000만']
  .map((name) => page.getByRole('button', { name }));
const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
expect(boxes.every((box) => box !== null && box.height >= 44)).toBe(true);
expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
```

- [ ] **Step 6: Simulation E2E RED 확인 후 selector/fixture만 보정**

Run: `npx playwright test tests/simulation.spec.ts --grep "시작 자산 빠른 조정" --reporter=list`

Expected: FAIL — 빠른 조정 버튼이 없다. 테스트 진입 문제만 보정하고 레이아웃 기대값은 유지한다.

- [ ] **Step 7: Simulation E2E GREEN 확인**

Run: `npx playwright test tests/simulation.spec.ts --grep "시작 자산 빠른 조정" --reporter=list`

Expected: PASS

- [ ] **Step 8: Simulation 변경 커밋**

```bash
git add tests/unit/simulation/SimulationOnboarding.test.tsx src/simulation/ui/StartingPrincipalStep.tsx src/simulation/ui/simulation.css tests/simulation.spec.ts
git commit -m "feat(simulation): add principal adjustments"
```

### Task 3: 통합 검증

**Files:**
- Verify only; 실패 수정이 필요하면 Task 1 또는 Task 2 파일만 수정

**Interfaces:**
- Consumes: Task 1의 `adjustmentsVisibility`와 Task 2의 시작 자산 빠른 조정
- Produces: 타입·단위·Main/Simulation 사용자 흐름 검증 증거

- [ ] **Step 1: 정적 검사**

Run: `npm run check`

Expected: PASS

- [ ] **Step 2: 전체 단위 테스트**

Run: `npm run test:unit`

Expected: PASS

- [ ] **Step 3: 영향 E2E**

Run: `npx playwright test tests/main-react.spec.ts tests/simulation.spec.ts --reporter=list`

Expected: PASS

- [ ] **Step 4: diff 품질 확인**

Run: `git diff --check && git status --short`

Expected: whitespace 오류 없음. 상태에는 의도한 변경만 있거나, 모든 구현 커밋 후 깨끗함.

- [ ] **Step 5: 검증 중 수정이 있었다면 커밋**

```bash
git add tests/unit/main/MoneyField.test.tsx src/main/ui/common/MoneyField.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/main.css tests/main-react.spec.ts tests/unit/simulation/SimulationOnboarding.test.tsx src/simulation/ui/StartingPrincipalStep.tsx src/simulation/ui/simulation.css tests/simulation.spec.ts
git commit -m "fix(ui): stabilize money adjustments"
```
