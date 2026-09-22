# Unified Bottom Sheet Surfaces Implementation Plan

**Implementation status (2026-09-22):** Implemented and verified, including premerge fixes and the child workspace dependency task. See the [integration evidence](../evidence/2026-09-22-unified-bottom-sheet-integration.md) for final results and limitations; the task checklist below records the original implementation sequence.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main, Simulation, and Portfolio use one responsive surface contract with the same Bottom Sheet/Modal geometry, internal header/context/body/status/footer layout, motion, focus behavior, and close states.

**Architecture:** Extend `ResponsiveDialog` as the only shared overlay shell and add a small `ResponsiveDialogLayout` component for the repeated internal frame. App controllers keep draft, validation, persistence, recovery, and domain actions; they pass those decisions into the shared shell through `requestClose(reason)` and footer actions. Portfolio's duplicate dialog and Main's dedicated sheet presentation are migrated and removed after their callers use the shared contract.

**Tech Stack:** React, TypeScript, native `<dialog>`, Anime.js, existing CSS tokens, Vitest, Testing Library, Playwright.

**Spec:** [docs/superpowers/specs/2026-09-22-unified-bottom-sheet-design.md](../specs/2026-09-22-unified-bottom-sheet-design.md)

## Global Constraints

- CSS viewport `<= 767px` uses a bottom attached sheet; `>= 768px` uses a centered modal.
- The mobile surface is capped at `92dvh`; only the body scrolls; header and footer remain visible and include safe-area padding.
- All controls have at least a 44×44px interaction area, an accessible name, a visible focus ring, and explicit selected/disabled states.
- Main owns the five monthly amounts and expense answers; Simulation and Portfolio never write Main-owned values.
- Workspace schema v5, protocol 5, `accountMap`, `locations`, backup, import/export, and recovery contracts are unchanged.
- No new modal library is introduced; use the existing native dialog, `useSheetDismiss`, Anime.js tokens, and `ResponsiveDialog`.
- Existing draft, save, conflict, recovery, and offline behavior remains app-owned and is not replaced by the surface component.
- The implementation must preserve user worktrees and unrelated files, including the untracked `docs/superpowers/plans/2026-09-16-portfolio-editor-hierarchy.md`.

## Review Focus

1. **Short mobile viewports (320×568 and 390×600):** the last field must remain scrollable and the footer must never cover it. Pin this in `ResponsiveDialogLayout` and each app's Playwright viewport test.
2. **Crossing the 767/768 breakpoint while dirty:** the same draft, errors, and focused field must survive a presentation switch. Pin this in the shared responsive dialog test.
3. **Drag starting on controls:** pointer activity on an input, button, slider, or body scroll must not dismiss the sheet. Pin this in the shared drag test and Main/Portfolio browser flows.
4. **Portfolio stage transitions:** item editing, sample selection, and discard confirmation must not create two simultaneous focus traps or lose the parent scroll position. Pin this in `PortfolioDialogs.test.tsx` and `portfolio.spec.ts`.
5. **Saving/error/conflict close attempts:** a busy or failed operation must keep the surface open, preserve draft input, and expose retry without treating the operation as successful. Pin this in Main, Simulation, and Portfolio controller tests.

---

### Task 1: Build the shared surface frame and dialog contract

**Files:**

- Create: `src/components/common/ResponsiveDialogLayout.tsx`
- Modify: `src/components/common/ResponsiveDialog.tsx`
- Modify: `src/components/common/responsive-dialog.css`
- Modify: `src/components/motion/useSheetDismiss.ts` only where the shared shell needs a typed dismiss reason or cleanup hook
- Test: `tests/unit/components/ResponsiveDialog.test.tsx`
- Test: `tests/unit/components/ResponsiveDialogLayout.test.tsx`

**Interfaces:**

- `ResponsiveDialog` continues to receive `open`, `labelledBy`, `size`, `mobileHeight`, `mobileEntranceMotion`, `busy`, `returnFocusRef`, `onRequestClose(reason)`, `onClosed`, and `children`.
- Add `ResponsiveDialogLayoutProps`:

```ts
export interface ResponsiveDialogLayoutProps {
  title: ReactNode;
  titleId: string;
  eyebrow?: ReactNode;
  onBack?: () => void;
  onClose: () => void;
  context?: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  layout?: 'edit' | 'step' | 'settings' | 'preview' | 'confirm';
}
```

