# Main Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the quick setup, dashboard, and editor under one compact visual system while reducing the flow gauges to percentage-only interactive bars.

**Architecture:** Add small React primitives for buttons, surfaces, and percentage tooltips, then migrate existing main-app components onto those primitives. Keep cashflow calculations, persistence, backup, recovery, and routing unchanged; visual behavior remains local to `src/main/ui`.

**Tech Stack:** React 19, Vite 5, TypeScript 5.5, Tailwind CSS 4, Vitest 4, Testing Library, Playwright

## Global Constraints

- New main runtime source remains exclusively in `src/main/**/*.ts` and `src/main/**/*.tsx`.
- Do not add `es-toolkit`; reconsider it only during the later cross-app integration design.
- Do not import from legacy `apps/main/**/*.js` or other JavaScript application modules.
- Preserve schema v2 storage, recovery, backup, PWA, and GitHub Pages base `/IndividualSavingsFlowUI/`.
- Preserve money formatting, caret behavior, cashflow calculations, and editor focus management.
- Percentage tooltips contain only a value such as `56.3%`.
- The compact flow bar exposes percentage through hover, focus, and tap.

---

### Task 1: Shared visual primitives and tokens

**Files:**
- Create: `src/main/ui/common/Button.tsx`
- Create: `src/main/ui/common/Surface.tsx`
- Create: `tests/unit/main/Button.test.tsx`
- Create: `tests/unit/main/Surface.test.tsx`
- Modify: `src/main/ui/main.css`

**Interfaces:**
- Produces: `Button({ variant?: 'primary' | 'secondary' | 'quiet', className?, ...buttonProps })`
- Produces: `Surface({ as?: 'section' | 'div' | 'aside', className?, ...elementProps })`
- Produces CSS classes `.ui-button`, `.ui-button--primary`, `.ui-button--secondary`, `.ui-button--quiet`, `.ui-surface`, and shared control tokens.

- [ ] **Step 1: Write failing primitive tests**

```tsx
render(<Button variant="quiet">+10만</Button>);
expect(screen.getByRole('button', { name: '+10만' })).toHaveClass(
  'ui-button',
  'ui-button--quiet',
);

render(<Surface as="section" aria-label="요약">내용</Surface>);
expect(screen.getByRole('region', { name: '요약' })).toHaveClass('ui-surface');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/main/Button.test.tsx tests/unit/main/Surface.test.tsx`

Expected: FAIL because `Button.tsx` and `Surface.tsx` do not exist.

- [ ] **Step 3: Implement the typed primitives**

```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...props}
    />
  );
}
```

Implement `Surface` with an `as` switch that returns the requested semantic element and always merges `ui-surface` with `className`:

```tsx
export function Surface({ as = 'div', className = '', children, ...props }: SurfaceProps) {
  const classes = `ui-surface ${className}`.trim();
  if (as === 'section') return <section className={classes} {...props}>{children}</section>;
  if (as === 'aside') return <aside className={classes} {...props}>{children}</aside>;
  return <div className={classes} {...props}>{children}</div>;
}
```

In `main.css`, define shared values for 44px minimum controls, 12px control radius, 24px surface radius, border, focus ring, disabled opacity, and the three button strengths. Keep existing brand colors and fonts.

- [ ] **Step 4: Run focused tests and type checks**

Run: `npm run test:unit -- tests/unit/main/Button.test.tsx tests/unit/main/Surface.test.tsx && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/common/Button.tsx src/main/ui/common/Surface.tsx src/main/ui/main.css tests/unit/main/Button.test.tsx tests/unit/main/Surface.test.tsx
git commit -m "feat(main): add shared visual primitives"
```

---

### Task 2: Unified money input controls

**Files:**
- Modify: `src/main/ui/common/MoneyField.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/MoneyField.test.tsx`

**Interfaces:**
- Consumes: `Button` and its `quiet` variant from Task 1.
- Preserves: `MoneyFieldProps` and all existing `onChange(valueWon: number)` behavior.
- Produces CSS classes `.money-field`, `.money-field__input-row`, `.money-field__unit`, `.money-field__adjustments`, and `.money-field__reset`.

- [ ] **Step 1: Add failing style and state tests**

```tsx
render(<MoneyField id="amount" label="금액" valueWon={3_000_000} onChange={vi.fn()} />);

expect(screen.getByLabelText('금액')).toHaveClass('money-field__input');
expect(screen.getByRole('button', { name: '-10만' })).toHaveClass('ui-button--quiet');
expect(screen.getByRole('button', { name: '초기화' })).toHaveClass(
  'ui-button--quiet',
  'money-field__reset',
);
```

Add this disabled-state case:

```tsx
render(<MoneyField id="amount" label="금액" valueWon={0} disabled onChange={vi.fn()} />);
expect(screen.getByLabelText('금액')).toBeDisabled();
for (const name of ['-10만', '+10만', '+50만', '초기화']) {
  expect(screen.getByRole('button', { name })).toBeDisabled();
}
```

