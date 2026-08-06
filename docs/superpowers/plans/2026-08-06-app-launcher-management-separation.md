# App Launcher Management Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate app navigation from the right-aligned management tool, move icon help into the gear popover, and add automatic app overflow that stays dormant while the current four apps fit.

**Architecture:** `AppLauncher` becomes a shell containing an `ISF 앱` navigation region and a sibling `앱 도구` group. A pure partition helper and a narrow `ResizeObserver` hook determine direct versus overflow navigation while always keeping the current app visible. `AppManagementMenu` keeps app-owned actions but adds journey-owned icon help in the same visual popover without placing static help content inside the ARIA menu.

**Tech Stack:** React 19, TypeScript, CSS/Tailwind CSS 4 foundation tokens, ResizeObserver, Vitest + Testing Library, Playwright.

## Global Constraints

- Do not begin Task 1 until the in-progress common React component work is complete and merged into `main`.
- Re-read the latest `AppLauncher`, `AppManagementMenu`, shared component API, journey CSS, and focused tests after that merge; preserve the new common API if it differs from this plan's current snapshot.
- Main remains the completed current baseline; no app storage schema, route, calculation, backup, reset, or write-back behavior changes.
- Current app navigation is generated from `APP_NAV_ITEMS`; do not duplicate app metadata for help or overflow.
- The current app is always directly visible.
- Current four-app layouts render no `더보기` when they fit.
- App links and management trigger remain 44×44px.
- The right management group never wraps, shrinks, or becomes sticky/fixed.
- `ISF 앱` navigation contains navigation controls only; the sibling tool group is named `앱 도구`.
- The gear's accessible name remains `관리 메뉴`.
- Existing pointer, keyboard, touch long-press, confirmation dialog, persistence failure, and reduced-motion contracts remain supported.

---

## File Structure

- Create `src/journey/ui/appNavigationOverflow.ts`: pure capacity and current-app-preserving partition logic.
- Create `tests/unit/journey/appNavigationOverflow.test.ts`: literal geometry and ordering cases for four, five, overflow, and trailing current app.
- Modify `src/journey/ui/AppLauncher.tsx`: render semantic sibling groups, observe navigation width, render `더보기`, and remove the separate `?` control.
- Modify `src/journey/ui/AppManagementMenu.tsx`: add the first `앱 아이콘 안내` menu item and a sibling static help region.
- Modify `src/journey/ui/journey.css`: left/right group layout, hairline, overflow popover, integrated help panel, and removal of obsolete narrow-help styles.
- Modify `tests/unit/journey/AppLauncher.test.tsx`: semantic separation, no standalone help, fallback partition, overflow routes, focus and dismissal.
- Modify `tests/unit/journey/AppManagementMenu.test.tsx`: integrated help disclosure and existing action lifecycle.
- Modify `tests/app-journey.spec.ts`: real 390/768/desktop geometry, help, overflow, keyboard, touch, focus restoration, and app-specific management regression.
- Modify `DESIGN.md`: replace the standalone help contract with separated navigation/tools and automatic overflow.

---

### Task 0: Dependency Gate and Latest-Baseline Audit

**Files:**
- Read: `src/journey/ui/AppLauncher.tsx`
- Read: `src/journey/ui/AppManagementMenu.tsx`
- Read: `src/journey/ui/journey.css`
- Read: `tests/unit/journey/AppLauncher.test.tsx`
- Read: `tests/unit/journey/AppManagementMenu.test.tsx`
- Read: `tests/app-journey.spec.ts`
- Read: `DESIGN.md`

**Interfaces:**
- Consumes: the completed common React component work on latest `main`.
- Produces: a confirmed implementation baseline; no product code or test changes.

- [ ] **Step 1: Confirm the external dependency is complete**

Require both conditions before continuing:

1. the owner/user reports the common React component work complete;
2. the corresponding work is present on latest `main`.

If either condition is absent, stop after reporting that this plan remains queued. Do not infer completion from elapsed time or a clean worktree.

- [ ] **Step 2: Update the isolated worktree from latest main**

Use the Orca-managed worktree; do not create or delete it. Fetch and inspect branch relationships before integrating latest `main`:

