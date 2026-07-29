# ISF Product PRD and Root Documentation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft product PRD with the approved current-state product definition, update the two surviving root documents, and remove obsolete root Markdown after absorbing valid information.

**Architecture:** The product PRD is the source of truth for product scope, current capabilities, migration state, requirements, and acceptance criteria. `README.md` remains the operational entry point and `DESIGN.md` remains the UI contract; legacy notes and agent-specific guidance are removed from the root after relevant information is absorbed.

**Tech Stack:** Markdown, Git, ripgrep, existing Vite/TypeScript/Playwright verification commands

## Global Constraints

- Main is a completed current product baseline, not a future rebuild requirement.
- Legacy code is a temporary migration asset, not a supported product path or new implementation foundation.
- Legacy runtime code is not deleted in this documentation phase.
- Root Markdown must contain only `README.md` and `DESIGN.md`.
- Do not create `AGENTS.md`.
- Preserve user-owned unrelated changes.
- The final PRD must combine the `to-prd` product template with the `breakdown-feature-prd` detailed feature structure.

---

### Task 1: Rewrite the Product PRD

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Reference: `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`
- Reference: `.planning/PROJECT.md`
- Reference: `.planning/ROADMAP.md`
- Reference: `.planning/REQUIREMENTS.md`
- Reference: `docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md`
- Reference: `docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md`

**Interfaces:**
- Consumes: approved product baseline, legacy temporary-asset policy, current Superpowers phase results
- Produces: one product source of truth containing product scope, current state, transition state, future roadmap, requirements, acceptance criteria, implementation decisions, testing decisions, and exclusions

- [x] **Step 1: Establish the PRD status vocabulary**

Use exactly these top-level delivery states:

```markdown
## Delivery State

### Current Product Baseline
### Migration Transition
### Future Product Expansion
```

State that Main, Simulation, Portfolio, Account Map, and shared local-first infrastructure belong to the current baseline. State that legacy inventory, feature migration, compatibility verification, reference removal, and eventual deletion belong to the transition.

- [x] **Step 2: Correct the goal and problem statement**

Replace language that presents Main as an unfinished rebuild. Describe the current problem as maintaining a coherent connected financial-planning product while safely extracting the remaining value from legacy code without reopening obsolete user paths.

- [x] **Step 3: Rewrite user stories**

Cover all of the following actors and benefits:

```text
individual financial planner
mobile user
savings and investment planner
multi-account user
household planner
returning user with old saved data
maintainer migrating legacy capabilities
maintainer removing verified-dead legacy code
contributor reading project documentation
QA engineer verifying current behavior
```

Every story must use the format:

```markdown
1. As a <persona>, I want <capability>, so that <benefit>.
```

- [x] **Step 4: Define functional and non-functional requirements**

Functional requirements must cover:

```text
Main summary-first and Financial Detail Modal behavior
Sankey and projection consistency
Simulation import and independent assumptions
Portfolio creation and persistence
Account Map read-only Main import and page-owned draft
local-first storage, import, export, backup, and compatibility
legacy inventory, migration decisions, verification, and deletion gate
documentation ownership and root-document policy
future capture, household merge, history comparison, and real-estate planning
```

Non-functional requirements must cover local-first privacy, accessibility, responsive behavior, deterministic calculations, compatibility, security, maintainability, design consistency, and financial disclaimers.

- [x] **Step 5: Define acceptance criteria**

Add observable checklists for:

```text
current Main behavior remains unchanged
legacy UI is not exposed as a normal user path
legacy capability cannot be deleted before migration or rejection evidence exists
migrated behavior and old-data compatibility are verified
runtime references are absent before deletion is declared complete
README and DESIGN accurately represent current state
only README.md and DESIGN.md remain at repository root
AGENTS.md does not exist
```

- [x] **Step 6: Record implementation and testing decisions**

Describe module boundaries without file paths or code snippets. Tests must verify external behavior and public data contracts rather than legacy internals.

- [x] **Step 7: Validate PRD structure**

Run:

```bash
test -s docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
rg -n '^## ' docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
rg -n 'Main.*(재구축 예정|구축 예정)|legacy.*지원 기능|레거시.*지원 기능' docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
```

Expected:

- The file exists and contains all required PRD sections.
- The final `rg` command returns no matches.

- [x] **Step 8: Commit the PRD**

```bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
git commit -m "docs: align product PRD with current ISF direction"
```

### Task 2: Refresh the Surviving Root Documents

**Files:**
- Modify: `README.md`
- Modify: `DESIGN.md`
- Reference: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`

**Interfaces:**
- Consumes: final product PRD
- Produces: concise operational product entry point and current UI contract

- [x] **Step 1: Update README product structure**

Describe four connected destinations:

```text
Main
Simulation
Portfolio
Account Map
```

State that Main is the current completed baseline. Describe Account Map as an independent page-owned draft that imports Main data without implicit write-back.

- [x] **Step 2: Add migration status to README**

Add a concise section with this meaning:

```markdown
## Legacy Migration Status

