# Simulation Compound Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Simulation readiness route with a Bedrock React app that visualizes the long-term difference between the current Main savings/investment split and putting the same money entirely into savings.

**Architecture:** Keep projection math in pure TypeScript domain functions, isolate current Main reads and the single Simulation draft behind narrow repositories, and let one React application compose onboarding, controls, summary, and an accessible SVG chart. The app reads current `isf-main-v2`, never writes Main, and replaces—not imports—the retained JavaScript Simulation.

**Tech Stack:** Vite static MPA, React 19, TypeScript 5.5, Tailwind CSS 4, SVG, Vitest, Testing Library, Playwright, Vite PWA.

## Global Constraints

- Main remains the completed current product baseline and Simulation becomes a new detailed app.
- The app must work at 390px, 768px, and desktop without horizontal overflow.
- Core behavior remains local-first and does not require a server or market-data request.
- Main data is read-only; Simulation must never write `isf-main-v2`.
- Monthly savings grow at the base rate and monthly investments plus starting principal grow at the selected expected return.
- The comparison baseline puts starting principal and both monthly contributions into savings at the base rate.
- Annual rates use `(1 + annualRate)^(1 / 12) - 1`; contributions occur at month end.
- Expected-return presets are `5%`, `9%`, `13%`, and custom; custom changes in `0.25%p` steps and accepts at most two decimals.
- Duration supports 1–50 years, direct input, slider, one-year decrement/increment, and 10/20/30-year shortcuts.
- Base rate defaults to `2.75%`; inflation defaults to `baseRate - 0.25%p`.
- Fees, tax, exchange rates, backtests, ETF examples, multiple saved simulations, and MDD are outside this implementation.
- Existing legacy Simulation storage must not be mutated before its approved removal gate.
- Existing version `0.11.90` changes in `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, and `shared/legacy/sw.js` are authorized and must be committed without additional version bumps.

---

### Task 1: Pure compound projection

**Files:**
- Create: `src/simulation/domain/model.ts`
- Create: `src/simulation/domain/projection.ts`
- Create: `src/simulation/domain/validation.ts`
- Test: `tests/unit/simulation/projection.test.ts`
- Test: `tests/unit/simulation/validation.test.ts`

**Interfaces:**
- Consumes: scalar Won amounts, annual percentage values, duration, and nominal/real mode.
- Produces: `createDefaultSimulationDraft(source)`, `projectCompoundGrowth(draft)`, `validateSimulationDraft(value)`, `ProjectionPoint`, and `ProjectionResult`.

- [ ] **Step 1: Write failing projection tests**

```ts
import { describe, expect, it } from 'vitest';
import { annualPercentToMonthlyRate, projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import type { CompoundSimulationDraft } from '../../../src/simulation/domain/model';

const draft: CompoundSimulationDraft = {
  schemaVersion: 1,
  source: {
    monthlySavingsWon: 300_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 1_753_758_900_000,
  },
  initialInvestmentWon: 10_000_000,
  years: 10,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal',
  updatedAt: 1_753_758_900_100,
};

describe('projectCompoundGrowth', () => {
  it('converts effective annual rates to monthly rates', () => {
    expect(annualPercentToMonthlyRate(9)).toBeCloseTo(Math.pow(1.09, 1 / 12) - 1, 12);
  });

  it('keeps savings, investments, all-savings, and principal internally consistent', () => {
    const result = projectCompoundGrowth(draft);
    const final = result.points.at(-1)!;
    expect(result.points).toHaveLength(11);
    expect(final.month).toBe(120);
    expect(final.currentPlanNominalWon).toBe(final.savingsNominalWon + final.investmentNominalWon);
    expect(final.contributedPrincipalWon).toBe(70_000_000);
    expect(final.currentPlanNominalWon).toBeGreaterThan(final.allSavingsNominalWon);
    expect(result.principalRatioPercent).toBeCloseTo(
      final.currentPlanNominalWon / final.contributedPrincipalWon * 100,
      6,
    );
  });

  it('uses the same starting principal in the all-savings baseline', () => {
    const result = projectCompoundGrowth({ ...draft, years: 1 });
    expect(result.points[0].allSavingsNominalWon).toBe(10_000_000);
    expect(result.points[0].investmentNominalWon).toBe(10_000_000);
  });

  it('discounts every displayed series in real mode without changing nominal results', () => {
    const nominal = projectCompoundGrowth(draft);
    const real = projectCompoundGrowth({ ...draft, amountMode: 'real' });
    expect(real.finalCurrentPlanWon).toBeLessThan(nominal.finalCurrentPlanWon);
    expect(real.points.at(-1)!.currentPlanNominalWon).toBe(
      nominal.points.at(-1)!.currentPlanNominalWon,
    );
  });
});
```

- [ ] **Step 2: Run projection tests and verify failure**

Run:

```bash
npx vitest run tests/unit/simulation/projection.test.ts
```

Expected: FAIL because `src/simulation/domain/projection.ts` does not exist.

- [ ] **Step 3: Implement domain types and monthly projection**

Define:

```ts
export interface SimulationMainSource {
  monthlySavingsWon: number;
  monthlyInvestmentWon: number;
  mainUpdatedAt: number;
}

export interface CompoundSimulationDraft {
  schemaVersion: 1;
  source: SimulationMainSource;
  initialInvestmentWon: number;
  years: number;
  expectedAnnualReturnPercent: number;
  baseRatePercent: number;
  inflationOffsetPercentPoints: number;
  amountMode: 'nominal' | 'real';
  updatedAt: number;
}

export interface ProjectionPoint {
  year: number;
  month: number;
  contributedPrincipalWon: number;
  savingsNominalWon: number;
  investmentNominalWon: number;
  currentPlanNominalWon: number;
  allSavingsNominalWon: number;
  currentPlanRealWon: number;
  allSavingsRealWon: number;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  finalCurrentPlanWon: number;
  finalAllSavingsWon: number;
  advantageOverAllSavingsWon: number;
  principalRatioPercent: number | null;
}
```

Implement `projectCompoundGrowth()` as a 0-to-`years * 12` monthly loop. Append point 0 and each completed year only. Use unrounded balances internally and round Won fields at output boundaries. Real values use:

```ts
const inflationAnnualRate = (draft.baseRatePercent + draft.inflationOffsetPercentPoints) / 100;
const realFactor = Math.pow(1 + inflationAnnualRate, month / 12);
const currentPlanRealWon = Math.round(currentPlanNominalWon / realFactor);
```

- [ ] **Step 4: Write failing validation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  createDefaultSimulationDraft,
  parseSimulationDraft,
} from '../../../src/simulation/domain/validation';

const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('Simulation draft validation', () => {
  it('creates approved defaults', () => {
    expect(createDefaultSimulationDraft(source, 456)).toMatchObject({
      source,
      initialInvestmentWon: 0,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: 456,
    });
  });

  it('rejects values outside approved ranges and extra legacy collections', () => {
    expect(parseSimulationDraft({ schemaVersion: 1, years: 51 })).toBeNull();
    expect(parseSimulationDraft({
      ...createDefaultSimulationDraft(source, 456),
      strategies: [],
    })).toBeNull();
  });
});
```

- [ ] **Step 5: Implement strict validation**

Use exact-key validation. Require nonnegative safe-integer Won amounts, years 1–50, expected return 0.00–30.00, finite base and inflation-offset values greater than `-100`, two-decimal percentage precision, valid `amountMode`, and positive safe-integer timestamps.

- [ ] **Step 6: Run focused unit tests**

Run:

```bash
npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/validation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/domain tests/unit/simulation
git commit -m "feat(simulation): add compound projection"
```

---

### Task 2: Main source and single-draft repositories

**Files:**
- Create: `src/simulation/infrastructure/mainSourceRepository.ts`
- Create: `src/simulation/infrastructure/simulationRepository.ts`
- Create: `src/simulation/application/bootstrap.ts`
- Test: `tests/unit/simulation/mainSourceRepository.test.ts`
- Test: `tests/unit/simulation/simulationRepository.test.ts`
- Test: `tests/unit/simulation/bootstrap.test.ts`

**Interfaces:**
- Consumes: `isf-main-v2`, `isf-simulation-compound-v1`, and Task 1 validation.
- Produces: `MainSourceRepository`, `SimulationRepository`, `bootstrapSimulation()`, and explicit found/empty/invalid/unavailable results.

- [ ] **Step 1: Write failing repository tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserMainSourceRepository,
  MAIN_STORAGE_KEY,
} from '../../../src/simulation/infrastructure/mainSourceRepository';

