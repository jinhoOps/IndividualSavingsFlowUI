# Testing Patterns

**Analysis Date:** 2026-06-23

## Test Framework

**Runner:**
- Playwright `^1.60.0` is the active automated test runner.
- Config: `playwright.config.ts`.
- Test directory: `tests/`.
- Vitest `^4.1.5` and `@vitest/ui` `^4.1.5` are installed in `package.json`, but no `vitest.config.*` file or `npm test` script is present.
- `shared/core/clipboard-parser.test.js` is a direct Node script-style smoke test, not a Vitest suite.

**Assertion Library:**
- Playwright `expect` from `@playwright/test` in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- The parser smoke test in `shared/core/clipboard-parser.test.js` uses manual boolean checks and `console.log`.

**Run Commands:**
```bash
npm run test:e2e      # Run Playwright end-to-end tests
npm run check         # Run TypeScript no-emit checks
npm run lint          # Same as check; runs tsc --noEmit
node shared/core/clipboard-parser.test.js  # Run parser smoke test manually
```

## Test File Organization

**Location:**
- E2E and browser integration tests live under `tests/`: `tests/step1.spec.ts`, `tests/step2.spec.ts`.
- The parser smoke test is colocated with the implementation: `shared/core/clipboard-parser.test.js` next to `shared/core/clipboard-parser.js`.

**Naming:**
- Use `*.spec.ts` for Playwright suites under `tests/`.
- Use `*.test.js` only for standalone JavaScript smoke tests when keeping them near source.

**Structure:**
```text
tests/
├── step1.spec.ts      # Main app UI/UX, layout, storage, and flow contracts
└── step2.spec.ts      # Simulation app tutorial, import, storage fallback, and strategy contracts

shared/core/
├── clipboard-parser.js
└── clipboard-parser.test.js
```

## Test Structure

**Suite Organization:**
```typescript
// tests/step2.spec.ts
// @ts-nocheck
import { test, expect } from '@playwright/test';

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
- Group tests by feature phase or contract area with `test.describe`, as in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- Use `test.beforeEach` to reset browser storage and IndexedDB before navigation.
- Use `test.afterEach` to close pages when the suite opens long-running UI flows, as in `tests/step1.spec.ts`.
- Navigate to app entry HTML files directly: `page.goto('apps/main/index.html')`, `page.goto('apps/simulation/index.html')`.
- Wait for stable selectors before assertions: `page.waitForSelector('main')`, `page.waitForSelector('#totalMonthlyInvestCapacity')`.
- Prefer Playwright locators and web assertions: `await expect(page.locator('#step1SyncBanner')).toBeVisible()`.
- Use `page.evaluate` for direct browser-context contract checks against app modules and LocalStorage.

## Mocking

**Framework:** Playwright browser context primitives; no Vitest mocking pattern is active.

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
- Mock browser globals in `page.evaluate` when testing fallback paths: `window.IsfStorageHub`, `window.IsfHubStorage` in `tests/step2.spec.ts`.
- Seed `localStorage` and clear `sessionStorage`/IndexedDB in `page.addInitScript` before loading the app.
- Mock user confirmation flows with `page.once('dialog', ...)` when clicks trigger `confirm` or `alert`.

**What NOT to Mock:**
- Do not mock rendering for layout and visual contract tests in `tests/step1.spec.ts`; assert real DOM boxes, overflow, visibility, SVG contents, and screenshots.
- Do not mock app calculators when testing strategy comparison contracts in `tests/step2.spec.ts`; dynamically import and execute `apps/simulation/modules/calculator.js` in the page.
- Do not bypass LocalStorage/IndexedDB state setup when the behavior under test depends on persistence contracts.

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
- Inline constants live at the top of the relevant spec file, such as `STEP1_SOURCE` in `tests/step2.spec.ts`.
- UI fixtures are established through browser storage in `page.addInitScript`, not external fixture files.
- Parser examples live inline in `testCases` inside `shared/core/clipboard-parser.test.js`.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# No configured coverage command is present in package.json.
# Add a runner/config first before relying on coverage reports.
```

**Current Signals:**
- Playwright produces behavior confidence for major UI flows in `tests/step1.spec.ts` and `tests/step2.spec.ts`.
- No coverage thresholds are configured in `playwright.config.ts`, `vite.config.ts`, or `package.json`.
- Vitest coverage packages are optional peer entries in `package-lock.json`, but no local coverage provider is configured.

## Test Types

**Unit Tests:**
- Not formally configured. `shared/core/clipboard-parser.test.js` is a manual script that imports `ClipboardParser` from `shared/core/clipboard-parser.js`, iterates cases, and logs pass/fail.
- For new pure functions in `apps/main/modules/input-sanitizer.js`, `apps/main/modules/comparison-engine.js`, or `apps/simulation/modules/calculator.js`, prefer adding a real Vitest script/config before creating more manual test scripts.

**Integration Tests:**
- Playwright specs act as browser integration tests. They load real app pages, interact with controls, inspect LocalStorage, and dynamically import modules.
- `tests/step2.spec.ts` checks storage bridge fallback behavior by injecting failing storage globals and asserting app state.
- `tests/step1.spec.ts` checks Main UI layout hierarchy, Sankey/network rendering, controls, screenshots, and saved input contracts.

**E2E Tests:**
- Playwright is configured in `playwright.config.ts` with `testDir: './tests'`, Chromium only, `workers: 1`, `fullyParallel: false`, `trace: 'on-first-retry'`, `serviceWorkers: 'block'`, and a Vite web server.
- Base URL is `http://localhost:5173/IndividualSavingsFlowUI/`.
- The web server command is `node ./node_modules/vite/bin/vite.js --host 127.0.0.1`.

## Common Patterns

**Async Testing:**
```typescript
await page.goto('apps/main/index.html');
await page.waitForSelector('main');
const sankeySvg = page.locator('#sankeySvg');
await expect(sankeySvg).toBeVisible();
const box = await sankeySvg.boundingBox();
expect(box).not.toBeNull();
```

**Error Testing:**
```typescript
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message());
  await dialog.dismiss();
});

const failingHub = {
  saveStep2Entry: async () => { throw new Error('IDB_BLOCKED_SAVE'); },
};
window.IsfStorageHub = failingHub;
```

**Responsive/Layout Testing:**
```typescript
for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(4);
}
```

**Visual Artifacts:**
- `tests/step1.spec.ts` writes screenshots under `test-results/`, for example `test-results/phase07-step1-mobile-390.png`.
- Treat `test-results/` as generated verification output, not source.

## Adding New Tests

**For UI behavior:**
- Add a focused Playwright `test(...)` to `tests/step1.spec.ts` for Main app behavior or `tests/step2.spec.ts` for Simulation app behavior.
- Reset storage in `beforeEach` before relying on persisted state.
- Assert user-visible DOM state with locators before checking internal state with `page.evaluate`.

**For pure logic:**
- Prefer creating a proper Vitest configuration and `npm test` script before expanding unit tests.
- Put test cases near the source when testing isolated shared utilities, following the colocated pattern of `shared/core/clipboard-parser.test.js`, but use real assertions rather than console-only pass/fail.

**For storage and import contracts:**
- Use browser-context dynamic imports and controlled `window.*` globals, following `tests/step2.spec.ts`.
- Assert both returned values and persisted browser storage keys.

---

*Testing analysis: 2026-06-23*
