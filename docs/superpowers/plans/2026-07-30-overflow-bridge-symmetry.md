# Overflow Bridge Symmetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce liquid overlap from `4%` to `2%` and keep both original income bars horizontally symmetric whenever planned spending is at or below `100%`.

**Architecture:** Keep the existing outward `displayLengthPercent` model unchanged. Change only bridge geometry to begin at `98%`, then make the right breakout gutter conditional on the existing deficit state. Expose that state on the summary section so CSS can apply the same rule to both bar variants.

**Tech Stack:** React 19, TypeScript 5.5, Tailwind CSS 4, Vitest 4, Testing Library, Playwright 1.60, Vite 5.

## Global Constraints

- Income bar remains logical length `100` and current height.
- Liquid bridge starts at `98%` and overlaps the income bar by length `2`.
- Outward extension remains `min(max(overflowPercent, 0), 50) / 5`, length `0...10`.
- Combined liquid length is `2 + displayLengthPercent`, length `2...12`.
- The bridge and outward extension must have no visible gap.
- At or below `100%`, no breakout gutter exists and bar left/right geometry is symmetric.
- Above `100%`, retain the existing right breakout gutter and viewport containment.
- Preserve tooltip behavior, reduced motion, droplets, accessible output, table layout, and card styling.
- Do not stage or modify `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, or `shared/legacy/sw.js`.

---

### Task 1: Two-Percent Bridge and Conditional Gutter

**Files:**
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/step1.spec.ts`

**Interfaces:**
- Consumes: existing `isDeficit` boolean and `data-overflow` convention.
- Produces:
  - `.flow-overflow-bridge` from bar `98%` through `100%`
  - `data-overflow="true|false"` on `.flow-context-summary`
  - breakout gutter only for `[data-overflow="true"]`

- [ ] **Step 1: Write failing geometry expectations**

Change the maximum-overflow E2E assertions:

```ts
expect(geometry.bridgeStartRatio).toBeCloseTo(0.98, 2);
expect(geometry.bridgeRatio).toBeCloseTo(0.02, 2);
expect(geometry.seamGap).toBeLessThanOrEqual(0);
expect(geometry.totalRatio).toBeCloseTo(0.12, 2);
```

Add a test using stored values whose total equals monthly income. For both `.flow-context-summary` and `.allocation-bar__segments`, compare the bar rectangle with its full-width parent:

```ts
expect(Math.abs(geometry.leftGap - geometry.rightGap)).toBeLessThanOrEqual(1);
expect(geometry.marginInlineEnd).toBe(0);
expect(geometry.hasBridge).toBe(false);
expect(geometry.hasExtension).toBe(false);
```

Keep the existing maximum-overflow assertions for `outwardRatio === 0.10`, no document overflow, and extension inside viewport.

- [ ] **Step 2: Run focused E2E and verify RED**

```bash
npx playwright test tests/step1.spec.ts -g "Main liquid overflow presentation" --reporter=list
```

Expected: FAIL because bridge still starts at `96%`, spans `4%`, and non-deficit bars retain the right gutter.

- [ ] **Step 3: Apply minimum implementation**

Expose deficit state on the summary section:

```tsx
<section
  className="flow-context-summary"
  data-overflow={isDeficit ? 'true' : 'false'}
  aria-label="현재 자금 계획 요약"
>
```

Make gutters conditional and update bridge geometry:

```css
.allocation-bar__segments,
.flow-context-summary {
  margin-inline-end: 0;
}

.allocation-bar__segments[data-overflow="true"],
.flow-context-summary[data-overflow="true"] {
  margin-inline-end: min(10%, 2.5rem);
}

.flow-overflow-bridge {
  left: 98%;
  width: calc(2% + 1px);
}
```

Keep the extra `1px` seam overlap and all other liquid styles unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
npx playwright test tests/step1.spec.ts -g "Main liquid overflow presentation" --reporter=list
npm run check
```

Expected: component tests PASS, focused E2E PASS at mobile and tablet widths, TypeScript check exits `0`.

- [ ] **Step 5: Commit**

```bash
git add src/main/ui/setup/FlowContextSummary.tsx src/main/ui/main.css tests/step1.spec.ts
git commit -m "fix(main): refine overflow bridge balance"
```

---

### Task 2: Regression Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed Task 1.
- Produces: verification evidence for integration.

- [ ] **Step 1: Run full verification**

```bash
npm run test:unit
npm run test:e2e
npm run check
npx vite build
git diff --check
```

Expected: all current unit and E2E tests PASS, intentional legacy skips remain skips, TypeScript and Vite build exit `0`, and `git diff --check` prints nothing.

- [ ] **Step 2: Inspect scope**

```bash
git status --short
git diff HEAD^ -- src/main/ui/setup/FlowContextSummary.tsx src/main/ui/main.css tests/step1.spec.ts
```

Expected: implementation touches only planned files. Existing unrelated worktree changes remain unstaged and unchanged.
