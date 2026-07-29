# Money Quick Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development.

**Goal:** Replace MoneyField reset with symmetric ±100,000 and ±500,000 won controls.

**Architecture:** Keep adjustment behavior inside the shared React `MoneyField`; reuse `adjustWon()` for clamping and preserve existing button styling.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Task 1: Change quick adjustments

**Files:**
- Modify: `tests/unit/main/MoneyField.test.tsx`
- Modify: `src/main/ui/common/MoneyField.tsx`

- [x] Write a test requiring `-50만`, `-10만`, `+10만`, `+50만` and rejecting `초기화`.
- [x] Run `npx vitest run tests/unit/main/MoneyField.test.tsx` and verify expected failure.
- [x] Add `-50만` to `adjustmentButtons` and remove reset button.
- [x] Run focused test and verify pass.
- [x] Run `npm run check && npm run test:unit`.
- [x] Run `npx playwright test tests/main-react.spec.ts`.