- [ ] **Step 2: Run the MoneyField test and verify RED**

Run: `npm run test:unit -- tests/unit/main/MoneyField.test.tsx`

Expected: FAIL because the common classes and shared buttons are absent.

- [ ] **Step 3: Migrate MoneyField to shared controls**

Use `Button variant="quiet"` for all four adjustment actions. Add named layout classes while retaining controlled input formatting, digit-relative caret restoration, adjustment values, validation attributes, and `원` suffix.

Add compact wrapping adjustment layout and a subdued reset style in `main.css`. Ensure each button retains a minimum 44px touch height.

- [ ] **Step 4: Run MoneyField tests and source checks**

Run: `npm run test:unit -- tests/unit/main/MoneyField.test.tsx && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/common/MoneyField.tsx src/main/ui/main.css tests/unit/main/MoneyField.test.tsx
git commit -m "refactor(main): unify money input controls"
```

---

### Task 3: Compact flow bar with positioned tooltip

**Files:**
- Create: `src/main/ui/common/PercentageTooltip.tsx`
- Create: `tests/unit/main/PercentageTooltip.test.tsx`
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`

**Interfaces:**
- Produces: `PercentageTooltip({ id, value, open, position })`, where `position` is `{ xPercent: number }`.
- `FlowContextSummaryProps` remains `{ data: MainData }`.
- The meter remains the full-width `role="meter"` focus and pointer target.

- [ ] **Step 1: Replace verbose summary expectations with compact behavior tests**

```tsx
render(<FlowContextSummary data={cashflowFixture} />);

expect(screen.queryByText('월 수입 320만 원')).not.toBeInTheDocument();
expect(screen.queryByText('현재 계획 230만 원')).not.toBeInTheDocument();
expect(screen.queryByText('남는 돈 90만 원')).not.toBeInTheDocument();
expect(screen.getByRole('meter')).toHaveClass('flow-bar');
```

Cover hover, focus, tap, zero income, and deficit with explicit assertions:

```tsx
fireEvent.pointerMove(meter, { clientX: 40 });
fireEvent.pointerEnter(meter, { clientX: 40 });
expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
fireEvent.pointerLeave(meter);
fireEvent.focus(meter);
expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
fireEvent.blur(meter);
expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
fireEvent.click(meter, { clientX: 40 });
expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
fireEvent.click(meter, { clientX: 40 });
expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

render(<FlowContextSummary data={emptyFixture} />);
expect(screen.getByRole('meter')).toHaveAttribute(
  'aria-valuetext',
  '수입을 먼저 입력해주세요.',
);
expect(screen.queryByText('수입을 먼저 입력해주세요.')).not.toBeInTheDocument();

render(<FlowContextSummary data={deficitFixture} />);
expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '125.0%');
expect(screen.getByRole('meter').firstElementChild).toHaveStyle({ width: '100%' });
```

- [ ] **Step 2: Add a failing PercentageTooltip positioning test**

```tsx
render(
  <PercentageTooltip
    id="tip"
    open
    value="56.3%"
    position={{ xPercent: 42 }}
  />,
);

expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
expect(screen.getByRole('tooltip')).toHaveStyle({ left: '42%' });
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm run test:unit -- tests/unit/main/PercentageTooltip.test.tsx tests/unit/main/FlowContextSummary.test.tsx`

Expected: FAIL because the tooltip primitive is absent and the old summary text is still rendered.

- [ ] **Step 4: Implement compact interaction**

Render only the meter track, visual fill, and `PercentageTooltip`. Use pointer coordinates relative to the bar, clamped from 0 to 100, for hover and tap placement. Use the visual percentage as the keyboard-focus position. Keep pointer, focus, and tap state independent so pointer leave does not close a focused tooltip.

Use a 6px `.flow-bar` with a positioned wrapper. Remove old summary card padding, amount copy, notices, and permanent warnings. Keep deficit information available through meter ARIA text.

- [ ] **Step 5: Run focused tests and checks**

Run: `npm run test:unit -- tests/unit/main/PercentageTooltip.test.tsx tests/unit/main/FlowContextSummary.test.tsx && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ui/common/PercentageTooltip.tsx src/main/ui/setup/FlowContextSummary.tsx src/main/ui/main.css tests/unit/main/PercentageTooltip.test.tsx tests/unit/main/FlowContextSummary.test.tsx
git commit -m "refactor(main): compact flow context bar"
```

---

### Task 4: Allocation bar on the same interaction model

**Files:**
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/AllocationBar.test.tsx`

**Interfaces:**
- Consumes: `PercentageTooltip` from Task 3.
- Preserves: `AllocationBarProps`, allocation calculation, deficit denominator, and amount labels.
- Produces: persistent legend text as `<label> <amount>` without parenthesized percentages.

