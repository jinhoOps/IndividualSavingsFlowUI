# Cashflow Progress and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development. Complete each task red-green-refactor.

**Goal:** Make setup progress simple, review details tabular, and deficit overflow expressive without breaking mobile layout or accessibility.

**Architecture:** Keep cashflow calculations in existing domain functions. `FlowContextSummary` owns one progressbar. `AllocationBar` derives both visual segments and semantic table rows from one allocation array, while CSS owns pressure overflow presentation.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Percentages shown in table and tooltip always use monthly income.
- Deficit visual segments normalize against planned outflow only to fit the track.
- No schema, storage or PWA changes.
- Pointer, keyboard and touch expose identical information.
- Pressure effects stay inside the component and honor reduced motion.

---

### Task 1: Convert setup meter to progressbar

**Files:**
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`

- [x] Change focused tests to require `role="progressbar"`.
- [x] Require tooltip text `현재 계획 230만 원 · 수입의 71.9%`.
- [x] Require deficit `aria-valuetext` to retain actual `125.0%`, while `aria-valuenow` remains `100`.
- [x] Run `npx vitest run tests/unit/main/FlowContextSummary.test.tsx` and confirm expected failure.
- [x] Replace meter semantics with progressbar semantics.
- [x] Build tooltip text from planned amount and actual percentage.
- [x] Run focused test and confirm pass.

### Task 2: Replace review legend with semantic table

**Files:**
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`

- [x] Require table columns `종류`, `금액`, `수입 대비`.
- [x] Require consumption row `소비`, `180만 원`, `56.3%`.
- [x] Require segment tooltip `소비 · 180만 원 · 56.3%`.
- [x] Require deficit rows to retain income-based percentages and show `초과`.
- [x] Require tiny segments to use table label buttons as interaction fallback.
- [x] Run `npx vitest run tests/unit/main/AllocationBar.test.tsx` and confirm expected failure.
- [x] Derive actual income percentages separately from normalized visual percentages.
- [x] Render semantic table and remove list legend.
- [x] Expand segment accessible names and tooltip values to label, amount and percentage.
- [x] Run focused test and confirm pass.

### Task 3: Add pressure overflow presentation

**Files:**
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/main-react.spec.ts`

- [x] Require `data-overflow="true"` and pressure cap/droplet hooks for deficit fixtures.
- [x] Require no pressure hooks for normal fixtures.
- [x] Run focused unit tests and confirm expected failure.
- [x] Add overflow state markup shared by progress and review bars.
- [x] Add contained pressure cap, diagonal pattern and two droplets in CSS.
- [x] Add responsive review table styles with right-aligned numeric cells.
- [x] Add reduced-motion overrides for pressure animation.
- [x] Add Playwright assertions for mobile table order, rich tooltip and no horizontal overflow.
- [x] Run `npm run check && npm run test:unit`.
- [x] Run `npx playwright test tests/main-react.spec.ts`.
- [x] Run `git diff --check`.