describe('BrowserMainSourceRepository', () => {
  beforeEach(() => localStorage.clear());

  it('projects only current Main savings, investments, and updatedAt', () => {
    localStorage.setItem(MAIN_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      updatedAt: 123,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    }));
    expect(new BrowserMainSourceRepository().load()).toEqual({
      status: 'found',
      source: {
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 123,
      },
    });
  });

  it('does not read legacy Main keys', () => {
    localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      monthlyInvest: 900_000,
    }));
    expect(new BrowserMainSourceRepository().load()).toEqual({ status: 'empty' });
  });
});
```

Write Simulation repository tests that verify:

- valid draft round-trip under `isf-simulation-compound-v1`;
- malformed draft returns `invalid`;
- read/write exceptions return `unavailable`;
- save never changes `isf-main-v2`, `isf-rebuild-v1`, or legacy Step 2 keys;
- `clear()` removes only `isf-simulation-compound-v1`.

- [ ] **Step 2: Run repository tests and verify failure**

Run:

```bash
npx vitest run tests/unit/simulation/mainSourceRepository.test.ts tests/unit/simulation/simulationRepository.test.ts
```

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Implement narrow repositories**

Use:

```ts
export const MAIN_STORAGE_KEY = 'isf-main-v2';
export const SIMULATION_STORAGE_KEY = 'isf-simulation-compound-v1';

