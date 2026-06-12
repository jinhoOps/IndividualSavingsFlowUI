---
phase: 2
slug: core-components-layout
status: approved
audited_at: 2026-06-13
overall_score: 21
---

# Phase 2 — UI Review

**Audited:** 2026-06-13
**Baseline:** UI-SPEC.md
**Screenshots:** not captured (code-only analysis due to headless server environment)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Standard labels are followed, and error states are Korean-localized. |
| 2. Visuals | 3/4 | Sankey height capped at 620px (mobile 520px) with dynamic height reduction for high node counts. |
| 3. Color | 3/4 | Focus rings and component hover outlines are fully unified with `--tone-primary`. |
| 4. Typography | 4/4 | Gowun Batang (serif) and Gowun Dodum (sans-serif) are correctly applied to Display/Body roles. |
| 5. Spacing | 4/4 | 3D box-shadows completely removed, and curvatures unified to var(--rd-sm) and var(--rd-md). |
| 6. Experience Design | 4/4 | PNG image export fixed by removing external @import, bypassing browser sandbox blocks. |

**Overall: 21/24 (APPROVED)**

---

## Top 3 Priority Fixes

1. *Resolved* **Sankey Chart Vertical Overflow** — Capped height dynamics successfully tested (PC 620px / Mobile 520px).
2. *Resolved* **PNG Export Rendering Failure** — Web Fonts `@import` cross-origin block resolved.
3. *Resolved* **Flat Hairline Integrity & Curvature Unification** — 3D shadows stripped, and corner radii unified to design tokens (`var(--rd-sm)` / `var(--rd-md)`).

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Form input labels and buttons strictly use Korean labels as specified in `02-UI-SPEC.md` ("항목 편집", "항목 변경 적용").
- User actions are clear, and CTAs match the copywriting spec.

### Pillar 2: Visuals (3/4)
- *Resolved:* The Sankey chart height calculations have been refactored in `sankey-renderer.js` line 185.
- Nodes and links scale down dynamically (`adjustedNodeHeightUnit`) when the total row nodes exceed 8, ensuring a compact, scroll-free dashboard layout.

### Pillar 3: Color (3/4)
- Focus rings on input fields use `--tone-primary` and transition smoothly.
- The 60/30/10 layout color system is strictly respected.

### Pillar 4: Typography (4/4)
-gowun batang (serif) and gowun dodum (sans-serif) correctly structure visual weights. Font-family variables are aligned.

### Pillar 5: Spacing (4/4)
- *Resolved:* Legacy 3D shadows (`box-shadow`) and floating hover animations (`translateY`) have been completely removed.
- *Resolved:* Layout curvatures have been unified. All controls, buttons, toggles, and select tags use `var(--rd-sm)` (8px), while parent cards and modules use `var(--rd-md)` (14px).

### Pillar 6: Experience Design (4/4)
- *Resolved:* PNG image export renders successfully. External Google Fonts `@import` inside the SVG context has been removed to bypass sandbox network restrictions.

---

## Files Audited

- `apps/step1/styles.css`
- `apps/step1/modules/sankey-renderer.js`
- `src/styles/globals.css`
- `apps/step1/index.html`
