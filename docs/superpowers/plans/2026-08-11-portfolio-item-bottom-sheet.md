# Portfolio Item Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline Portfolio target addition and editing with one focused modal bottom sheet that protects unfinished input and commits a valid target atomically.

**Architecture:** `AllocationEditor` continues to own the target list and opens a focused `PortfolioItemSheet` with an immutable initial snapshot. The sheet owns temporary name, amount, and classification state; one reducer action commits that snapshot to the aggregate draft only after validation. The existing `PortfolioDialog` supplies modal focus behavior and gains opt-in backdrop closing so unrelated dialogs do not change behavior.

**Tech Stack:** React 18, TypeScript, native `<dialog>`, Vitest + Testing Library, Playwright, CSS media queries.

## Global Constraints

- Portfolio continues to read Main's monthly investment amount without writing back to Main.
- Target input is KRW amount only; percentages remain calculated, read-only output.
- Name-based classification recommendation is the default; a segment toggle records a user override.
- The target sheet contains name, one growth/stable segment, amount, and the primary `취소 / 완료` footer actions.
- Editing retains target removal as a quiet secondary header action so current Portfolio functionality is not lost.
- Backdrop, Escape, and `취소` close immediately when pristine and require `입력 내용을 버릴까요?` confirmation when dirty.
- All visible controls have at least a 44px touch target.
- At 390px and 768px, the sheet must not overflow horizontally or hide fields/actions behind the keyboard or safe area.
- Reduced-motion users receive no slide/fade transition.

---

### Task 1: Atomic target commit contract

**Files:**
- Modify: `src/portfolio/application/portfolioReducer.ts`
- Test: `tests/unit/portfolio/portfolioReducer.test.ts`

**Interfaces:**
- Consumes: existing `PortfolioDraft`, `Classification`, `ClassificationOrigin`, `setItemAmount`, and `setItemClassification` contracts.
- Produces: `PortfolioAction` member `{ type: 'draft-item-committed'; item: PortfolioItemIdentity; amountWon: number; classification: Classification; classificationOrigin: ClassificationOrigin; now: number }`.

- [ ] **Step 1: Write failing reducer tests for add and edit commits**

Add tests that dispatch one action and assert the resulting draft contains the complete item without an intermediate blank target:

```tsx
const committed = portfolioReducer(state, {
  type: 'draft-item-committed',
  item: { id: 'bond', name: '국채 ETF', order: 0 },
  amountWon: 50_000,
  classification: 'stable',
  classificationOrigin: 'automatic',
  now: 3,
});
expect(committed.draft.items[0]).toMatchObject({
  id: 'bond', name: '국채 ETF', classification: 'stable',
  classificationOrigin: 'automatic',
});
expect(materializeAllocation(committed.draft, 200_000).items[0].amountWon).toBe(50_000);
```

Add an edit case using an existing id and assert item count/order are preserved while name, amount, and a `user` classification replace the old values.

