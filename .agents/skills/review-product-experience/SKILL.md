---
name: review-product-experience
description: Use when assessing current development progress, product direction, design quality, frontend completeness, end-to-end UX, responsive behavior, or cross-functional release readiness in this repository.
---

# Review Product Experience

## Purpose

Review the project as one product experience across planning, design, frontend, and UX. Establish facts from current sources, inspect the real UI when needed, and lead with actionable findings rather than document summaries.

## Evidence Order

Read only what the scope needs, in this order:

1. `AGENTS.md`
2. Product PRD
3. `.planning/STATE.md`
4. `.planning/ROADMAP.md`
5. `.planning/REQUIREMENTS.md`
6. `DESIGN.md`
7. `README.md`
8. recent commits and `git status`
9. relevant code and tests
10. local or deployed browser UI

Current canonical sources override historical milestones and legacy code. Never present roadmap percentage as product completion without explaining what it counts.

## Review Workflow

1. Confirm scope, target ref, and whether the user wants conversation or a durable report.
2. Establish current, migration, and future product boundaries.
3. Compare status and roadmap claims with recent implementation, routes, tests, and UI.
4. Inspect code only where it verifies a material claim.
5. Use the browser before judging visuals or interactions. Check relevant flows at 390px, 768px, and desktop.
6. Separate facts, inferences, and recommendations.
7. Return confirmed strengths, actionable gaps, decisions needed, and recommended next actions.

## Review Lenses

- **Planning:** user value, scope, priorities, dependencies, metrics, acceptance criteria, unresolved decisions.
- **Design:** hierarchy, DESIGN consistency, responsive behavior, accessibility, copy, feedback, current versus readiness presentation.
- **Frontend:** routes, state ownership, loading/empty/error/recovery states, compatibility, legacy isolation, observable tests.
- **UX:** first-use comprehension, primary-task discovery, cognitive load, action feedback, cross-destination continuity, mobile recovery.

Ignore style preferences without user impact. Cite paths, commits, tests, or browser evidence for material claims.

## Output

Respond conversationally by default:

1. current product state;
2. highest-impact findings;
3. planning feedback;
4. design and UX feedback;
5. frontend evidence and risks;
6. next recommended decision.

Create `docs/reviews/YYYY-MM-DD-product-experience-review.md` only when the user requests a report, another owner needs a handoff, findings need longitudinal tracking, or the review is a release/milestone gate. Record the reviewed branch or commit.

## Change Authority

Review is read-only until findings are presented. Apply a minor change only after explicit approval of the exact change.

Approved minor changes may include:

- documentation status, links, terminology, or consistency;
- user-facing copy;
- narrow accessibility labels or semantic attributes;
- small CSS presentation fixes without data, navigation, or state impact;
- focused test expectations that align with an already-approved contract.

Use a separate task for features, routes, data/calculation/persistence/compatibility changes, architecture, legacy deletion, broad redesign, deployment, release, or external mutation.

Before editing, name exact files and verification. Preserve unrelated work, follow `AGENTS.md`, and report changed files, verification evidence, remaining risk, and next owner.
