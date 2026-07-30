# Overflow Seam and Mobile Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend liquid overflow into the final `4%` of the income bar and restore visually centered 6/6 mobile table geometry without changing the card background.

**Architecture:** Keep `displayLengthPercent` as the existing outward `0...10` model. Render a fixed `4%` bridge inside the income bar and the existing variable extension outside it, sharing color and sheen so their combined visual length is `4...14`. Move the overflow gutter from the entire `AllocationBar` to its visual bar only so the table/card retain symmetric width.

**Tech Stack:** React 19, TypeScript 5.5, Tailwind CSS 4, Vitest 4, Testing Library, Playwright 1.60, Vite 5.

## Global Constraints

- Income bar remains length `100` and current height.
- Liquid bridge starts at `96%` and overlaps the income bar by length `4`.
- Outward extension remains `min(max(overflowPercent, 0), 50) / 5`, length `0...10`.
- Combined liquid length is `4 + displayLengthPercent`, length `4...14`.
- The bridge and outward extension must have no visible gap.
- Keep the existing card background unchanged.
- On mobile, use `12px` horizontal card padding and a translucent gray `1px` hairline.
- Apply the right-side breakout gutter only to the visual bar, never the table or whole card.
- Preserve table column alignment, tooltip behavior, reduced motion, and document containment.
- Do not stage or modify `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, or `shared/legacy/sw.js`.

---

### Task 1: Seamless Four-Percent Liquid Bridge

**Files:**
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `tests/step1.spec.ts`

**Interfaces:**
- Consumes: existing `OverflowPresentation.displayLengthPercent`.
- Produces:
  - `.flow-overflow-bridge`, fixed from bar `96%` through `100%`
  - `.flow-overflow-extension`, variable from bar `100%` through `110%`
  - `.flow-overflow-sheen`, spanning both layers without changing accessible output

- [ ] **Step 1: Write failing component expectations**

For each bar suite, assert that a deficit renders both decorative layers:

```ts
rerender(<FlowContextSummary data={deficitFixture} />);
expect(document.querySelector('.flow-overflow-bridge')).toBeInTheDocument();
expect(document.querySelector('.flow-overflow-extension')).toHaveStyle({
  '--overflow-length': '5%',
});
```

For non-deficit data, assert neither layer exists. Keep existing intensity, droplet, table, ARIA, and actual-percentage assertions.

- [ ] **Step 2: Run focused unit tests and verify RED**

```bash
npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
```

Expected: FAIL because `.flow-overflow-bridge` is absent.

- [ ] **Step 3: Render the fixed bridge beside the outward extension**

In both components, replace the single extension fragment with:

```tsx
<>
  <span aria-hidden="true" className="flow-overflow-bridge">
    <span className="flow-overflow-sheen" />
  </span>
  <span aria-hidden="true" className="flow-overflow-extension" style={overflowStyle}>
    <span className="flow-overflow-sheen" />
    {overflow.showDroplets ? (
      <span className="flow-overflow-droplets">
        <span className="flow-overflow-droplet" />
        <span className="flow-overflow-droplet" />
      </span>
    ) : null}
  </span>
</>
```

Render this fragment only when `overflow.intensity !== 'none'`.

- [ ] **Step 4: Implement continuous bridge geometry**

In `main.css`:

```css
.flow-overflow-bridge,
.flow-overflow-extension {
  @apply pointer-events-none absolute top-1/2 z-2 block -translate-y-1/2;
  height: 0.375rem;
}

.flow-overflow-bridge {
  left: 96%;
  width: calc(4% + 1px);
  border-radius: 999px 0 0 999px;
  background: linear-gradient(
    90deg,
    rgb(15 118 110 / 0%),
    rgb(225 29 72 / 76%) 72%,
    rgb(225 29 72 / 92%)
  );
}

.flow-overflow-extension {
  left: 100%;
  width: var(--overflow-length);
  border-radius: 0 999px 999px 0;
}
```

The extra bridge pixel overlaps the outward extension to prevent a subpixel seam. Use identical right-edge bridge and left-edge extension colors. Keep extension width transition and current flow duration. Include `.flow-overflow-bridge` and its sheen in reduced-motion animation removal.

- [ ] **Step 5: Add failing and passing E2E seam geometry**

Extend `Main liquid overflow presentation`:

```ts
const geometry = await page.locator('.allocation-bar__segments').evaluate((bar) => {
  const barRect = bar.getBoundingClientRect();
  const bridge = bar.querySelector('.flow-overflow-bridge')!.getBoundingClientRect();
  const extension = bar.querySelector('.flow-overflow-extension')!.getBoundingClientRect();
  return {
    bridgeStartRatio: (bridge.left - barRect.left) / barRect.width,
    bridgeRatio: bridge.width / barRect.width,
    outwardRatio: extension.width / barRect.width,
    seamGap: extension.left - bridge.right,
    totalRatio: (extension.right - bridge.left) / barRect.width,
  };
});