export type MainSourceLoadResult =
  | { status: 'found'; source: SimulationMainSource }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type SimulationLoadResult =
  | { status: 'found'; draft: CompoundSimulationDraft }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };
```

Parse Main through the current `MainData` scalar contract. Do not import a legacy sanitizer or connector. Catch storage access separately from malformed JSON so the UI can distinguish recovery states.

- [ ] **Step 4: Write failing bootstrap tests**

```ts
it('resumes a matching draft and flags a newer Main source without overwriting it', () => {
  const result = bootstrapSimulation(
    { status: 'found', source: { ...source, mainUpdatedAt: 200 } },
    { status: 'found', draft: { ...draft, source: { ...source, mainUpdatedAt: 100 } } },
  );
  expect(result).toEqual({
    kind: 'ready',
    draft: expect.objectContaining({ source: expect.objectContaining({ mainUpdatedAt: 100 }) }),
    latestMainSource: expect.objectContaining({ mainUpdatedAt: 200 }),
    mainChanged: true,
    persistenceAvailable: true,
  });
});

it('requires Main setup when savings plus investments equal zero', () => {
  expect(bootstrapSimulation(
    { status: 'found', source: { ...source, monthlySavingsWon: 0, monthlyInvestmentWon: 0 } },
    { status: 'empty' },
  )).toEqual({ kind: 'main-required', reason: 'zero-contribution' });
});
```

- [ ] **Step 5: Implement bootstrap state decisions**

`bootstrapSimulation()` must return:

```ts
type SimulationBootstrapResult =
  | { kind: 'ready'; draft: CompoundSimulationDraft | null; latestMainSource: SimulationMainSource; mainChanged: boolean; persistenceAvailable: boolean }
  | { kind: 'main-required'; reason: 'empty' | 'invalid' | 'zero-contribution' | 'unavailable' };
```

A `null` draft means the first-entry starting-principal question must render. Invalid drafts are discarded from the active state but not silently overwritten until the user starts or restarts.

- [ ] **Step 6: Run repository and bootstrap tests**

Run:

```bash
npx vitest run tests/unit/simulation/mainSourceRepository.test.ts tests/unit/simulation/simulationRepository.test.ts tests/unit/simulation/bootstrap.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/application src/simulation/infrastructure tests/unit/simulation
git commit -m "feat(simulation): isolate local data"
```

---

### Task 3: Simulation application flow and controls

**Files:**
- Create: `src/simulation/ui/SimulationApp.tsx`
- Create: `src/simulation/ui/StartingPrincipalPrompt.tsx`
- Create: `src/simulation/ui/SimulationControls.tsx`
- Create: `src/simulation/ui/SimulationSummary.tsx`
- Create: `src/simulation/ui/AdvancedSettings.tsx`
- Create: `src/simulation/main.tsx`
- Modify: `apps/simulation/index.html`
- Modify: `src/journey/ui/AppLauncher.tsx`
- Test: `tests/unit/simulation/SimulationApp.test.tsx`
- Test: `tests/unit/simulation/SimulationControls.test.tsx`

**Interfaces:**
- Consumes: Task 1 projection, Task 2 repositories/bootstrap, shared `AppLauncher`, and existing app foundation.
- Produces: the complete route state machine except chart rendering.

- [ ] **Step 1: Write failing first-entry and recovery component tests**

```tsx
it('asks the approved starting-principal question and starts from zero', async () => {
  const user = userEvent.setup();
  render(<SimulationApp mainSourceRepository={foundMain(source)} repository={emptyDraft()} now={() => 456} />);
  expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '없어요' }));
  expect(screen.getByRole('heading', { name: /20년 뒤 예상금액/ })).toBeVisible();
});

