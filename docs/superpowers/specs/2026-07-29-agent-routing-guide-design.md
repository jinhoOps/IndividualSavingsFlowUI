# ISF Agent Routing Guide Design

## Goal

Create a root `AGENTS.md` that acts as a waypoint for many concurrent or sequential agents. It must route each assigned role to the smallest relevant document set, enforce a short list of product and safety rules, and prevent repeated repository initialization work such as unnecessary CodeGraph `init`.

The guide must remain thin. Product requirements belong to the PRD, visual rules belong to DESIGN, implementation structure belongs to the codebase maps, and delivery order belongs to Roadmap and Superpowers plans.

## Readers

- Coordinators assigning bounded work
- Product planners and PM agents
- UX and interaction designers
- Architects and implementation agents
- Storage and legacy-migration agents
- QA and code-review agents
- Documentation agents

An agent may hold more than one role. In that case it combines the relevant reading lists and reads duplicated documents only once.

## Start Sequence

Every agent follows this order:

1. Read `AGENTS.md`.
2. Identify the assigned role and explicit task scope.
3. Read the relevant Product PRD section.
4. Read only the role-specific documents listed in the routing table.
5. Inspect `git status` and the files already changed by other workers.
6. Perform the bounded task.
7. Run the verification required for the changed surface.
8. Report changed files, verification evidence, remaining risks, and handoff information.

Agents do not load all of `.planning`, all historical milestones, or the entire repository before beginning a bounded task.

## Minimum Mandatory Rules

### Product Baseline

- Main is a completed current product baseline.
- Normal Main financial editing belongs to Financial Detail Modal.
- Simulation, Portfolio, and Account Map own their own editable state.
- Account Map may read Main data but does not implicitly write back to Main.

### Legacy Migration

- Legacy code is a temporary migration asset, not a supported product path.
- Do not restore legacy UI as a normal user path.
- Do not build new features on top of legacy modules.
- Before removing legacy code, inventory its behavior and data contracts.
- Removal requires migration or explicit rejection evidence, compatibility verification, reference removal, and regression tests.

### Change Safety

- Preserve user changes and unrelated changes from other agents.
- Do not expand the task into adjacent refactoring without authority.
- Do not claim completion without fresh verification evidence.
- If a product boundary changes, update the appropriate PRD, spec, or ADR rather than changing code alone.
- Use `rg` or `rg --files` for ordinary discovery before broader indexing tools.

### Documentation Ownership

- Product scope and acceptance criteria: Product PRD
- Current product introduction and commands: README
- UI, responsive, and accessibility contracts: DESIGN
- Implementation structure and conventions: `.planning/codebase/`
- Delivery order and current position: `.planning/ROADMAP.md` and `.planning/STATE.md`
- Architectural decisions: `docs/adr/`
- Feature design and execution: `docs/superpowers/specs/` and `docs/superpowers/plans/`

## Role Routing

### Coordinator

Read:

- Product PRD
- Active Roadmap
- Project State
- Active Superpowers spec and plan

Responsibilities:

- Split work into bounded, non-overlapping tasks.
- Assign a single owner to shared initialization or generated-state work.
- Prevent multiple agents from modifying the same source of truth without coordination.
- Collect verification evidence and unresolved risks from workers.

### Planner / Product Manager

Read:

- Product PRD
- Active Roadmap
- Active Requirements
- Relevant Superpowers specs

Responsibilities:

- Define user problem, scope, personas, user stories, requirements, acceptance criteria, and exclusions.
- Separate current product behavior from migration transition and future expansion.
- Avoid describing already shipped Main behavior as future implementation.

### UX / Designer

Read:

- Relevant Product PRD requirements and acceptance criteria
- DESIGN
- Relevant feature spec
- Current screen structure and relevant browser tests

Responsibilities:

- Maintain summary-first information hierarchy.
- Preserve Financial Detail Modal as Main's primary editing surface.
- Verify 390px mobile, 768px narrow layout, desktop, accessibility, and feedback behavior.
- Avoid using legacy UI as a design reference unless the task explicitly concerns migration evidence.

### Architect / Developer

Read:

- Relevant Product PRD scope
- Relevant ADRs
- Codebase Architecture
- Codebase Structure
- Codebase Conventions
- Relevant feature spec and plan

Responsibilities:

- Implement within current module and data-ownership boundaries.
- Prefer existing shared utilities and storage interfaces.
- Keep calculation, normalization, persistence, rendering, and connector responsibilities separable.
- Add or update tests for externally observable behavior.

### Storage / Legacy Migration

Read:

- Product PRD Migration Transition
- Codebase Integrations
- Codebase Concerns
- Relevant storage and compatibility source
- Relevant historical phase documents only when needed to understand a specific contract

Responsibilities:

- Inventory legacy behavior and schema meaning before changing or deleting it.
- Classify each capability as migrate, reject, or pending decision.
- Preserve current saved-data, import, export, backup, and share compatibility.
- Prove runtime and test references are absent before declaring removal complete.

### QA / Reviewer

Read:

- Product PRD acceptance criteria
- Codebase Testing
- Relevant feature spec and plan
- Current diff and affected tests

Responsibilities:

- Test external behavior and public data contracts rather than implementation details.
- Check requirement compliance, regression risk, mobile behavior, storage compatibility, and security.
- Report findings before proposing unrelated improvements.

### Documentation

Read:

- Product PRD
- README
- DESIGN
- Active Roadmap
- Relevant ADR and Superpowers spec

Responsibilities:

- Keep current product, migration transition, and future roadmap clearly separated.
- Link to source documents instead of duplicating their full contents.
- Check links, terminology, and status claims after changes.

## CodeGraph Policy

The repository already contains `.codegraph/`. Repeated initialization by every worker is prohibited.

### Default Behavior

1. Check whether `.codegraph/` exists.
2. If it exists, reuse it and do not run CodeGraph `init`.
3. Use `rg`, `rg --files`, and role-specific documents for ordinary bounded discovery.
4. Do not make CodeGraph initialization a task completion requirement.

### Worker Restrictions

- Ordinary worker agents must not initialize, reinitialize, rebuild, or delete CodeGraph state.
- Workers must not run initialization merely because a generic workflow mentions it.
- Workers should report suspected missing or corrupt graph state to the Coordinator.

### Initialization Authority

Only the Coordinator or one explicitly assigned graph-owner agent may initialize or rebuild CodeGraph, and only when:

- `.codegraph/` is missing or demonstrably unusable;
- the assigned task materially benefits from graph indexing; and
- simpler repository discovery is insufficient.

Only one graph owner may perform this work at a time. Other agents wait for the owner or continue with non-graph discovery.

## Verification Routing

### Documentation-Only

- Validate Markdown links.
- Run `git diff --check`.
- Confirm status claims match the PRD and Roadmap.

### TypeScript or Shared Contract

- Run `npm run check`.
- Run focused tests for affected consumers.

### User Flow

- Run the relevant Playwright spec or focused group.
- Run the full E2E suite when shared infrastructure or multiple destinations are affected.

### UI

- Verify 390px mobile, 768px narrow layout, and desktop.
- Check overflow, modal containment, focus, touch targets, and graph visibility.

### Legacy Removal

- Search runtime imports, routes, selectors, storage keys, compatibility paths, and test references.
- Verify migrated behavior and old-data compatibility.
- Run type checking and the full relevant regression suite.

## Error and Conflict Handling

- If task scope conflicts with the PRD, stop and report the conflict.
- If two source documents disagree, use this priority:
  1. Current user instruction
  2. Product PRD
  3. Current approved Superpowers spec
  4. ADR that is not superseded
  5. Active Roadmap and Requirements
  6. Codebase maps
  7. Historical milestone documents
- If another agent owns overlapping files, coordinate rather than overwriting.
- If required context is missing, ask for the smallest clarification needed.
- If CodeGraph state appears invalid, do not silently rebuild it; escalate to the Coordinator.

## AGENTS.md Shape

The root guide should contain:

1. Purpose
2. Start sequence
3. Minimum mandatory rules
4. Role routing table
5. CodeGraph policy
6. Verification matrix
7. Conflict and handoff rules
8. Direct links to canonical documents

It should not copy:

- the entire PRD;
- all design tokens;
- historical phase narratives;
- product-specific agent syntax;
- exhaustive implementation details;
- generic CodeGraph initialization commands.

## Documentation Consistency

Creating `AGENTS.md` supersedes the earlier decision to keep only README and DESIGN at the repository root. The implementation must update the Product PRD, README, and the earlier product-direction documentation spec so none of them still require `AGENTS.md` to be absent. The new root Markdown policy is:

- `README.md`: product and operational entry point
- `DESIGN.md`: UI contract
- `AGENTS.md`: agent routing and minimum repository rules

## Acceptance Criteria

- A newly assigned agent can identify its first required documents in under one minute.
- Every role links to the Product PRD and only the additional documents it needs.
- Main completion and legacy temporary-asset rules are explicit.
- CodeGraph `init` is explicitly skipped when `.codegraph/` already exists.
- Worker agents cannot independently initialize or rebuild CodeGraph.
- One Coordinator or graph-owner exception is defined for missing or invalid state.
- Verification is routed by change type.
- The guide contains working relative links.
- The guide does not duplicate large sections of canonical documents.
- Root Markdown contains `README.md`, `DESIGN.md`, and `AGENTS.md`.
- No current canonical document states that `AGENTS.md` must not exist.
