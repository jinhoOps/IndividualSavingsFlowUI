# App Management and Simulation Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **완료 기록 (2026-08-06):** 구현, 독립 코드 리뷰와 회귀 검증을 완료하고 `main`에 병합·푸시했다. 병합 커밋은 `c368dac`이며, 최종 검증에서 `npm run check`, 단위 테스트 428개, E2E 50개와 `git diff --check`가 통과했다. 리뷰에서 발견된 관리 메뉴 포커스 복귀, Main 가져오기 노출 범위와 Simulation 초기화 실패 dialog 처리도 병합 전에 반영했다. 아래 체크박스는 실행 당시 계획을 보존한 기록이며 현재 미완료 상태를 뜻하지 않는다.

**Goal:** Add one accessible gear management menu beside the app-launcher help control in every app and align Simulation surfaces and controls with the shared ISF visual foundation.

**Architecture:** `AppLauncher` receives a render-only management slot; a journey-owned `AppManagementMenu` implements the shared trigger, popover, file row, confirmation dialog, and focus behavior without importing app persistence. Main, Simulation, Portfolio, and Account Map each construct their own item list and retain ownership of backup/reset effects. Simulation keeps chart geometry and hierarchy while replacing duplicated shell, surface, button, input, and dialog styling with shared foundation classes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 shared foundation classes, CSS, Vitest + Testing Library, Playwright.

## Global Constraints

- Main remains the completed current baseline and keeps its five-value v2 data contract.
- Simulation and Portfolio never write back to Main; Account Map remains readiness-only with no storage.
- The gear trigger is 44×44px and follows the narrow help control in the same unwrapped launcher row.
- Setup or onboarding screens that hide `AppLauncher` also hide the management menu.
- Ordinary surfaces use a white flat panel and solid hairline; shadow is limited to popovers and modal dialogs.
- All visible primary controls retain a minimum 44px touch target at 390px, 768px, and desktop.
- Reset primary-write failure preserves the prior applied state; cleanup-only failure reports partial success accurately.
- No new persistence schema, cross-app backup schema, calculations, tax, MDD, or Account Map settings are introduced.

---

## File Structure

- Create `src/journey/ui/AppManagementMenu.tsx`: generic management item model, gear trigger, popover lifecycle, file input row, and confirmation state.
- Create `src/journey/ui/ManagementConfirmationDialog.tsx`: modal focus containment and return-focus behavior.
- Modify `src/journey/ui/AppLauncher.tsx`: accept and render a `managementMenu?: ReactNode` slot after help.
- Modify `src/journey/ui/journey.css`: gear, popover, menu-row, destructive tone, empty message, and dialog styles.
- Create `src/main/ui/MainManagementMenu.tsx`: Main-owned item construction and restart coordination.
- Modify `src/main/ui/MainApp.tsx`: inject Main management menu only in dashboard/recovery contexts that show the launcher.
- Modify `src/main/ui/dashboard/SummaryDashboard.tsx`: remove duplicated header backup/restart controls while retaining feedback.
- Create `src/simulation/ui/SimulationManagementMenu.tsx`: Simulation reset item and error feedback adapter.
- Modify `src/simulation/ui/SimulationApp.tsx`: inject management menu and remove the old toolbar menu.
- Delete `src/simulation/ui/SimulationMenu.tsx`: superseded Simulation-only details/dialog implementation.
- Create `src/portfolio/ui/PortfolioManagementMenu.tsx`: Portfolio reset item using the existing reset callback.
- Modify `src/portfolio/ui/PortfolioApp.tsx`: inject management menu and remove the old toolbar reset control.
- Delete `src/portfolio/ui/PortfolioMenu.tsx`: superseded Portfolio-only reset dialog.
- Modify `src/journey/ui/ReadinessApp.tsx`: always inject the Account Map empty management menu.
- Modify Simulation UI component class names and `src/simulation/ui/simulation.css`: use shared surfaces/buttons/inputs while retaining chart-specific rules.
- Modify `DESIGN.md`: record management-menu and Simulation shared-visual contracts.