it('routes zero Main contributions back to Main', () => {
  render(<SimulationApp mainSourceRepository={foundMain({
    ...source,
    monthlySavingsWon: 0,
    monthlyInvestmentWon: 0,
  })} repository={emptyDraft()} />);
  expect(screen.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Main에서 설정하기' })).toHaveAttribute(
    'href',
    '/IndividualSavingsFlowUI/apps/main/',
  );
});
```

Add these explicit cases:

```tsx
it('accepts an existing investment principal', async () => {
  const user = userEvent.setup();
  render(<SimulationApp mainSourceRepository={foundMain(source)} repository={emptyDraft()} />);
  await user.click(screen.getByRole('button', { name: '있어요' }));
  await user.type(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), '10000000');
  await user.click(screen.getByRole('button', { name: '계산 시작' }));
  expect(screen.getByText('1,000만 원')).toBeVisible();
});

it('keeps calculating when draft storage is unavailable', async () => {
  render(<SimulationApp mainSourceRepository={foundMain(source)} repository={unavailableDraft()} />);
  expect(screen.getByText('자동 저장을 사용할 수 없습니다')).toBeVisible();
  expect(screen.getByRole('button', { name: '없어요' })).toBeEnabled();
});

it('does not overwrite an active draft when Main is newer', () => {
  render(<SimulationApp
    mainSourceRepository={foundMain({ ...source, mainUpdatedAt: 200 })}
    repository={foundDraft({ ...draft, source: { ...source, mainUpdatedAt: 100 } })}
  />);
  expect(screen.getByText('Main의 저축·투자 금액이 변경되었습니다.')).toBeVisible();
  expect(screen.getByText('월 저축 30만 원')).toBeVisible();
});

it('restarts from the latest Main source and asks for principal again', async () => {
  const user = userEvent.setup();
  render(<SimulationApp
    mainSourceRepository={foundMain({ ...source, monthlySavingsWon: 400_000 })}
    repository={foundDraft(draft)}
  />);
  await user.click(screen.getByRole('button', { name: '처음부터 다시' }));
  expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
});
```

- [ ] **Step 2: Run the component test and verify failure**

Run:

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx
```

Expected: FAIL because `SimulationApp` does not exist.

- [ ] **Step 3: Implement the application state machine**

Use `useMemo` for repositories, initialize once from `bootstrapSimulation()`, and persist every valid draft change through `SimulationRepository.save()`. Keep the active draft in component state even when persistence fails.

Render these states:

- Main recovery;
- first-entry principal question;
- ready Simulation;
- newer-Main notice;
- non-blocking persistence error.

`처음부터 다시` calls only `SimulationRepository.clear()` and constructs a new prompt from the latest current Main source.

- [ ] **Step 4: Write failing control tests**

```tsx
it('supports presets, 0.25-point custom changes, and two-decimal direct input', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SimulationControls draft={draft} onChange={onChange} />);

  await user.click(screen.getByRole('button', { name: '연 기대수익률 13%' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
    expectedAnnualReturnPercent: 13,
  }));

  await user.click(screen.getByRole('button', { name: '직접 입력' }));
  await user.click(screen.getByRole('button', { name: '기대수익률 0.25%p 올리기' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
    expectedAnnualReturnPercent: 9.25,
  }));
});

it('supports slider, number input, one-year controls, and year shortcuts', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SimulationControls draft={draft} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: '기간 1년 늘리기' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 21 }));
  await user.click(screen.getByRole('button', { name: '30년' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 30 }));
  expect(screen.getByRole('slider', { name: '투자 기간' })).toHaveAttribute('min', '1');
  expect(screen.getByRole('slider', { name: '투자 기간' })).toHaveAttribute('max', '50');
});
```

- [ ] **Step 5: Implement controls and compact summaries**

`SimulationControls` owns:

- read-only Main monthly savings/investment amounts;
- year range and synchronized number input;
- one-year decrement/increment;
- 10/20/30 shortcuts;
- expected-return presets and custom editor.