- [ ] **Step 1: Add failing content and interaction tests**

```tsx
render(<AllocationBar data={cashflowFixture} />);

expect(screen.getByText('소비 180만 원')).toBeVisible();
expect(screen.queryByText('소비 180만 원 (56.3%)')).not.toBeInTheDocument();
```

Require the shared tooltip and zero-value access:

```tsx
fireEvent.focus(screen.getByLabelText('소비 56.3%'));
expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);

render(<AllocationBar data={emptyFixture} />);
expect(screen.getByText('소비 0원')).toBeVisible();
expect(screen.getByRole('button', { name: '소비 0.0%' })).toBeVisible();
```

- [ ] **Step 2: Run AllocationBar tests and verify RED**

Run: `npm run test:unit -- tests/unit/main/AllocationBar.test.tsx`

Expected: FAIL because percentages are permanently printed and the shared tooltip is not used.

- [ ] **Step 3: Migrate AllocationBar**

Use the shared 6px flow-bar geometry and `PercentageTooltip`. Keep the visible legend limited to labels and amounts. Preserve segment ARIA labels containing percentages. Provide a legend-linked keyboard/tap target for zero or too-small segments so the visual segment never needs an artificial width.

- [ ] **Step 4: Run focused tests and checks**

Run: `npm run test:unit -- tests/unit/main/AllocationBar.test.tsx && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/setup/AllocationBar.tsx src/main/ui/main.css tests/unit/main/AllocationBar.test.tsx
git commit -m "refactor(main): unify allocation bar"
```

---

### Task 5: Apply the visual system across setup and dashboard

**Files:**
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/dashboard/CashflowSummary.tsx`
- Modify: `src/main/ui/editor/ApplyBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/SetupFlow.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: `Button`, `Surface`, `MoneyField`, compact `FlowContextSummary`, and unified `AllocationBar`.
- Preserves: setup step navigation, validation focus, dashboard editor focus trap, dirty-state confirmation, backup actions, and apply/cancel behavior.

- [ ] **Step 1: Add failing integration assertions**

In `SetupFlow.test.tsx`, add:

```tsx
expect(screen.getByLabelText('설정 단계').closest('.ui-surface')).not.toBeNull();
expect(screen.getByRole('button', { name: '다음' })).toHaveClass('ui-button--primary');
expect(screen.getByRole('button', { name: '이전' })).toHaveClass('ui-button--secondary');
expect(screen.getByRole('meter')).toHaveClass('flow-bar');
expect(screen.queryByText(/^월 수입 /)).not.toBeInTheDocument();
```

In `SummaryDashboard.test.tsx`, add:

```tsx
expect(screen.getByRole('region', { name: '월 자금 구성' })).toHaveClass('ui-surface');
fireEvent.click(screen.getByRole('button', { name: '금액 수정' }));
expect(screen.getByRole('button', { name: '편집기 닫기' })).toHaveClass('ui-button--quiet');
expect(screen.getByRole('button', { name: '저장' })).toHaveClass('ui-button--primary');
expect(screen.getByRole('button', { name: '취소' })).toHaveClass('ui-button--secondary');
```

- [ ] **Step 2: Run focused integration tests and verify RED**

Run: `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx tests/unit/main/SummaryDashboard.test.tsx`

Expected: FAIL because the screens still use independent inline class strings.

- [ ] **Step 3: Migrate setup and dashboard components**

Replace repeated card and button class strings with `Surface` and `Button`. Keep headings, copy, layout breakpoints, modal structure, and event handlers unchanged. Remove obsolete CSS selectors after all consumers migrate.

- [ ] **Step 4: Add browser-level interaction coverage**

In `tests/main-react.spec.ts`, add these browser assertions:

```ts
const meter = page.getByRole('meter', { name: '수입 대비 현재 계획' });
await meter.hover();
await expect(page.getByRole('tooltip')).toHaveText(/^\d+\.\d%$/);
await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);

await page.setViewportSize({ width: 390, height: 844 });
await meter.tap();
await expect(page.getByRole('tooltip')).toBeVisible();
await page.getByRole('heading').tap();
await expect(page.getByRole('tooltip')).toHaveCount(0);
```

- [ ] **Step 5: Run unit, browser, type, and build verification**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e
npx vite build
git diff --check
```

Expected: all commands pass; the build retains the GitHub Pages base and produces the main React entry without importing legacy JavaScript.

- [ ] **Step 6: Commit**

```bash
git add src/main/ui/setup/SetupFlow.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/dashboard/CashflowSummary.tsx src/main/ui/editor/ApplyBar.tsx src/main/ui/main.css tests/unit/main/SetupFlow.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/main-react.spec.ts
git commit -m "refactor(main): unify app visual system"
```
