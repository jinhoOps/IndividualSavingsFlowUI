# Task 2 Report: Interactive Donut Summary

## Result

- Status: DONE
- Commit: `1533f87 feat(main): add cashflow donut`

## Changed files

- `src/main/ui/dashboard/CashflowDonutSummary.tsx`: Accessible SVG cashflow donut, center summary, interactive legend, and shared detail tooltip.
- `src/main/ui/main.css`: Donut colors, layout, 44px legend targets, segment transitions, and reduced-motion behavior.
- `tests/unit/main/CashflowDonutSummary.test.tsx`: Normal, focus/tap, zero-income, and deficit behavior coverage.

## TDD evidence

- RED: `npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx`
  - Failed as expected: Vite could not resolve `CashflowDonutSummary` because the component did not yet exist.
- GREEN: `npx vitest run tests/unit/main/CashflowDonutSummary.test.tsx`
  - Passed: 4 tests.
- Verification: `npm run check`
  - Passed: source and unit TypeScript checks.

## Self-review

- Ran `git diff --check`: no whitespace errors.
- Confirmed normal chart accessibility text, all legend controls, focus/tap tooltip state, zero-income guidance, and deficit-only `소득 초과` text are directly covered.
- Confirmed each SVG segment uses `pathLength="100"`, cumulative dash offset, and `-90deg` rotation; legend buttons retain 44px minimum targets for zero/tiny segments.
- Confirmed reduced-motion removes donut segment transitions.

## Concerns

- The component is intentionally standalone per Task 2 brief and is not yet mounted in `SummaryDashboard`; integration is owned by a later task.

## Fix round 1/5: Deficit visual clipping

- Status: DONE
- Commit: pending
- Changed files:
  - `src/main/domain/cashflowInsight.ts`: preserve actual income-relative percentages for deficits; retain the existing zero-income normalization used when no income is available.
  - `src/main/ui/dashboard/CashflowDonutSummary.tsx`: clip each segment in consumption → saving → investment order at the remaining 100% arc length.
  - `tests/unit/main/cashflowInsight.test.ts`: verifies deficit allocations remain 70%, 30%, 30% rather than being renormalized.
  - `tests/unit/main/CashflowDonutSummary.test.tsx`: verifies the rendered SVG uses 56.25%, 9.375%, then the remaining 34.375% investment arc.
- RED: `npx vitest run tests/unit/main/cashflowInsight.test.ts tests/unit/main/CashflowDonutSummary.test.tsx`
  - Failed as expected: the domain returned normalized 53.85% / 23.08% / 23.08% allocations and the SVG began with a 50% consumption arc.
- GREEN: `npx vitest run tests/unit/main/cashflowInsight.test.ts tests/unit/main/CashflowDonutSummary.test.tsx`
  - Passed: 26 tests.
- Verification: `npm run check` and `git diff --check`
  - Passed.
- Self-review: confirmed displayed legend/accessibility percentages remain actual income-relative values, the center deficit label remains visible, and the third segment is clipped only after the preceding two actual-income segments consume the available arc.
- Concern: clipped overflow intentionally has no separate visual segment; AllocationBar remains the detailed overflow presentation.