`AdvancedSettings` is collapsed by default and owns:

- base-rate numeric input, default 2.75%;
- inflation-offset numeric input, default -0.25%p;
- computed inflation rate text;
- nominal/real segmented control.

`SimulationSummary` shows only:

- `${years}년 뒤 예상금액`;
- formatted `finalCurrentPlanWon`;
- `전부 저축보다` plus signed difference;
- `납입원금 대비 총 ${principalRatioPercent}%`.

- [ ] **Step 6: Replace the readiness entry**

Change `apps/simulation/index.html` to load:

```html
<script type="module" src="../../src/simulation/main.tsx"></script>
```

Update title, description, and theme color for the detailed Simulation. In `AppLauncher`, mark Simulation as `사용 중` while Portfolio and Account Map remain `준비 중`; preserve `aria-current` as a separate current-location signal.

- [ ] **Step 7: Run focused component and source checks**

Run:

```bash
npx vitest run tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationControls.test.tsx
npm run check
```

Expected: all tests and both TypeScript checks PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/simulation/index.html src/simulation src/journey/ui/AppLauncher.tsx tests/unit/simulation
git commit -m "feat(simulation): add growth controls"
```

---

### Task 4: Accessible responsive growth chart

**Files:**
- Create: `src/simulation/ui/GrowthChart.tsx`
- Create: `src/simulation/ui/chartGeometry.ts`
- Create: `src/simulation/ui/simulation.css`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Test: `tests/unit/simulation/chartGeometry.test.ts`
- Test: `tests/unit/simulation/GrowthChart.test.tsx`
- Test: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: `ProjectionPoint[]` and selected nominal/real display mode.
- Produces: a responsive SVG with current-plan area/line, subdued all-savings line, accessible text summary, and hover/focus/touch year detail.

- [ ] **Step 1: Write failing geometry tests**

```ts
it('maps both series into one shared plot without NaN or out-of-range coordinates', () => {
  const geometry = buildChartGeometry(points, { width: 680, height: 285 });
  expect(geometry.currentPlanPath).toMatch(/^M/);
  expect(geometry.allSavingsPath).toMatch(/^M/);
  expect(geometry.currentPlanPath).not.toContain('NaN');
  for (const point of geometry.points) {
    expect(point.x).toBeGreaterThanOrEqual(geometry.plot.left);
    expect(point.x).toBeLessThanOrEqual(geometry.plot.right);
    expect(point.currentY).toBeGreaterThanOrEqual(geometry.plot.top);
    expect(point.currentY).toBeLessThanOrEqual(geometry.plot.bottom);
  }
});
```

- [ ] **Step 2: Run geometry tests and verify failure**

Run:

```bash
npx vitest run tests/unit/simulation/chartGeometry.test.ts
```

Expected: FAIL because `buildChartGeometry` does not exist.

- [ ] **Step 3: Implement deterministic geometry**

Build paths from yearly points using one X scale and one Y scale. Include:

```ts
interface ChartGeometryPoint {
  year: number;
  x: number;
  currentY: number;
  allSavingsY: number;
  point: ProjectionPoint;
}
```

Use a zero Y baseline, reserve fixed viewBox padding, and return an area path that closes only the current-plan curve to the baseline. Do not smooth through points in a way that overshoots actual values; use a monotonic line or straight segments.

- [ ] **Step 4: Write failing chart interaction tests**

```tsx
it('exposes the current year through keyboard focus and names both series', async () => {
  const user = userEvent.setup();
  render(<GrowthChart result={result} amountMode="nominal" />);
  expect(screen.getByText(/현재 계획.*전부 저축/)).toBeVisible();
  const yearTen = screen.getByRole('button', { name: '10년 상세 보기' });
  await user.tab();
  // Continue until the year point is focused, then verify detail content.
  yearTen.focus();
  expect(screen.getByText('현재 계획 총액')).toBeVisible();
  expect(screen.getByText('누적 납입원금')).toBeVisible();
  expect(screen.getByText('저축 잔액')).toBeVisible();
  expect(screen.getByText('투자 잔액')).toBeVisible();
});
```

- [ ] **Step 5: Implement chart semantics and tooltip**

- Render current plan as a 4px solid line plus low-opacity area.
- Render all-savings as a 2px low-contrast dashed line.
- Add visible labels `현재 계획` and `전부 저축`.
- Overlay transparent, minimum-44px focus/touch targets at annual points.
- Use pointer move to select the nearest year, focus to select a year, and Escape/outside pointer to dismiss.
- Clamp tooltip X/Y inside the SVG/container.
- Include a screen-reader summary with conditions, final current-plan amount, final all-savings amount, and the difference.

- [ ] **Step 6: Add responsive styling and reduced motion**

`simulation.css` must:

- reuse ISF Pearl and app-foundation tokens;
- keep one column at 390px;
- keep controls at least 44px high;
- make long Won values wrap without splitting digits awkwardly;
- keep SVG width `100%` with a stable `viewBox`;
- prevent document overflow;
- disable curve transition under `prefers-reduced-motion: reduce`.

- [ ] **Step 7: Write focused browser coverage**

Create `tests/simulation.spec.ts` with:

- first entry with/without starting principal;
- correct 5/9/13/custom and duration interactions;
- nominal/real toggle;
- touch tooltip at 390px;
- keyboard tooltip at 768px;
- desktop hover;
- Main source change notice and restart;
- zero contribution recovery;
- no document overflow at all three viewports;
- `isf-main-v2` unchanged after every Simulation edit.

Seed only `isf-main-v2`; do not seed a journey snapshot or legacy Simulation state.

- [ ] **Step 8: Run chart and browser tests**

Run:

```bash
npx vitest run tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx
npx playwright test tests/simulation.spec.ts --reporter=list
```

Expected: unit tests PASS and all Simulation browser cases PASS.

- [ ] **Step 9: Commit**

```bash
git add src/simulation/ui tests/unit/simulation tests/simulation.spec.ts
git commit -m "feat(simulation): visualize compound growth"
```

---

### Task 5: Journey update and legacy Simulation removal

**Files:**
- Delete: `src/journey/simulation.tsx`
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`
- Modify: `tests/unit/journey/ReadinessApp.test.tsx`
- Delete: `src/entries/step2.ts`
- Delete: `apps/simulation/app.js`
- Delete: `apps/simulation/styles.css`
- Delete: `apps/simulation/modules/*.js`
- Delete: `tests/step2.spec.ts`
- Verify: `public/data/indices/**`
- Verify: `src/core/storage/CompatibilityBridge.ts`
- Verify: `shared/legacy/sw.js`

