# Testing Patterns

**Analysis Date:** [YYYY-MM-DD]

## Test Framework

**Runner:**
- Vitest (`^4.1.5`)
- Config: Managed primarily via default Vite config (`vite.config.ts`).

**Run Commands:**
```bash
npx vitest              # Run all tests
```

## Test File Organization

**Location:**
- Co-located with the implementation logic in core directories.

**Naming:**
- `*.test.ts` or `*.test.js`
- Examples: `src/core/backtest/engine.test.ts`, `shared/core/clipboard-parser.test.js`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('BacktestEngine', () => {
  describe('LumpSum Simulation (거치식)', () => {
    it('배당 재투자 없이 정확한 수익률을 계산해야 한다', () => {
      // Setup
      // Execute
      // Assert
      expect(result.totalReturn).toBeCloseTo(0.21, 2);
    });
  });
});
```

**Patterns:**
- Extensive use of `describe` blocks to group related test cases by logical feature or edge case.
- `expect().toBeCloseTo()` is heavily utilized for floating-point financial calculations and ROI.
- Test case descriptions (`it`) are written descriptively in Korean.

## Manual Validation

**UI/UX Responsiveness:**
- Manual validation is strictly required for UI/UX responsiveness.
- Focus specifically on the `760px` breakpoint to ensure seamless transition between mobile and desktop views.

**Release & Version Sync:**
- Version sync verification is required prior to build.
- Ensures `package.json` version (`v0.10.0`) properly propagates to `__APP_VERSION__` and `manifest.webmanifest` via `npm run sync-version`.

---

*Testing analysis: [YYYY-MM-DD]*