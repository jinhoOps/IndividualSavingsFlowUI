# Task 1 Report — Baseline and refactor inventory

## Status

DONE_WITH_CONCERNS

## Scope and commit

- Worktree: `codex/refactor-shared-foundation`
- Starting commit: `2119b7d docs: plan shared refactor foundation`
- Baseline evidence commit: `0ef8fec docs: capture refactor baseline and inventory`
- Changed file: `docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md`

The baseline document contains the required headings (`Commands and results`, `Inventory`, `Intentional exceptions`, and `Follow-up risks`) and the required inventory columns. It records common UI/motion candidates, app orchestration, workspace storage/compatibility, and `apps/main/modules` legacy references with owner, consumers, focused tests, planned phase, and removal condition.

## Verification evidence

- `npm run check` — PASS (exit 0).
- `npm run test:unit` — PASS (exit 0), 96 files and 1,088 tests passed.
- `npm run test:e2e` — CONCERN (exit 1), 126 passed, 4 failed, 61 skipped / 191 total. Failures: one `actualOverflowRatio` deficit geometry assertion (expected 2, received -1) and three Main assembly-width checks expecting `app-wide-visual` while receiving `allocation-bar__visual-stage`.
- `npm run build` — PASS (exit 0), 1,986 modules transformed and PWA assets generated. The existing build script bumped version files from `0.11.94` to `0.11.95`; those generated edits were reverted and are not in the commit.
- `git status --short` — clean after the commit.
- `git diff --check` — PASS.

## CodeGraph/search notes

CodeGraph was run first as required. It resolved `AppShell`, `AppLauncher`, `Button`, `Surface`, `useReducedMotion`, `useAnimeScope`, and `animateVisualNumber`, including their consumers and focused tests, but warned that its index belongs to the parent worktree. The result was cross-checked with the required focused `rg` search in this worktree. No CodeGraph rebuild was run, per repository ownership guidance.

## Concerns and follow-up

The E2E failures are baseline concerns and must be understood before later phases use the suite to identify regressions. The four failures were not caused by this documentation-only task. The 61 skips are existing intentional suite skips and were recorded rather than changed.

The build has a generated version-bump side effect; future baseline/build runs should account for it. Legacy storage keys, `legacyPhaseA`, and `apps/main/modules` references remain intentionally preserved until Phase 4 compatibility and removal evidence exists.

Next owner: Task 2 / Phase 1 implementer should start with the approved refactor design and this baseline document, preserve the listed exceptions, and run focused common-foundation tests before broad extraction.

## Fix round 1 report

Status: DONE_WITH_CONCERNS

Addressed review findings in `docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md`:

1. Added an `Execution worktree and provenance` section with the isolated path, branch, clean-status output (`## codex/refactor-shared-foundation`), full baseline HEAD `2119b7deb27c7c48b74d3f0b3028d23b4603252`, `origin/main` full SHA and subject, merge-base, and `git rev-list --left-right --count` relationship (`2 0` from baseline to origin/main).
2. Replaced generic focused-test labels with concrete unit and app E2E paths for each inventory candidate, including `tests/{account-map,portfolio,simulation,main-react}.spec.ts` where applicable.
3. Added reproducible file/line/title references for all four E2E failures and a concise source list for the 61 intentional skips.

Verification for this fix:

- `git diff --check` — PASS (no output).
- Markdown-link scan (`rg -o '\\[[^]]+\\]\\([^)]+' docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md`) — PASS; no markdown links are present in the baseline document, so no relative links require resolution.
- `git status --short` — showed only the intended baseline document before commit.

The original baseline E2E concern remains unchanged: four failures and 61 intentional skips are documented and reproducible. No source or product behavior was changed.
