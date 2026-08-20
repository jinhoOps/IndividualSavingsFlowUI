# Repository Codex Harness Implementation Record

> Current scope: CI-only repository harness. Do not recreate API-key based Codex GitHub Action review.

**Goal:** Keep a Git-tracked repository harness with deterministic CI, `AGENTS.md` review rules, and repository-local verification guidance.

**Architecture:** `AGENTS.md` is the root instruction and review-rule entry point. `.agents/skills/verify-repository-change` routes agents to the right documents and verification evidence. `scripts/check-agent-harness.mjs` enforces the harness shape, and `.github/workflows/ci.yml` runs deterministic PR/main checks.

**Tech Stack:** Markdown, Codex Agent Skills, Node.js 22 ESM, npm scripts, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-20-repository-codex-harness-design.md`

## Current Files

- `AGENTS.md`: repository guide and `Code Review Rules`.
- `.agents/skills/review-product-experience/SKILL.md`: existing product review skill.
- `.agents/skills/verify-repository-change/SKILL.md`: repository verification skill.
- `.github/workflows/ci.yml`: deterministic CI.
- `scripts/check-agent-harness.mjs`: harness checker.
- `package.json`: `check:harness` and `check:ci`.

## Removed From Scope

- `.github/workflows/codex-review.yml`
- `.github/codex/prompts/review.md`
- Codex Action
- OpenAI API key

Review automation that depends on an OpenAI API key is not part of this repository harness. Review guidance remains in `AGENTS.md` so Codex Cloud, local agents, and human reviewers can use the same rules without a repository secret.

## Verification Commands

Run:

```bash
npm run check:harness
npm run check:ci
git diff --check
rg -n "openai/codex-action|OPENAI_API_KEY|pull_request_target" .github scripts package.json AGENTS.md
```

Expected:

- harness check passes;
- TypeScript and Vitest pass through `check:ci`;
- whitespace check prints no output;
- forbidden marker search reports only intentional checker guard strings, not workflow or package usage.

## Handoff Notes

- GitHub branch protection should require the `CI` workflow if remote enforcement is desired.
- GitHub Actions itself is the final authority for workflow syntax after push.
- Existing Orca worktrees need normal merge or rebase from `main` to pick up these files.