- `ResponsiveDialogLayout` produces the `data-surface-layout`, `data-surface-header`, `data-surface-context`, `data-surface-body`, `data-surface-status`, and `data-surface-footer` hooks used by the common CSS and tests.
- The header's drag handle is the only element carrying `data-sheet-drag-handle`; `onBack` is optional and the close action is always present.

- [ ] **Step 1: Add failing structure and behavior tests.** Assert that the layout renders one labelled heading, one handle, one body scroll region, one optional status region, and one footer; assert that `onBack` and `onClose` are called by their named buttons.

```tsx
it('keeps the body as the only scroll region and exposes the standard frame', () => {
  render(<ResponsiveDialogLayout title="조건 편집" titleId="title" onClose={vi.fn()} footer={<button>적용</button>}>
    <input aria-label="기간" />
  </ResponsiveDialogLayout>);
  expect(screen.getByRole('heading', {name: '조건 편집'})).toHaveAttribute('id', 'title');
  expect(screen.getByRole('region', {name: '조건 편집 내용'})).toHaveAttribute('data-surface-body', '');
  expect(screen.getByRole('button', {name: '닫기'})).toBeVisible();
  expect(screen.getByRole('button', {name: '적용'})).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests and verify the new assertions fail.**

Run: `npm run test:unit -- tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/ResponsiveDialogLayout.test.tsx`

Expected: FAIL because the layout component and standard data hooks do not exist yet.

- [ ] **Step 3: Implement the frame and shared presentation behavior.** Render a native dialog through the existing portal, keep an active-dialog stack for focus trapping, and add a body scroll-lock reference count that releases on close and unmount. Add `data-presentation="sheet|modal"` through the shared media query, without remounting children when the breakpoint changes. Keep `onRequestClose(reason)` as the only controller callback.

- [ ] **Step 4: Implement common geometry and motion.** Add the mobile bottom attachment, 92dvh cap, 24px top radius, desktop centered widths, safe-area footer padding, and body-only overflow to `responsive-dialog.css`. Reuse `MOTION_DISTANCE_PX`, `MOTION_DURATION`, and `createProductSpring('surface')`; set final opacity/transform when reduced motion, jsdom, layout measurement, or Anime.js initialization cannot provide an animation.

- [ ] **Step 5: Run focused tests and type checks.**

Run: `npm run test:unit -- tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/ResponsiveDialogLayout.test.tsx && npm run check`

Expected: PASS; the shared surface still closes only after `onRequestClose` approves and returns focus to `returnFocusRef`.

- [ ] **Step 6: Commit the shared shell.**

```bash
git add src/components/common/ResponsiveDialog.tsx src/components/common/ResponsiveDialogLayout.tsx src/components/common/responsive-dialog.css src/components/motion/useSheetDismiss.ts tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/ResponsiveDialogLayout.test.tsx
git commit -m "feat: add unified responsive surface frame"
```

### Task 2: Migrate Main editors to the common frame

**Files:**

- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/dashboard/MainPlanEditor.tsx`
- Modify: `src/main/ui/dashboard/ExpenseAssistantDialog.tsx`
- Modify: `src/main/ui/dashboard/RemainingAllocationDialog.tsx`
- Modify: `src/main/ui/editor/ApplyBar.tsx`
- Modify: `src/main/ui/main.css`
- Test: `tests/unit/main/SummaryDashboard.test.tsx`
- Test: `tests/unit/main/MainPlanEditor.test.tsx`
- Test: `tests/main-react.spec.ts`

**Interfaces:**

- `SummaryDashboard` remains the owner of draft, dirty, validation, save status, and `onApply/onCancel`.
- `MainPlanEditor`, `ExpenseAssistantDialog`, and `RemainingAllocationDialog` become body/content components and receive surface actions from `SummaryDashboard`; they do not create a second focus trap or attach their own sheet listener.
- Use `ResponsiveDialogLayout` with `layout="edit"` and keep the existing `data-dialog-initial-focus` selectors.

- [ ] **Step 1: Add failing Main surface assertions.** Extend the existing dashboard tests to assert the standard header/body/footer hooks, that the five fields remain in the same order, that the footer is visible while the body is scrollable, and that a dirty close opens the existing discard path.

