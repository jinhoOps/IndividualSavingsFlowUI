# Journey Snapshot Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용되지 않는 JourneySnapshot 저장 계약과 Portfolio readiness 잔존 코드를 제거하고 앱 이동을 URL 탐색과 최신 Main 직접 읽기로 단순화한다.

**Architecture:** Main 진입점은 폐기된 snapshot key를 읽지 않고 best-effort 삭제한다. Main의 Simulation CTA는 저장 없이 route로 이동하며 Account Map은 repository 없는 정적 readiness 화면을 사용한다. Main 데이터 판정은 domain validator 한 곳이 소유하고 Portfolio가 공유한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, Vite/Rollup, localStorage

## Global Constraints

- 승인 spec: `docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md`
- `isf-journey-snapshot-v1`은 읽기·parse·변환 없이 삭제한다.
- 삭제 실패는 Main 시작과 앱 이동을 막지 않는다.
- Main, Simulation, Portfolio의 현재 저장 데이터와 route를 보존한다.
- 과거 Superpowers spec·plan은 역사 자료로 보존한다.
- `npm run build`의 자동 version bump는 검증 후 원복한다.

---

### Task 1: Retired Storage Purge and Direct Navigation

**Files:**
- Create: `src/main/infrastructure/retiredStorage.ts`
- Create: `tests/unit/main/retiredStorage.test.ts`
- Modify: `src/main/main.tsx:1-23`
- Modify: `src/main/ui/MainApp.tsx:1-40,220-232,342-354`
- Modify: `tests/unit/main/MainApp.test.tsx:151-218`

**Interfaces:**
- Produces: `purgeRetiredStorage(getStorage?: () => Storage): void`
- Preserves: `MainAppProps.navigate?(href: string): void`
- Removes: `MainAppProps.journeyRepository`, `JourneyRepository`, `journeyError`

- [ ] **Step 1: Write the failing purge tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { purgeRetiredStorage } from '../../../src/main/infrastructure/retiredStorage';

