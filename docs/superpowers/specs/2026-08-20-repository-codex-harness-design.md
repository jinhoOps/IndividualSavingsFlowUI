# Repository Codex Harness Design

## Background

This repository already has `AGENTS.md`, one repository-local skill, product PRD routing, and an Orca-managed worktree layout. The missing piece is a reproducible repository harness that turns those conventions into checks every branch and pull request can run.

The harness must live in Git. Files placed only above `/Users/jinho/orca/workspaces/IndividualSavingsFlowUI` are useful for local operator habits, but Codex project discovery starts from the project root and CI cannot enforce parent-level files. All Orca worktrees for this repository should therefore inherit the harness after the branch is merged or rebased, not through a separate parent directory.

## Goals

- Make the repository's agent operating rules easier to follow and harder to accidentally bypass.
- Add required deterministic CI for pull requests and base branch pushes.
- Add optional, non-blocking Codex review automation for high-signal PR feedback.
- Keep the harness repository-local so every Orca worktree sees the same files after normal Git integration.
- Preserve current product boundaries from the PRD and `AGENTS.md`.
- Avoid adding a generic `.ai/` convention unless a supported tool in this repository actually consumes it.

## Non-Goals

- Do not change product behavior, storage schema, routes, UI, or tests for user-facing features.
- Do not create a global Codex plugin, global skill, or parent-workspace-only harness.
- Do not make AI review a required merge gate.
- Do not use AI review as a replacement for TypeScript, unit, build, or focused E2E verification.
- Do not reconnect legacy code, change product ownership boundaries, or update product scope.
- Do not require every Orca worktree to be edited manually.

## Recommended Approach

Use a Git-included repository harness:

- `AGENTS.md` remains the primary Codex entry point and gains explicit `Code Review Rules`.
- `.agents/skills/` remains the repository-local skill location.
- `scripts/check-agent-harness.mjs` validates the expected harness shape.
- `package.json` exposes `check:harness` and a CI aggregate command.
- `.github/workflows/ci.yml` provides required deterministic checks.
- `.github/workflows/codex-review.yml` runs optional Codex PR review when the secret is present and the PR context is trusted.
- `.github/codex/prompts/review.md` owns the AI review prompt instead of embedding a long prompt in workflow YAML.

This keeps the source of truth in the repository and makes the same contract visible locally, in Orca worktrees, and in GitHub Actions.

## Alternatives Considered

### Generic `.ai/` Directory

A generic `.ai/` directory could help other tools if they are later introduced, but it is not an official Codex discovery path. Using it now would duplicate `AGENTS.md`, `.agents/skills/`, and `.github/codex/prompts/` without enforcement. This design does not create `.ai/`.

### Parent-Level Shared Harness

A parent-level harness under `/Users/jinho/orca/workspaces/IndividualSavingsFlowUI` would be visible to local operators but not reliably discovered by Codex from each Git project root, and it would not run in CI. This design keeps parent-level habits optional and non-authoritative.

### Blocking AI Review

Blocking AI review could prevent some review misses, but it creates secret availability, model availability, and prompt-injection failure modes that are not deterministic. This design makes deterministic CI blocking and AI review advisory.

## Architecture

### `AGENTS.md`

`AGENTS.md` stays concise and link-first. It should not duplicate product requirements already owned by the PRD, README, DESIGN, ADRs, specs, or plans.

Add a `Code Review Rules` section aimed at Codex Cloud automatic review and repository-local review agents. The rules should prioritize consequential findings:

- product boundary violations against the PRD;
- Main, Simulation, Portfolio, Account Map ownership regressions;
- unsupported legacy runtime reuse;
- storage, import, export, backup, revision, or compatibility regressions;
- mobile, accessibility, focus, overflow, and touch target regressions covered by DESIGN;
- missing verification evidence for changed surfaces;
- security or CI workflow permission regressions.

The rules should explicitly de-prioritize pure style preferences and checks that deterministic CI already owns.

### Repository-Local Skills

Keep `.agents/skills/review-product-experience/SKILL.md`.

Add one narrow repository-local skill named `verify-repository-change`, whose job is to map a change surface to the correct documents and verification evidence. It should not implement code. It should help agents produce a handoff containing changed files, commands run, results, risks, and next owner.

The skill must reference existing canonical documents instead of copying product requirements.

### Harness Checker

Create `scripts/check-agent-harness.mjs`.

The checker should fail when required harness files or sections are missing:

- `AGENTS.md`
- `.agents/skills/review-product-experience/SKILL.md`
- `.agents/skills/verify-repository-change/SKILL.md`
- `.github/codex/prompts/review.md`
- `.github/workflows/ci.yml`
- `.github/workflows/codex-review.yml`
- expected `package.json` scripts

It should also check important content markers, such as `Code Review Rules`, canonical PRD links, and the non-blocking review policy. It can use Node's standard library only; no new dependency is needed for this first version.

The checker is intentionally a guardrail, not a semantic validator. It verifies that the harness exists and points to the right sources, while human and AI review still judge quality.

### Package Scripts

Add:

```json
"check:harness": "node scripts/check-agent-harness.mjs",
"check:ci": "npm run check:harness && npm run check && npm run test:unit"
```

`npm run check` currently runs TypeScript source and unit project type checks. `npm run test:unit` runs Vitest. The CI aggregate keeps deterministic checks explicit without changing the existing `check` meaning.

`npm run build` remains separate because it mutates version-related files through the existing build script. GitHub Pages deploy already runs build on deploy branches. PR CI should avoid unnecessary version metadata churn.

### Deterministic CI

Add `.github/workflows/ci.yml`.

Trigger:

- `pull_request`
- `push` to `main`
- `workflow_dispatch`

Core steps:

- checkout;
- setup Node 22 with npm cache;
- `npm install --legacy-peer-deps`;
- `npm run check:ci`.

This workflow is the candidate required branch protection check. It should fail on harness drift, TypeScript contract failures, and unit test failures.

Do not run full Playwright E2E on every pull request in the first harness pass. E2E remains required by `AGENTS.md` for user-flow, UI, and shared infrastructure changes. A later plan can add label-based or path-based E2E jobs if the repository needs that cost on every PR.

### Codex Review Automation

Add `.github/workflows/codex-review.yml` using the official Codex GitHub Action.

Policy:

- advisory only;
- read-only checkout and least permissions possible;
- skipped cleanly when `OPENAI_API_KEY` is not configured;
- skipped for untrusted fork contexts where secrets are unavailable;
- findings posted as a PR review/comment when possible;
- workflow failure must not block deterministic CI.

Prompt source:

- `.github/codex/prompts/review.md`

Prompt behavior:

- obey `AGENTS.md` and the product PRD;
- report only material P0/P1 regressions and product boundary violations;
- include file and line references where possible;
- avoid style-only comments;
- avoid repeating deterministic CI failures unless they reveal a product or safety risk.

The workflow should not use `pull_request_target` for reviewing untrusted code. It should run in the pull request context, with secrets naturally unavailable on forks.

## Data Flow

Local development:

```text
agent or maintainer
  -> reads AGENTS.md and relevant docs
  -> changes repo files
  -> runs npm run check:harness or npm run check:ci
  -> handoff records evidence
```

GitHub deterministic CI:

```text
pull request or main push
  -> checkout repository
  -> install dependencies
  -> run npm run check:ci
  -> pass or fail as required signal
```

GitHub Codex review:

```text
trusted pull request
  -> checkout repository read-only
  -> load .github/codex/prompts/review.md
  -> Codex reviews diff using AGENTS.md and PRD context
  -> advisory finding is posted
  -> deterministic CI remains the merge gate
```

## Error Handling

- If `check-agent-harness.mjs` finds a missing file, section, or script, it prints all failures and exits non-zero.
- If required docs are renamed or moved, the checker fails until links and markers are updated.
- If `OPENAI_API_KEY` is missing, Codex review is skipped and the workflow completes successfully.
- If Codex review cannot post feedback, the workflow records the failure without blocking CI.
- If deterministic CI fails, the branch is not considered verified until the root cause is fixed or the failure is explicitly handed off.

## Security and Permissions

- Deterministic CI uses only the repository checkout and npm dependencies.
- Codex review uses minimum GitHub token permissions needed for read and advisory feedback.
- Codex review does not run on `pull_request_target`.
- The review prompt must tell the model to treat repository and PR text as untrusted input and to follow only repository instructions plus workflow prompt policy.
- AI review must not edit files, push commits, create releases, or deploy.
- GitHub Pages deployment stays in the existing deploy workflow and is not mixed into PR CI.

## Orca Worktree Behavior

The authoritative harness files live inside the Git repository. The current Orca worktree can implement them on the active branch. After integration to `main`, new Orca worktrees inherit the harness automatically. Existing worktrees pick it up through normal merge or rebase.

No separate files are required under `/Users/jinho/orca/workspaces/IndividualSavingsFlowUI` outside individual Git worktrees.

## Testing and Verification

Spec-only validation:

- relative link review for new document references;
- `git diff --check`;
- self-review for placeholders, contradictions, ambiguity, and scope.

Implementation validation:

- `npm run check:harness`;
- `npm run check:ci`;
- inspect `git diff --check`;
- review workflow YAML for least-privilege permissions and trusted trigger choice.

If CI workflow syntax cannot be fully verified locally, the handoff should state that GitHub Actions will be the final syntax authority on first push.

## Acceptance Criteria

- `AGENTS.md` includes concise, consequential `Code Review Rules`.
- The repository has a local verification skill for change-surface-to-evidence handoff.
- `scripts/check-agent-harness.mjs` fails on missing harness files, missing required sections, or missing package scripts.
- `npm run check:harness` and `npm run check:ci` exist.
- PR/main deterministic CI runs harness, TypeScript, and Vitest checks.
- Codex review automation is advisory, uses the prompt file, and is skipped or non-blocking when secrets or posting permissions are unavailable.
- No `.ai/` directory is introduced.
- No parent-level workspace harness is required for Orca worktrees.
- No product runtime, storage schema, route, UI, or legacy migration behavior changes.