**Interfaces:**
- Consumes: supported Simulation React route and replacement tests from Tasks 1–4.
- Produces: a product route with no legacy Simulation runtime, DOM, direct tests, or v1 Main connector.

- [ ] **Step 1: Update journey tests before removal**

Change app-journey assertions so:

- Main launch opens the detailed Simulation and the starting-principal question;
- Simulation is labeled `사용 중`;
- Portfolio and Account Map remain `준비 중`;
- Portfolio readiness no longer expects a Simulation readiness handoff button;
- readiness-only DOM assertions cover Portfolio and Account Map, while Simulation asserts no legacy selectors;
- current-location semantics remain separate from availability.

Run:

```bash
npx vitest run tests/unit/journey
npx playwright test tests/app-journey.spec.ts --reporter=list
```

Expected: FAIL only where the old readiness contract still exists.

- [ ] **Step 2: Simplify readiness behavior**

Remove Simulation-specific `continueToPortfolio()` and `createPortfolioJourneySnapshot()` behavior from `ReadinessApp`. Portfolio remains a readiness destination and recovers to Main when its own valid journey connection is absent. Keep Account Map isolated.

- [ ] **Step 3: Prove replacement coverage exists**

Run:

```bash
npx vitest run tests/unit/simulation
npx playwright test tests/simulation.spec.ts tests/app-journey.spec.ts --reporter=list
```

Expected: PASS before deleting legacy source.

- [ ] **Step 4: Audit legacy references**

Run:

```bash
rg -n \
  "apps/simulation/(app|modules|styles)|src/entries/step2|strategyCardGroup|isf-step2|saveStep2Entry|listStep2Entries|getStep2EntryById|deleteStep2Entry" \
  apps src shared public scripts tests vite.config.ts package.json README.md docs
```

Classify every hit:

- delete if it belongs only to the retired Simulation;
- retain only when Portfolio, Account Map, storage compatibility, or migration documentation still consumes it;
- do not delete shared APIs merely because their old Simulation caller is removed.

- [ ] **Step 5: Remove legacy Simulation runtime and direct tests**