describe('purgeRetiredStorage', () => {
  it('removes the retired key without reading it', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('must not read'); }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    purgeRetiredStorage(() => storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledWith('isf-journey-snapshot-v1');
  });

  it('swallows unavailable storage and removal failures', () => {
    expect(() => purgeRetiredStorage(() => { throw new Error('blocked'); })).not.toThrow();
    expect(() => purgeRetiredStorage(() => ({
      removeItem: () => { throw new Error('quota'); },
    } as unknown as Storage))).not.toThrow();
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/main/retiredStorage.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Replace snapshot MainApp tests with the direct-navigation contract**

```tsx
it('opens Simulation without writing a journey snapshot', async () => {
  const navigate = vi.fn();
  render(<MainApp
    repository={repository({ status: 'current', data: data(3_000_000), original: null })}
    navigate={navigate}
  />);
  await screen.findByRole('heading', { name: 'dashboard' });
  fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));
  expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/apps/simulation/'));
  expect(localStorage.getItem('isf-journey-snapshot-v1')).toBeNull();
});
```

Delete the quota-blocked navigation and negative derived snapshot tests.

- [ ] **Step 4: Implement minimal purge and navigation**

```ts
const RETIRED_JOURNEY_STORAGE_KEY = 'isf-journey-snapshot-v1';

export function purgeRetiredStorage(
  getStorage: () => Storage = () => window.localStorage,
): void {
  try {
    getStorage().removeItem(RETIRED_JOURNEY_STORAGE_KEY);
  } catch {
    // Retired data must not block Main.
  }
}
```

Call it in `main.tsx` before render. Remove snapshot imports, repository injection, error state/copy and try/catch from `MainApp`. `continueToSimulation()` must only guard applied data then call `navigate(appPath('simulation'))`.

- [ ] **Step 5: Verify GREEN**

Run: `npm run test:unit -- tests/unit/main/retiredStorage.test.ts tests/unit/main/MainApp.test.tsx && npm run check`

Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/main tests/unit/main
git commit -m "refactor(journey): remove snapshot handoff"
```

### Task 2: Account Map-only Readiness

**Files:**
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Modify: `src/journey/accountMap.tsx`
- Modify: `tests/unit/journey/ReadinessApp.test.tsx`
- Delete: `src/journey/domain/journeySnapshot.ts`
- Delete: `src/journey/infrastructure/journeyRepository.ts`
- Delete: `tests/unit/journey/journeySnapshot.test.ts`
- Delete: `tests/unit/journey/journeyRepository.test.ts`

**Interfaces:**
- Produces: prop-free `ReadinessApp(): JSX.Element`
- Removes: snapshot domain, repository and readiness connection state

- [ ] **Step 1: Replace readiness tests with a failing prop-free contract**

```tsx
it('shows only Account Map readiness and Main recovery', () => {
  render(<ReadinessApp />);
  expect(screen.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
  expect(screen.getByText('Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Main으로 이동' }))
    .toHaveAttribute('href', expect.stringContaining('/apps/main/'));
  expect(screen.queryByText(/연결되었습니다|월 투자 가능액|Portfolio로 이어가기/))
    .not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/journey/ReadinessApp.test.tsx`

Expected: FAIL because `destination` is required.

- [ ] **Step 3: Implement and delete snapshot modules**

Reduce `ReadinessApp` to `AppLauncher currentApp="account-map"`, the approved heading/message and one Main link. Render `<ReadinessApp />` from `accountMap.tsx`. Delete the four snapshot source/test files above.

- [ ] **Step 4: Prove references are gone**

Run: `rg -n "JourneySnapshot|JourneyRepository|createMainJourneySnapshot|createPortfolioJourneySnapshot|journeyRepository" src apps tests`

Expected: no results. The retired key may occur only in the purge module/test.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:unit -- tests/unit/journey tests/unit/main/MainApp.test.tsx && npm run check`

```bash
git add src/journey tests/unit/journey
git commit -m "refactor(journey): remove snapshot runtime"
```

### Task 3: Shared Main Validation and Import-graph Isolation

**Files:**
- Modify: `src/main/domain/validation.ts`
- Modify: `src/main/infrastructure/mainRepository.ts`
- Modify: `src/portfolio/infrastructure/mainSourceRepository.ts`
- Modify: `tests/unit/main/validation.test.ts`
- Modify: `tests/unit/portfolio/mainSourceRepository.test.ts`
- Modify: `tests/unit/portfolio/legacyIsolation.test.ts`

**Interfaces:**
- Produces: `isMainDataShape(value: unknown): value is MainData` from Main domain validation
- Consumed by: Main repository and Portfolio Main source adapter
- Test helper: `readRuntimeGraph(entryPath: string): Promise<Map<string, string>>`

- [ ] **Step 1: Add a failing domain ownership test**

```ts
it.each([
  [{ ...validMain, schemaVersion: 1 }, false],
  [{ ...validMain, monthlyInvestmentWon: -1 }, false],
  [{ ...validMain, monthlyInvestmentWon: 250_000 }, true],
])('owns the current Main storage shape', (candidate, expected) => {
  expect(isMainDataShape(candidate)).toBe(expected);
});
```

Import from `src/main/domain/validation.ts` before it exports the symbol.

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/main/validation.test.ts`

Expected: FAIL because the domain export is missing.

- [ ] **Step 3: Move and share the canonical validator**

Move `mainDataKeys` and `isMainDataShape` unchanged from `mainRepository.ts` to `main/domain/validation.ts`. Import it from Main repository. Remove Portfolio's `mainKeys`, `CurrentMainProjectionSource` and `isCurrentMainData`; import the shared validator and project only `updatedAt` and `monthlyInvestmentWon`.

- [ ] **Step 4: Strengthen legacy isolation**

Replace whole-directory substring collection with traversal starting at `src/portfolio/main.tsx`. Resolve static relative imports, side-effect imports, `.ts/.tsx/.js/.jsx` and `index.*`, with a visited-path guard. Assert the graph includes Portfolio Main source and Main validation, then apply the existing forbidden list to the concatenated graph plus Portfolio HTML.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:unit -- tests/unit/main/validation.test.ts tests/unit/portfolio/mainSourceRepository.test.ts tests/unit/portfolio/legacyIsolation.test.ts && npm run check`

```bash
git add src/main/domain/validation.ts src/main/infrastructure/mainRepository.ts src/portfolio/infrastructure/mainSourceRepository.ts tests/unit/main tests/unit/portfolio
git commit -m "refactor(main): share current data validator"
```

### Task 4: Canonical Docs and Full Verification

**Files:**
- Modify: `README.md`, `DESIGN.md`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- Modify: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/TESTING.md`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Documents: URL-only navigation, direct latest-Main reads, Account Map-only readiness and retired-key purge

- [ ] **Step 1: Update active documentation**

Remove current `JourneySnapshot` transfer claims. State that navigation uses URLs, Simulation and Portfolio directly read latest Main, Account Map alone is readiness-only, and Main purges the retired key without reading it. Link the approved retirement spec. Do not rewrite historical specs/plans.

- [ ] **Step 2: Strengthen browser regression**

In Main→Simulation E2E, seed `isf-journey-snapshot-v1`, load Main, assert it is purged, click the CTA and verify Simulation renders from `isf-main-v2`.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm run test:unit -- tests/unit/main tests/unit/journey tests/unit/portfolio
npx playwright test tests/app-journey.spec.ts tests/portfolio.spec.ts tests/simulation.spec.ts --reporter=list
```

Expected: all active focused tests pass.

- [ ] **Step 4: Run full required verification**

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
```

Expected: TypeScript exit 0, all active tests pass, intentional legacy skips remain skips.

- [ ] **Step 5: Build and inspect actual chunks**

Record the four version files, run `npm run build`, then run:

```bash
rg -n "JourneySnapshot|JourneyRepository|isf-journey-snapshot-v1|apps/portfolio/(app\\.js|modules|styles\\.css)|src/entries/step3\\.ts|isf-step3-(portfolios-v2|snapshots-v1)|IsfStorageHub|portfolioCreator" dist/assets/portfolio-*.js dist/assets/accountMap-*.js
```

Expected: no results. Restore only automatic build-version edits to exact pre-build contents with `apply_patch`.

- [ ] **Step 6: Check references and diff**

```bash
rg -n "JourneySnapshot|JourneyRepository|isf-journey-snapshot-v1" README.md DESIGN.md .planning docs/ways-of-work src apps tests
git diff --check
git status --short
```

Expected: active references are limited to retirement documentation and the purge module/test; no generated version diff remains.

- [ ] **Step 7: Commit docs and E2E**

```bash
git add README.md DESIGN.md .planning docs/ways-of-work tests/app-journey.spec.ts
git commit -m "docs(journey): retire snapshot contract"
```

- [ ] **Step 8: Review the complete implementation**

Review from `1334874` through HEAD against the approved spec. Resolve severity findings and rerun affected focused tests; if production code changes, repeat full verification.
