# Portfolio Focused Mobile UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Portfolio first-time setup, result viewing, allocation editing, and investment-location management so each mobile state has one clear task.

**Architecture:** Keep the existing workspace, Portfolio draft/plan, reducer persistence, calculation, and shared-location command contracts. Extend Portfolio presentation state for a three-step first-time setup, compose the existing allocation editor inside dedicated setup and edit surfaces, and render investment locations only from a closed-by-default result disclosure. Use the existing Main responsive pattern: a focus-contained bottom sheet at widths up to 768px and a right-side panel above 768px.

**Tech Stack:** React 18, TypeScript, CSS, Vitest with Testing Library, Playwright, Vite.

## Global Constraints

- Do not change Portfolio plan, draft, workspace schema, revision protocol, or location identity.
- Portfolio reads Main `monthlyInvestmentWon` through the existing read-only adapter and never writes Main.
- Do not add location-scoped allocation editing, Account Map functionality, prices, returns, account numbers, or purchase execution.
- First-time setup and allocation editing must not render investment-location UI.
- A cash-only plan with zero investment targets and 100% cash remains valid.
- A first-time draft reload resumes at `allocation`; the setup step is not persisted.
- A clean edit reload returns to result; a changed draft reload resumes editing.
- Widths `<=768px` use a bottom sheet; widths `>768px` use a side panel.
- Visible primary controls remain at least 44px high; dialogs contain focus and return it to their trigger.
- Preserve pointer, touch, keyboard, reduced-motion, draft/apply/cancel, stale-write, and legacy-isolation behavior.

---

### Task 1: Make First-Time Setup an Explicit Reducer State

**Files:**
- Modify: `src/portfolio/application/portfolioReducer.ts`
- Test: `tests/unit/portfolio/portfolioReducer.test.ts`

**Interfaces:**
- Produces: `PortfolioView = 'setup' | 'result' | 'edit'`
- Produces: `PortfolioSetupStep = 'welcome' | 'allocation' | 'review'`
- Produces: `PortfolioState.setupStep: PortfolioSetupStep | null`
- Produces actions: `{ type: 'setup-next' }`, `{ type: 'setup-previous' }`
- Preserves all existing `PortfolioAction` draft and persistence actions.

- [ ] **Step 1: Write failing reducer tests for bootstrap and setup navigation**

```ts
it('starts a cash-only first visit at welcome without persisting a setup step', () => {
  const state = createPortfolioState(ready({ plan: null, draft: createCashOnlyDraft(200_000, 1) }));
  expect(state).toMatchObject({ view: 'setup', setupStep: 'welcome', dirty: false });
});

it('resumes a changed first-time draft at allocation', () => {
  const draft = setItemAmount(
    createCashOnlyDraft(200_000, 1),
    { id: 'index', name: '인덱스', order: 0 },
    120_000,
  );
  expect(createPortfolioState(ready({ plan: null, draft })))
    .toMatchObject({ view: 'setup', setupStep: 'allocation', dirty: true });
});

it('moves welcome, allocation, and review without changing the draft', () => {
  const initial = createPortfolioState(ready({ plan: null }));
  const allocation = portfolioReducer(initial, { type: 'setup-next' });
  const review = portfolioReducer(allocation, { type: 'setup-next' });
  expect(allocation.setupStep).toBe('allocation');
  expect(review.setupStep).toBe('review');
  expect(review.draft).toEqual(initial.draft);
});
```

- [ ] **Step 2: Run tests and confirm they fail on the missing setup state**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts`

Expected: FAIL because `PortfolioState.view` does not accept `setup`, `setupStep` is missing, and setup actions are not handled.

- [ ] **Step 3: Add setup presentation types and deterministic bootstrap rules**

```ts
export type PortfolioView = 'setup' | 'result' | 'edit';
export type PortfolioSetupStep = 'welcome' | 'allocation' | 'review';

export interface PortfolioState {
  view: PortfolioView;
  setupStep: PortfolioSetupStep | null;
  applied: PortfolioPlan | null;
  draft: PortfolioDraft;
  dirty: boolean;
  saveState: 'saved' | 'saving' | 'error' | 'cleanup-error';
  fieldError: string | null;
}

