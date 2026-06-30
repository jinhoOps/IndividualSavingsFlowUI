# Account Map Force Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic force-style spacing to Account Map node layout.

**Architecture:** Keep the existing vanilla SVG renderer and replace the fixed-only layout with a seeded semantic layout plus bounded force relaxation. The renderer remains synchronous and deterministic.

**Tech Stack:** Vanilla JavaScript ES modules, SVG, Playwright, TypeScript check.

---

### Task 1: Add Layout Regression Coverage

**Files:**
- Modify: `tests/account-map.spec.ts`

- [x] **Step 1: Add assertions after Account Map import renders**

In the existing `loads as a dedicated route and imports a page-owned draft from Main data` test, evaluate node transforms and relationship path distances. Assert that no account nodes share the same center and that the known salary-to-living transfer has meaningful horizontal and vertical separation.

- [x] **Step 2: Run focused test to observe current behavior**

Run: `npx playwright test tests/account-map.spec.ts -g "loads as a dedicated route"`

Expected before implementation: test may fail if the current fixed columns keep linked nodes too rigid or too close vertically.

### Task 2: Implement Deterministic Force Relaxation

**Files:**
- Modify: `apps/account-map/modules/map-renderer.js`

- [x] **Step 1: Change `computePositions(nodes, width, height)` to `computePositions(nodes, relationships, width, height)`**

Seed nodes exactly as before by semantic lane, but store lane anchors for each node.

- [x] **Step 2: Build link pairs from relationships**

For each relationship with valid source and target positions, create a link object with `sourceId`, `targetId`, and a target distance. Cross-lane links should target a longer distance than same-lane links.

- [x] **Step 3: Run a fixed relaxation loop**

For roughly 70 iterations:
- Apply link attraction toward target distance.
- Apply repulsion when two nodes are closer than the minimum node spacing.
- Apply weak anchor force toward the semantic lane x coordinate.
- Clamp positions inside the SVG bounds.

- [x] **Step 4: Update render call**

Call `computePositions(renderNodes, relationships, width, height)`.

### Task 3: Verify

**Files:**
- Test: `tests/account-map.spec.ts`

- [x] **Step 1: Run type check**

Run: `npm run check`

Expected: pass.

- [x] **Step 2: Run Account Map tests**

Run: `npx playwright test tests/account-map.spec.ts`

Expected: pass.

- [ ] **Step 3: Commit implementation and plan/spec**

Commit source, tests, and docs together with message `feat(account-map): add force layout spacing`.