```bash
git status --short
git fetch origin main
git log --oneline --decorate -12 main origin/main HEAD
git diff --name-status HEAD..main -- src/journey/ui tests/unit/journey tests/app-journey.spec.ts DESIGN.md
```

Preserve every user or other-worker change. If latest `main` touches the same files, integrate through a normal merge or rebase only after confirming the working tree is clean and the user-selected branch policy permits it.

- [ ] **Step 3: Reconcile current APIs with the approved spec**

Confirm these capabilities still exist, even if names changed:

- one shared app metadata source;
- a launcher-level slot or composition boundary for the management control;
- app-owned management item/action injection;
- popover outside-click, Escape, and return-focus behavior;
- icon rendering shared between navigation and help.

If the common component work removed or materially changed any boundary, update this plan and ask for approval before Task 1. Do not recreate an obsolete API.

- [ ] **Step 4: Verify the post-merge baseline**

Run:

```bash
npm run check
npm run test:unit
npx playwright test tests/app-journey.spec.ts --reporter=list
git diff --check
```

Expected: current baseline passes before launcher changes. If it fails, stop and report the pre-existing failure.

---

### Task 1: Pure Responsive Overflow Partition

**Files:**
- Create: `src/journey/ui/appNavigationOverflow.ts`
- Create: `tests/unit/journey/appNavigationOverflow.test.ts`

**Interfaces:**
- Consumes: ordered navigation items with stable string ids, current id, measured navigation width, 44px target width, and 4px gap.
- Produces: `partitionAppNavigation<T extends { id: string }>(items, currentId, availableWidth, options?): { visible: T[]; overflow: T[] }`.
- Preserves: original order inside both returned arrays and direct visibility of the current item.

- [ ] **Step 1: Write failing partition tests**

Create literal fixtures `a` through `f` and test these outcomes:

```ts
const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

expect(partitionAppNavigation(items.slice(0, 4), 'd', 188)).toEqual({
  visible: items.slice(0, 4),
  overflow: [],
});
expect(partitionAppNavigation(items, 'e', 236)).toEqual({
  visible: items,
  overflow: [],
});
expect(partitionAppNavigation(items, 'e', 188)).toEqual({
  visible: [items[0], items[1], items[4]],
  overflow: [items[2], items[3]],
});
expect(partitionAppNavigation(items, 'b', 188)).toEqual({
  visible: [items[0], items[1], items[2]],
  overflow: [items[3], items[4]],
});
```

The `188px` overflow case reserves one 44px `더보기` target and three 44px direct targets with four 4px gaps. Also cover zero/negative width and `availableWidth === undefined` fallback: at most four direct items, with current retained.

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run tests/unit/journey/appNavigationOverflow.test.ts
```

Expected: FAIL because the partition module does not exist.

- [ ] **Step 3: Implement the minimal pure partition**

Use exact defaults and no DOM dependency:

```ts
interface OverflowOptions {
  itemWidth?: number;
  gap?: number;
  fallbackVisibleCount?: number;
}

export function partitionAppNavigation<T extends { id: string }>(
  items: readonly T[],
  currentId: string,
  availableWidth: number | undefined,
  options: OverflowOptions = {},
): { visible: T[]; overflow: T[] } {
  const itemWidth = options.itemWidth ?? 44;
  const gap = options.gap ?? 4;
  const fallbackVisibleCount = options.fallbackVisibleCount ?? 4;
  const allFitWidth = items.length * itemWidth + Math.max(0, items.length - 1) * gap;
  if (availableWidth !== undefined && availableWidth >= allFitWidth) {
    return { visible: [...items], overflow: [] };
  }

  const measuredCapacity = availableWidth === undefined
    ? fallbackVisibleCount
    : Math.floor((Math.max(0, availableWidth) - itemWidth) / (itemWidth + gap));
  const visibleCount = Math.max(0, Math.min(items.length, measuredCapacity));
  const initialVisible = items.slice(0, visibleCount);
  const current = items.find(({ id }) => id === currentId);
  const visible = current === undefined || initialVisible.some(({ id }) => id === currentId)
    ? initialVisible
    : [...initialVisible.slice(0, -1), current];
  const visibleIds = new Set(visible.map(({ id }) => id));
  return {
    visible,
    overflow: items.filter(({ id }) => !visibleIds.has(id)),
  };
}
```

Handle `visibleCount === 0` explicitly: if the current item exists, return it as the single visible item and place every other item in overflow. Do not mutate the source array.

- [ ] **Step 4: Run focused tests and type check**

Run:

```bash
npx vitest run tests/unit/journey/appNavigationOverflow.test.ts
npm run check
```

Expected: partition tests and TypeScript pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/journey/ui/appNavigationOverflow.ts tests/unit/journey/appNavigationOverflow.test.ts
git commit -m "feat(journey): partition launcher overflow"
```

