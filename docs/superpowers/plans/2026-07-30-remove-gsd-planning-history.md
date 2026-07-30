# GSD Planning History Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale GSD phase machinery and replace it with a small current-state documentation set that cannot be mistaken for supported product behavior.

**Architecture:** The Product PRD remains the product source of truth. `.planning` retains only current requirements, forward roadmap, concise state, and implementation maps; Git history retains retired milestone evidence. Root routing documents point agents to current sources and explicitly prevent old implementation records from overriding runtime evidence.

**Tech Stack:** Markdown, JSON cleanup, Git, ripgrep, existing repository verification commands

## Global Constraints

- Work directly on `main` as explicitly approved by the user.
- Preserve `.planning/codebase/` as the implementation navigation map.
- Preserve `.codegraph/` and its single-owner initialization rule.
- Do not delete legacy runtime code; this task removes only stale planning machinery and claims.
- Current runtime and tests outrank retired planning history when documenting supported behavior.

---

### Task 1: Remove retired GSD artifacts

**Files:**
- Delete: `.planning/phases/`
- Delete: `.planning/milestones/`
- Delete: `.planning/quick/`
- Delete: `.planning/debug/`
- Delete: `.planning/diagrams/`
- Delete: `.planning/ui-reviews/`
- Delete: `.planning/MILESTONES.md`
- Delete: `.planning/RETROSPECTIVE.md`
- Delete: `.planning/v1.9-MILESTONE-AUDIT.md`
- Delete: `.planning/config.json`
- Delete: `.planning/update.cjs`
- Delete: `.planning/PROJECT.md`

**Interfaces:**
- Consumes: Git history as the recovery path for retired records.
- Produces: `.planning/` without GSD execution state or historical completion claims.

- [ ] **Step 1: Record the exact tracked targets**

Run:

```bash
git ls-files '.planning/**'
```

- [ ] **Step 2: Delete only the approved targets**

Delete the paths listed in this task without touching `.planning/codebase/`.

- [ ] **Step 3: Verify the retired structures are absent**

Run:

```bash
test ! -e .planning/phases &&
test ! -e .planning/milestones &&
test ! -e .planning/config.json &&
test -d .planning/codebase
```

### Task 2: Replace active planning documents

**Files:**
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/REQUIREMENTS.md`

**Interfaces:**
- Consumes: current React Main data contract, readiness-route tests, Product PRD.
- Produces: concise present-state facts, ordered future outcomes, and requirement status without phase counters.

- [ ] **Step 1: Rewrite State as a runtime snapshot**

State must identify Main as the only supported detailed app, list its current scalar fields, mark the other routes readiness-only, and describe retained legacy code as migration evidence.

- [ ] **Step 2: Rewrite Roadmap as forward-looking outcomes**

Roadmap must contain no completed GSD phases, percentages, waves, or plan counters.

- [ ] **Step 3: Rewrite Requirements by status**

Requirements must separate supported current behavior, transition requirements, and uncommitted future candidates. It must not mark removed household budgeting, item allocation, Sankey, modal editing, or projections as currently complete.

### Task 3: Align navigation and product claims

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `.agents/skills/review-product-experience/SKILL.md`

**Interfaces:**
- Consumes: the replacement State, Roadmap, Requirements, and actual Main runtime.
- Produces: one consistent product boundary and a routing guide that does not require retired history.

- [ ] **Step 1: Remove historical milestone routing**

AGENTS must not direct workers to retired milestones and must preserve the existing CodeGraph ownership rule.

- [ ] **Step 2: Correct current feature descriptions**

README, DESIGN, and PRD must describe the current scalar Main experience and readiness routes without claiming unsupported modal, Sankey, projection, account allocation, or household-budget behavior.

- [ ] **Step 3: Update review input order**

The product-experience review skill must use current canonical documents and runtime evidence, not historical planning state.

### Task 4: Verify documentation integrity

**Files:**
- Verify: all modified and retained Markdown files

**Interfaces:**
- Consumes: final working tree.
- Produces: evidence that retired GSD references and broken relative links are absent.

- [ ] **Step 1: Search for live GSD and retired-path references**

Run:

```bash
rg -n 'GSD|gsd_state_version|\.planning/(phases|milestones|PROJECT|MILESTONES|RETROSPECTIVE)' \
  AGENTS.md README.md DESIGN.md .planning docs .agents --glob '*.md'
```

Expected: no live operational references; references inside this removal plan are allowed.

- [ ] **Step 2: Check Markdown relative links**

Run the repository Markdown link checker or a local equivalent over the changed canonical documents.

- [ ] **Step 3: Check diff validity and repository status**

Run:

```bash
git diff --check
git status --short
```