- [ ] **Step 2: Run the focused reducer tests and verify failure**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts`

Expected: FAIL because `draft-item-committed` is not a `PortfolioAction` member.

- [ ] **Step 3: Implement one atomic reducer action**

Add `ClassificationOrigin` to the model imports and add the action union member. In the reducer, build the next draft without emitting intermediate actions:

```tsx
case 'draft-item-committed': {
  const withAmount = setItemAmount(state.draft, action.item, action.amountWon);
  return tryDraft(state, action.now, () => setItemClassification(
    withAmount,
    action.item.id,
    action.classification,
    action.classificationOrigin,
  ));
}
```

Keep existing granular actions for standalone/edit presentation compatibility; the setup sheet is the first consumer of the atomic action.

- [ ] **Step 4: Run the reducer tests and verify pass**

Run: `npm run test:unit -- tests/unit/portfolio/portfolioReducer.test.ts`

Expected: all reducer tests PASS.

- [ ] **Step 5: Commit the atomic contract**

```bash
git add src/portfolio/application/portfolioReducer.ts tests/unit/portfolio/portfolioReducer.test.ts
git commit -m "feat(portfolio): commit target edits atomically"
```

### Task 2: Focused target sheet and discard protection

**Files:**
- Create: `src/portfolio/ui/PortfolioItemSheet.tsx`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Create: `tests/unit/portfolio/PortfolioItemSheet.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioDialogs.test.tsx`

**Interfaces:**
- Consumes: `PortfolioDialog`, `Button`, `recommendClassification`, `normalizePortfolioName`, and `Classification`/`ClassificationOrigin`.
- Produces: `PortfolioItemSheetProps` with `mode: 'add' | 'edit'`, `initialValue: PortfolioItemSheetValue`, `existingNames: string[]`, `investmentWon: number`, `returnFocusRef`, `onComplete(value)`, `onRemove?()`, and `onClose()`.
- Produces: opt-in `closeOnBackdrop?: boolean` on `PortfolioDialog`; default remains `false`.

- [ ] **Step 1: Write failing sheet behavior tests**

Cover these externally visible contracts:

```tsx
expect(screen.getByRole('dialog', { name: '투자 대상 추가' })).toBeVisible();
expect(screen.getByLabelText('투자 대상 이름')).toHaveFocus();
expect(screen.getByRole('button', { name: '성장, 누르면 안정으로 변경' })).toBeVisible();
expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
```

Then fill `미국 인덱스` and `120000`, toggle classification, click `완료`, and assert `onComplete` receives:

```tsx
{
  name: '미국 인덱스', amountWon: 120000,
  classification: 'stable', classificationOrigin: 'user',
}
```

Add separate tests asserting:

- pristine `취소`, Escape, and backdrop click call `onClose` directly;
- dirty close attempts open `입력 내용을 버릴까요?`;
- `계속 입력` closes only the confirmation and preserves field values;
- `버리기` closes the sheet;
- normalized duplicate names and amounts below 1,000 show connected field errors;
- edit mode exposes the quiet remove action, while add mode does not;
- removing dirty or pristine edit content uses the existing explicit remove callback without silently committing fields.

- [ ] **Step 2: Run the new sheet tests and verify failure**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: FAIL because `PortfolioItemSheet` and opt-in backdrop handling do not exist.

- [ ] **Step 3: Add opt-in dialog backdrop handling**

Extend `PortfolioDialog` without altering existing callers:

```tsx
closeOnBackdrop = false,
// ...
onClick={(event) => {
  if (closeOnBackdrop && event.target === event.currentTarget) onClose();
}}
```

Add a regression test showing a normal confirmation dialog ignores a click whose target is the `<dialog>`, while a caller with `closeOnBackdrop` invokes `onClose`.

- [ ] **Step 4: Implement local sheet state and validation**

Define the value contract:

```tsx
export interface PortfolioItemSheetValue {
  name: string;
  amountWon: number;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
}
```

Initialize string amount state from `initialValue.amountWon`; calculate `dirty` by comparing normalized primitive field values with the immutable initial value. While `classificationOrigin === 'automatic'`, name changes call `recommendClassification(name)` locally. Toggling the segment flips classification and sets origin to `user`.

Use `PortfolioDialog` for the sheet and a second `PortfolioDialog` for discard confirmation. Route backdrop, Escape, and footer `취소` through `requestClose`; route `계속 입력` to confirmation close and `버리기` to `onClose`. Call `onComplete` only when the normalized name is unique and amount is an integer of at least 1,000 won and not greater than `investmentWon`.

- [ ] **Step 5: Add bottom-sheet styling**

Add `.portfolio-item-sheet` as a bottom-anchored dialog with:

```css
.portfolio-item-sheet {
  inset: auto 0 0;
  width: min(100%, 32rem);
  max-height: min(88dvh, calc(100dvh - env(safe-area-inset-top)));
  margin: 0 auto;
  padding: 1.25rem 1rem calc(1rem + env(safe-area-inset-bottom));
  overflow: auto;
  border-radius: 1.5rem 1.5rem 0 0;
  transform: none;
}
```

Use a two-column identity row (`minmax(0, 1fr) auto`), a full-width amount field, and a two-column footer. Add `@starting-style`/keyframes only where supported, and disable sheet/backdrop animation inside the existing `prefers-reduced-motion` rule.

- [ ] **Step 6: Run the sheet/dialog tests and verify pass**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: all sheet and dialog tests PASS.

- [ ] **Step 7: Commit the reusable sheet**

```bash
git add src/portfolio/ui/PortfolioItemSheet.tsx src/portfolio/ui/PortfolioDialog.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx
git commit -m "feat(portfolio): add focused target sheet"
```

### Task 3: Replace setup inline expansion with the common sheet

**Files:**
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/unit/portfolio/AllocationEditor.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: `PortfolioItemSheet`, `draft-item-committed`, existing `draft-item-removed`, `createId`, and materialized allocation rows.
- Produces: setup target rows that open the same sheet for add/edit and preserve compact name + amount/percentage summaries.

- [ ] **Step 1: Replace inline expectations with failing integration tests**

Update the setup editor tests to assert:

```tsx
fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveFocus();
expect(onAction).not.toHaveBeenCalled();
```

After valid input and `완료`, assert exactly one `draft-item-committed` action. Click the completed `미국 인덱스` row, assert `투자 대상 수정` opens with existing values, complete the edit, and assert one atomic commit for id `index`. Add an assertion that cancelling a new target leaves the list and reducer untouched.

Update `PortfolioApp` tests to complete new targets through the dialog before advancing to review.

- [ ] **Step 2: Run focused editor/app tests and verify failure**

Run: `npm run test:unit -- tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL because setup still expands inline and dispatches `draft-item-added` immediately.

