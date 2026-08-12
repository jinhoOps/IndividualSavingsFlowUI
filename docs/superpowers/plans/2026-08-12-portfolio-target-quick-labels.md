# Portfolio Target Quick Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make target deletion an accessible trash-icon action and let users fill five representative investment names from the add sheet.

**Architecture:** Keep interaction local to `PortfolioItemSheet`; quick-fill buttons update existing local name/classification state and focus the amount input, while the existing `onRemove` callback remains the deletion boundary. Use the `Trash2` component from `lucide-react` for the delete glyph and CSS only for sizing/layout.

**Tech Stack:** React 19, TypeScript, CSS, Lucide React, Vitest, Testing Library, Playwright

## Global Constraints

- Quick-fill names are exactly `S&P 500`, `나스닥`, `코스피`, `미국 국채`, `금 현물`.
- Quick-fill buttons appear only when `mode === 'add'`.
- A quick-fill selection recomputes classification only when `classificationOrigin === 'automatic'`; a user classification is never overwritten.
- Every quick-fill and delete button has a minimum 44px touch target and equivalent pointer, touch, and keyboard behavior.
- At 390px, quick-fill buttons wrap without shrinking their text.
- Delete uses no visible text, exposes `투자 대상 삭제`, removes from the current draft through `onRemove`, and appears only in edit mode.
- Do not change Portfolio schemas, reducer contracts, or Main read-only ownership.

---

### Task 1: Quick-fill behavior and accessible delete control

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/portfolio/ui/PortfolioItemSheet.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/portfolio/PortfolioItemSheet.test.tsx`

**Interfaces:**
- Consumes: existing `recommendClassification(name: string): Classification`, local `classificationOrigin`, and optional `onRemove(): void`.
- Produces: add-only buttons named by `QUICK_TARGET_NAMES`; delete button with accessible name `투자 대상 삭제`; no prop or persistence-contract changes.

- [ ] **Step 1: Write failing quick-fill tests**

Add tests that assert the exact buttons, edit-mode exclusion, focus movement, automatic recommendation, and user override preservation:

```tsx
it('quick-fills approved target names only while adding', () => {
  renderSheet();
  const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
  const names = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'];
  for (const name of names) expect(within(sheet).getByRole('button', { name })).toBeVisible();

  fireEvent.click(within(sheet).getByRole('button', { name: '미국 국채' }));
  expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveValue('미국 국채');
  expect(within(sheet).getByRole('button', { name: '안정, 누르면 성장으로 변경' })).toBeVisible();
  expect(within(sheet).getByLabelText('금액')).toHaveFocus();
});

