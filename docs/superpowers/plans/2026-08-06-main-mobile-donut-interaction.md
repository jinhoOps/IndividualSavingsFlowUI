# Main Mobile Donut Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Main's mobile cashflow donut compact and directly touchable while preserving amount detail, keyboard access, and desktop density.

**Architecture:** Keep cashflow calculation and allocation order in `cashflowInsight`, add a pure SVG-coordinate hit-test helper for ring selection, and let `CashflowDonutSummary` remain the single owner of hover, focus, and fixed tap state. CSS media queries hide only the visual amount at widths below 640px; accessible names and tooltips retain the amount at every viewport.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 shared foundation classes, SVG, Vitest + Testing Library, Playwright.

## Global Constraints

- Main remains the completed current baseline and keeps its five-value v2 data contract.
- Financial Detail Modal remains the only ordinary Main editing path.
- Donut calculations, allocation ordering, savings/investment bands, and investment/saving bands do not change.
- The user-facing donut term is `여윳돈`; the internal allocation id remains `remaining`.
- Mobile legend buttons retain a minimum 44px touch height and two-column layout at 390px.
- Mobile visually shows only color dot, label, and percentage; amount remains in the accessible name and tooltip.
- Desktop visually retains label, amount, and percentage.
- Pointer, touch, focus, and keyboard expose equivalent allocation detail.
- Reduced motion removes selection transition without removing selection state.

---

## File Structure

- Create `src/main/ui/dashboard/donutHitTest.ts`: convert a pointer coordinate inside the SVG bounds into the visible donut allocation id.
- Create `tests/unit/main/donutHitTest.test.ts`: prove ring geometry, clipped segment order, and ignored center/outside coordinates.
- Modify `src/main/domain/cashflowInsight.ts`: change only the `remaining` allocation's user-facing label to `여윳돈`.
- Modify `src/main/ui/dashboard/CashflowDonutSummary.tsx`: share active state across SVG pointer/touch and legend focus/tap, expose fixed selection, and render compactable amount markup.
- Modify `src/main/ui/main.css`: compact the mobile legend, restore amount density at 640px, and style selected donut geometry.
- Modify `tests/unit/main/CashflowDonutSummary.test.tsx`: cover center replacement, tooltip, outside dismissal, fixed selection, and terminology.
- Modify `tests/main-react.spec.ts`: verify 390px single-line legend and direct touch, plus desktop amount and reduced-motion behavior.
- Modify `DESIGN.md`: record mobile legend density and direct donut exploration contract.

---

### Task 1: Allocation Terminology and Pure Ring Hit Testing

**Files:**
- Create: `src/main/ui/dashboard/donutHitTest.ts`
- Create: `tests/unit/main/donutHitTest.test.ts`
- Modify: `src/main/domain/cashflowInsight.ts`
- Modify: `tests/unit/main/CashflowDonutSummary.test.tsx`

**Interfaces:**
- Consumes: `DonutAllocation[]` from `calculateCashflowInsight()` and DOMRect-like SVG bounds.
- Produces: `hitTestDonutAllocation(allocations, point, bounds): DonutAllocation['id'] | undefined`.
- Preserves: allocation ids and calculations; only `remaining.label` becomes `여윳돈`.

- [ ] **Step 1: Write failing terminology and geometry tests**

Add the following contract to `CashflowDonutSummary.test.tsx`:

```tsx
expect(screen.getByRole('img', {
  name: /소비 56\.3%.*저축 9\.4%.*투자 6\.3%.*여윳돈 28\.1%/,
})).toBeVisible();
expect(screen.getByRole('button', { name: /여윳돈.*90만 원.*28\.1%/ })).toBeVisible();
```

Create `donutHitTest.test.ts` with a square `100×100` bound and explicit points on the ring:

```ts
const bounds = { left: 0, top: 0, width: 100, height: 100 };
const allocations = calculateCashflowInsight(appliedData).allocations;

expect(hitTestDonutAllocation(allocations, { x: 50, y: 10 }, bounds)).toBe('consumption');
expect(hitTestDonutAllocation(allocations, { x: 26.5, y: 82.4 }, bounds)).toBe('saving');
expect(hitTestDonutAllocation(allocations, { x: 13.8, y: 67 }, bounds)).toBe('investment');
expect(hitTestDonutAllocation(allocations, { x: 10, y: 50 }, bounds)).toBe('remaining');
expect(hitTestDonutAllocation(allocations, { x: 50, y: 50 }, bounds)).toBeUndefined();
expect(hitTestDonutAllocation(allocations, { x: 99, y: 50 }, bounds)).toBeUndefined();
```

Add an over-income fixture, hit the 90% angle, and assert it resolves to the clipped `investment` segment rather than inventing a missing `remaining` segment.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
npx vitest run tests/unit/main/donutHitTest.test.ts tests/unit/main/CashflowDonutSummary.test.tsx
```

Expected: FAIL because `donutHitTest.ts` does not exist and the rendered label is still `남는 돈`.

- [ ] **Step 3: Implement the pure hit-test helper and terminology change**

In `donutHitTest.ts`, define narrow structural inputs so tests do not need a real `DOMRect`:

```ts
import type { DonutAllocation } from '../../domain/cashflowInsight';

interface DonutPoint { x: number; y: number }
interface DonutBounds { left: number; top: number; width: number; height: number }

export function hitTestDonutAllocation(
  allocations: DonutAllocation[],
  point: DonutPoint,
  bounds: DonutBounds,
): DonutAllocation['id'] | undefined {
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;

  const viewBoxX = ((point.x - bounds.left) / bounds.width) * 100;
  const viewBoxY = ((point.y - bounds.top) / bounds.height) * 100;
  const deltaX = viewBoxX - 50;
  const deltaY = viewBoxY - 50;
  const radius = Math.hypot(deltaX, deltaY);
  if (radius < 33 || radius > 47) return undefined;

  const radians = Math.atan2(deltaX, -deltaY);
  const clockwisePercentage = ((radians < 0 ? radians + Math.PI * 2 : radians)
    / (Math.PI * 2)) * 100;
  let offset = 0;

  for (const allocation of allocations) {
    const visible = Math.min(
      Math.max(0, allocation.displayPercentage),
      Math.max(0, 100 - offset),
    );
    if (clockwisePercentage >= offset && clockwisePercentage < offset + visible) {
      return allocation.id;
    }
    offset += visible;
  }

  return undefined;
}
```

Return `undefined` for non-positive bounds, the center hole, outside the ring, or a percentage not covered by a visible segment. In `cashflowInsight.ts`, change only the `remaining` label literal and its `DonutAllocation` union member from `남는 돈` to `여윳돈`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/main/donutHitTest.test.ts tests/unit/main/CashflowDonutSummary.test.tsx
npm run check
```

Expected: both test files pass and TypeScript accepts the unchanged allocation-id contract.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/main/domain/cashflowInsight.ts src/main/ui/dashboard/donutHitTest.ts tests/unit/main/donutHitTest.test.ts tests/unit/main/CashflowDonutSummary.test.tsx
git commit -m "feat(main): add donut ring hit testing"
```

---

### Task 2: Shared Selection State and Compact Responsive Legend

**Files:**
- Modify: `src/main/ui/dashboard/CashflowDonutSummary.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/CashflowDonutSummary.test.tsx`

**Interfaces:**
- Consumes: `hitTestDonutAllocation()` from Task 1.
- Produces: active SVG class `cashflow-donut__segment--active`, fixed legend state through `aria-pressed`, and visual amount span `cashflow-donut__legend-amount`.
- Preserves: existing tooltip role, amount formatting, legend keyboard buttons, income-zero guidance, and savings/investment default center.

- [ ] **Step 1: Write failing interaction tests**

Extend `CashflowDonutSummary.test.tsx` with a real outside button and a deterministic SVG box:

```tsx
render(<><CashflowDonutSummary data={appliedData} /><button type="button">outside</button></>);
const chart = screen.getByRole('img', { name: /소비 56\.3%/ });
Object.defineProperty(chart, 'getBoundingClientRect', {
  value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
});