---

### Task 2: Semantic Launcher Groups and Overflow Menu

**Files:**
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `src/journey/ui/journey.css`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`, `partitionAppNavigation()`, `managementMenu` slot, shared icons, and `appPath()`.
- Produces: sibling `ISF 앱` navigation and `앱 도구` group, optional `더보기` button/popup, and no standalone `앱 아이콘 도움말` button.
- Preserves: current-link semantics, readiness state, pointer/focus tooltip, touch long-press suppression, and management slot rendering.

- [ ] **Step 1: Write failing semantic and fallback tests**

Update the primary `AppLauncher` test to assert:

```tsx
const navigation = screen.getByRole('navigation', { name: 'ISF 앱' });
const tools = screen.getByRole('group', { name: '앱 도구' });
expect(within(navigation).getAllByRole('link')).toHaveLength(4);
expect(within(navigation).queryByRole('button', { name: '관리 메뉴' })).not.toBeInTheDocument();
expect(within(tools).getByRole('button', { name: '관리 메뉴' })).toBeVisible();
expect(screen.queryByRole('button', { name: '앱 아이콘 도움말' })).not.toBeInTheDocument();
```

Stub `ResizeObserver` and the navigation element's `clientWidth` at a width that forces one current app plus earlier apps into direct display. Assert the current app remains a direct link, `더보기` contains the hidden routes in source order, prepared status is present, Escape/outside pointer closes it, and focus returns to `더보기`.

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
npx vitest run tests/unit/journey/AppLauncher.test.tsx
```

Expected: FAIL because help remains standalone, management remains inside navigation, and overflow does not exist.

- [ ] **Step 3: Implement measurement and semantic structure**

In `AppLauncher`:

- replace the root `nav` with a `.journey-launcher` wrapper;
- render a child `nav aria-label="ISF 앱"` containing only visible links and optional `더보기`;
- render a sibling `div role="group" aria-label="앱 도구"` containing the existing management slot;
- observe the navigation container with one `ResizeObserver`, update its measured `clientWidth`, and disconnect on unmount;
- partition `APP_NAV_ITEMS` through Task 1's helper;
- remove `helpOpen`, `HELP_PANEL_ID`, the narrow help button, and the old help panel;
- keep app tooltip and long-press state handlers unchanged except for references required by the new wrapper.

The observer callback reads only the navigation area's assigned flex width, which already excludes the fixed tool group and hairline.

- [ ] **Step 4: Implement the overflow popup**

Add local `overflowOpen` state, a trigger ref, and an overflow root ref. Render `더보기` only when `overflow.length > 0`.

- trigger: 44×44px, `aria-label="앱 더보기"`, `aria-expanded`, `aria-controls`;
- popup: `role="menu"`, `aria-label="추가 앱"`;
- each hidden app: an anchor with `role="menuitem"`, shared icon, accessible label, and readiness text;
- Escape/outside pointer: close and restore trigger focus;
- focus leaving the navigation area: close without stealing focus;
- opening overflow clears active app tooltip;
- direct app focus/pointer closes overflow;
- the fixed management component's existing outside-pointer behavior closes it before pointer-opening overflow, while management blur closes it before keyboard-opening overflow.

- [ ] **Step 5: Add launcher layout and overflow CSS**

Use a single flex row:

```css
.journey-launcher {
  display: flex;
  width: 100%;
  max-width: 72rem;
  min-width: 0;
  align-items: center;
  margin-inline: auto;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 68%, transparent);
  padding-bottom: 0.25rem;
}

.journey-launcher__navigation {
  min-width: 0;
  flex: 1 1 auto;
}

.journey-launcher__list {
  display: flex;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.journey-launcher__tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-left: 0.75rem;
  border-left: 1px solid var(--line);
  padding-left: 0.75rem;
}
```

