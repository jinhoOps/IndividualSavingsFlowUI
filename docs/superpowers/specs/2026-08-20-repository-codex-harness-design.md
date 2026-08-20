# Repository Codex Harness Design

## Revision

2026-08-20 cleanup: the repository does not use API-key based Codex GitHub Action review. The harness keeps deterministic CI, `AGENTS.md` review rules, and repository-local skills. Codex Cloud or human-triggered review may consume `AGENTS.md` `Code Review Rules`, but this repository does not define `.github/workflows/codex-review.yml`, `.github/codex/prompts/review.md`, or any OpenAI API key requirement.

## Goals

- Keep agent instructions and review rules inside the Git repository.
- Add deterministic CI for pull requests and `main` pushes.
- Add a repository-local verification skill for choosing documents, commands, and handoff evidence.
- Keep the harness inherited by normal Git integration across Orca worktrees.
- Avoid `.ai/` and parent-workspace-only conventions that Codex and CI do not enforce here.

## Non-Goals

- Do not add Codex Action or any OpenAI API-key based workflow.
- Do not require an OpenAI API key for repository checks.
- Do not make AI review a merge gate.
- Do not change product runtime, storage schema, routes, UI, or legacy migration behavior.

## Architecture

Repository files:

- `AGENTS.md`: primary agent entry point plus consequential `Code Review Rules`.
- `.agents/skills/review-product-experience/SKILL.md`: existing cross-functional product review skill.
- `.agents/skills/verify-repository-change/SKILL.md`: change-surface to verification/handoff routing.
- `scripts/check-agent-harness.mjs`: deterministic harness shape checker.
- `package.json`: `check:harness` and `check:ci`.
- `.github/workflows/ci.yml`: required deterministic CI candidate.

The checker verifies required harness files and also fails if API-key based Codex Action review files or markers are reintroduced.

## CI Contract

`.github/workflows/ci.yml` runs on:

- `pull_request`
- `push` to `main`
- `workflow_dispatch`

It checks out the repo, installs dependencies with `npm install --legacy-peer-deps`, and runs `npm run check:ci`.

`npm run check:ci` runs:

- `npm run check:harness`
- `npm run check`
- `npm run test:unit`

Full Playwright E2E remains required by `AGENTS.md` for user-flow, UI, and shared infrastructure changes, but is not part of the first required PR CI gate.

## Review Contract

Review guidance lives in `AGENTS.md` under `Code Review Rules`.

Those rules are intended for Codex Cloud review, local agents, and human reviewers. They prioritize product boundary, storage compatibility, accessibility, mobile, verification, and security risks. They intentionally exclude style-only comments and deterministic failures that CI already owns.

## Orca Worktree Behavior

The authoritative harness lives inside the Git repository. New Orca worktrees inherit it after normal merge/rebase from `main`. Existing worktrees pick it up through normal Git integration. No parent-level files under `/Users/jinho/orca/workspaces/IndividualSavingsFlowUI` are required.

## Verification

- `npm run check:harness`
- `npm run check:ci`
- `git diff --check`
- search workflow files for forbidden Codex Action, OpenAI API key, and `pull_request_target` markers

## Acceptance Criteria

- `AGENTS.md` includes concise `Code Review Rules`.
- Repository-local verification skill exists.
- `scripts/check-agent-harness.mjs` validates required harness files and rejects API-key Codex Action review.
- `npm run check:harness` and `npm run check:ci` pass.
- `.github/workflows/ci.yml` is the only new PR CI workflow.
- `.github/workflows/codex-review.yml` does not exist.
- `.github/codex/prompts/review.md` does not exist.
- No `.ai/` directory is introduced.
