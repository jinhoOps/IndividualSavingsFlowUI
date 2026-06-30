# Quick 260630-cqu Summary

## Result

- Moved the Main Account Map summary out of the financial settings summary and placed it immediately after 월 가계 흐름.
- Updated the Main summary language so it explains that Account Map is a separate view for account connections and recurring payment candidates, not part of the Sankey household flow.
- Replaced ambiguous metrics with 계좌 후보, 연결 후보, and 결제 후보.
- Added explicit SVG colors for Account Map nodes and labels to prevent black node fallback rendering.
- Added Playwright regressions for Main placement/copy and Account Map node contrast.

## Verification

- `npm run check` passed.
- `npx playwright test tests/account-map.spec.ts --reporter=line` passed: 8 tests.
- `npx playwright test tests/step1.spec.ts --reporter=dot` passed: 69 tests.
