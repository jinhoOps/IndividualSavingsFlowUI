---
phase: 2
slug: core-components-layout
status: draft
audited_at: 2026-06-13
overall_score: 12
---

# Phase 2 — UI Review

**Audited:** 2026-06-13
**Baseline:** UI-SPEC.md
**Screenshots:** not captured (code-only analysis due to headless server environment)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Standard labels are generally followed, but some error states could be more specific. |
| 2. Visuals | 1/4 | Sankey chart overflows viewport height limit and loses layout balance when node count increases. |
| 3. Color | 2/4 | Legacy color schemes are mixed, and the 60/30/10 color split is diluted. |
| 4. Typography | 3/4 | Correct display/body fonts applied but weight constraints are loosely enforced. |
| 5. Spacing | 2/4 | Floating shadows and arbitrary margins break flat hairline visual rules. |
| 6. Experience Design | 1/4 | Sankey PNG image export fails to render, rendering the download feature broken. |

**Overall: 12/24**

---

## Top 3 Priority Fixes

1. **Sankey Chart Vertical Overflow** — Chart height scales infinitely based on node count, causing severe vertical stretching — Restructure height calculation with a maximum height limit or dynamic scale scaling.
2. **PNG Export Rendering Failure** — SVG image export fails because the cloned SVG attempts to load external fonts via `@import`, triggering sandbox security blocks — Remove `@import` from SVG styles and default to safe fallback fonts.
3. **Flat Hairline Integrity Violation** — Legacy 3D shadows (`box-shadow`) and translate animations are still active, contradicting the flat editorial styling — Strip away shadow styles and align completely with flat hairline border aesthetics.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Form input labels and buttons strictly use Korean labels as specified in `02-UI-SPEC.md` ("항목 편집", "항목 변경 적용").
- Non-destructive CTAs and warnings generally align with specs.
- *Recommendation:* Add more explicit instruction details when the error state triggers.

### Pillar 2: Visuals (1/4)
- **BLOCKER:** In `apps/step1/modules/sankey-renderer.js` line 185, height scales infinitely based on `maxCountPerColumn * nodeHeightUnit`. For portfolios with multiple accounts and allocations, the height extends beyond 1200px, causing the entire screen to scroll and breaking the single-dashboard visibility.
  - *Fix:* Caps the maximum height (e.g., max 600px) and scale node heights/gaps dynamically when node count exceeds a threshold.

### Pillar 3: Color (2/4)
- Legacy hardcoded colors (like `#334155`, `#64748b` in `sankey-renderer.js`) still exist alongside the CSS variable themes.
- Accent color (`--tone-primary`) is sometimes applied on decorative components, diluting the 10% accent rule.

### Pillar 4: Typography (3/4)
- "Gowun Batang" (serif) and "Gowun Dodum" (sans-serif) are declared in `globals.css` and loaded correctly.
- Some inline components bypass style variables and specify generic sans-serif weights.

### Pillar 5: Spacing (2/4)
- **BLOCKER:** Flat Hairline design mandates the complete removal of shadows. However, `apps/step1/styles.css` still contains legacy floating card shadows:
  - Line 2286: `box-shadow: 0 4px 12px rgba(16, 34, 32, 0.05);` and `transform: translateY(-2px);` on hover.
  - Line 242/266: `box-shadow: 0 2px 8px rgba(0,0,0,0.08);`.
  - These give cards a 3D float look, which directly violates the flat editorial guidelines.
  - *Fix:* Remove all `box-shadow` values from cards, headers, and buttons, maintaining flat `1px solid var(--line)` borders.

### Pillar 6: Experience Design (1/4)
- **BLOCKER:** PNG Export feature is broken. In `sankey-renderer.js` line 493:
  - `@import url('https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap');` is injected inside the cloned SVG style.
  - SVG blobs loaded into `img.src` are sandboxed by browsers and refuse network requests (such as Google Fonts). This crashes the `img.onload` handler or paints a blank canvas.
  - *Fix:* Remove `@import` from SVG export style and map basic fallback system fonts inside the exported SVG context.

---

## Files Audited

- `apps/step1/styles.css`
- `apps/step1/modules/sankey-renderer.js`
- `src/styles/globals.css`
- `apps/step1/index.html`