- [ ] **Step 3: Integrate sheet state in `AllocationEditor`**

Replace setup-only `expandedItemId`/`newItemId` with:

```tsx
type ActiveItemSheet =
  | { mode: 'add'; id: string; returnFocus: HTMLElement | null }
  | { mode: 'edit'; id: string; returnFocus: HTMLElement | null };
```

The `+` trigger allocates an id and opens local sheet state without dispatching. A completed row opens edit mode. Pass a ref representing the originating trigger into `PortfolioItemSheet`; on complete dispatch one `draft-item-committed` action, close the sheet, and allow `PortfolioDialog` to restore focus. On edit removal dispatch `draft-item-removed`, close, and restore focus to the add trigger when the removed row no longer exists.

Keep standalone/edit presentation controls unchanged. Render setup rows as buttons or summaries with name left and amount/percentage right; do not render hidden inline inputs in the closed list.

- [ ] **Step 4: Remove obsolete setup expansion CSS**

Delete setup selectors for `[open]`, `.portfolio-editor__identity-edit`, inline classification placement, setup amount/computed rows, and inline row actions. Preserve the flat row divider, 52px full-width `+` block, cash summary, and non-setup editor styles.

- [ ] **Step 5: Run focused unit tests and verify pass**

Run: `npm run test:unit -- tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/portfolioReducer.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 6: Add Playwright coverage for mobile sheet behavior**

Update the setup path to click `투자 대상 추가`, enter name/amount inside `투자 대상 추가`, complete, and assert the compact row. Add a 390px test that:

- opens add sheet and checks its bounding box is within viewport;
- verifies the background `배분 확인` control cannot receive pointer/focus while modal is open;
- changes a field, clicks the native dialog backdrop coordinate, and sees `입력 내용을 버릴까요?`;
- chooses `계속 입력` and sees the preserved value;
- chooses `버리기` on the next close attempt and sees the sheet close;
- reopens an existing row in `투자 대상 수정` and verifies the same sheet class and footer actions.

- [ ] **Step 7: Run the focused E2E group**

Run: `npm run test:e2e -- tests/portfolio.spec.ts --grep "setup|target sheet|mobile editor"`

Expected: focused Portfolio setup/sheet tests PASS at 390px with no console errors or horizontal overflow.

- [ ] **Step 8: Commit setup integration**

```bash
git add src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/portfolio.spec.ts
git commit -m "feat(portfolio): focus target add and edit"
```

### Task 4: Full verification and visual approval

**Files:**
- Modify only if verification exposes an in-scope defect.

**Interfaces:**
- Consumes: completed reducer, sheet, setup integration, and approved Product Design spec.
- Produces: current verification evidence and 390px/768px/desktop screenshots for approval.

- [ ] **Step 1: Run static and unit verification**

Run:

```bash
npm run check
npm run test:unit
git diff --check
```

Expected: typecheck/lint, all unit tests, and whitespace validation PASS.

- [ ] **Step 2: Run full Portfolio E2E verification**

Run: `npm run test:e2e -- tests/portfolio.spec.ts`

Expected: all Portfolio E2E tests PASS with no unexpected console errors.

- [ ] **Step 3: Capture responsive visual evidence**

Capture add, dirty-discard confirmation, completed row, and edit states at 390px; capture open sheets at 768px and desktop. Confirm:

- no horizontal overflow;
- the sheet covers the existing list from the bottom;
- name and classification share the top row;
- `취소 / 완료` remain visible above safe area;
- closed rows preserve name + amount/percentage hierarchy;
- reduced-motion removes the transition.

- [ ] **Step 4: Present visuals before push**

Publish the screenshots in the existing visual companion and ask for explicit approval. Do not push implementation commits before this visual gate.

- [ ] **Step 5: Push after approval**

Run: `git push origin main`

Expected: the verified implementation and its design/plan commits are present on `origin/main`.
