# Testing Patterns

**Analysis Date:** 2026-06-29

## Test Framework

**Runner:**
- Playwright `@playwright/test` `^1.60.0` is the configured runner for browser coverage.
- Config: `playwright.config.ts`
- `playwright.config.ts` sets `testDir: './tests'`, `fullyParallel: false`, `workers: 1`, `reporter: 'list'`, Chromium-only project, and `serviceWorkers: 'block'`.
- `playwright.config.ts` starts Vite with `node ./node_modules/vite/bin/vite.js --host 127.0.0.1` and uses `http://localhost:5173/IndividualSavingsFlowUI/` as the base URL.

**Assertion Library:**
- Playwright `expect` from `@playwright/test`, used in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- The standalone `shared/core/clipboard-parser.test.js` does not use an assertion library; it prints PASS/FAIL with `console.log`.

**Run Commands:**
```bash
npm run test:e2e        # Run all configured Playwright tests in tests/
npx playwright test     # Equivalent direct Playwright run
npm run check           # TypeScript compiler gate for src/, apps/, and shared/
```

## Test File Organization

**Location:**
- Configured E2E tests live in `tests/`, specifically `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- A standalone parser test lives beside its implementation at `shared/core/clipboard-parser.test.js`, but this file is not under the `testDir` configured in `playwright.config.ts`.
- Playwright artifacts are written under `test-results/`, such as `test-results/.last-run.json`; screenshot paths in tests also target `test-results/`.

**Naming:**
- Use `*.spec.ts` for Playwright tests under `tests/`, as in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Avoid new `*.test.js` console scripts like `shared/core/clipboard-parser.test.js` unless they are wired into a script or converted to a configured runner.

**Structure:**
```text
tests/
├── step1.spec.ts       # Main app UI, data, sanitizer, Sankey, financial-modal, responsive contracts
└── step2.spec.ts       # Simulation app tutorial, storage/import, strategy comparison, mobile UI contracts

shared/core/
└── clipboard-parser.test.js  # Standalone console-driven parser checks, not configured by Playwright
```

## Test Structure

**Suite Organization:**
```typescript
// tests/step2.spec.ts
import { test, expect } from '@playwright/test';

const STEP1_SOURCE = {
  version: 2,
  updatedAt: Date.now(),
  incomes: [],
  expenseItems: [],
  savingsItems: [],
  investItems: [],
};

