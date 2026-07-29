# Repository Introduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the repository a natural public description while preserving the detailed financial-planning concept in README.

**Architecture:** GitHub metadata carries the short product promise. README carries the present-to-future planning narrative and leaves destination-specific details to the existing product sections.

**Tech Stack:** Markdown, GitHub repository metadata

## Global Constraints

- Keep the product's planning identity.
- Describe future asset changes as assumption-based comparisons.
- Do not enumerate technical implementation details in the GitHub description.
- Preserve the existing four-destination product boundaries.

---

### Task 1: Update the Two Introduction Layers

**Files:**
- Modify: `README.md`
- External metadata: `jinhoOps/IndividualSavingsFlowUI` description

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-29-repository-introduction-design.md`
- Produces: a concise GitHub description and a detailed README concept section

- [x] **Step 1: Add the README product concept**

Add `## 제품 컨셉` before `## 프로젝트 목표`, explaining current-flow understanding, assumption-based future comparison, and connection to actionable planning.

- [x] **Step 2: Update the GitHub description**

Run:

```bash
gh repo edit jinhoOps/IndividualSavingsFlowUI --description '지금의 돈 흐름을 이해하고, 더 나은 미래 자산 계획을 세우는 개인 재무 플래닝 도구.'
```

- [x] **Step 3: Verify**

Run:

```bash
git diff --check
rg -n '제품 컨셉|현재|미래|가정|계획' README.md
gh repo view jinhoOps/IndividualSavingsFlowUI --json description
```

- [x] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-29-repository-introduction-design.md docs/superpowers/plans/2026-07-29-repository-introduction.md
git commit -m "docs: refine repository introduction"
```
