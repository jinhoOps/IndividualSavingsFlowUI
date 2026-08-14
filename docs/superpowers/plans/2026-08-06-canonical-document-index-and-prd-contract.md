# Canonical Document Index and PRD Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove retired `.planning` references and reflect approved recent product contracts in the canonical PRD without copying implementation details.

**Architecture:** `AGENTS.md` remains the role-based index, the Product PRD owns product requirements and acceptance criteria, `DESIGN.md` owns detailed UI contracts, and Superpowers specs and plans retain feature decision history. README links only to current canonical documents.

**Tech Stack:** Markdown, Git, existing repository documentation

## Global Constraints

- Preserve the existing uncommitted `package.json` description change.
- Do not restore or reference retired `.planning` GSD artifacts.
- Keep component paths, CSS implementation, and internal architecture out of the Product PRD.
- Do not rewrite historical Superpowers specs or plans.

---

### Task 1: Update the canonical document index

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Current Product PRD, DESIGN, ADR, Superpowers spec and plan locations
- Produces: Valid role routing and canonical document links with no `.planning` dependency

- [x] **Step 1:** Replace `.planning` ownership and role-routing links with the Product PRD, DESIGN, relevant ADR/spec/plan, current code, tests, and Git evidence.
- [x] **Step 2:** Remove retired Roadmap and State links from README.
- [x] **Step 3:** Search the edited files for remaining `.planning` references.

### Task 2: Reflect current product contracts in the PRD

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`

**Interfaces:**
- Consumes: Approved Portfolio, app management, app shell, Main donut, and responsive interaction specs
- Produces: Concise Portfolio requirements, cross-app isolation and interaction acceptance criteria, and current verification commands

- [x] **Step 1:** Remove retired Requirements, Roadmap, and State links and tracking claims.
- [x] **Step 2:** Add Portfolio ownership, synchronization, allocation, draft, apply, and reset contracts.
- [x] **Step 3:** Add only user-observable shell, chart/donut, and per-app isolation acceptance criteria.
- [x] **Step 4:** Add focused Simulation, Portfolio, and Account Map Playwright commands.

### Task 3: Verify documentation integrity

**Files:**
- Verify: `AGENTS.md`
- Verify: `README.md`
- Verify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`

**Interfaces:**
- Consumes: Final documentation diff
- Produces: Link and consistency evidence

- [x] **Step 1:** Run `rg -n '\\.planning' AGENTS.md README.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md` and expect no matches.
- [x] **Step 2:** Resolve every relative Markdown link in the three edited canonical documents and require all local targets to exist.
- [x] **Step 3:** Run `git diff --check` and inspect the scoped diff and status.
