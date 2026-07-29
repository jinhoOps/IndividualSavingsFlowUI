# Agent Routing Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise root `AGENTS.md` that routes each agent role to the right project sources, enforces shared safety rules, and prevents repeated CodeGraph initialization.

**Architecture:** `AGENTS.md` is a thin routing layer rather than a duplicate product specification. The Product PRD, README, DESIGN, codebase maps, Roadmap, ADRs, and Superpowers documents retain their existing ownership; the routing guide links agents to the smallest applicable subset and defines shared startup, verification, conflict, and handoff rules.

**Tech Stack:** Markdown, Git, repository-local planning and documentation conventions

## Global Constraints

- Main is a completed current product baseline.
- Legacy code is a temporary migration asset, not a supported product path.
- Normal Main financial editing belongs to Financial Detail Modal.
- Simulation, Portfolio, and Account Map own their own editable state.
- Account Map may read Main data but does not implicitly write back to Main.
- Existing `.codegraph/` state must be reused; ordinary workers must not initialize, reinitialize, rebuild, or delete it.
- Only the Coordinator or one explicitly assigned graph owner may initialize or rebuild CodeGraph when the state is missing or demonstrably unusable and simpler discovery is insufficient.
- Preserve user changes and unrelated changes from other agents.
- Root Markdown policy is `README.md`, `DESIGN.md`, and `AGENTS.md`.

---

## File Structure

- Create `AGENTS.md`: repository-wide startup sequence, minimum rules, role routing, CodeGraph ownership, verification matrix, conflicts, and handoff format.
- Modify `README.md`: expose the agent guide from the human and agent documentation entry point.
- Modify `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`: make agent routing a current documentation requirement and remove superseded statements that prohibit `AGENTS.md`.
- Modify `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`: record that the earlier root-only decision is superseded by the approved agent-routing design.
- Create `docs/superpowers/plans/2026-07-29-agent-routing-guide.md`: executable checklist and verification record for this documentation change.

### Task 1: Create the Repository Agent Waypoint

**Files:**
- Create: `AGENTS.md`
- Reference: `docs/superpowers/specs/2026-07-29-agent-routing-guide-design.md`

**Interfaces:**
- Consumes: canonical repository-relative paths and policies defined by the approved agent-routing design.
- Produces: a root routing contract read before role-specific work begins.

- [ ] **Step 1: Confirm every canonical target exists**

Run:

```bash
test -f README.md &&
test -f DESIGN.md &&
test -f docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md &&
test -f .planning/ROADMAP.md &&
test -f .planning/STATE.md &&
test -f .planning/REQUIREMENTS.md &&
test -f .planning/codebase/ARCHITECTURE.md &&
test -f .planning/codebase/STRUCTURE.md &&
test -f .planning/codebase/CONVENTIONS.md &&
test -f .planning/codebase/INTEGRATIONS.md &&
test -f .planning/codebase/CONCERNS.md &&
test -f .planning/codebase/TESTING.md
```

Expected: exit status `0`.

- [ ] **Step 2: Write the thin routing guide**

Create `AGENTS.md` with these exact top-level sections:

```markdown
# Agent Guide

## Start Here
## Minimum Rules
## Role Routing
## CodeGraph
## Verification
## Conflicts and Handoff
## Canonical Documents
```

The content must:

- tell every worker to identify role and scope, read the relevant PRD section, inspect `git status`, and load only role-specific sources;
- route Coordinator, Planner/Product, UX/Design, Architecture/Development, Storage/Legacy Migration, QA/Review, and Documentation roles;
- state the Main, Financial Detail Modal, app-state ownership, and legacy migration boundaries;
- state that `.codegraph/` is reused and ordinary workers never run initialization or rebuild;
- allow only one Coordinator or assigned graph owner to recover missing or unusable graph state;
- map documentation-only, TypeScript/shared-contract, user-flow, UI, and legacy-removal work to concrete verification;
- define document conflict priority and the completion handoff fields: changed files, commands and results, remaining risks, and next owner.

- [ ] **Step 3: Validate the guide structure and links**

Run:

```bash
rg -n '^## (Start Here|Minimum Rules|Role Routing|CodeGraph|Verification|Conflicts and Handoff|Canonical Documents)$' AGENTS.md
rg -n 'Coordinator|Planner|UX|Developer|Legacy|QA|Documentation|\\.codegraph/|npm run check|Playwright|git diff --check' AGENTS.md
```

