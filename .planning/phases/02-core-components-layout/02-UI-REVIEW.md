---
phase: 2
slug: core-components-layout
status: approved
audited_at: 2026-06-13
overall_score: 24
---

# Phase 2 — UI Review

**Audited:** 2026-06-13
**Baseline:** UI-SPEC.md (aligned with DESIGN.md)
**Screenshots:** not captured (verified via automated Playwright test suite `tests/step1.spec.ts`)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All labels are Korean-localized. Destructive warnings correctly utilize specified money formatters. |
| 2. Visuals | 4/4 | Sankey height capped at 440px (mobile 360px). Zoom applies only to viewBox width and CSS width (px) to prevent vertical stretching. |
| 3. Color | 4/4 | Focus rings and hover outlines unified with `--tone-primary` (#ea5b2a) or `--tone-accent` (#1e8b7c). |
| 4. Typography | 4/4 | Gowun Batang (serif) headings and Gowun Dodum (sans-serif) body font stack are fully utilized. |
| 5. Spacing | 4/4 | Default `.btn` curvature unified to `var(--rd-sm)` (8px) to align with inputs. `.sankey-view-btn` height locked to 28px for perfect vertical centering inside the 32px toggle container. |
| 6. Experience Design | 4/4 | PNG export uses base64 encoding to prevent encoding failures and features a dual-layer SVG fallback if canvas conversion fails. |

**Overall: 24/24 (APPROVED)**

---

## Top 3 Priority Fixes

1. *Resolved* **Curvature Unification** — Modified `.btn` in `step-theme.css` to use `var(--rd-sm)` (8px) instead of the oversized `var(--rd-lg)` (999px) pill shape. Restressed `var(--rd-lg)` strictly to primary CTAs (`.btn-primary`), resolving the chaotic mismatch between input curves and buttons.
2. *Resolved* **Non-Stretching Sankey SVG Zoom** — Refactored zoom styles in `sankey-renderer.js` to change only the coordinate width and CSS width, keeping height locked to CSS px bounds, entirely eliminating vertical page stretching on zoom.
3. *Resolved* **Robust PNG Export & Fallback** — Replaced direct blob URL image source assignment with unicode-safe Base64 serialization, adding a fail-proof direct SVG download fallback to bypass restrictive browser sandboxes.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
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
- `tests/step1.spec.ts`