it('preserves a user classification when quick-filling a name', () => {
  renderSheet();
  const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
  fireEvent.click(within(sheet).getByRole('button', { name: '성장, 누르면 안정으로 변경' }));
  fireEvent.click(within(sheet).getByRole('button', { name: '나스닥' }));
  expect(within(sheet).getByRole('button', { name: '안정, 누르면 성장으로 변경' })).toBeVisible();
});
```

Extend the edit test with:

```tsx
expect(within(sheet).queryByRole('button', { name: 'S&P 500' })).not.toBeInTheDocument();
const remove = within(sheet).getByRole('button', { name: '투자 대상 삭제' });
expect(remove).not.toHaveTextContent('투자 대상 삭제');
expect(remove.querySelector('svg')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/unit/portfolio/PortfolioItemSheet.test.tsx`

Expected: FAIL because the five quick-fill buttons and trash image do not exist.

- [ ] **Step 3: Add the icon-library dependency**

Install Lucide React so the visible trash glyph comes from a maintained icon library rather than a handcrafted asset:

```bash
npm install lucide-react
```

- [ ] **Step 4: Implement local quick-fill and icon behavior**

Add an amount ref and a single local helper so typed names and quick-fill names share the same automatic-classification rule:

```tsx
const QUICK_TARGET_NAMES = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'] as const;
const amountInputRef = useRef<HTMLInputElement>(null);

function updateName(nextName: string): void {
  setNameTouched(true);
  setName(nextName);
  if (classificationOrigin === 'automatic') setClassification(recommendClassification(nextName));
}

function quickFillName(nextName: string): void {
  updateName(nextName);
  amountInputRef.current?.focus();
}
```

Render `.portfolio-item-sheet__quick-targets` only in add mode, use native `button type="button"` controls, attach `ref={amountInputRef}` to the amount input, and replace visible delete text with:

```tsx
<button type="button" className="portfolio-item-sheet__remove" aria-label="투자 대상 삭제" onClick={onRemove}>
  <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
</button>
```

- [ ] **Step 5: Add contained responsive styling**

Add flex wrapping and fixed control minimums without changing the sheet width:

```css
.portfolio-item-sheet__quick-targets { display: flex; flex-wrap: wrap; gap: .5rem; }
.portfolio-item-sheet__quick-target { min-height: 44px; padding: .5rem .75rem; white-space: nowrap; }
.portfolio-item-sheet__remove { display: inline-grid; width: 44px; min-width: 44px; height: 44px; place-items: center; padding: 0; }
.portfolio-item-sheet__remove svg { width: 20px; height: 20px; }
```

Use existing border, radius, foreground, hover, and focus-visible tokens/patterns from `portfolio.css`; do not encode a new color system.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/unit/portfolio/PortfolioItemSheet.test.tsx`

Expected: all `PortfolioItemSheet` tests PASS.

- [ ] **Step 7: Commit the component increment**

```bash
git add package.json package-lock.json src/portfolio/ui/PortfolioItemSheet.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/PortfolioItemSheet.test.tsx
git commit -m "feat(portfolio): add target quick labels"
```

### Task 2: Browser flow and responsive contract

**Files:**
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: `PortfolioItemSheet` accessible button names and the existing setup/edit helpers.
- Produces: user-observable coverage for 390px wrapping, quick-fill completion, edit-only delete, and horizontal containment.

- [ ] **Step 1: Write the failing browser assertions**

Extend `protects dirty mobile target input and reuses the sheet for editing` before its manual name fill:

```ts
const quickNames = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'];
for (const name of quickNames) {
  const quickFill = sheet.getByRole('button', { name, exact: true });
  await expect(quickFill).toBeVisible();
  expect((await quickFill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
}
await sheet.getByRole('button', { name: '미국 국채', exact: true }).click();
await expect(sheet.getByLabel('투자 대상 이름')).toHaveValue('미국 국채');
await expect(sheet.getByLabel('금액')).toBeFocused();
expect(await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
```

After reopening the item in edit mode, assert:

```ts
await expect(editSheet.getByRole('button', { name: '투자 대상 삭제' })).toBeVisible();
await expect(editSheet.getByRole('button', { name: 'S&P 500' })).toHaveCount(0);
```

- [ ] **Step 2: Run the focused E2E and confirm RED before Task 1, or GREEN after Task 1**

Run: `npx playwright test tests/portfolio.spec.ts --grep "protects dirty mobile target input"`

Expected before Task 1: FAIL on missing quick-fill button. Expected after Task 1: PASS.

- [ ] **Step 3: Verify all required UI widths**

Run the same setup/add sheet at 390×844, 768×900, and 1280×900. At each width assert `document.documentElement.scrollWidth <= innerWidth`, sheet containment, visible actions, and quick-fill button height ≥44px. Keep the exact five-name assertion at 390px where wrapping is required.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm run check
npx vitest run
npx playwright test tests/portfolio.spec.ts
git diff --check
```

Expected: type/lint check PASS, all unit tests PASS, all Portfolio E2E tests PASS, and no whitespace errors.

- [ ] **Step 5: Commit browser coverage**

```bash
git add tests/portfolio.spec.ts
git commit -m "test(portfolio): cover target quick labels"
```

### Task 3: Visual acceptance

**Files:**
- No product files unless visual inspection exposes a spec violation.

**Interfaces:**
- Consumes: the implemented add and edit sheets.
- Produces: screenshot evidence at 390px, 768px, and desktop before completion is claimed.

- [ ] **Step 1: Capture add and edit states**

At 390×844 capture the add sheet with all five quick-fill buttons and the edit sheet with the trash icon. Capture the add sheet at 768×900 and 1280×900.

- [ ] **Step 2: Inspect against the approved hierarchy**

Confirm the investment name and amount remain dominant, the quick-fill controls read as optional shortcuts, the delete icon does not compete with the title, no text is compressed, and the action row remains visible above the safe area.

- [ ] **Step 3: Report evidence and residual risk**

Report changed files, exact validation commands and outcomes, screenshots reviewed, and any unresolved visual or interaction risk. Do not claim completion without current command output.
