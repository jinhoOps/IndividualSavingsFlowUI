# Portfolio Location Boundary Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove account and custody-location management from Portfolio while preserving existing shared locations and location-scoped plans in the workspace document.

**Architecture:** Portfolio renders and mutates only its aggregate plan and draft. Shared location data remains owned by the workspace compatibility contract and is not deleted, migrated, or rewritten when Portfolio loads or saves. Phase B Account Map will receive management UI under a separate specification.

**Tech Stack:** React, TypeScript, Vitest/Testing Library, Playwright, CSS, Markdown.

## Global Constraints

- Portfolio must not render location lists, status, creation, rename, archive, or linking controls.
- Portfolio must not expose a location repository dependency or shared-location command entry point.
- Existing `workspace.locations` and location-scoped Portfolio plans must remain byte-for-byte semantically preserved during aggregate Portfolio use.
- The unrelated untracked `artifacts/` directory must remain untouched.

---

### Task 1: Lock the Product Boundary in User-Visible Tests

**Files:**
- Modify: `tests/portfolio.spec.ts`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Delete: `tests/unit/portfolio/InvestmentLocations.test.tsx`
- Delete: `tests/unit/portfolio/locationRepository.test.ts`

**Interfaces:**
- Consumes: seeded `isf-workspace-v1` documents with aggregate and location-scoped Portfolio plans.
- Produces: regression coverage proving Portfolio exposes no location UI and preserves dormant location data.

- [x] **Step 1: Replace the location-management E2E scenarios with a boundary test**

Add an E2E assertion that seeds an investment location and location-scoped plan, opens Portfolio, verifies `투자 위치`, `계좌·보관처`, and location management controls are absent, exercises aggregate editing, and verifies `workspace.locations` plus the location-scoped plan remain unchanged.

- [x] **Step 2: Run the focused E2E and verify RED**

Run: `npx playwright test tests/portfolio.spec.ts --grep "does not expose account or custody management" --reporter=list`

Expected: FAIL because the current result still renders `투자 위치 1곳`.

- [x] **Step 3: Update the PortfolioApp component test contract**

Remove location repository fixtures and props, then assert an applied result contains no location-management region or controls.

- [x] **Step 4: Run the focused unit test and verify RED**

Run: `npx vitest run tests/unit/portfolio/PortfolioApp.test.tsx`

Expected: FAIL while `PortfolioApp` still mounts `InvestmentLocations`.

### Task 2: Remove Portfolio Location UI and Command Adapters

**Files:**
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Delete: `src/portfolio/ui/InvestmentLocations.tsx`
- Delete: `src/portfolio/infrastructure/locationRepository.ts`

**Interfaces:**
- Consumes: aggregate `PortfolioRepository` and read-only Main source.
- Produces: `PortfolioApp` without location repository injection or shared-location commands.

- [x] **Step 1: Remove the location dependency and mount point**

Delete the `InvestmentLocationRepository` prop/import and the `<InvestmentLocations />` result child from `PortfolioApp`.

- [x] **Step 2: Remove unreachable implementation files and styles**

Delete the Portfolio-specific location component and repository adapter, then remove every `.portfolio-locations*` CSS rule.

- [x] **Step 3: Run focused unit and E2E tests and verify GREEN**

Run: `npx vitest run tests/unit/portfolio/PortfolioApp.test.tsx`

Run: `npx playwright test tests/portfolio.spec.ts --reporter=list`

Expected: all focused tests pass.

### Task 3: Verify Compatibility and Documentation Consistency

**Files:**
- Verify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Verify: `DESIGN.md`
- Verify: `docs/superpowers/specs/2026-08-06-connected-account-map-workspace-design.md`
- Verify: `docs/superpowers/specs/2026-08-11-portfolio-focused-mobile-ux-design.md`

**Interfaces:**
- Consumes: completed Portfolio boundary removal.
- Produces: evidence that code, tests, and canonical documents agree.

- [x] **Step 1: Search for retired Portfolio location surfaces**

Run: `rg -n "InvestmentLocations|locationRepository|portfolio-locations|투자 위치" src/portfolio tests/portfolio.spec.ts tests/unit/portfolio`

Expected: no runtime, adapter, CSS, or positive behavior reference remains. Negative boundary assertions may name the retired UI.

- [x] **Step 2: Run static and focused regression checks**

Run: `npm run check`

Run: `npx vitest run tests/unit/portfolio`

Run: `npx playwright test tests/portfolio.spec.ts tests/app-journey.spec.ts --reporter=list`

Expected: all commands exit successfully with zero failures.

- [x] **Step 3: Check documentation and patch hygiene**

Run: `git diff --check`

Confirm canonical documents assign account and custody management to Phase B Account Map, identify the current runtime transition as completed, and preserve compatibility data.
