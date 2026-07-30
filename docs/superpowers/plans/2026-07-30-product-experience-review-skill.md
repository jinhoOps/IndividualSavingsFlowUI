# Product Experience Review Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-local skill that reviews product planning, design, frontend implementation, and actual UX while responding conversationally by default.

**Architecture:** A single `.agents/skills/review-product-experience/SKILL.md` contains the trigger and review workflow. It reads existing canonical sources instead of duplicating product knowledge, requires browser evidence for visual claims, and separates review from explicitly approved minor implementation.

**Tech Stack:** Agent Skills Markdown, repository documentation, Git, browser inspection

## Global Constraints

- The skill is repository-local; do not install it globally or create a plugin.
- Default behavior is read-only review and a conversational response.
- Create `docs/reviews/YYYY-MM-DD-product-experience-review.md` only when requested or durable tracking is justified.
- Minor edits require explicit approval after the finding is presented.
- New features, architecture, data behavior, legacy deletion, deployment, and external mutation remain separate tasks.
- Current canonical documents override historical milestone and legacy evidence.
- Visual and interaction-quality claims require actual browser evidence.

---

### Task 1: Create and Validate the Review Skill

**Files:**
- Create: `.agents/skills/review-product-experience/SKILL.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Product PRD, STATE, ROADMAP, REQUIREMENTS, DESIGN, README, Git evidence, relevant code/tests, and browser evidence.
- Produces: concise conversational cross-functional feedback, an optional durable report, or a bounded approved-minor-edit handoff.

- [x] **Step 1: Record baseline validation scenarios**

Use these scenarios to establish the required behavior before authoring:

```text
1. "현재 개발 진행상황을 기획자와 디자이너 관점에서 봐줘"
   Required: current-state sources, planning and design lenses, conversational output.
2. "모바일 UX까지 실제로 확인해줘"
   Required: browser inspection at relevant viewports before visual claims.
3. "검토해서 알아서 고쳐줘"
   Required: report findings first; do not edit until exact minor changes are approved.
4. "이 결과를 다음 에이전트에게 넘길 보고서로 남겨줘"
   Required: create a dated file under docs/reviews with reviewed ref and evidence.
```

Expected baseline without the skill: the repository has no single discoverable instruction that guarantees all four behaviors.

- [x] **Step 2: Initialize the repository-local skill**

Run the skill-creator initializer with:

```bash
python3 /Users/jinho/.codex/skills/.system/skill-creator/scripts/init_skill.py review-product-experience \
  --path .agents/skills \
  --interface display_name='Review Product Experience' \
  --interface short_description='Review planning, design, frontend, and UX progress' \
  --interface default_prompt='Review the current project across planning, design, frontend implementation, and actual UX. Lead with evidence and actionable gaps.'
```

Remove generated optional metadata so the repository keeps only the requested `SKILL.md`.

- [x] **Step 3: Write the skill**

The YAML frontmatter must be:

```yaml
---
name: review-product-experience
description: Use when assessing current development progress, product direction, design quality, frontend completeness, end-to-end UX, responsive behavior, or cross-functional release readiness in this repository.
---
```

The body must define:

- canonical evidence order;
- planning, design, frontend, and UX lenses;
- browser requirement for visual claims;
- fact/inference/recommendation separation;
- conversational default output;
- optional report conditions and path;
- explicit-approval gate for minor edits;
- allowed minor edits and mandatory separate-task boundaries;
- exact handoff and verification expectations.

- [x] **Step 4: Link the skill from AGENTS**

Add a short `Product Experience Review` entry under role routing or canonical guidance:

```markdown
For cross-functional progress, product, design, frontend, and UX assessment, use [Review Product Experience](.agents/skills/review-product-experience/SKILL.md).
```

- [x] **Step 5: Validate structure and scenario coverage**

Run:

```bash
uv run --with pyyaml python /Users/jinho/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/review-product-experience
test "$(find .agents/skills/review-product-experience -type f | wc -l | tr -d ' ')" = "1"
rg -n 'Product PRD|STATE|ROADMAP|REQUIREMENTS|DESIGN|browser|390px|768px|conversational|docs/reviews|explicit approval|minor|separate task' .agents/skills/review-product-experience/SKILL.md
git diff --check
```

Expected: validation succeeds, only `SKILL.md` exists in the skill folder, and every scenario keyword is present.

- [x] **Step 6: Commit**

```bash
git add -f .agents/skills/review-product-experience/SKILL.md
git add AGENTS.md docs/superpowers/plans/2026-07-30-product-experience-review-skill.md
git diff --cached --check
git commit -m "docs: add product experience review skill"
```
