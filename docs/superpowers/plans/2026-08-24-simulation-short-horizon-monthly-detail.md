# Simulation Short-Horizon Monthly Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Simulation’s graph explorable month-by-month through a three-year horizon, while preserving the annual graph density above it and making the mobile compact tooltip prioritize contributed principal.

**Architecture:** The projection domain remains the single producer of points and changes its sampling cadence only: monthly at 36 months or less, annual otherwise. The chart geometry derives positions and ticks from canonical `ProjectionPoint.month`; one shared UI formatter turns that month into every human-facing period label. `GrowthChart` passes that label and the selected visual variant into the tooltip and status text, so compact and detailed content cannot drift.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Playwright, anime.js (existing visual-only chart animation).

**Spec:** `docs/superpowers/specs/2026-08-24-simulation-short-horizon-monthly-detail-design.md`

## Global Constraints

- Keep the compound-growth equations, nominal/real calculations, `ProjectionPoint` numeric fields, Simulation draft storage, and Main’s read-only boundary unchanged.
- Keep 4–30 year projections annual (`0, 12, …, finalMonth`) and do not introduce a dense long-horizon SVG path.
- Use `ProjectionPoint.month` as the canonical time coordinate. Do not render fractional `ProjectionPoint.year` in chart labels, tooltip headings, or assistive text.
- Preserve the existing anime.js reveal/morph behavior as visual-only. A denser short-horizon path must not change interaction state, keyboard behavior, reduced-motion behavior, or tooltip containment.
- Mobile compact content is exactly period, current-plan total, and cumulative contributed principal. Desktop/tablet detailed content keeps all-savings plus principal, savings, and investment balances.
- Treat the existing fixed tooltip dimensions and overflow rules as a UI contract; verify at 390px, 768px, and desktop.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/simulation/domain/projection.ts` | Sample already-calculated monthly balances at monthly or annual cadence. |
| `src/simulation/ui/chartGeometry.ts` | Convert points into month-based x geometry, duration-aware ticks, and Korean period labels. |
| `src/simulation/ui/GrowthChart.tsx` | Select points through pointer/touch/keyboard and supply consistent label/value data to status and tooltip surfaces. |
| `src/simulation/ui/GrowthChartTooltip.tsx` | Render compact versus detailed information priority from explicit tooltip values. |
| `tests/unit/simulation/projection.test.ts` | Lock the two sampling-cadence boundaries. |
| `tests/unit/simulation/chartGeometry.test.ts` | Lock month geometry, short-duration ticks, and time-label grammar. |
| `tests/unit/simulation/GrowthChart.test.tsx` | Cover compact/detailed content, month selection, keyboard status, and animation invariants. |
| `tests/simulation.spec.ts` | Verify touch/pointer behavior and tooltip containment at actual responsive viewports. |
| `DESIGN.md` | Make the approved short-horizon/mobile graph interaction contract canonical. |
| `docs/superpowers/specs/2026-08-24-simulation-short-horizon-monthly-detail-design.md` | Mark the implemented, approved design status. |

---

## Task 1: Add the sampling-cadence contract in the projection domain

**Files:**

- Modify: `tests/unit/simulation/projection.test.ts`
- Modify: `src/simulation/domain/projection.ts`

- [ ] **Step 1: Write failing boundary tests for 3 and 4 years.**

  Create two projections from the default valid draft with `years: 3` and `years: 4`. Assert that the former contains all integer months from `0` through `36` (`37` points), and that the latter contains exactly `[0, 12, 24, 36, 48]`. Also assert both final points retain the requested final month so sampling never changes the result endpoint.

  ```ts
  expect(threeYear.points).toHaveLength(37);
  expect(threeYear.points.map((point) => point.month)).toEqual(
    Array.from({ length: 37 }, (_, month) => month),
  );
  expect(fourYear.points.map((point) => point.month)).toEqual([0, 12, 24, 36, 48]);
  ```

- [ ] **Step 2: Run the focused test and confirm the new monthly assertion fails.**

  Run: `npx vitest run tests/unit/simulation/projection.test.ts`

  Expected: the three-year test reports annual-only points before implementation.

- [ ] **Step 3: Change only point sampling in `projectCompoundGrowth`.**

  Derive `const includeEveryMonth = totalMonths <= 36` next to `totalMonths`. Keep the existing monthly balance advancement and `appendPoint()` data calculation intact; change the append condition to append every iteration when `includeEveryMonth`, otherwise only at 12-month boundaries. Keep the initial month-zero point and all result-total calculations unchanged.

- [ ] **Step 4: Re-run the projection tests.**

  Run: `npx vitest run tests/unit/simulation/projection.test.ts`

  Expected: pass, including existing nominal/real and target-reach tests.

- [ ] **Step 5: Commit the isolated domain change.**

  ```bash
  git add src/simulation/domain/projection.ts tests/unit/simulation/projection.test.ts
  git commit -m "feat(simulation): sample short projections by month"
  ```

## Task 2: Make geometry and labels month-native

**Files:**

- Modify: `tests/unit/simulation/chartGeometry.test.ts`
- Modify: `src/simulation/ui/chartGeometry.ts`

- [ ] **Step 1: Write failing formatter and tick tests.**

  Export and test `formatProjectionPeriod(month)` with the full label grammar:

  ```ts
  expect(formatProjectionPeriod(0)).toBe('현재');
  expect(formatProjectionPeriod(1)).toBe('1개월');
  expect(formatProjectionPeriod(12)).toBe('1년');
  expect(formatProjectionPeriod(18)).toBe('1년 6개월');
  expect(formatProjectionPeriod(36)).toBe('3년');
  ```

  Build a synthetic contiguous `0..36` point set (or the 3-year projection fixture) and assert geometry x ticks are `['현재', '6개월', '1년', '1년 6개월', '2년', '2년 6개월', '3년']`; assert its last x equals `plot.right`. Keep an annual fixture assertion that `30년` remains an end label and annual points do not acquire monthly labels.

- [ ] **Step 2: Run the focused geometry test and confirm it fails on missing formatter/monthly ticks.**

  Run: `npx vitest run tests/unit/simulation/chartGeometry.test.ts`

- [ ] **Step 3: Use `month` for horizontal geometry and choose ticks by sampling density.**

  In `chartGeometry.ts`:

  - replace `ChartGeometryPoint.year` with `month`, and calculate `maxMonth` from `point.month`;
  - calculate x with `point.month / maxMonth`, retaining the finite `Math.max(1, ...)` fallback;
  - export `formatProjectionPeriod(month: number)` with the exact Korean labels above;
  - recognize contiguous monthly points (`month` increments by one from zero) and retain first/last plus every sixth month as ticks;
  - retain first/last plus five-year (60-month) ticks for annual points, so 4–30 year displays stay sparse;
  - send every tick through `formatProjectionPeriod`, never a raw `year` string.

- [ ] **Step 4: Re-run focused geometry tests.**

  Run: `npx vitest run tests/unit/simulation/chartGeometry.test.ts`

  Expected: pass with no `NaN` geometry and exact short/long label assertions.

- [ ] **Step 5: Commit the geometry and label contract.**

  ```bash
  git add src/simulation/ui/chartGeometry.ts tests/unit/simulation/chartGeometry.test.ts
  git commit -m "feat(simulation): label short graph periods by month"
  ```

## Task 3: Align tooltip, live status, and keyboard selection with the selected period

**Files:**

- Modify: `tests/unit/simulation/GrowthChart.test.tsx`
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Modify: `src/simulation/ui/GrowthChartTooltip.tsx`

- [ ] **Step 1: Update/add failing component tests for the information hierarchy.**

  Use a three-year `projectCompoundGrowth` result alongside the current long-duration fixture. Verify all of the following:

  - in compact mode, selecting the graph shows `현재 계획 총액` and `누적 납입원금`, and does **not** render `전부 저축 총액`, `저축 잔액`, or `투자 잔액`;
  - in detailed mode, the existing `전부 저축 총액`, principal, savings, and investment entries remain;
  - `Home`, `ArrowRight`, and `End` on a three-year chart announce `현재`, `1개월`, and `3년` respectively through the status region;
  - pointer/touch mapping at the first and final x coordinates selects `현재` and `3년` without restarting an anime.js reveal or morph;
  - existing long-duration tests still expect labels such as `19년` and `20년`.

- [ ] **Step 2: Run the component test to verify the intended failures.**

  Run: `npx vitest run tests/unit/simulation/GrowthChart.test.tsx`

- [ ] **Step 3: Replace raw-year tooltip data with a single formatted period field.**

  In `GrowthChartTooltipValues`, replace `year: number` with `periodLabel: string`; render it in the heading. Render the second compact entry as contributed principal and render all-savings only for the `detailed` branch. Keep the fixed compact card class and dimensions unchanged.

- [ ] **Step 4: Feed the same label/value hierarchy from `GrowthChart`.**

  Import `formatProjectionPeriod` from `chartGeometry.ts`. Use it for the final screen-reader summary, active `role="status"` text, and the tooltip `periodLabel`. Select principal from the active point using the current nominal/real basis. Make the compact status name current-plan and principal; make the detailed status include current-plan, all-savings, principal, savings, and investment so assistive technology receives the same selected-data hierarchy as the visible card. Leave index-based keyboard movement and `indexAt()` untouched: the new monthly point list makes Arrow keys and touch naturally move one month under three years.

- [ ] **Step 5: Re-run component tests.**

  Run: `npx vitest run tests/unit/simulation/GrowthChart.test.tsx`

  Expected: pass, including reduced motion, StrictMode replay, visual morph continuity, tooltip dismissal, and the new monthly interaction assertions.

- [ ] **Step 6: Commit the chart interaction changes.**

  ```bash
  git add src/simulation/ui/GrowthChart.tsx src/simulation/ui/GrowthChartTooltip.tsx tests/unit/simulation/GrowthChart.test.tsx
  git commit -m "feat(simulation): prioritize principal in compact chart detail"
  ```

## Task 4: Validate responsive browser behavior and publish the UI contract

**Files:**

- Modify: `tests/simulation.spec.ts`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/specs/2026-08-24-simulation-short-horizon-monthly-detail-design.md`