---

### Task 1: Shared Launcher Management Shell

**Files:**
- Create: `src/journey/ui/AppManagementMenu.tsx`
- Create: `src/journey/ui/ManagementConfirmationDialog.tsx`
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `src/journey/ui/journey.css`
- Create: `tests/unit/journey/AppManagementMenu.test.tsx`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Produces:

```ts
export type AppManagementItem =
  | { kind: 'action'; id: string; label: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect(): void; confirmation?: ManagementConfirmation }
  | { kind: 'file'; id: string; label: string; accept: string; disabled?: boolean; onFile(file: File): void }
  | { kind: 'separator'; id: string }
  | { kind: 'message'; id: string; text: string };

export interface ManagementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
}

export function AppManagementMenu({ items }: { items: readonly AppManagementItem[] }): JSX.Element;
```

- Changes `AppLauncherProps` to:

```ts
export interface AppLauncherProps {
  currentApp: JourneyApp;
  managementMenu?: ReactNode;
}
```

- `AppLauncher` renders the supplied node inside `.journey-launcher__management-item` immediately after `.journey-launcher__help-item`.

- [ ] **Step 1: Write failing shared-menu tests**

Add tests that render one normal action, one file action, one danger action with confirmation, and one message. Assert:

```tsx
const items: AppManagementItem[] = [
  { kind: 'action', id: 'export', label: '백업 내보내기', onSelect: onExport },
  { kind: 'file', id: 'import', label: '백업 가져오기', accept: 'application/json,.json', onFile: onFile },
  { kind: 'separator', id: 'split' },
  {
    kind: 'action',
    id: 'reset',
    label: '처음부터 다시',
    tone: 'danger',
    onSelect: onReset,
    confirmation: { title: '처음부터 다시 할까요?', description: '현재 설정을 다시 확인합니다.', confirmLabel: '다시 시작' },
  },
];

expect(screen.getByRole('button', { name: '관리 메뉴' })).toHaveAttribute('aria-expanded', 'false');
fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
expect(screen.getByRole('menu', { name: '관리 메뉴' })).toBeVisible();
```

Cover action execution, file selection, file-cancel no-op, Escape, outside pointer close, confirmation initial focus, Tab wrapping, Escape cancel, and trigger focus restoration with `waitFor` after dialog unmount.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm run test:unit -- tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx
```

Expected: FAIL because `AppManagementMenu` and the launcher slot do not exist.

- [ ] **Step 3: Implement the minimal shared shell**

Use component-local state `open` and `pendingConfirmation`. Register `pointerdown` and `keydown` listeners only while the popover is open. Keep the trigger ref in `AppManagementMenu`; pass it to `ManagementConfirmationDialog`. The file row must use a visually hidden input and reset `event.currentTarget.value = ''` after processing so the same file can be chosen twice.

The confirmation dialog must call native `showModal()`, focus `[data-dialog-initial-focus]`, wrap Tab between enabled controls, prevent native cancel, close before unmount, and restore the gear trigger in a queued microtask.

- [ ] **Step 4: Add shared launcher styles**

Implement exact contracts:

```css
.journey-launcher__management-trigger { width: 44px; height: 44px; }
.journey-management__popover { width: min(17rem, calc(100vw - 32px)); }
.journey-management__row { min-height: 44px; }
.journey-management__dialog { width: min(28rem, calc(100vw - 32px)); }
```

Use `var(--panel)`, `var(--line)`, `var(--ui-control-radius)`, and `var(--shadow-float)` only for the floating popover/dialog. Add the trigger to the existing focus-visible and reduced-motion selectors.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: both test files pass.

- [ ] **Step 6: Commit the shared shell**

```bash
git add src/journey/ui/AppManagementMenu.tsx src/journey/ui/ManagementConfirmationDialog.tsx src/journey/ui/AppLauncher.tsx src/journey/ui/journey.css tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): add app management shell"
```

---

### Task 2: Main Management Actions

**Files:**
- Create: `src/main/ui/MainManagementMenu.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/main/SummaryDashboard.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes `AppManagementMenu` and `AppManagementItem` from Task 1.
- Produces:

```ts
export interface MainManagementMenuProps {
  saving: boolean;
  dirty: boolean;
  onCancel(): void;
  onRestart(): void;
  onExport(): void;
  onImportFile(file: File): void;
}

export function MainManagementMenu(props: MainManagementMenuProps): JSX.Element;
```

- [ ] **Step 1: Move behavioral expectations to failing Main tests**

Update `SummaryDashboard.test.tsx` to assert that the dashboard header no longer contains the three management controls but still renders `backupStatus`. Add `MainApp.test.tsx` coverage that opens `관리 메뉴`, executes export, supplies a JSON `File` to import, and confirms restart. For dirty state, confirmation executes `onCancel` before `onRestart`; for saving state, all actionable rows are disabled.

- [ ] **Step 2: Run Main unit tests and verify RED**

```bash
npm run test:unit -- tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx
```

Expected: FAIL because Main still renders header controls and does not inject a management menu.

- [ ] **Step 3: Implement Main-owned menu construction**

Build items in this exact order:

```ts
[
  { kind: 'action', id: 'main-export', label: '백업 내보내기', disabled: saving, onSelect: onExport },
  { kind: 'file', id: 'main-import', label: '백업 가져오기', accept: 'application/json,.json', disabled: saving, onFile: onImportFile },
  { kind: 'separator', id: 'main-reset-separator' },
  {
    kind: 'action', id: 'main-restart', label: '처음부터 다시', tone: 'danger', disabled: saving,
    confirmation: { title: '처음부터 다시 할까요?', description: '입력한 값은 유지한 채 설정 흐름을 다시 확인합니다.', confirmLabel: '다시 시작' },
    onSelect: () => { if (dirty) onCancel(); onRestart(); },
  },
] satisfies AppManagementItem[];
```

Pass `<MainManagementMenu ... />` through `MainAppShell` to `AppLauncher`. Do not pass it in setup branches where `showLauncher={false}`. Remove backup/restart controls and `window.confirm` logic from `SummaryDashboard`; retain the status paragraph in its existing dashboard location.

- [ ] **Step 4: Run Main unit tests and verify GREEN**

Run the command from Step 2. Expected: both files pass.

- [ ] **Step 5: Update and run focused Main E2E**

Replace direct header-control selectors with management-menu interactions. Keep the existing accessible file input assertion and add Escape/focus-return plus 390px containment:

```bash
npx playwright test tests/main-react.spec.ts --reporter=list
```

Expected: all supported Main tests pass.

- [ ] **Step 6: Commit Main integration**

```bash
git add src/main/ui/MainManagementMenu.tsx src/main/ui/MainApp.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/main/ui/main.css tests/unit/main/MainApp.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/main-react.spec.ts
git commit -m "feat(main): move actions to management menu"
```

---

### Task 3: Simulation, Portfolio, and Account Map Management

**Files:**
- Create: `src/simulation/ui/SimulationManagementMenu.tsx`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Delete: `src/simulation/ui/SimulationMenu.tsx`
- Create: `src/portfolio/ui/PortfolioManagementMenu.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Delete: `src/portfolio/ui/PortfolioMenu.tsx`
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Replace: `tests/unit/simulation/SimulationMenu.test.tsx` with `tests/unit/simulation/SimulationManagementMenu.test.tsx`
- Modify: `tests/unit/portfolio/PortfolioDialogs.test.tsx`
- Modify: `tests/unit/journey/ReadinessApp.test.tsx`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/portfolio.spec.ts`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Consumes `AppManagementMenu` from Task 1.
- Produces `SimulationManagementMenu({ onReset, resetFailed })` and `PortfolioManagementMenu({ onReset })`.