test.describe('Step 2 Phase 08 storage and import contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((source) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('isf-step1-active', JSON.stringify(source));
    }, STEP1_SOURCE);
  });

  test('Phase 08 Step 1 import keeps Step 2 edits local and reset re-imports the source', async ({ page }) => {
    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#totalMonthlyInvestCapacity');
    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('1,750,000');
  });
});
```

**Patterns:**
- Group tests by app step and phase/regression topic with `test.describe`, as in `tests/step1.spec.ts` suites for Main UI audits, Phase 09, Phase 10.6, and final responsive flows.
- Reset browser storage in `test.beforeEach` with `page.addInitScript`, clearing `localStorage`, `sessionStorage`, and sometimes IndexedDB in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Navigate with relative app entry paths such as `apps/main/index.html` in `tests/step1.spec.ts` and `apps/simulation/index.html` in `tests/step2.spec.ts`.
- Use locator assertions for visible UI state, such as `await expect(page.locator('#totalInitialAsset')).toHaveValue(...)` and `await expect(modal).toBeVisible()` in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Use `page.evaluate` and dynamic `import('/IndividualSavingsFlowUI/...')` to exercise module-level contracts from the browser runtime, as in `tests/step1.spec.ts` importing `apps/main/modules/input-sanitizer.js` and `apps/main/modules/sankey-builder.js`.
- Assert layout and responsive behavior through `boundingBox`, `getComputedStyle`, document overflow checks, viewport loops, and screenshots in `tests/step1.spec.ts` and `tests/step2.spec.ts`.

## Mocking

**Framework:** Playwright browser context and hand-written fakes

**Patterns:**
```typescript
// tests/step2.spec.ts
const result = await page.evaluate(async () => {
  const [{ state }, { featureController }] = await Promise.all([
    import('/IndividualSavingsFlowUI/apps/simulation/modules/state.js'),
    import('/IndividualSavingsFlowUI/apps/simulation/modules/feature-controllers.js'),
  ]);

  const failingHub = {
    saveStep2Entry: async () => { throw new Error('IDB_BLOCKED_SAVE'); },
    listStep2Entries: async () => { throw new Error('IDB_BLOCKED_LIST'); },
    getStep2EntryById: async () => { throw new Error('IDB_BLOCKED_LOAD'); },
    deleteStep2Entry: async () => { throw new Error('IDB_BLOCKED_DELETE'); },
    triggerAutoBackup: async () => ({ created: false }),
  };
  window.IsfStorageHub = failingHub;
  window.IsfHubStorage = failingHub;

  await featureController.saveCurrent();
  return { savedId: state.currentSimulationId };
});
```

**What to Mock:**
- Mock browser storage bridge failures by replacing `window.IsfStorageHub` and `window.IsfHubStorage`, as in `tests/step2.spec.ts`.
- Mock dialog behavior with `page.once('dialog', ...)` or `page.on('dialog', ...)`, as in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Seed app state through `localStorage.setItem` in `page.addInitScript` or through runtime module imports in `page.evaluate`, as in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Use malicious string fixtures in browser-state tests to verify DOM escaping and injection safety, such as account and group option tests in `tests/step1.spec.ts`.

**What NOT to Mock:**
- Do not mock DOM rendering when testing UI contracts; tests assert actual rendered elements in `apps/main/index.html` and `apps/simulation/index.html`.
- Do not mock calculation modules when validating financial results; tests import real calculators such as `apps/simulation/modules/calculator.js`, `apps/simulation/modules/comparison-calculator.js`, `apps/main/modules/calculator.js`, and `apps/main/modules/sankey-builder.js`.
- Do not rely on service worker behavior in E2E tests because `playwright.config.ts` blocks service workers.

## Fixtures and Factories

**Test Data:**
```typescript
// tests/step2.spec.ts
const STEP1_SOURCE = {
  version: 2,
  updatedAt: Date.now(),
  incomes: [],
  expenseItems: [],
  savingsItems: [],
  investItems: [],
  horizonYears: 18,
  startInvest: 25000000,
  monthlyInvest: 1750000,
};
```

**Location:**
- Inline fixtures are defined near the suite that uses them, such as `STEP1_SOURCE` at the top of `tests/step2.spec.ts`.
- Larger state fixtures are constructed inside individual `page.evaluate` calls in `tests/step1.spec.ts`, often passed through `sanitizeInputs` from `apps/main/modules/input-sanitizer.js`.
- Reusable Playwright helper functions live at the top of the spec file, such as `openControlsPanel` and `openFinancialAddMenu` in `tests/step1.spec.ts`.

## Coverage

**Requirements:** None enforced. No coverage script is present in `package.json`, and no coverage configuration was detected in `playwright.config.ts`, Vitest config, Jest config, or package scripts.

**View Coverage:**
```bash
Not detected
```

## Test Types

**Unit Tests:**
- Minimal configured unit-test coverage. `shared/core/clipboard-parser.test.js` exercises `shared/core/clipboard-parser.js` with inline cases but is not part of the Playwright test directory or `package.json` scripts.
- `vitest` and `@vitest/ui` are present in `package.json`, but no `vitest.config.*` file or `npm test` script is present.

**Integration Tests:**
- Browser-level integration tests dominate. `tests/step1.spec.ts` and `tests/step2.spec.ts` combine UI interactions, runtime module imports, localStorage, IndexedDB cleanup, storage hub fakes, DOM rendering, and calculator outputs.
- Module contract checks are run inside the real browser with `page.evaluate`, such as sanitizer, Sankey topology, strategy assumptions, and storage fallback checks in `tests/step1.spec.ts` and `tests/step2.spec.ts`.

**E2E Tests:**
- Playwright E2E tests are the primary automated test type, configured by `playwright.config.ts`.
- Tests run serially with one worker because `playwright.config.ts` sets `fullyParallel: false` and `workers: 1`.
- The configured browser project is Chromium Desktop Chrome only in `playwright.config.ts`.

## Common Patterns

**Async Testing:**
```typescript
// tests/step1.spec.ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    indexedDB.databases?.().then((databases) => {
      for (const database of databases) {
        if (database.name) indexedDB.deleteDatabase(database.name);
      }
    }).catch(() => {});
  });
  await page.goto('apps/main/index.html');
  await page.waitForSelector('main');
});
```

**Error Testing:**
```typescript
// tests/step2.spec.ts
page.on('dialog', async (dialog) => {
  await dialog.dismiss();
});

await page.evaluate(() => {
  const failingHub = {
    saveStep2Entry: async () => { throw new Error('IDB_BLOCKED_SAVE'); },
    listStep2Entries: async () => { throw new Error('IDB_BLOCKED_LIST'); },
    getStep2EntryById: async () => { throw new Error('IDB_BLOCKED_LOAD'); },
    deleteStep2Entry: async () => { throw new Error('IDB_BLOCKED_DELETE'); },
    triggerAutoBackup: async () => ({ created: false }),
  };
  window.IsfStorageHub = failingHub;
  window.IsfHubStorage = failingHub;
});
```

---

*Testing analysis: 2026-06-29*