Expected: all seven headings and all routing and verification terms are present.

- [ ] **Step 4: Commit the waypoint**

```bash
git add AGENTS.md
git diff --cached --check
git commit -m "docs: add agent routing guide"
```

Expected: commit succeeds with only `AGENTS.md` staged.

### Task 2: Reconcile Canonical Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`

**Interfaces:**
- Consumes: the root routing contract from Task 1.
- Produces: one consistent root-document policy across the README, Product PRD, and superseded documentation design.

- [ ] **Step 1: Update the README documentation index**

Add this entry to `## 제품 문서`:

```markdown
- [Agent Guide](AGENTS.md)
```

Place it immediately after the Product PRD so agents encounter the routing guide before specialized documentation.

- [ ] **Step 2: Update Product PRD documentation requirements**

Change the PRD so it consistently requires:

- root Markdown to contain `README.md`, `DESIGN.md`, and `AGENTS.md`;
- `AGENTS.md` to route roles to canonical sources without duplicating them;
- existing `.codegraph/` state to be reused and ordinary agents not to initialize or rebuild it;
- acceptance criteria that verify the guide exists, the three root documents are present, and no current canonical document prohibits `AGENTS.md`;
- removal of `현재 필요하지 않은 AGENTS 생성` from out-of-scope language.

Keep the existing Current Product Baseline, Migration Transition, and Future Product Expansion boundaries unchanged.

- [ ] **Step 3: Mark the earlier documentation decision as superseded**

Update `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`:

- add `AGENTS.md` under `### 루트에 유지` with the role of agent routing and minimum repository rules;
- replace `### 생성하지 않음` and its prohibition with a supersession note linking to `2026-07-29-agent-routing-guide-design.md`;
- change completion criteria from two root Markdown files to three;
- remove `AGENTS.md` creation from out-of-scope.

Do not rewrite the historical cleanup decisions for CONTEXT, TODO, prd-10, or GEMINI.

- [ ] **Step 4: Verify consistency**

Run:

```bash
rg -n 'AGENTS|CodeGraph|\\.codegraph/' README.md AGENTS.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md
! rg -n 'AGENTS.*(생성하지|존재하지|필요하지)|AGENTS를 생성하지|AGENTS가 존재하지' README.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md
```

Expected: the first command shows the new routing and graph policy; the second command returns success because no prohibition remains.

- [ ] **Step 5: Commit canonical documentation reconciliation**

```bash
git add README.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md
git diff --cached --check
git commit -m "docs: align product docs with agent guide"
```

Expected: commit succeeds with the three canonical documents staged.

### Task 3: Verify the Documentation Contract

**Files:**
- Verify: `AGENTS.md`
- Verify: `README.md`
- Verify: `DESIGN.md`
- Verify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Verify: `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`
- Verify: `docs/superpowers/specs/2026-07-29-agent-routing-guide-design.md`
- Verify: `docs/superpowers/plans/2026-07-29-agent-routing-guide.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: fresh evidence that the routing guide is complete, linked, and consistent.

- [ ] **Step 1: Verify the root Markdown policy**

Run:

```bash
find . -maxdepth 1 -type f -name '*.md' -print | sort
```

Expected:

```text
./AGENTS.md
./DESIGN.md
./README.md
```

- [ ] **Step 2: Validate every inline Markdown link in the changed documents**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const files = [
  'AGENTS.md',
  'README.md',
  'docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md',
  'docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md',
  'docs/superpowers/specs/2026-07-29-agent-routing-guide-design.md',
  'docs/superpowers/plans/2026-07-29-agent-routing-guide.md',
];
const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) failures.push(`${file}: ${target}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`validated links in ${files.length} files`);
NODE
```

Expected: `validated links in 6 files`.

- [ ] **Step 3: Run final Markdown and repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the implementation plan may remain uncommitted before the final plan commit.

- [ ] **Step 4: Record completion in the plan and commit**

Mark every completed checkbox in this plan as `[x]`, then run:

```bash
git add docs/superpowers/plans/2026-07-29-agent-routing-guide.md
git diff --cached --check
git commit -m "docs: record agent guide implementation"
```

Expected: commit succeeds and `git status --short` is empty.