Delete the listed JavaScript runtime, CSS, old entry wrapper, and `tests/step2.spec.ts`. Remove Simulation-only precache and version-sync references. Keep `apps/simulation/index.html` because it is the supported React route.

For `public/data/indices/**`, delete only files with no remaining runtime, test, documentation, or approved migration consumer. Record retained files and exact consumers in the spec if any remain.

- [ ] **Step 6: Verify no runtime or direct-test reference remains**

Run:

```bash
rg -n \
  "apps/simulation/(app|modules|styles)|src/entries/step2|strategyCardGroup|step1-connector\\.js" \
  apps src shared public scripts tests vite.config.ts package.json
```

Expected: no Simulation legacy runtime, selector, entry, or connector hits.

Run:

```bash
rg -n "isf-rebuild-v1|isf-step2|saveStep2Entry|listStep2Entries|getStep2EntryById|deleteStep2Entry" \
  src apps shared tests
```

Expected: any remaining hits have a verified non-Simulation consumer; no hit originates from the new Simulation.

- [ ] **Step 7: Run focused post-removal regression**

Run:

```bash
npm run check
npx vitest run tests/unit/simulation tests/unit/journey
npx playwright test tests/simulation.spec.ts tests/app-journey.spec.ts --reporter=list
```

Expected: all checks PASS.

- [ ] **Step 8: Commit**

```bash
git add -A apps/simulation src/entries/step2.ts src/journey src/core/storage shared/legacy public/data tests
git diff --cached --check
git commit -m "refactor(simulation): remove legacy runtime"
```

---

### Task 6: Documentation, version state, and full verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `docs/superpowers/specs/2026-07-30-simulation-compound-growth-design.md`
- Modify: `package.json`
- Modify: `public/manifest.webmanifest`
- Modify: `shared/core/utils.js`
- Modify: `shared/legacy/sw.js`

**Interfaces:**
- Consumes: completed Simulation behavior and legacy-removal evidence.
- Produces: canonical product-state documentation, committed `0.11.90` version state, and final verification evidence.

- [ ] **Step 1: Update canonical product state**

Document:

- Main and Simulation are detailed current products;
- Portfolio and Account Map remain readiness-only future apps;
- Simulation compares the current Main savings/investment split with an all-savings baseline;
- expected returns are user assumptions, not backtests or financial advice;
- tax and MDD remain future extensions;
- removed legacy Simulation behavior and storage keys are not supported paths.

Update the approved spec’s removal section with exact deleted paths, retained compatibility references, and the commands that proved removal.

- [ ] **Step 2: Verify documentation consistency**

Run:

```bash
rg -n "Simulation.*준비 중|Simulation.*향후 새로 개발|세 앱.*향후" \
  README.md AGENTS.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
```

Expected: no stale claim that Simulation remains readiness-only.

- [ ] **Step 3: Commit authorized version files with documentation**

Confirm all four files show `0.11.90` and do not run `npm run build`, because that script bumps the version again.

Run:

```bash
git diff -- package.json public/manifest.webmanifest shared/core/utils.js shared/legacy/sw.js
git add README.md AGENTS.md \
  docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md \
  docs/superpowers/specs/2026-07-30-simulation-compound-growth-design.md \
  package.json public/manifest.webmanifest shared/core/utils.js shared/legacy/sw.js
git diff --cached --check
git commit -m "docs(simulation): mark compound app current"
```

- [ ] **Step 4: Run full verification without a version bump**

Run:

```bash
npm run check
npx vitest run
npx playwright test --reporter=list
npx vite build
git diff --check
git status --short
```

Expected:

- TypeScript source and unit checks PASS.
- Full Vitest suite PASS.
- Current E2E suite PASS; intentionally retained legacy-only skips are reported separately.
- Vite build PASS without changing source version files.
- `git diff --check` exits 0.
- no uncommitted implementation or version file remains.

- [ ] **Step 5: Request independent code review**

Use `superpowers:requesting-code-review`. Reviewer must inspect:

- projection math and month-end contribution order;
- nominal/real calculations;
- Main read-only guarantee;
- storage failure and revision-change behavior;
- chart focus/touch/tooltip containment;
- legacy removal reference scan;
- canonical product-state consistency.

Fix Critical and Important findings with focused regression tests before integration.

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch`. Preserve the Orca-managed worktree. For the established local integration choice, merge into local `main`, rerun the full verification on merged `main`, push `origin/main`, and verify local and remote SHAs match.