export function createPortfolioState(result: ReadyBootstrap): PortfolioState {
  const dirty = result.plan === null
    ? !isCashOnly(result.draft)
    : !sameAllocation(result.draft, result.plan);
  return {
    view: result.plan === null ? 'setup' : dirty ? 'edit' : 'result',
    setupStep: result.plan === null ? dirty ? 'allocation' : 'welcome' : null,
    applied: result.plan,
    draft: result.draft,
    dirty,
    saveState: result.persistenceAvailable ? 'saved' : 'error',
    fieldError: null,
  };
}
```

Handle setup navigation with these exact branches, then set `setupStep: null` on `apply-succeeded` and `view: 'setup', setupStep: 'welcome'` on aggregate reset:

```ts
case 'setup-next':
  return state.view !== 'setup' || state.setupStep === null
    ? state
    : { ...state, setupStep: state.setupStep === 'welcome' ? 'allocation' : 'review' };
case 'setup-previous':
  return state.view !== 'setup' || state.setupStep === null
    ? state
    : { ...state, setupStep: state.setupStep === 'review' ? 'allocation' : 'welcome' };
```

Keep the applied-plan `cancel-edit` branch returning `view: 'result'`, `setupStep: null`, the draft cloned from `state.applied`, and `dirty: false`.

- [ ] **Step 4: Add reducer tests for apply, reset, and clean edit invariants**

```ts
expect(portfolioReducer(reviewState, { type: 'apply-succeeded', plan }))
  .toMatchObject({ view: 'result', setupStep: null, dirty: false });
expect(portfolioReducer(resultState, { type: 'edit-opened' }))
  .toMatchObject({ view: 'edit', setupStep: null, dirty: false });
expect(portfolioReducer(resultState, { type: 'reset-confirmed', now: 10 }))
  .toMatchObject({ view: 'setup', setupStep: 'welcome', dirty: false });
```

- [ ] **Step 5: Run focused reducer tests**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the reducer state change**

```bash
git add src/portfolio/application/portfolioReducer.ts tests/unit/portfolio/portfolioReducer.test.ts
git commit -m "feat(portfolio): separate setup presentation state"
```

---

### Task 2: Build the Three-Step First-Time Setup

**Files:**
- Create: `src/portfolio/ui/PortfolioSetupFlow.tsx`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Test: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: `PortfolioSetupStep`, `PortfolioDraft`, `PortfolioAction` from Task 1.
- Produces: `PortfolioSetupFlow({ step, draft, investmentWon, saveError, fieldError, onAction, onPrevious, onNext, onApply, now })`.
- Changes `AllocationEditor` to support `presentation: 'setup' | 'edit'` and hide its duplicate outer heading when composed by a parent surface.

```ts
export interface PortfolioSetupFlowProps {
  step: PortfolioSetupStep;
  draft: PortfolioDraft;
  investmentWon: number;
  saveError: boolean;
  fieldError: string | null;
  onAction(action: PortfolioAction): void;
  onPrevious(): void;
  onNext(): void;
  onApply(): void;
  now(): number;
}
```

- [ ] **Step 1: Add failing component tests for isolated setup states**

```tsx
it('shows only the welcome task on a first visit', () => {
  render(<PortfolioApp mainSourceRepository={mainFound} repository={emptyRepository} locationRepository={locations} />);
  expect(screen.getByRole('heading', { name: '매달 200,000원을 어디에 투자할까요?' })).toBeVisible();
  expect(screen.getByRole('button', { name: '배분 시작하기' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '투자 위치' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('투자 배분 도넛')).not.toBeInTheDocument();
});

it('applies from setup review without opening a second dialog', async () => {
  render(<PortfolioApp mainSourceRepository={mainFound} repository={emptyRepository} locationRepository={locations} />);
  fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: '배분 시작' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: '투자금 200,000원' })).toBeVisible();
});
```

- [ ] **Step 2: Run focused component tests and confirm failure**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL because the current first visit renders `AllocationEditor` directly and uses the apply dialog.

- [ ] **Step 3: Implement `PortfolioSetupFlow` with three explicit sections**

```tsx
export function PortfolioSetupFlow(props: PortfolioSetupFlowProps) {
  const index = ['welcome', 'allocation', 'review'].indexOf(props.step);
  return (
    <Surface as="section" className="portfolio-setup" aria-labelledby="portfolio-setup-title">
      <div className="portfolio-setup__progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / 3) * 100}%` }} />
      </div>
      <p role="status">{index + 1} / 3 · {setupLabel(props.step)}</p>
      {props.step === 'welcome' ? <PortfolioWelcome investmentWon={props.investmentWon} /> : null}
      {props.step === 'allocation' ? (
        <AllocationEditor
          draft={props.draft}
          investmentWon={props.investmentWon}
          onAction={props.onAction}
          now={props.now}
          fieldError={props.fieldError}
          presentation="setup"
        />
      ) : null}
      {props.step === 'review' ? <PortfolioSetupReview draft={props.draft} investmentWon={props.investmentWon} /> : null}
      <nav aria-label="설정 이동">
        {props.step !== 'welcome' ? <Button onClick={props.onPrevious}>이전</Button> : null}
        <Button variant="primary" onClick={props.step === 'review' ? props.onApply : props.onNext}>
          {props.step === 'welcome' ? '배분 시작하기' : props.step === 'review' ? '배분 시작' : '다음'}
        </Button>
      </nav>
    </Surface>
  );
}
```

Use `materializeAllocation` in `PortfolioSetupReview` and show three rows: target count, formatted investment, formatted cash percentage. Do not impose a minimum target count; `validateApplicableDraft` remains the apply gate.

Define `setupLabel(step)` as an exhaustive switch returning `시작`, `배분`, or `검토`.

- [ ] **Step 4: Integrate setup without `InvestmentLocations` or `PortfolioApplyBar`**

In `PortfolioApp`, render `PortfolioSetupFlow` when `state.view === 'setup'`. Route step actions through `dispatchState`; route draft actions through existing `dispatchDraft`; call `apply()` directly from review so no confirmation dialog opens.

- [ ] **Step 5: Add Playwright coverage for setup reload behavior**

```ts
test('separates first setup and resumes a changed draft at allocation', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('heading', { name: '매달 200,000원을 어디에 투자할까요?' })).toBeVisible();
  await expect(page.getByRole('region', { name: '투자 위치' })).toHaveCount(0);
  await page.getByRole('button', { name: '배분 시작하기' }).click();
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('인덱스');
  await page.reload();
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByLabel('투자 대상 이름 1')).toHaveValue('인덱스');
});
```

- [ ] **Step 6: Run focused setup tests**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx && npx playwright test tests/portfolio.spec.ts --grep "first setup|changed draft" --reporter=list`

