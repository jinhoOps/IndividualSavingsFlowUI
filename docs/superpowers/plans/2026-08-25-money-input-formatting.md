# Current Product Money Input Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Format every current TypeScript product direct Won input immediately and add add-only quick amount controls to the Portfolio item sheet.

**Architecture:** Extract the existing caret-safe Main money input behavior into a narrow shared core helper with an explicit zero-display option. Keep Main's domain path as a compatibility facade, then adapt each affected UI at its local display-to-safe-integer boundary.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-money-input-formatting-design.md`

## Global Constraints

- Internal calculations, validation, reducer actions, and persistence receive safe integer Won without commas.
- Empty input, zero behavior, invalid state behavior, and blur commits remain compatible with each current surface.
- Portfolio quick controls appear only in `PortfolioItemSheet mode="add"`, in the order `-50만`, `-10만`, `+10만`, `+50만`.
- Existing Portfolio dialog focus, Escape, discard, return-focus, ownership, storage, write boundaries, and anime.js motion remain unchanged.
- New visible controls use CSS classes, have minimum 44px targets, and fit on one row at 390px.

---

### Task 1: Shared money input contract

**Files:**
- Create: `src/core/domain/moneyInput.ts`
- Modify: `src/main/domain/money.ts`
- Test: `tests/unit/core/moneyInput.test.ts`

**Interfaces:**
- Produces `parseWonInput`, `formatWonInput`, `normalizeMoneyEdit`, and `adjustWon` for current product consumers.
- Preserves the Main facade exports and existing caret/zero behavior by default.

- [ ] Write tests for comma parsing, empty/zero display modes, unsafe values, caret-relative formatting, and non-negative adjustment.
- [ ] Run `npx vitest run tests/unit/core/moneyInput.test.ts` and observe the expected missing-module failure.
- [ ] Implement the smallest shared helper and Main facade re-export.
- [ ] Run the focused helper and existing Main money tests and confirm both pass.

### Task 2: Portfolio add sheet and direct editor inputs

**Files:**
- Modify: `src/portfolio/ui/PortfolioItemSheet.tsx`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Tests: `tests/unit/portfolio/PortfolioItemSheet.test.tsx`, `tests/unit/portfolio/AllocationEditor.test.tsx`

**Interfaces:**
- Consumes the shared money helper.
- Produces formatted display strings while `onComplete` and `PortfolioAction` values remain safe integer Won.

- [ ] Add failing tests for immediate comma display, safe blur/action values, add-only quick controls, ordered deltas, zero clamp, and edit-sheet absence.
- [ ] Run the focused Portfolio tests and observe failures caused by the missing behavior.
- [ ] Implement local display state and four CSS-grid quick controls without changing dialog ownership.
- [ ] Run the focused Portfolio unit tests and inspect the action payloads.

### Task 3: Simulation Starting Principal

**Files:**
- Modify: `src/simulation/ui/StartingPrincipalStep.tsx`
- Test: `tests/unit/simulation/SimulationOnboarding.test.tsx`

**Interfaces:**
- Consumes the shared parser/formatter/adjuster.
- Produces safe integer `initialInvestmentWon` values to the existing onboarding callback.

- [ ] Add failing assertions for formatted typed values and comma-formatted quick adjustment results.
- [ ] Run the focused Simulation unit test and observe the failure.
- [ ] Replace raw `Number` calculations with shared parsing and formatting while preserving existing labels and validation.
- [ ] Run the focused Simulation unit test.

### Task 4: Account Map direct money inputs

**Files:**
- Modify: `src/account-map/ui/AccountMapSetup.tsx`
- Modify: `src/account-map/ui/AccountMapLocationPicker.tsx`
- Modify: `src/account-map/ui/AccountMapModal.tsx`
- Tests: `tests/unit/account-map/AccountMapApp.test.tsx`, relevant Account Map component tests

**Interfaces:**
- Consumes shared money parsing/formatting at setup, picker, modal edit, and restore boundaries.
- Preserves `workspace.locations` and `workspace.accountMap` ownership and emits numeric callback/command payloads.

- [ ] Add or update failing tests for formatted setup/picker/modal values and separator-free saved payloads.
- [ ] Run focused Account Map tests and observe failures.
- [ ] Normalize all five Account Map numeric Won inputs and replace `Number` comma-sensitive validation/commit paths.
- [ ] Run focused Account Map unit tests and inspect saved command payloads.

### Task 5: Cross-surface browser and responsive verification

**Files:**
- Modify: `tests/portfolio.spec.ts`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/account-map.spec.ts`
- Modify: `tests/unit/main/MoneyField.test.tsx` only if shared extraction changes regression coverage

- [ ] Add Portfolio 390px one-row/44px quick-control coverage and update affected displayed-value assertions.
- [ ] Update Simulation and Account Map browser expectations to comma-formatted visible values while keeping storage assertions numeric.
- [ ] Run focused Portfolio, Simulation, and Account Map Playwright specs at their existing viewport matrix.
- [ ] Run `npm run check` and the affected unit test groups.
- [ ] Run `git diff --check`, inspect the complete diff, and commit the finished change without push/merge/PR.
