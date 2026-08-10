# Portfolio Summary-First Design QA

- Date: 2026-08-10
- Reviewed route: `apps/portfolio/`
- Theme/auth: light, local-only state, no authentication
- Source visual truth: [normalized 390×844 source](docs/superpowers/evidence/portfolio-summary-first/source-390-normalized.png)
- Original generated source provenance (external, not required for review): `/Users/jinho/.codex/generated_images/019fd4cb-220c-77c3-8228-057e79269eeb/exec-9a07df2b-d42c-49d9-9e14-e22eec7827b9.png`
- Primary implementation screenshot: [390×844 result](docs/superpowers/evidence/portfolio-summary-first/implementation-390-result.png)
- Final side-by-side comparison: [normalized source and implementation](docs/superpowers/evidence/portfolio-summary-first/combined-390-final.png)

## Normalization and state

- Source pixels: 852x1846. It was downsampled to the tracked [390x844 normalized source](docs/superpowers/evidence/portfolio-summary-first/source-390-normalized.png); the generated source density is approximately 2.185x relative to the 390px CSS target.
- Implementation pixels: 390x844 at a 390x844 CSS viewport and `deviceScaleFactor: 1`.
- State: Main monthly investment 800,000 won; Global Index 50% growth, Bonds 25% stable, Gold 15% stable, Cash 10% stable; amount display off; ratio sort; reduced motion enabled.
- Crop: both primary images are viewport-only with no browser chrome or device frame. The combined image places normalized source on the left and implementation on the right.

## Findings

No actionable P0, P1, or P2 findings remain.

- [P3] The implementation edit glyph is optically a little darker and larger than the generated source. The shipped `public/icons/portfolio-edit.svg` is a real asset, remains centered in a required 44x44px control, and uses the shared focus treatment. Reducing the visible glyph from 24px to 20px could make it quieter in a later polish pass.
- Acceptable intentional deviation: the source canvas is nearly flat Pearl while the implementation shows the shared AppShell's subtle green/orange Pearl radial tint. Portfolio must keep the same canvas as Main and the other apps, so no Portfolio-only background override or shared-token change was made.
- Acceptable intentional deviation: the generated source has a more sans-like display treatment. The implementation uses the approved product typography from `DESIGN.md`: Gowun Batang for the summary and ratios, Gowun Dodum for labels and copy.

## Required fidelity surfaces

- Fonts and typography: Gowun Batang/Dodum loaded before capture; the headline is bold, labels have clear optical weight, ratios retain display hierarchy, and the long Korean target does not collide with its ratio at the 200%-zoom equivalent width. No clipping or truncation was observed.
- Spacing and layout: the final 390px implementation hero starts at y=133 and the allocation surface at y=277; the source starts at approximately y=140 and y=280. Implementation rows are 128-129px high and all four end at y=792 inside the 844px viewport. At 1280px the summary remains exactly 768px wide.
- Colors and tokens: accent, stable/cash colors, line, panel, and Pearl canvas use shared product tokens. Labels and numeric values provide meaning in addition to color.
- Icon and asset quality: launcher icons use the existing shared icon set. The edit affordance loads `public/icons/portfolio-edit.svg` successfully (`naturalWidth > 0`); no emoji, CSS drawing, placeholder, or improvised inline asset replaces source imagery.
- Copy and content: `이번 달 투자금`, `안정 50%`, `글로벌 인덱스에 50%를 배분해요`, all four names, and their 50/25/15/10 percentages match the source state. Amount-on switches the heading to `이번 달 투자금 800,000원` and renders five won values across the total and four rows.
- Interactions: edit opens the allocation editor; management opens the view settings; amount display and input sort update; Escape closes management and returns focus; edit focus has a 3px visible ring; reduced motion preserves the same information.
- Accessibility: visible result controls are at least 44x44px, the edit button has the accessible name `배분 수정`, the management overlay stays within 16px viewport gutters, focus return works, and the proportional bars are decorative alongside text names and percentages.
- Responsive: 390x844, 768x900, and 1280x900 are horizontally overflow-free with all four result rows in the viewport. The 390px editor and fixed apply bar stay within 16px gutters. A 640px CSS viewport, equivalent to a 1280px desktop at 200% browser zoom, keeps the long Korean name and ratio separate without horizontal overflow.

## Comparison evidence

- Full view: [combined-390-final.png](docs/superpowers/evidence/portfolio-summary-first/combined-390-final.png) (780x844, source left/implementation right).
- Hero focus: [combined-390-final-hero-focus.png](docs/superpowers/evidence/portfolio-summary-first/combined-390-final-hero-focus.png) (780x170).
- Allocation-list focus: [combined-390-final-list-focus.png](docs/superpowers/evidence/portfolio-summary-first/combined-390-final-list-focus.png) (780x540).
- Responsive results: [implementation-768-result.png](docs/superpowers/evidence/portfolio-summary-first/implementation-768-result.png) (768x900) and [implementation-1280-result.png](docs/superpowers/evidence/portfolio-summary-first/implementation-1280-result.png) (1280x900).
- Additional states: [management open](docs/superpowers/evidence/portfolio-summary-first/implementation-390-management-open.png) (272x329 element capture from a 390x844 viewport), [amount on](docs/superpowers/evidence/portfolio-summary-first/implementation-390-amount-on.png) (390x844), [edit](docs/superpowers/evidence/portfolio-summary-first/implementation-390-edit.png) (390x844), [focus](docs/superpowers/evidence/portfolio-summary-first/implementation-390-focus.png) (390x844), and [200% zoom equivalent](docs/superpowers/evidence/portfolio-summary-first/implementation-640-zoom-200-long-name.png) (640x900).

## Iteration history

1. Initial comparison used `implementation-390-before.png` and `combined-390-before.png`. P1: hero and list were merged into one white surface instead of the source's canvas hero plus grouped list. P2: the heading lacked source weight, the edit action sat at the far edge, and 76px rows made the list much denser than the source. A Playwright regression failed with a measured 20px hero/list gap before later surface assertions.
2. `portfolio.css` changed the summary to a transparent canvas region, moved the flat surface to the allocation list, made the headline bold with an inline edit action, and restored the 390px row rhythm. The focused regression passed, and `combined-390-after-1.png` showed y-position and height alignment with the source. The shared AppShell canvas tint was reviewed and classified as an intentional product-wide constraint, not an actionable Portfolio mismatch.
3. Final browser captures rechecked 390/768/1280 result layouts plus management-open, amount-on, edit, focus, reduced-motion, and the 200%-equivalent long-name state. Every captured state reported zero console or page errors; overflow, touch-target, containment, and focus assertions passed. Final full and focused combined images showed no remaining actionable P0/P1/P2 difference.

## Implementation checklist

- [x] Preserve shared AppShell canvas, launcher, typography, and icon assets.
- [x] Match source hierarchy with canvas hero and a single proportional-list surface.
- [x] Keep four default rows visible at 390px with no horizontal overflow.
- [x] Verify amount, sort, management, edit, focus, reduced-motion, responsive, and long-name states.
- [x] Keep only P3 follow-up polish.

final result: passed
