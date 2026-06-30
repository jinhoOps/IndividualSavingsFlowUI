# Quick 260630-cqu Plan

## Task

Move the Main Account Map summary so it follows the 월 가계 흐름 section, clarify what the summary is showing, and fix unreadable black nodes on the dedicated Account Map page.

## Scope

- Keep Main Sankey account-free and preserve the existing household-flow intent.
- Reposition the Account Map entry as a separate follow-up panel after 월 가계 흐름.
- Rewrite the entry copy and metric labels around account candidates, relationship candidates, and fixed-payment candidates.
- Make Account Map SVG node fill, stroke, and text colors explicit so browser fallback rendering cannot turn nodes black.
- Add focused regression coverage for placement, copy, route link, and node contrast.

## Verification

- `npm run check`
- `npx playwright test tests/account-map.spec.ts --reporter=line`
- `npx playwright test tests/step1.spec.ts --reporter=dot`