Style `더보기` as a 44px navigation control and its popover with the existing panel, line, radius, shadow, 16px viewport gutter, readiness-dot, focus ring, and reduced-motion tokens. Remove obsolete `.journey-launcher__help-*` rules.

- [ ] **Step 6: Run focused tests and type check**

Run:

```bash
npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/appNavigationOverflow.test.ts
npm run check
```

Expected: semantic, overflow, legacy tooltip/long-press, and type tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/journey/ui/AppLauncher.tsx src/journey/ui/journey.css tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): separate launcher tools"
```

---

### Task 3: Icon Help Inside Management Popover

**Files:**
- Modify: `src/journey/ui/AppManagementMenu.tsx`
- Modify: `src/journey/ui/journey.css`
- Modify: `tests/unit/journey/AppManagementMenu.test.tsx`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`, `AppNavigationIcon`, and existing app-owned management items.
- Produces: first menu item `앱 아이콘 안내` plus a sibling `region` inside the visual popover wrapper.
- Preserves: `관리 메뉴` trigger name, app item ordering after help, file input, confirmation dialog, partial failures, outside/Escape close, and return focus.

- [ ] **Step 1: Write failing integrated-help tests**

In `AppManagementMenu.test.tsx`, open `관리 메뉴` and assert:

```tsx
const help = screen.getByRole('menuitem', { name: '앱 아이콘 안내' });
expect(help).toHaveAttribute('aria-expanded', 'false');
fireEvent.click(help);
expect(help).toHaveAttribute('aria-expanded', 'true');
const panel = screen.getByRole('region', { name: '앱 아이콘 안내' });
expect(panel).toHaveTextContent('자금 흐름 (Main)');
expect(panel).toHaveTextContent('계좌 연결 (Account Map)');
expect(panel).toHaveTextContent('준비 중');
expect(within(screen.getByRole('menu', { name: '관리 메뉴' })).queryByRole('region'))
  .not.toBeInTheDocument();
```

Assert a second click collapses the panel, help retains focus, Escape/outside closes the whole wrapper and returns focus to gear, and existing app item execution still works after expanding/collapsing help.

- [ ] **Step 2: Run the component tests and confirm RED**

Run:

```bash
npx vitest run tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx
```

Expected: FAIL because `AppManagementMenu` has no integrated app help.

- [ ] **Step 3: Restructure the popover without breaking ARIA menu content**

In `AppManagementMenu`:

- add `helpOpen` state and a help-region id;
- keep one visual `.journey-management__popover` wrapper without a menu role;
- place `div role="menu" aria-label="관리 메뉴"` inside the wrapper;
- render `앱 아이콘 안내` as the first `role="menuitem"` button with `aria-expanded` and `aria-controls`;
- render current app-owned items after the help row;
- render the static help `section role="region" aria-label="앱 아이콘 안내"` as a sibling after the role menu;
- generate all help rows from `APP_NAV_ITEMS` and `AppNavigationIcon`;
- reset `helpOpen` whenever the whole popover closes or an app action begins;
- add root `onBlur` handling that closes only when focus leaves the complete management root, preserving focus for menu/file/dialog descendants.

Keep `aria-controls` on the gear pointed at the visual popover wrapper. Do not rename the gear or role menu.

- [ ] **Step 4: Reuse and rename help-panel CSS**

Move the prior static help row styling to `.journey-management__app-help`; do not restore the standalone `?` hit target. The integrated region:

- uses the popover's width instead of a second absolute panel;
- has a top hairline separating it from action rows;
- uses the same icon, text, readiness typography as the previous help panel;
- creates no focusable controls;
- stays within the existing popover viewport gutter.

- [ ] **Step 5: Run focused tests and type check**

Run:

```bash
npx vitest run tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx
npm run check
```

