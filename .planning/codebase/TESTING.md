# Testing Patterns

**Analysis Date:** 2026-05-12

## Test Framework

**Runner:**
- Vitest `^4.1.5` (Detected in `package.json`).

**Assertion Library:**
- Vitest default (Chai-compatible `expect`).

**Run Commands:**
```bash
npx vitest              # Run all tests (Manual execution as no script is in package.json)
npx vitest run          # CI/Single run
```

## Test File Organization

**Location:**
- Co-located with source or in `shared/core/`.
- Example: `shared/core/clipboard-parser.test.js`.

**Naming:**
- `*.test.js` or `*.spec.js`.

## Test Structure

**Legacy/Manual Pattern:**
Found in `shared/core/clipboard-parser.test.js`:
```javascript
const testCases = [
  { name: '...', input: '...', expected: { ... } }
];

testCases.forEach(tc => {
  const result = ClipboardParser.parseSms(tc.input);
  const success = ...;
  console.log(`[${tc.name}] ${success ? '✅ PASS' : '❌ FAIL'}`);
});
```

**Modern Pattern (Recommended for Vitest):**
```javascript
import { describe, it, expect } from 'vitest';
import { someFunction } from './module.js';

describe('ModuleName', () => {
  it('should behave as expected', () => {
    expect(someFunction()).toBe(true);
  });
});
```

## Mocking

**Framework:**
- Vitest (builtin `vi`).

**What to Mock:**
- Browser APIs (`localStorage`, `IndexedDB`).
- Network requests (though mostly client-side logic).

## Fixtures and Factories

**Test Data:**
- Defined as constants within test files or in `apps/step1/modules/constants.js` (e.g., `SAMPLE_INPUTS`).

## Coverage

**Requirements:**
- None enforced in `package.json`.

## Test Types

**Unit Tests:**
- Focus on `IsfUtils` and pure logic in `modules/`.
- Example: `clipboard-parser.test.js` tests SMS parsing logic.

**Integration Tests:**
- Storage migration and backup logic (`shared/storage/`).

**E2E Tests:**
- Not explicitly configured (No Playwright/Cypress detected).

## Common Patterns

**Unit Conversion Testing:**
Tests should verify the Won-to-Man and Man-to-Won consistency.
```javascript
expect(IsfUtils.toWon(1)).toBe(10000);
expect(IsfUtils.toMan(10000)).toBe(1);
```

**Error Testing:**
Verify that sanitizers handle invalid inputs gracefully.
```javascript
expect(IsfUtils.sanitizeMoney("abc")).toBe(0);
```

---

*Testing analysis: 2026-05-12*