Expected: PASS.

- [ ] **Step 7: Commit first-time setup**

```bash
git add src/portfolio/ui/PortfolioSetupFlow.tsx src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/PortfolioApp.test.tsx tests/portfolio.spec.ts
git commit -m "feat(portfolio): add focused first-time setup"
```

---

### Task 3: Isolate Editing in a Responsive Sheet or Panel

**Files:**
- Create: `src/portfolio/ui/PortfolioEditSurface.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/PortfolioApplyBar.tsx`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Test: `tests/unit/portfolio/PortfolioDialogs.test.tsx`
- Test: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: existing `AllocationEditor`, `PortfolioApplyBar`, `PortfolioDialog`, `PortfolioDraft`.
- Produces: `PortfolioEditSurface({ draft, dirty, saveError, fieldError, investmentWon, onAction, onCancel, onApply, now })`.
- Keeps `PortfolioApplyBar` as the edit-only confirmation owner; first-time setup does not render it.

```ts
export interface PortfolioEditSurfaceProps {
  draft: PortfolioDraft;
  dirty: boolean;
  saveError: boolean;
  fieldError: string | null;
  investmentWon: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onAction(action: PortfolioAction): void;
  onCancel(): void;
  onApply(): void;
  now(): number;
}
```

- [ ] **Step 1: Write failing edit-isolation and clean/dirty tests**