```tsx
it('uses the shared edit frame without changing Main field ownership', () => {
  render(<DashboardHarness mobile />);
  fireEvent.click(screen.getByRole('button', {name: '월 금액 편집'}));
  const dialog = screen.getByRole('dialog', {name: '월 금액 편집'});
  expect(dialog.querySelector('[data-surface-body]')).toBeTruthy();
  expect(within(dialog).getByLabelText('월 실수령액')).toHaveValue('3,200,000');
  expect(within(dialog).getByRole('button', {name: '적용'})).toBeDisabled();
});
```

- [ ] **Step 2: Run the Main focused tests and confirm the new frame assertions fail.**

Run: `npm run test:unit -- tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/MainPlanEditor.test.tsx`

Expected: FAIL because Main still renders its custom header/sheet structure.

- [ ] **Step 3: Move MainPlanEditor content into the common layout.** Keep the five input handlers, validation paths, `MoneyAdjustments`, save feedback, and initial-focus markers unchanged. Put the title/context in the layout header/context slots and the existing ApplyBar actions in the layout footer.

- [ ] **Step 4: Migrate expense and remaining-money dialogs.** Replace each direct `useSheetDismiss`/custom header arrangement with the common layout. Keep intermediate answer persistence, remaining allocation validation, and their existing `requestClose` semantics in their controllers. Route close reasons through the shared `ResponsiveDialog` callback.

- [ ] **Step 5: Remove obsolete Main sheet geometry.** Delete only the `main-editor-sheet` positioning, duplicate handle, backdrop, and fixed-footer rules that are superseded by `responsive-dialog.css`; preserve dashboard and summary styles.

- [ ] **Step 6: Verify Main behavior at mobile and desktop.**

Run: `npm run test:unit -- tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/MainPlanEditor.test.tsx && npm run test:e2e -- tests/main-react.spec.ts --reporter=dot`

Expected: PASS at 390px and desktop; Main apply, cancel, discard confirmation, validation focus, save failure, and existing journey navigation remain unchanged.

- [ ] **Step 7: Commit the Main migration.**

```bash
git add src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/dashboard/MainPlanEditor.tsx src/main/ui/dashboard/ExpenseAssistantDialog.tsx src/main/ui/dashboard/RemainingAllocationDialog.tsx src/main/ui/editor/ApplyBar.tsx src/main/ui/main.css tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/MainPlanEditor.test.tsx tests/main-react.spec.ts
git commit -m "refactor: move Main editors to shared surface layout"
```

### Task 3: Migrate Simulation condition editing

**Files:**

- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**

- `SimulationApp` keeps its existing automatically saved draft, repository writes, conflict handling, and `mobileEntranceMotion` behavior.
- The condition editor uses `ResponsiveDialogLayout layout="edit"` with `명목 · 실질` as the first context control, then condition fields. The autosave surface has no cancel/apply footer.

- [ ] **Step 1: Add failing layout and state tests.** Assert the first visible control inside the condition dialog is the nominal/real toggle and that changes retain the existing automatic save and immediate graph update behavior. Closing the surface must not introduce a second apply step.

```tsx
it('places the amount mode toggle before condition fields in the shared editor', async () => {
  render(<SimulationHarness />);
  fireEvent.click(screen.getByRole('button', {name: '조건 편집'}));
  const dialog = screen.getByRole('dialog', {name: '시뮬레이션 조건 편집'});
  expect(within(dialog).getByRole('group', {name: '금액 기준'})).toBeVisible();
  expect(within(dialog).getByRole('group', {name: '금액 기준'}).compareDocumentPosition(within(dialog).getByLabelText('기간'))
    & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused Simulation tests and confirm the new assertions fail.**

Run: `npm run test:unit -- tests/unit/simulation/SimulationApp.test.tsx`

Expected: FAIL because the editor still owns an app-specific body arrangement.

- [ ] **Step 3: Recompose the editor with the common frame.** Move the title/close control, amount-mode group and fields into the standard slots. Preserve automatic saving, validation, source Main revision checks, pending state, and mobile Anime.js opt-in; do not add a separate edit draft or cancel/apply actions.

- [ ] **Step 4: Remove duplicate Simulation surface spacing.** Keep graph and result card styles intact; remove only editor-specific header/footer positioning that conflicts with the common frame. Do not reintroduce the removed `⌃` icon or text-link CTA beside the expected return rate.

- [ ] **Step 5: Verify Simulation flow.**

Run: `npm run test:unit -- tests/unit/simulation/SimulationApp.test.tsx && npm run test:e2e -- tests/simulation.spec.ts --reporter=dot`

Expected: PASS for 390px bottom-sheet motion, 768px modal geometry, desktop centered modal, cancel/apply, raw input validation, save failure, and Portfolio sample CTA placement.

- [ ] **Step 6: Commit the Simulation migration.**

```bash
git add src/simulation/ui/SimulationApp.tsx src/simulation/ui/simulation.css tests/unit/simulation/SimulationApp.test.tsx tests/simulation.spec.ts
git commit -m "refactor: move Simulation editor to shared surface layout"
```

### Task 4: Migrate Portfolio editing into one staged surface

**Files:**

- Modify: `src/portfolio/ui/PortfolioEditSurface.tsx`
- Modify: `src/portfolio/ui/PortfolioItemSheet.tsx`
- Modify: `src/portfolio/ui/PortfolioApplyBar.tsx`
- Modify: `src/portfolio/ui/PortfolioSetupFlow.tsx`
- Modify: `src/portfolio/ui/PortfolioExamplePicker.tsx`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/portfolio/PortfolioDialogs.test.tsx`
- Test: `tests/unit/portfolio/PortfolioItemSheet.test.tsx`
- Test: `tests/unit/portfolio/AllocationEditor.test.tsx`
- Test: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Test: `tests/portfolio.spec.ts`