- [ ] **Step 1: Write failing app-specific tests**

Assert exact menu content and confirmation copy:

```tsx
expect(screen.getByRole('menuitem', { name: '시뮬레이션 다시 설정' })).toBeVisible();
expect(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' })).toBeVisible();
expect(screen.getByText('아직 관리할 설정이 없습니다')).toBeVisible();
```

Preserve existing reset semantics: Simulation clears only its repository; Portfolio writes a cash-only applied plan and clears its draft. Assert reset failure remains visible in the active menu/dialog surface and Portfolio cleanup-only failure retains the cash-only result with partial-success text.

- [ ] **Step 2: Run focused unit tests and verify RED**

```bash
npm run test:unit -- tests/unit/simulation/SimulationManagementMenu.test.tsx tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/journey/ReadinessApp.test.tsx
```

Expected: FAIL because the new management adapters and Account Map menu do not exist.

- [ ] **Step 3: Implement app adapters and remove old menus**

Use these confirmation contracts:

```ts
// Simulation
{ title: '시뮬레이션을 다시 설정할까요?', description: 'Simulation에서 설정한 값만 지우고 다시 시작합니다.', confirmLabel: '다시 설정' }

// Portfolio
{ title: '투자 배분을 처음부터 다시 할까요?', description: '투자 대상이 제거되고 투자금 전체가 현금으로 돌아갑니다.', confirmLabel: '초기화' }
```

Inject each adapter through the `managementMenu` slot. Remove `SimulationMenu` and `PortfolioMenu` imports/rendering. Account Map injects an `AppManagementMenu` with one `{ kind: 'message', id: 'account-map-empty', text: '아직 관리할 설정이 없습니다' }` item.

- [ ] **Step 4: Run focused unit tests and verify GREEN**

Run the command from Step 2. Expected: all three files pass.

- [ ] **Step 5: Update and run detailed-app E2E**

Update reset selectors to open `관리 메뉴` first. Add Account Map empty-menu assertions and confirm that Main, Simulation, and Portfolio localStorage bytes outside the target app remain unchanged.

```bash
npx playwright test tests/simulation.spec.ts tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list
```

Expected: all tests in the three specs pass.

- [ ] **Step 6: Commit detailed-app integration**

```bash
git add src/simulation/ui src/portfolio/ui src/journey/ui/ReadinessApp.tsx tests/unit/simulation tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/journey/ReadinessApp.test.tsx tests/simulation.spec.ts tests/portfolio.spec.ts tests/app-journey.spec.ts
git commit -m "feat(journey): connect app management actions"
```

---

### Task 4: Simulation Shared Visual Foundation

**Files:**
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/SimulationOnboarding.tsx`
- Modify: `src/simulation/ui/StartingPrincipalStep.tsx`
- Modify: `src/simulation/ui/ScenarioSetupStep.tsx`
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Modify: `src/simulation/ui/SimulationComparison.tsx`
- Modify: `src/simulation/ui/SimulationControls.tsx`
- Modify: `src/simulation/ui/AdvancedSettings.tsx`
- Modify: `src/simulation/ui/simulation.css`
- Modify: `tests/unit/simulation/SimulationOnboarding.test.tsx`
- Modify: `tests/unit/simulation/SimulationControls.test.tsx`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**
- No data or repository signatures change.
- Produces DOM contracts: `.ui-surface` on onboarding, chart, comparison, controls, and advanced-setting surfaces; `.ui-button` variants on action controls.

- [ ] **Step 1: Add failing visual-contract tests**

In unit tests assert shared classes on representative controls:

```tsx
expect(screen.getByRole('region', { name: '복리 성장 그래프' })).toHaveClass('ui-surface');
expect(screen.getByRole('button', { name: '연 기대수익률 9%' })).toHaveClass('ui-button');
expect(screen.getByRole('button', { name: '직접 입력' })).toHaveClass('ui-button', 'ui-button--secondary');
```

If the chart remains a `section`, add `aria-label="복리 성장 그래프"` rather than changing its heading relation. Add E2E computed-style assertions for white panel background, solid 1px border, shared radius, no ordinary surface shadow, and 44px controls at 390/768/1280.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm run test:unit -- tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/SimulationControls.test.tsx
npx playwright test tests/simulation.spec.ts --reporter=list
```