Legacy code that still contains unmigrated capabilities or compatibility knowledge is retained temporarily. It is not a supported user path or a foundation for new features. Each capability is migrated or explicitly rejected, verified against current behavior and saved-data compatibility, and then its remaining references and implementation are removed.
```

Do not list individual legacy files as a permanent architecture.

- [x] **Step 3: Update README roadmap and documentation links**

Move valid real-estate and household ideas from root notes into the future roadmap summary. Link to the product PRD, design contract, Superpowers spec, active roadmap, and ADRs.

- [x] **Step 4: Correct DESIGN**

Keep the editorial visual system, unit rules, responsive contract, and feedback behavior. Remove or rewrite statements that:

```text
treat legacy browser execution as a permanent design goal
require every dirty state in every app to use one global pending bar
describe an obsolete sync banner as current navigation feedback
contradict the current Main completed baseline
```

- [x] **Step 5: Validate README and DESIGN**

Run:

```bash
rg -n 'Account Map|Legacy Migration Status|Product PRD' README.md
rg -n 'ISF Pearl|만원|원 단위|390px|768px|Financial Detail Modal' DESIGN.md
git diff --check -- README.md DESIGN.md
```

Expected: each current product and design contract term is present and `git diff --check` exits 0.

- [x] **Step 6: Commit root document refresh**

```bash
git add README.md DESIGN.md
git commit -m "docs: refresh current product and design guides"
```

### Task 3: Remove Obsolete Root Markdown

**Files:**
- Delete: `CONTEXT.md`
- Delete: `TODO.md`
- Delete: `prd-10.md`
- Delete: `GEMINI.md`
- Verify absent: `AGENTS.md`

**Interfaces:**
- Consumes: information already absorbed into the PRD, README, DESIGN, active roadmap, and Git history
- Produces: a root Markdown surface containing only `README.md` and `DESIGN.md`

- [x] **Step 1: Verify information absorption before deletion**

Run:

```bash
rg -n 'Summary Surface|Financial Detail Modal|Savings Maturity Month|Item-Level Savings Yield' docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md DESIGN.md
rg -n '부동산|DSR|LTV|가구 병합' docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md README.md .planning/ROADMAP.md
rg -n '백테스트|stock-snowball|Legacy Migration' docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md README.md .planning
```

Expected: product terminology, future roadmap, and legacy/backtest history each have at least one non-root-note home.

- [x] **Step 2: Delete obsolete root Markdown**

Delete only:

```text
CONTEXT.md
TODO.md
prd-10.md
GEMINI.md
```

Do not delete runtime source, `.planning` history, ADRs, Superpowers specs, or the product PRD.

- [x] **Step 3: Verify root Markdown policy**

Run:

```bash
find . -maxdepth 1 -type f -name '*.md' -print | sort
test ! -e AGENTS.md
```

Expected output:

```text
./DESIGN.md
./README.md
```

- [x] **Step 4: Verify document links and repository checks**

Run:

```bash
rg -n '\\[[^]]+\\]\\(([^)]+\\.md[^)]*)\\)' README.md DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
git diff --check
npm run check
```

Expected: Markdown diff checks pass and TypeScript exits 0.

- [x] **Step 5: Commit root cleanup**

```bash
git add README.md DESIGN.md CONTEXT.md TODO.md prd-10.md GEMINI.md
git commit -m "docs: keep only current root documentation"
```

### Task 4: Final Product Documentation Review

**Files:**
- Review: `README.md`
- Review: `DESIGN.md`
- Review: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Review: `docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md`

**Interfaces:**
- Consumes: all prior task outputs
- Produces: verified documentation set and migration-ready product baseline

- [x] **Step 1: Check status claims**

Run:

```bash
rg -n '완료|현재 제품|전환 중|향후|임시자산|마이그레이션' README.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
```

Confirm Main is current and complete, legacy is temporary, and future features are not described as shipped.

- [x] **Step 2: Scan for placeholders and contradictions**

Run:

```bash
rg -n 'TBD|FIXME|XXX|구축 예정인 Main|레거시 사용자 경로|GEMINI\\.md|CONTEXT\\.md|TODO\\.md|prd-10\\.md' README.md DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
```

Expected: no placeholders or obsolete root-document references. References to the literal concept of future work are allowed only when requirements and acceptance criteria are explicit.

- [x] **Step 3: Run final verification**

Run:

```bash
git diff --check
npm run check
find . -maxdepth 1 -type f -name '*.md' -print | sort
git status --short
```

Expected:

- Diff check exits 0.
- TypeScript exits 0.
- Root Markdown list contains only `DESIGN.md` and `README.md`.
- Git status contains no unexpected files.

- [x] **Step 4: Record final handoff**

Report:

```text
PRD path
Superpowers spec path
implementation plan path
root Markdown files retained
root Markdown files removed
verification commands and outcomes
commits created
legacy runtime code removal explicitly deferred
```