- [ ] **Step 1: Update the existing mobile compact-tooltip E2E expectation.**

  Retain its fixed `192 × 112` size, drag/release, no-wrap, and scroll-dismissal checks. Change the visible values to `현재 계획 총액` plus `누적 납입원금`; assert `전부 저축 총액` is absent.

- [ ] **Step 2: Add a short-duration browser interaction test.**

  At 390px, set `기간 숫자` to `3`, begin a touch gesture near the first graph position, move to a month coordinate (for example, six twelfths of the graph width), and assert the compact tooltip shows `6개월` and contributed principal. Release and assert it remains selected. Then exercise keyboard `Home`, `ArrowRight`, and `End` on `그래프 연도 탐색` and assert `현재`, `1개월`, and `3년`. At 768px and desktop, assert the detailed tooltip still exposes all-savings and component balances. At all three widths, retain/extend the current checks that tooltip, SVG, and surrounding surface do not overflow and visible controls meet 44px touch-target expectations.

- [ ] **Step 3: Run the focused E2E spec before final docs.**

  Run: `npx playwright test tests/simulation.spec.ts`

  Expected: all simulation browser cases pass at their configured 390px, 768px, and desktop viewports.

- [ ] **Step 4: Update canonical design text and the approved spec status.**

  In `DESIGN.md` Simulation bullets, state that 0–3 year charts use month selection and labels while 4–30 year charts stay annual; state the compact mobile card’s three fields are period/current-plan/cumulative-principal; preserve desktop detailed fields and the dismissal behavior. In the spec, change the status from review-pending to implemented only after the implementation and all verification in this plan pass.

- [ ] **Step 5: Run the complete verification set.**

  ```bash
  npm run check
  npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx
  npx playwright test tests/simulation.spec.ts
  git diff --check
  ```

  Expected: every command exits 0. If an E2E failure implicates anime.js timing, reproduce with the exact failing test first; do not weaken the visual-only animation assertions to hide a state/timing bug.

- [ ] **Step 6: Commit documentation and E2E coverage.**

  ```bash
  git add tests/simulation.spec.ts DESIGN.md docs/superpowers/specs/2026-08-24-simulation-short-horizon-monthly-detail-design.md
  git commit -m "docs(simulation): define monthly graph exploration"
  ```

## Final review and handoff

- [ ] Review `git diff main...HEAD` against the approved spec: 3 years or less has 37 monthly endpoints, 4 years or more is annual, no fractional-year text is reachable, compact has principal instead of all-savings, and detailed retains all values.
- [ ] Confirm no persistence schema, Main-owned monthly-value write path, or anime.js motion contract changed unintentionally with `rg -n "isf-workspace|monthlySavingsWon|monthlyInvestmentWon|animate\(" src/simulation`.
- [ ] Record the exact verification outputs and any browser-specific risk in the handoff. Do not merge or push without explicit user instruction.