**Interfaces:**

- `PortfolioEditSurface` owns `stage: 'allocation' | 'item' | 'examples'` and preserves its existing `PortfolioAction`, draft, dirty, field-error, applying, and recovery props.
- `PortfolioItemSheet` continues to support `inline`; its `inline` path becomes the item stage body instead of opening `PortfolioDialog`.
- `PortfolioApplyBar` opens a shared `layout="confirm"` dialog only when confirmation is required; it keeps its current `applying` lock and error behavior.

- [ ] **Step 1: Add failing tests for a single Portfolio focus trap.** Assert that opening item editing shows one `role=dialog`, that the parent allocation list is inert while the item stage is active, that Back returns to the selected row and preserves scroll, and that apply confirmation remains the only additional modal.

```tsx
it('edits an item inside the same surface instead of nesting a second sheet', () => {
  render(<PortfolioFixture />);
  fireEvent.click(screen.getByRole('button', {name: /미국 인덱스 편집/}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('button', {name: '뒤로'})).toBeVisible();
  expect(screen.getByRole('textbox', {name: '투자 대상 이름'})).toHaveValue('미국 인덱스');
});
```

- [ ] **Step 2: Run Portfolio focused tests and confirm they fail.**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL because `PortfolioDialog` currently wraps the parent, item form, sample picker, and confirmation separately.

- [ ] **Step 3: Convert PortfolioEditSurface to the shared edit frame.** Render the allocation summary, allocation rows, cash row, add action, validation status, and apply footer in the standard order. Keep the existing `PortfolioEditorSummary` and `PortfolioAllocationRow` data calculations; change only their surface placement and stage callbacks.

- [ ] **Step 4: Convert item editing and samples to stages.** Render `PortfolioItemSheet inline` for `stage === 'item'`, add a Back action that clears the stage without committing, and render the existing example picker in the same surface for `stage === 'examples'`. Preserve add/edit validation, automatic classification origin, quick adjustments, removal, discard confirmation, and focus return.

- [ ] **Step 5: Move apply confirmation to the shared confirm layout.** Keep `PortfolioApplyBar` as the owner of whether confirmation is needed and whether apply is pending. The confirmation dialog must disable both actions and Escape while `applying` is true and return focus to the apply trigger after close.

- [ ] **Step 6: Replace Portfolio geometry with the common frame.** Remove `dataPresentation`, duplicate native dialog sizing, duplicate handle rules, and nested sheet height rules from `portfolio.css`; retain Portfolio-specific field, row, summary, and result styles. Ensure the body scroll container contains the allocation list while footer actions remain visible.