```tsx
it('opens applied editing in a modal surface without locations', () => {
  render(<PortfolioApp mainSourceRepository={mainFound} repository={appliedRepository} locationRepository={locations} />);
  fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
  const dialog = screen.getByRole('dialog', { name: '투자 배분 수정' });
  expect(within(dialog).getByRole('heading', { name: '투자 배분 수정' })).toBeVisible();
  expect(within(dialog).queryByRole('heading', { name: '투자 위치' })).not.toBeInTheDocument();
  expect(screen.getByTestId('portfolio-result-controls')).toHaveAttribute('inert');
  expect(within(dialog).queryByRole('complementary', { name: '배분 변경' })).not.toBeInTheDocument();
});

it('shows apply actions only after the first allocation change', () => {
  render(<PortfolioApp mainSourceRepository={mainFound} repository={appliedRepository} locationRepository={locations} />);
  fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
  expect(screen.queryByRole('complementary', { name: '배분 변경' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('인덱스 금액'), { target: { value: '110000' } });
  fireEvent.blur(screen.getByLabelText('인덱스 금액'));
  expect(screen.getByRole('complementary', { name: '배분 변경' })).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and confirm current inline editor fails isolation**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: FAIL because edit currently replaces the result content and is not a dialog/panel.

- [ ] **Step 3: Implement a shared responsive edit surface**

```tsx
export function PortfolioEditSurface(props: PortfolioEditSurfaceProps) {
  return (
    <PortfolioDialog
      className="portfolio-edit-surface"
      labelledBy="portfolio-edit-title"
      onClose={props.onCancel}
      returnFocusRef={props.returnFocusRef}
    >
        <header>
          <h2 id="portfolio-edit-title">투자 배분 수정</h2>
          <Button data-dialog-initial-focus aria-label="편집기 닫기" onClick={props.onCancel}>닫기</Button>
        </header>
        <AllocationEditor
          draft={props.draft}
          investmentWon={props.investmentWon}
          onAction={props.onAction}
          now={props.now}
          fieldError={props.fieldError}
          presentation="edit"
        />
        {props.dirty ? (
          <PortfolioApplyBar
            dirty
            saveError={props.saveError}
            draft={props.draft}
            investmentWon={props.investmentWon}
            onCancel={props.onCancel}
            onApply={props.onApply}
          />
        ) : null}
    </PortfolioDialog>
  );
}
```

Add optional `className?: string` to `PortfolioDialog`, merge it with `portfolio-dialog ui-surface`, and reuse its existing focus loop. Pass the captured `배분 수정` button through `returnFocusRef`. Keep the result container mounted and set `inert` plus `aria-hidden="true"` while editing.

- [ ] **Step 4: Add responsive CSS with one exact breakpoint**

```css
.portfolio-edit-surface { position: fixed; z-index: 40; overflow-y: auto; background: var(--panel); }
@media (max-width: 768px) {
  .portfolio-edit-surface { inset: auto 0 0; max-height: 88dvh; border-radius: 1.5rem 1.5rem 0 0; }
}
@media (min-width: 769px) {
  .portfolio-edit-surface { inset: 0 0 0 auto; width: min(34rem, 42vw); border-left: 1px solid var(--line); }
}
```

Keep the sticky action bar inside the scrolling edit surface and add bottom padding equal to its rendered height plus safe-area inset so the final cash control remains reachable.

- [ ] **Step 5: Update edit confirmation copy and layout**

Change the dialog title to `투자 배분을 적용할까요?`; render target count, investment, and cash as three `.portfolio-confirmation__row` elements; use `계속 수정` and `배분 적용`. Do not change validation or persistence sequencing.

- [ ] **Step 6: Add Playwright assertions at 390, 768, and 1280 widths**

```ts
for (const viewport of [{ width: 390, mode: 'sheet' }, { width: 768, mode: 'sheet' }, { width: 1280, mode: 'panel' }]) {
  await page.setViewportSize({ width: viewport.width, height: 900 });
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '배분 수정' }).click();
  await expect(page.getByRole('dialog', { name: '투자 배분 수정' })).toHaveAttribute('data-presentation', viewport.mode);
  await expect(page.getByRole('region', { name: '투자 위치' })).toHaveCount(0);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
}
```

Also assert Escape closes, focus returns to `배분 수정`, clean reload returns to result, dirty reload reopens edit, and the final input remains above the action bar.

- [ ] **Step 7: Run focused edit tests**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx && npx playwright test tests/portfolio.spec.ts --grep "edit|sheet|panel|reload" --reporter=list`

Expected: PASS.

- [ ] **Step 8: Commit responsive editing**

```bash
git add src/portfolio/ui/PortfolioEditSurface.tsx src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/PortfolioApplyBar.tsx src/portfolio/ui/PortfolioDialog.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx tests/portfolio.spec.ts
git commit -m "feat(portfolio): isolate allocation editing"
```

---

### Task 4: Move Investment Locations Behind the Result Disclosure

**Files:**
- Modify: `src/portfolio/ui/InvestmentLocations.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/portfolio/InvestmentLocations.test.tsx`
- Test: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Test: `tests/portfolio.spec.ts`

**Interfaces:**
- `InvestmentLocations` keeps its current repository prop and command behavior.
- It now owns a native closed-by-default `<details>` whose summary is `투자 위치 {n}곳`.
- `portfolioStatusLabel` output is rendered as non-interactive text with `role="status"`, never a disabled button.

- [ ] **Step 1: Write failing disclosure and status-semantic tests**