expect(geometry.bridgeStartRatio).toBeCloseTo(0.96, 2);
expect(geometry.bridgeRatio).toBeCloseTo(0.04, 2);
expect(geometry.outwardRatio).toBeCloseTo(0.10, 2);
expect(geometry.seamGap).toBeLessThanOrEqual(0);
expect(geometry.totalRatio).toBeCloseTo(0.14, 2);
```

Run before CSS completion to confirm RED on missing bridge, then after completion to confirm PASS.

- [ ] **Step 6: Verify and commit the seam**

```bash
npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
npx playwright test tests/step1.spec.ts -g "Main liquid overflow presentation" --reporter=list
npm run check
git add src/main/ui/setup/FlowContextSummary.tsx src/main/ui/setup/AllocationBar.tsx src/main/ui/main.css tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx tests/step1.spec.ts
git commit -m "fix(main): blend liquid overflow seam"
```

Expected: focused unit and E2E tests PASS; TypeScript checks exit `0`.

---

### Task 2: Center the 6/6 Mobile Review Table

**Files:**
- Modify: `src/main/ui/main.css`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: existing `.allocation-bar`, `.allocation-bar__segments`, `.allocation-table`.
- Produces: symmetric card geometry and bar-only breakout gutter.

- [ ] **Step 1: Add a failing mobile review geometry test**

In the existing `mobile quick setup` review flow, after reaching 6/6:

```ts
const layout = await page.locator('.allocation-bar').evaluate((card) => {
  const cardRect = card.getBoundingClientRect();
  const parentRect = card.parentElement!.getBoundingClientRect();
  const tableRect = card.querySelector('.allocation-table')!.getBoundingClientRect();
  const bar = card.querySelector('.allocation-bar__segments')!;
  const cardStyle = getComputedStyle(card);
  const barStyle = getComputedStyle(bar);
  const borderMatch = cardStyle.borderLeftColor.match(/rgba?\(([^)]+)\)/);
  const borderParts = borderMatch?.[1].split(',').map((part) => Number.parseFloat(part.trim())) ?? [];
  return {
    leftGap: cardRect.left - parentRect.left,
    rightGap: parentRect.right - cardRect.right,
    paddingLeft: Number.parseFloat(cardStyle.paddingLeft),
    paddingRight: Number.parseFloat(cardStyle.paddingRight),
    borderWidth: Number.parseFloat(cardStyle.borderLeftWidth),
    borderAlpha: borderParts.length === 4 ? borderParts[3] : 1,
    tableMatchesCard:
      Math.abs(tableRect.left - (cardRect.left + 12 + 1)) <= 1
      && Math.abs(tableRect.right - (cardRect.right - 12 - 1)) <= 1,
    barRightMargin: Number.parseFloat(barStyle.marginRight),
  };
});

expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThanOrEqual(1);
expect(layout.paddingLeft).toBe(12);
expect(layout.paddingRight).toBe(12);
expect(layout.borderWidth).toBe(1);
expect(layout.borderAlpha).toBeGreaterThan(0);
expect(layout.borderAlpha).toBeLessThanOrEqual(0.2);
expect(layout.tableMatchesCard).toBe(true);
expect(layout.barRightMargin).toBeGreaterThan(0);
```

This catches the current bug where margin on `.allocation-bar` shifts the table/card left.

- [ ] **Step 2: Run the mobile review test and verify RED**

```bash
npx playwright test tests/main-react.spec.ts -g "mobile quick setup" --reporter=list
```

Expected: FAIL on asymmetric card gaps or `16px` horizontal padding.

- [ ] **Step 3: Move gutter ownership and refine the mobile hairline**

Replace the whole-card gutter:

```css
.allocation-bar {
  @apply grid gap-3 rounded-2xl border bg-white/75 py-4 text-sm text-muted-text;
  padding-inline: 0.75rem;
  border-color: rgb(100 116 139 / 18%);
}

.allocation-bar__segments {
  margin-inline-end: min(10%, 2.5rem);
}

@media (min-width: 640px) {
  .allocation-bar {
    padding-inline: 1rem;
  }
}
```

Remove `margin-inline-end` from `.allocation-bar`. Do not alter `bg-white/75` or add a shadow. Keep the existing `FlowContextSummary` gutter because it has no table.

- [ ] **Step 4: Run responsive and accessibility regression**

```bash
npx playwright test tests/main-react.spec.ts --reporter=list
npx playwright test tests/step1.spec.ts -g "Main liquid overflow presentation|live Main summary" --reporter=list
npx vitest run tests/unit/main/AllocationBar.test.tsx
npm run check
```

Expected: mobile review, liquid containment, summary overflow, component, and TypeScript checks PASS.

- [ ] **Step 5: Commit the centered table**

```bash
git add src/main/ui/main.css tests/main-react.spec.ts
git commit -m "fix(main): center mobile review table"
```

---

### Task 3: Full Verification and Integration

**Files:**
- Verify only.

- [ ] **Step 1: Run full verification**

```bash
npm run check
npm run test:unit
npx playwright test --reporter=list
npx vite build
git diff --check
```

Expected: no failures; migration-reference suites remain intentionally excluded.

- [ ] **Step 2: Request independent code review**

Use `superpowers:requesting-code-review` for the follow-up implementation range. Fix all Critical and Important findings through `superpowers:receiving-code-review`, then rerun affected verification.

- [ ] **Step 3: Finish the branch**

Use `superpowers:verification-before-completion` and `superpowers:finishing-a-development-branch`. Preserve the Orca worktree and the four unrelated dirty files unless explicitly told otherwise.