Expected: integrated help and every existing management action/dialog test pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/journey/ui/AppManagementMenu.tsx src/journey/ui/journey.css tests/unit/journey/AppManagementMenu.test.tsx tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): move icon help into management"
```

---

### Task 4: Cross-App Responsive Contract and Documentation

**Files:**
- Modify: `tests/app-journey.spec.ts`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: semantic group names and stable classes from Tasks 2–3.
- Produces: real-browser evidence across four apps and canonical UI documentation.

- [ ] **Step 1: Replace standalone-help browser expectations**

At 390px, 768px, and 1280px for each route, assert:

- `ISF 앱` navigation has four direct links and no `관리 메뉴` descendant;
- sibling `앱 도구` contains one 44×44px `관리 메뉴`;
- `앱 아이콘 도움말` is absent;
- all direct app links share one y-axis and remain 44×44px;
- the tool group's right edge matches the launcher right edge within 1px;
- hairline border width is 1px and uses a nontransparent line color;
- page horizontal overflow is absent.

- [ ] **Step 2: Verify integrated help and management regression**

Open the gear on every route, activate `앱 아이콘 안내`, and assert all four app labels and Account Map readiness appear in the same popover wrapper. Verify the region is not inside `role="menu"`, stays within 16px viewport gutters, and collapses on a second activation.

Then verify each route's existing management content:

- Main: `백업 가져오기`;
- Simulation: `시뮬레이션 다시 설정`;
- Portfolio: `투자 배분 처음부터 다시`;
- Account Map: `아직 관리할 설정이 없습니다`.

Close by Escape and outside pointer and assert gear focus restoration.

- [ ] **Step 3: Verify overflow with controlled available width**

Use `page.addStyleTag()` to constrain `.journey-launcher` to a width that cannot hold four direct links plus the fixed tool group. Assert:

- `앱 더보기` appears left of the hairline;
- the current route remains a direct link even when it is last in `APP_NAV_ITEMS`;
- hidden apps appear in source order inside `추가 앱`;
- readiness text remains accessible;
- selecting a hidden app routes correctly;
- opening gear closes overflow and opening overflow closes gear;
- Escape/outside pointer returns focus to the trigger that owned the open popup.

Remove the injected style, resize to a width that fits, and assert `앱 더보기` disappears. The pure Task 1 test supplies the synthetic five-app case and proves that five direct 44px items remain visible at `236px` of navigation width.

- [ ] **Step 4: Update DESIGN canonical contracts**

Replace the old standalone `?` paragraph with:

- left `ISF 앱` navigation and right `앱 도구` group separated by whitespace and a vertical hairline;
- 44px right-aligned gear named `관리 메뉴`;
- `앱 아이콘 안내` disclosure inside the management popover;
- automatic width-based `더보기`, current-app visibility, source-order overflow, and dormant current four-app behavior;
- nonsticky page-scroll behavior and popover focus/containment rules.

- [ ] **Step 5: Run focused browser tests**

Run:

```bash
npx playwright test tests/app-journey.spec.ts --reporter=list
```

Expected: cross-app launcher, help, management, overflow, focus, touch, and responsive tests pass.

- [ ] **Step 6: Run complete required verification**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
git diff --check
```

Expected: type checks pass, all active unit and supported E2E tests pass, retired legacy tests remain explicitly skipped, and diff-check emits no output.

- [ ] **Step 7: Request independent review**

Use `superpowers:requesting-code-review` against the post-dependency-gate base. Require review of the latest common component API, semantic nav/tool separation, width math, current-app retention, ResizeObserver cleanup, focus restoration, popup mutual exclusion, ARIA menu/region structure, 390px containment, app-specific actions, and schema/data ownership preservation. Fix every Critical or Important finding and rerun Step 6.

- [ ] **Step 8: Commit browser contract and documentation**

```bash
git add tests/app-journey.spec.ts DESIGN.md
git commit -m "test(journey): verify separated launcher tools"
```

---

## Completion Evidence

Record in the final handoff:

- the common React dependency completion evidence and the exact post-gate base commit;
- changed files and responsibilities;
- partition RED/GREEN, launcher RED/GREEN, and management-help RED/GREEN commands;
- 390px, 768px, desktop, constrained-width overflow, keyboard, touch, and focus results;
- final type, unit, full E2E, and diff-check counts;
- independent review findings and fixes;
- confirmation that app routes, storage schemas, management actions, and unrelated user changes remain unchanged;
- the Orca worktree remains available unless the user explicitly changes that policy.