fireEvent.pointerDown(chart, { clientX: 50, clientY: 10, pointerType: 'touch' });
expect(screen.getByText('56.3%')).toBeVisible();
expect(screen.getByText('소비')).toBeVisible();
expect(document.querySelector('.cashflow-donut__segment--consumption'))
  .toHaveClass('cashflow-donut__segment--active');
expect(screen.getByRole('button', { name: /소비.*180만 원.*56\.3%/ }))
  .toHaveAttribute('aria-pressed', 'true');

fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
expect(screen.getByText('15.6%')).toBeVisible();
expect(screen.getByText('저축·투자')).toBeVisible();
```

Also assert:

- pointer hover and legend focus temporarily override the fixed selection, then reveal it again on leave/blur;
- tapping the same legend item toggles fixed selection off;
- center-hole and outside-ring pointer events do not replace the default center;
- `cashflow-donut__legend-amount` exists for every allocation even though CSS controls its visual presence;
- tooltip and accessible button name retain `명칭 · 금액 · 비율`.

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx
```

Expected: FAIL because the SVG has no hit-test handler, center replacement, active class, or `aria-pressed` state.

- [ ] **Step 3: Implement shared selection behavior**

Update `CashflowDonutSummary.tsx` as follows:

- keep `hoveredId`, `focusedId`, and fixed `tappedId`, with active precedence `hoveredId ?? focusedId ?? tappedId`;
- attach pointer handlers to the SVG and call `hitTestDonutAllocation()` with `event.clientX`, `event.clientY`, and `event.currentTarget.getBoundingClientRect()`;
- mouse/pen pointer movement updates `hoveredId`; touch `pointerdown` toggles `tappedId`;
- ignore center-hole and outside-ring results without clearing an existing selection;
- add a document `pointerdown` listener only while `tappedId` exists; clear it when the target is outside the `.cashflow-donut` section;
- render selected center content as percentage first and label second; otherwise retain savings/investment percentage, `저축·투자`, and `소득 초과`;
- add `cashflow-donut__segment--active` only to the active circle;
- set legend `aria-pressed={tappedId === allocation.id}` and expand its accessible label to include label, amount, and percentage;
- give the amount span class `cashflow-donut__legend-amount`.

Do not make the SVG keyboard-focusable; the four 44px legend buttons remain the keyboard interaction surface.

- [ ] **Step 4: Implement responsive visual density and selection feedback**

In `main.css`:

```css
.cashflow-donut__legend-button {
  @apply grid min-h-11 grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-600 outline-none focus-visible:ring-3 focus-visible:ring-accent/35;
}

.cashflow-donut__legend-button::before {
  @apply h-2 w-2 rounded-full;
}

.cashflow-donut__legend-button span:first-child {
  @apply whitespace-nowrap;
}

.cashflow-donut__legend-amount {
  @apply hidden;
}

.cashflow-donut__chart circle {
  r: 40px;
  stroke-width: 14px;
  transition: r 160ms ease-out, stroke-width 160ms ease-out,
    stroke-dasharray 220ms ease-out, stroke-dashoffset 220ms ease-out;
}

.cashflow-donut__chart circle.cashflow-donut__segment--active {
  r: 42px;
  stroke-width: 15px;
}
```

At `@media (min-width: 640px)`, restore the existing three-field desktop grid, gap, 10px color point, and `.cashflow-donut__legend-amount { display: inline; }`. Keep the global reduced-motion rule and ensure it covers the new `r` and `stroke-width` transition.

- [ ] **Step 5: Run focused tests and check style output**

Run:

```bash
npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx tests/unit/main/donutHitTest.test.ts
npm run check
```