```tsx
it('starts locations closed and exposes a count in the summary', () => {
  render(<InvestmentLocations repository={createRepository([location('ISA')])} />);
  const disclosure = screen.getByRole('group', { name: '투자 위치 1곳' });
  expect(disclosure).not.toHaveAttribute('open');
  expect(screen.queryByRole('button', { name: '아직 배분하지 않음' })).not.toBeInTheDocument();
});

it('renders allocation readiness as status text after opening', () => {
  render(<InvestmentLocations repository={createRepository([location('ISA')])} />);
  fireEvent.click(screen.getByText('투자 위치 1곳'));
  expect(screen.getByRole('status', { name: '아직 배분하지 않음' })).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm run test:unit -- tests/unit/portfolio/InvestmentLocations.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL because locations are always expanded and status is a disabled button.

- [ ] **Step 3: Wrap the existing location surface in a native disclosure**

Add `<details className="portfolio-locations-disclosure">` as the return root, place `<summary>투자 위치 {locations.length}곳</summary>` immediately before the current `Surface`, and close `</details>` immediately after that `Surface`. Do not conditionally render the `Surface`; closed native details must keep the repository subscription mounted.

Keep the component mounted while closed so repository subscription, external reconciliation, and same-page open state survive add/rename/archive operations. Native `<details>` resets to closed only when the result screen remounts or the page reloads.

- [ ] **Step 4: Replace disabled status buttons with text semantics**

```tsx
<span className="portfolio-locations__status" role="status" aria-label={portfolioStatusLabel(location.portfolioStatus)}>
  {portfolioStatusLabel(location.portfolioStatus)}
</span>
```

Keep only `이름 변경` and `보관` as actions. Update CSS so the status reads as a badge without hover, pressed, or disabled-button styling.

- [ ] **Step 5: Add result-only Playwright coverage**

Assert locations are absent from setup and edit, closed on result entry, remain open through rename/add operations, close after page reload, fit at 390px, and expose no button named `아직 배분하지 않음`.

- [ ] **Step 6: Run location tests**

Run: `npm run test:unit -- tests/unit/portfolio/InvestmentLocations.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx && npx playwright test tests/portfolio.spec.ts --grep "location|투자 위치" --reporter=list`

Expected: PASS.

- [ ] **Step 7: Commit result disclosure changes**

```bash
git add src/portfolio/ui/InvestmentLocations.tsx src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/InvestmentLocations.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/portfolio.spec.ts
git commit -m "feat(portfolio): disclose locations from results"
```

---

### Task 5: Align Canonical UI Documentation and Run Full Gates

**Files:**
- Modify: `DESIGN.md`
- Modify: `README.md`
- Test: `tests/portfolio.spec.ts`
- Test: `tests/app-journey.spec.ts`

**Interfaces:**
- No runtime interfaces produced.
- Documentation must retain aggregate-only Portfolio, Main read-only ownership, shared-location commands, and Account Map readiness boundaries.

- [ ] **Step 1: Update current UI contracts**

In `DESIGN.md`, replace the broad Portfolio result/edit bullets with exact setup/result/edit separation, `<=768px` sheet behavior, `>768px` panel behavior, result-only location disclosure, and non-interactive readiness status. In `README.md`, describe first-time guided setup, result-first revisit, focused editing, and result-only investment-location management without implying location-scoped allocation editing.

- [ ] **Step 2: Run source and unit checks**

Run: `npm run check && npm run test:unit`

Expected: TypeScript checks pass and all unit test files pass.

- [ ] **Step 3: Run Portfolio and cross-app browser tests**

Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list`

Expected: all selected tests pass with no console errors, overflow, hidden controls, or focus failures.

- [ ] **Step 4: Run the full E2E gate**

Run: `npm run test:e2e -- --reporter=list`

Expected: all E2E tests pass.

- [ ] **Step 5: Build and verify the Portfolio route**

Run: `npm run build`

Expected: Vite build exits 0 and includes `apps/portfolio/index.html`. The build script increments `package.json` patch version and synchronizes `public/manifest.webmanifest`, `shared/legacy/sw.js`, and `shared/core/utils.js`; verify all four files contain the same version and include them in this task's commit.

- [ ] **Step 6: Verify documentation and repository hygiene**

Run: `git diff --check && rg -n "위치별.*(편집|배분)" README.md DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`

Expected: no whitespace errors; wording continues to state that location-scoped allocation editing is unavailable.

- [ ] **Step 7: Commit documentation and final verification updates**

```bash
git add DESIGN.md README.md tests/portfolio.spec.ts tests/app-journey.spec.ts package.json public/manifest.webmanifest shared/legacy/sw.js shared/core/utils.js
git commit -m "docs(portfolio): align focused UX contracts"
```

Do not stage `artifacts/product-design-audit/` unless the user explicitly requests audit evidence in version control.