- [ ] **Step 7: Verify Portfolio at short and wide viewports.**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx && npm run test:e2e -- tests/portfolio.spec.ts --reporter=dot`

Expected: PASS for 390×844, 390×600, 768×1024, and desktop: summary-first allocation editing, one item stage, no nested focus trap, footer visibility, discard/apply confirmation, sample selection, and recovery behavior.

- [ ] **Step 8: Commit the Portfolio migration.**

```bash
git add src/portfolio/ui/PortfolioEditSurface.tsx src/portfolio/ui/PortfolioItemSheet.tsx src/portfolio/ui/PortfolioApplyBar.tsx src/portfolio/ui/PortfolioSetupFlow.tsx src/portfolio/ui/PortfolioExamplePicker.tsx src/portfolio/ui/AllocationEditor.tsx src/portfolio/ui/portfolio.css tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/portfolio/PortfolioItemSheet.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx tests/portfolio.spec.ts
git commit -m "refactor: stage Portfolio editing inside shared surface"
```

### Task 5: Migrate settings and result preview surfaces

**Files:**

- Modify: `src/journey/ui/AppManagementMenu.tsx`
- Modify: `src/main/ui/MainManagementMenu.tsx`
- Modify: `src/simulation/ui/SimulationManagementMenu.tsx`
- Modify: `src/portfolio/ui/PortfolioManagementMenu.tsx`
- Modify: `src/portfolio/ui/PortfolioResultCardPreview.tsx`
- Modify: `src/components/common/responsive-dialog.css`
- Test: `tests/unit/journey/AppLauncher.test.tsx`
- Test: `tests/unit/main/MainApp.test.tsx`
- Test: `tests/unit/simulation/SimulationManagementMenu.test.tsx`
- Test: `tests/unit/portfolio/PortfolioDialogs.test.tsx`
- Test: `tests/account-workspace.spec.ts`

**Interfaces:**

- Management menus use `ResponsiveDialogLayout layout="settings"`; account recovery/logout and view controls remain owned by their existing app controllers.
- `PortfolioResultCardPreview` uses `layout="preview"`; PNG creation, stale revision checks, share client, and save/share actions remain unchanged.

- [ ] **Step 1: Add failing settings and preview layout assertions.** Verify mobile settings are bottom sheets with grouped fieldsets, preview dialogs keep the image visible while options scroll, and the preview footer remains visible at 390px.

```tsx
it('keeps preview controls below the image without hiding the footer', () => {
  render(<PreviewFixture />);
  fireEvent.click(screen.getByRole('button', {name: '저장하기'}));
  const dialog = screen.getByRole('dialog', {name: '계획 이미지 저장'});
  expect(dialog.querySelector('[data-surface-layout="preview"]')).toBeTruthy();
  expect(within(dialog).getByRole('img', {name: /저장하거나 공유할/})).toBeVisible();
  expect(within(dialog).getByRole('button', {name: '이미지 저장'})).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests and confirm the new hooks fail.**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/simulation/SimulationManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx`

Expected: FAIL because these callers still render their previous menu/preview body arrangement.

- [ ] **Step 3: Migrate management menu contents.** Keep the existing right-handed placement decision out of the overlay shell; the launcher opens the common settings surface and the surface content uses fieldsets, full-row labels, and a right-aligned control column. Preserve account recovery and logout behavior.

- [ ] **Step 4: Migrate result preview.** Put the PNG image in the body/context area, the amount switch and privacy notice in the status/options area, and the intent-specific action in the footer. Keep share upload gated behind the explicit action and preserve stale/revision/error handling.

- [ ] **Step 5: Verify settings and preview flows.**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/simulation/SimulationManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx && npm run test:e2e -- tests/account-workspace.spec.ts --grep "result-card|settings" --reporter=dot`

Expected: PASS for 390px, 768px, and desktop with no launcher overflow, visible image preview, correct focus return, and unchanged save/share behavior.

- [ ] **Step 6: Commit the settings and preview migration.**

```bash
git add src/journey/ui/AppManagementMenu.tsx src/main/ui/MainManagementMenu.tsx src/simulation/ui/SimulationManagementMenu.tsx src/portfolio/ui/PortfolioManagementMenu.tsx src/portfolio/ui/PortfolioResultCardPreview.tsx src/components/common/responsive-dialog.css tests/unit/journey/AppLauncher.test.tsx tests/unit/main/MainApp.test.tsx tests/unit/simulation/SimulationManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx tests/account-workspace.spec.ts
git commit -m "refactor: align settings and preview surfaces"
```

### Task 6: Remove duplicate shells and update canonical documentation

**Files:**

- Delete: `src/portfolio/ui/PortfolioDialog.tsx`
- Modify: `DESIGN.md`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md` only for the approved surface contract and acceptance wording
- Modify: `docs/superpowers/specs/2026-09-21-responsive-overlays-and-result-card-design.md` with a link to the unified surface spec where the old shell details are superseded
- Modify: `docs/superpowers/plans/2026-09-21-responsive-experience.md` to point implementation ownership at the new plan
- Test/search: repository-wide runtime reference search

- [ ] **Step 1: Prove the old implementations have no remaining runtime consumers.**

Run: `rg -n "PortfolioDialog|dataPresentation|main-editor-sheet|portfolio-dialog" src tests`

Expected before deletion: only the migration callers and tests are listed; after migration the command returns no runtime import or selector references except intentional compatibility documentation.

- [ ] **Step 2: Delete the duplicate Portfolio shell and obsolete Main/Portfolio CSS.** Remove only rules and imports that existed to provide the old shell, retaining field, row, summary, chart, and result-card styles.

- [ ] **Step 3: Update canonical docs.** Add the 767/768 breakpoint, header/context/body/status/footer contract, surface types, app-specific order, and no-nested-trap rule to `DESIGN.md`. Link the approved spec from the PRD and superseded responsive docs without changing data ownership or schema claims.

- [ ] **Step 4: Verify docs and source references.**

Run: `git diff --check && npm run check && rg -n "PortfolioDialog|dataPresentation|main-editor-sheet|portfolio-dialog" src tests`

Expected: diff and type checks pass; no retired shell remains in supported runtime paths.

- [ ] **Step 5: Commit the cleanup and documentation.**

```bash
git add -u src/portfolio/ui/PortfolioDialog.tsx src/main/ui/main.css src/portfolio/ui/portfolio.css DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-09-21-responsive-overlays-and-result-card-design.md docs/superpowers/plans/2026-09-21-responsive-experience.md
git commit -m "docs: finalize unified responsive surface contract"
```

### Task 7: Run the release verification matrix and hand off

**Files:**

- Modify: `tests/main-react.spec.ts` only if the shared selectors need viewport assertions
- Modify: `tests/simulation.spec.ts` only if the shared selectors need viewport assertions
- Modify: `tests/portfolio.spec.ts` only if the shared selectors need viewport assertions
- Modify: `tests/account-workspace.spec.ts` only if the preview/settings flow needs a shared surface locator
- No production data or storage files are changed in this task.

- [ ] **Step 1: Run the complete type and unit checks.**

Run: `npm run check:ci`

Expected: harness, source/unit TypeScript, and all unit tests pass.

- [ ] **Step 2: Run focused browser flows across all apps.**

Run: `npm run test:e2e -- tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts tests/account-workspace.spec.ts --reporter=dot`

Expected: the changed Main, Simulation, Portfolio, settings, and result-preview flows pass. Any unrelated pre-existing full-suite failures are recorded with their exact test and not relabelled as passing.

- [ ] **Step 3: Verify the viewport matrix.** Use Playwright contexts for `390x844`, `390x600`, `768x1024`, `1024x600`, and `1280x900`; assert the surface presentation, body scroll containment, footer visibility, focus return, and no horizontal overflow. Use a reduced-motion context once for each editor.

- [ ] **Step 4: Inspect the changed UI manually.** Capture Main monthly edit, Simulation condition edit, Portfolio allocation/item stage, settings, and result preview at 390px, 768px, and desktop. Confirm the internal order matches the spec and that no screen has two visible close controls or two simultaneous sheets.

- [ ] **Step 5: Run final repository checks and prepare handoff.**

Run: `git diff --check && git status --short --branch && git log --oneline -8`

Expected: only intentional implementation commits and the preserved user untracked plan remain; report changed files, exact test results, any existing failures, and any follow-up owner.

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 cover the shared shell and Main; Task 3 covers Simulation; Task 4 covers Portfolio stages and nested-trap removal; Task 5 covers settings and preview; Task 6 covers duplicate-shell removal and canonical docs; Task 7 covers the full verification matrix.
- **Placeholder scan:** No task depends on an unnamed future file or an unspecified error path. Every task names the files, test command, expected result, and commit.
- **Type consistency:** `ResponsiveDialogLayoutProps`, `layout`, `onBack`, `onClose`, `context`, `status`, `footer`, and `requestClose(reason)` are used consistently across all migration tasks.
- **Review focus coverage:** short viewports and breakpoint changes are pinned in Tasks 1 and 7; drag guards in Tasks 1–2; Portfolio stage/focus behavior in Task 4; saving/error/conflict behavior in Tasks 2–4.
- **Known boundary:** Supabase migration/functions/Cron deployment is outside this UI plan. The result preview keeps the existing share client contract and must continue to show backend errors without claiming a link was created.