Expected: component and geometry tests pass; type and Tailwind compilation checks pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/main/ui/dashboard/CashflowDonutSummary.tsx src/main/ui/main.css tests/unit/main/CashflowDonutSummary.test.tsx
git commit -m "feat(main): compact mobile donut details"
```

---

### Task 3: Responsive Browser Contract and Canonical Design Record

**Files:**
- Modify: `tests/main-react.spec.ts`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: the DOM classes and accessible names from Tasks 1–2.
- Produces: browser-level evidence for 390px touch, desktop detail, outside dismissal, selection geometry, overflow, and reduced motion.
- Documents: mobile legend information density and direct ring interaction without changing product or storage ownership.

- [ ] **Step 1: Add failing 390px and desktop browser assertions**

In the existing live-dashboard donut test group, seed the normal `3,200,000원` fixture and add a 390px case that reads each legend button layout:

```ts
const legendLayout = await page.locator('.cashflow-donut__legend-button').evaluateAll((buttons) =>
  buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const label = button.querySelector('span:first-child')!.getBoundingClientRect();
    const percentage = button.querySelector('span:last-child')!.getBoundingClientRect();
    const amount = button.querySelector<HTMLElement>('.cashflow-donut__legend-amount')!;
    return {
      height: rect.height,
      oneLine: Math.abs(label.top - percentage.top) <= 1,
      amountDisplay: getComputedStyle(amount).display,
    };
  }),
);

for (const item of legendLayout) {
  expect(item.height).toBeGreaterThanOrEqual(44);
  expect(item.oneLine).toBe(true);
  expect(item.amountDisplay).toBe('none');
}
```

Use the SVG bounding box to tap its top ring point and assert center text `56.3%`, `소비`, active-circle computed `r: 42px`, and the full tooltip. Tap the dashboard heading and assert the center returns to `15.6%`, `저축·투자`. Assert `html.scrollWidth <= innerWidth`.

Resize to desktop, assert `.cashflow-donut__legend-amount` is visible, hover the saving legend, and verify center, tooltip, and active segment agree.

- [ ] **Step 2: Extend the existing reduced-motion test**

After enabling `reducedMotion: 'reduce'`, select a donut segment and inspect the active circle:

```ts
const transition = await page.locator('.cashflow-donut__segment--active').evaluate((circle) => ({
  duration: getComputedStyle(circle).transitionDuration,
  r: getComputedStyle(circle).r,
}));
expect(['0s', '0.00001s']).toContain(transition.duration);
expect(transition.r).toBe('42px');
```

This proves motion is removed without suppressing selection feedback.

- [ ] **Step 3: Run focused Playwright and confirm GREEN**

Run:

```bash
npx playwright test tests/main-react.spec.ts --grep "donut|dashboard" --reporter=list
```

Expected: all matching Main dashboard and donut tests pass at their declared viewports.

- [ ] **Step 4: Update the canonical UI contract**

In `DESIGN.md` under Main's dashboard contract, add:

- mobile donut legend shows color, label, and percentage in two columns while preserving 44px targets;
- desktop also shows the amount;
- touch/pointer selection replaces the center with the active label and percentage and expands the active arc;
- keyboard legend buttons provide the same detail, including amount through accessible naming and tooltip;
- the displayed fourth allocation term is `여윳돈`.

Do not copy implementation geometry or event-handler details into `DESIGN.md`.

- [ ] **Step 5: Run complete required verification**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
git diff --check
```

Expected: type checks pass, every active unit test passes, every supported E2E test passes, retired legacy tests remain explicitly skipped, and diff-check emits no output.

- [ ] **Step 6: Request independent code review**

Use `superpowers:requesting-code-review` against the branch base. Require review of pointer-angle boundaries, over-income clipping, outside dismissal, keyboard equivalence, 390px wrapping, 44px targets, desktop amount restoration, reduced motion, and preservation of the Main v2 data contract. Fix every Critical or Important finding and rerun Step 5.

- [ ] **Step 7: Commit browser contract and documentation**

```bash
git add tests/main-react.spec.ts DESIGN.md
git commit -m "test(main): verify mobile donut interaction"
```

---

## Completion Evidence

Record in the final handoff:

- changed files and the distinction between geometry, component state, responsive CSS, tests, and canonical documentation;
- focused RED/GREEN commands from each task;
- final `npm run check`, unit, full E2E, and `git diff --check` results;
- independent review findings and fixes;
- confirmation that Main v2 storage, Financial Detail Modal, allocation calculations, and unrelated user changes remain unchanged.
