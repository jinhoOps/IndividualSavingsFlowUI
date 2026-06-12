---
phase: 2
slug: core-components-layout
status: approved
audited_at: 2026-06-13
overall_score: 23
---

# Phase 2 — UI Review

**Audited:** 2026-06-13
**Baseline:** UI-SPEC.md (aligned with DESIGN.md)
**Screenshots:** not captured (code-only analysis due to headless server environment)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Standard labels are followed, and error states are Korean-localized. |
| 2. Visuals | 4/4 | Sankey height capped at 440px (mobile 360px), matching the fixed 460px container to fit onto a single screen. |
| 3. Color | 4/4 | Focus rings and component hover outlines are fully unified with `--tone-primary`. |
| 4. Typography | 4/4 | Gowun Batang (serif) and Gowun Dodum (sans-serif) are correctly applied to Display/Body roles. |
| 5. Spacing | 4/4 | All toolbar control elements are strictly aligned to a 32px height standard with unified curves. |
| 6. Experience Design | 4/4 | PNG image export fixed by removing external @import, bypassing browser sandbox blocks. |

**Overall: 23/24 (APPROVED)**

---

## Top 3 Priority Fixes

1. *Resolved* **Sankey Chart Vertical Overflow** — Aspect ratio and height clamping (height 460px card / max-height 440px SVG) successfully locked in.
2. *Resolved* **PNG Export Rendering Failure** — Web Fonts `@import` cross-origin block resolved.
3. *Resolved* **Curvature & Toolbar Controls Alignment** — All control buttons, select boxes, and labels in the toolbar are unified to a strict 32px height standard.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Form input labels and buttons strictly use Korean labels as specified in `02-UI-SPEC.md` ("항목 편집", "항목 변경 적용").
- Non-destructive CTAs and warnings generally align with specs.

### Pillar 2: Visuals (4/4)
- *Resolved:* The Sankey chart height calculations have been refactored in `sankey-renderer.js` line 185, limiting SVG max height to 440px (mobile 360px).
- *Resolved:* The Sankey container wrapper `.sankey-wrap` is set to `height: 460px` (mobile `380px`), creating a clean, scrolling-free layout fit for single-page dashboard viewing.

### Pillar 3: Color (4/4)
- Focus rings on input fields use `--tone-primary` and transition smoothly.
- Hardcoded colors in CSS are aligned under variable tokens.

### Pillar 4: Typography (4/4)
- Gowun Batang (serif) and Gowun Dodum (sans-serif) correctly structure visual weights. Font-family variables are aligned.

### Pillar 5: Spacing (4/4)
- *Resolved:* All control elements in the Sankey toolbar (view amount/percent toggle, sort select mode, zoom buttons, and zoom indicators) are aligned to a strict 32px height standard.
- *Resolved:* Corner curves are unified under `var(--rd-sm)` for inputs/buttons and `var(--rd-md)` for container panels.

### Pillar 6: Experience Design (4/4)
- *Resolved:* PNG image export renders successfully. External Google Fonts `@import` inside the SVG context has been removed to bypass sandbox network restrictions.

---

## Files Audited

- `apps/step1/styles.css`
- `apps/step1/modules/sankey-renderer.js`
- `src/styles/globals.css`
- `apps/step1/index.html`
