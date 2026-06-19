# Phase 7: Step 1 UI/UX Refactoring & Modularization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 7-Step 1 UI/UX Refactoring & Modularization
**Areas discussed:** Step 1 UI recomposition, CSS cleanup, App.js modularization, rendering/schema safety

---

## Step 1 UI Recomposition

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve panel order | Keep Summary, Visualization, Controls, Projection, Comparison while improving hierarchy and density. | ✓ |
| Strong editorial reflow | Recompose major page structure more aggressively around `DESIGN.md`. | |
| Agent decides | Let the planner pick the final composition. | |

**User's choice:** `3` from the proposed list, interpreted as Step 1 UI recomposition.
**Notes:** Keep the current mental model and avoid broad Step 1 navigation churn. Apply the design system more consistently and protect the 768px mobile layout.

---

## CSS Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate and reduce | Remove dead CSS, merge duplicate declarations, and reuse shared tokens. | ✓ |
| Physically split now | Split into multiple CSS files regardless of measured duplication. | |
| Agent decides | Let the planner decide after inspecting import constraints. | ✓ |

**User's choice:** `2` from the proposed list, interpreted as CSS cleanup and theme consolidation.
**Notes:** The target is meaningful stylesheet reduction without breaking media-query integrity. Physical splitting is allowed if it improves maintainability after consolidation.

---

## App.js Modularization

| Option | Description | Selected |
|--------|-------------|----------|
| Extract major responsibilities | Move initialization, bindings, rendering orchestration, and persistence handlers out of `app.js`. | ✓ |
| Minimal cleanup only | Keep `app.js` mostly intact and remove only obvious duplication. | |
| Full rewrite | Rebuild Step 1 orchestration from scratch. | |

**User's choice:** `1` from the proposed list, interpreted as major but conservative `app.js` modularization.
**Notes:** Preserve the existing 3-layer architecture and vanilla ES module runtime. Avoid unnecessary churn in small helpers.

---

## Rendering And Schema Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Include safety hardening | Review `innerHTML` renderers, escaping, external data merge points, and lightweight guards. | ✓ |
| Defer safety hardening | Limit this phase to visual/CSS/module cleanup. | |
| Agent decides | Let the planner include only issues discovered during implementation. | |

**User's choice:** `4` from the proposed list, interpreted as including security and runtime guard improvements in Phase 7.
**Notes:** Use existing escaping and sanitization helpers first. Add new schema utilities only when existing helpers are insufficient.

---

## The Agent's Discretion

- Exact module filenames and extraction sequence.
- Whether CSS is physically split after consolidation.
- Specific mobile collapse behavior for lower-priority panels.

## Deferred Ideas

- Step 2 IndexedDB fallback and private-mode storage behavior.
- Step 2 initial-data warning banner UX.
- Step 2 simulation table mobile redesign.
- Broad Step 1 React migration.
- Whole-architecture replacement of the global storage bridge.