Expected: FAIL on missing shared classes and current bespoke surface/button styles.

- [ ] **Step 3: Apply shared classes without changing information order**

Add `ui-surface` to onboarding, chart, comparison, controls, and calculation-settings roots. Add `ui-button ui-button--primary` to forward/confirm CTA controls, `ui-button ui-button--secondary` to presets and increment/decrement controls, and `ui-button ui-button--quiet` only to low-priority text actions.

Keep this result order in `SimulationApp`: hero → chart → comparison → controls → advanced settings. Do not wrap the hero in a card or alter chart SVG/tooltip geometry.

- [ ] **Step 4: Remove duplicated generic Simulation CSS**

Delete selectors that redefine generic button border, radius, background, and touch height. Keep layout selectors such as `.simulation-duration-control`, chart geometry/color selectors, tooltip placement, comparison grid, and responsive chart density. Ordinary surfaces must resolve to:

```css
background-color: var(--panel);
border: 1px solid var(--line);
border-radius: var(--ui-surface-radius);
box-shadow: none;
```

Use padding only to express Simulation layout, not a second visual token system.

- [ ] **Step 5: Run focused unit and E2E tests and verify GREEN**

Run both commands from Step 2. Expected: all focused tests pass; chart and tooltip behavior remain unchanged.

- [ ] **Step 6: Commit Simulation visual alignment**

```bash
git add src/simulation/ui tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/SimulationControls.test.tsx tests/simulation.spec.ts
git commit -m "style(simulation): align shared visual system"
```

---

### Task 5: Documentation and Full Regression Gate

**Files:**
- Modify: `DESIGN.md`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/main-react.spec.ts`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Documents the final external contracts only; no new runtime interface.

- [ ] **Step 1: Update DESIGN canonical contracts**

Under `App Launcher`, add the gear position, 44×44px size, app-owned items, popover containment, Escape/outside close, and confirmation-dialog focus rules. Under Simulation, state that ordinary surfaces and controls use the shared flat panel/control tokens while chart color and interaction remain Simulation-owned.

- [ ] **Step 2: Add the cross-app launcher matrix**

In `app-journey.spec.ts`, visit all four routes at 390, 768, and 1280 widths and assert:

```ts
await expect(page.getByRole('button', { name: '관리 메뉴' })).toBeVisible();
expect(await page.getByRole('button', { name: '관리 메뉴' }).evaluate((button) => {
  const rect = button.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
})).toEqual({ width: 44, height: 44 });
expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
```

Open each menu and assert its expected item or Account Map message, viewport 16px containment, Escape close, outside-pointer close, and trigger focus return.

- [ ] **Step 3: Run the complete required verification**

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
git diff --check
```

Expected: type checks pass, every active unit test passes, every supported E2E test passes, retired legacy tests remain explicitly skipped, and diff-check emits no output.

- [ ] **Step 4: Request independent code review**

Use `superpowers:requesting-code-review` against the branch base. Require review of data ownership, partial persistence failures, dialog focus in real Chromium, 390px launcher containment, and removal of duplicated Simulation visual rules. Fix every Critical or Important finding and rerun Step 3.

- [ ] **Step 5: Commit final documentation and regression coverage**

```bash
git add DESIGN.md tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts
git commit -m "docs(ui): record app management contract"
```
