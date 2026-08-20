---
name: verify-repository-change
description: Use when planning, implementing, reviewing, or handing off changes in this repository to choose the correct canonical documents, verification commands, and evidence summary for the changed surface.
---

# Verify Repository Change

Use this repository-local skill to map a change to the smallest relevant document set and the required verification evidence. This skill does not authorize implementation by itself; it supports implementation, review, and handoff tasks already requested by the user.

## Start

1. Read `AGENTS.md`.
2. Run `git status --short`.
3. Identify the changed surface before reading broad history.
4. Read the Product PRD section that governs the changed surface.
5. Read only the role documents named by `AGENTS.md` for that surface.

## Change Surface Routing

### Documentation-only

Read:

- `AGENTS.md`
- `README.md` when commands, product intro, or status claims change
- `DESIGN.md` when UI, responsive, or accessibility contracts change
- Product PRD when product scope, requirements, or acceptance claims change
- related Superpowers spec, plan, or ADR when the doc references them

Verify:

- relative links resolve from the edited file
- `git diff --check`
- status claims match Product PRD, README, DESIGN, and approved specs

### TypeScript or shared contract

Read:

- Product PRD data contract for the affected slice
- related ADR, spec, or plan
- affected source and tests

Verify:

- `npm run check`
- focused tests for affected consumers
- compatibility search when storage, import, export, backup, revision, or localStorage changes

### User flow or UI

Read:

- `DESIGN.md`
- Product PRD acceptance criteria for the affected app
- related browser or Playwright specs

Verify:

- focused Playwright spec or focused group for the flow
- 390px, 768px, and desktop checks for overflow, overlay containment, focus, touch target, and visualization visibility
- `npm run check` when TypeScript changed

### CI, harness, or agent workflow

Read:

- `AGENTS.md`
- `docs/superpowers/specs/2026-08-20-repository-codex-harness-design.md`
- `docs/superpowers/plans/2026-08-20-repository-codex-harness.md` when present
- relevant official Codex documentation when using Codex product features

Verify:

- `npm run check:harness`
- `npm run check:ci` when package scripts, workflow behavior, or checker logic changed
- `git diff --check`
- inspect workflow permissions and trigger trust boundaries

### Legacy removal or migration

Read:

- Product PRD Legacy transition
- related ADR, spec, and plan
- compatibility code and tests

Verify:

- runtime import, route, selector, storage key, compatibility path, and test reference searches
- old-data compatibility path
- `npm run check`
- related regression tests

## Handoff Format

Every completion handoff should include:

- changed files and purpose
- verification commands and exact pass/fail result
- skipped verification with reason
- remaining risks or unresolved items
- next owner and starting document when follow-up work remains

## Review Rules

- Treat Product PRD and approved specs as current product truth.
- Treat Git history and legacy code as evidence, not current product scope.
- Do not claim completion without fresh verification evidence.
- Do not overwrite unrelated user or worker changes.
- Do not broaden product boundaries without updating the owning PRD, approved spec, or ADR.
