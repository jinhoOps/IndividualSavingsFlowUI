# Simulation Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Simulation as a guided first-run experience and a concise result-first workspace that automatically uses the latest Main contributions.

**Architecture:** Keep the existing pure projection domain, read-only Main adapter, and single Simulation repository. Add a versioned draft migration boundary, make bootstrap synchronize only the Main-owned source fields, split onboarding and result UI into focused React components, and keep chart interaction isolated from result composition.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5, Tailwind CSS 4 utilities plus scoped CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Main owns only its five monthly values; Simulation never writes to Main.
- Simulation keeps one local draft under `isf-simulation-compound-v1` and does not touch legacy storage keys.
- Current Simulation settings are `initialInvestmentWon`, `years`, `expectedAnnualReturnPercent`, `baseRatePercent`, `inflationOffsetPercentPoints`, and `amountMode`.
- First run has exactly two stages: starting principal, then duration and expected return.
- Revisit skips onboarding when a valid completed draft exists.
- Duration is an integer from 0 through 30 years; 0 is displayed as `현재`.
- Expected return is 0.00% through 30.00%, at most two decimals; custom `− / +` changes 0.25%p.
- Results under ₩100,000,000 round at the hundreds place and display through thousands; results at or above ₩100,000,000 round at the thousands place and display through ten-thousands.
- Money output never contains a decimal unit such as `4.82억 원`.
- Core result copy is the only sentence-shaped result: `이대로 20년 유지하면 4억 8,241만 원이 됩니다!`.
- Desktop, 768px, and 390px keep the chart and essential controls without horizontal overflow.
- Every interactive target is at least 44px; pointer, touch, keyboard, focus, accessible names, live status, and reduced motion are required.
- No new runtime dependency and no revival of legacy Simulation modules.

## File Structure

### Domain and persistence

- Modify `src/simulation/domain/model.ts`: current schema version and migration notice types.
- Modify `src/simulation/domain/validation.ts`: current v2 validation plus strict v1 migration.
- Modify `src/simulation/domain/projection.ts`: retain formulas and cover year 0 explicitly.
- Modify `src/simulation/infrastructure/simulationRepository.ts`: load migration metadata without changing the storage key.
- Modify `src/simulation/application/bootstrap.ts`: latest-Main synchronization and stale-Main recovery outcomes.

### UI

- Modify `src/simulation/ui/format.ts`: one Korean money formatter and chart-axis formatter.
- Create `src/simulation/ui/SimulationOnboarding.tsx`: two-stage orchestration and live preview.
- Create `src/simulation/ui/StartingPrincipalStep.tsx`: principal yes/no and conditional input.
- Create `src/simulation/ui/ScenarioSetupStep.tsx`: scenario question, controls, preview, and completion.
- Modify `src/simulation/ui/SimulationControls.tsx`: shared 0–30 duration and preset/custom return controls.
- Create `src/simulation/ui/SimulationHero.tsx`: single result sentence and one-line source conditions.
- Create `src/simulation/ui/SimulationComparison.tsx`: the two approved comparison values.
- Rename behavior in `src/simulation/ui/AdvancedSettings.tsx`: compact amount-mode toggle plus collapsed `계산 기준`.
- Create `src/simulation/ui/SaveIndicator.tsx`: persistent low-emphasis save state.
- Create `src/simulation/ui/SimulationMenu.tsx`: confirmed Simulation-only reset action.
- Create `src/simulation/ui/GrowthChartTooltip.tsx`: visual hierarchy and collision-aware positioning.
- Modify `src/simulation/ui/GrowthChart.tsx`: pointer, touch, keyboard, ticks, and tooltip state.
- Modify `src/simulation/ui/chartGeometry.ts`: ticks and active-point geometry.
- Modify `src/simulation/ui/SimulationApp.tsx`: compose onboarding/result/recovery states and persistence.
- Delete `src/simulation/ui/StartingPrincipalPrompt.tsx` and `src/simulation/ui/SimulationSummary.tsx` after consumers move.
- Rewrite `src/simulation/ui/simulation.css`: Main-aligned editorial layout and responsive behavior.

### Tests and documents

- Add focused unit tests beside `tests/unit/simulation/` for migration, formatting, onboarding, hero, comparison, save indicator, menu, and tooltip.
- Modify `tests/simulation.spec.ts` and `tests/app-journey.spec.ts` for supported external behavior.
- Update Product PRD, `DESIGN.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, codebase maps, and `README.md` so current-product claims match runtime.

---

### Task 1: Version the draft and migrate legacy durations

**Files:**
- Modify: `src/simulation/domain/model.ts`
- Modify: `src/simulation/domain/validation.ts`
- Modify: `src/simulation/infrastructure/simulationRepository.ts`
- Test: `tests/unit/simulation/validation.test.ts`
- Test: `tests/unit/simulation/simulationRepository.test.ts`

**Interfaces:**
- Produces: `SIMULATION_SCHEMA_VERSION = 2`.
- Produces: `SimulationDraftMigration = 'schema-upgraded' | 'duration-capped'`.
- Produces: `parseStoredSimulationDraft(value): { draft: CompoundSimulationDraft; migration: SimulationDraftMigration | null } | null`.
- Produces: found repository result `{ status: 'found'; draft; migration }`.
- Preserves: storage key `isf-simulation-compound-v1`.

- [ ] **Step 1: Write failing current-range and migration tests**

```ts
it('accepts 0 through 30 years and rejects values outside the current range', () => {
  const draft = createDefaultSimulationDraft(source, 456);
  expect(parseSimulationDraft({ ...draft, years: 0 })).not.toBeNull();
  expect(parseSimulationDraft({ ...draft, years: 30 })).not.toBeNull();
  expect(parseSimulationDraft({ ...draft, years: -1 })).toBeNull();
  expect(parseSimulationDraft({ ...draft, years: 31 })).toBeNull();
});

it('migrates v1 durations above 30 without dropping other settings', () => {
  const legacy = { ...createDefaultSimulationDraft(source, 456), schemaVersion: 1, years: 47 };
  expect(parseStoredSimulationDraft(legacy)).toEqual({
    draft: { ...legacy, schemaVersion: 2, years: 30 },
    migration: 'duration-capped',
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/simulation/validation.test.ts tests/unit/simulation/simulationRepository.test.ts`

Expected: FAIL because schema v2, year 0, and migration metadata are not implemented.

- [ ] **Step 3: Implement strict v2 parsing and v1 migration**

```ts
export const SIMULATION_SCHEMA_VERSION = 2 as const;
export type SimulationDraftMigration = 'schema-upgraded' | 'duration-capped';

export function parseStoredSimulationDraft(value: unknown): StoredDraftParseResult | null {
  const current = parseSimulationDraft(value);
  if (current !== null) return { draft: current, migration: null };

  const legacy = parseLegacyV1Draft(value);
  if (legacy === null) return null;
  const capped = Math.min(legacy.years, 30);
  return {
    draft: { ...legacy, schemaVersion: SIMULATION_SCHEMA_VERSION, years: capped },
    migration: legacy.years > 30 ? 'duration-capped' : 'schema-upgraded',
  };
}
```

`parseLegacyV1Draft` must require the exact existing v1 keys, schema version 1, years 1–50, and every existing numeric constraint. It must not accept extra keys or malformed legacy data.

- [ ] **Step 4: Return migration metadata from the repository**

```ts
const parsed = parseStoredSimulationDraft(JSON.parse(raw));
return parsed === null
  ? { status: 'invalid' }
  : { status: 'found', draft: parsed.draft, migration: parsed.migration };
```

Add repository assertions that saving a v2 draft changes only `isf-simulation-compound-v1` and that loading a v1 47-year draft returns a 30-year v2 draft with `duration-capped`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/validation.test.ts tests/unit/simulation/simulationRepository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/domain/model.ts src/simulation/domain/validation.ts src/simulation/infrastructure/simulationRepository.ts tests/unit/simulation/validation.test.ts tests/unit/simulation/simulationRepository.test.ts
git commit -m "feat(simulation): migrate duration range"
```

### Task 2: Support year zero and exact Korean money formatting

**Files:**
- Modify: `src/simulation/domain/projection.ts`
- Modify: `src/simulation/ui/format.ts`
- Test: `tests/unit/simulation/projection.test.ts`
- Create: `tests/unit/simulation/format.test.ts`

**Interfaces:**
- Produces: `formatWon(amountWon: number): string` with approved contextual rounding.
- Produces: `formatChartAxisWon(amountWon: number): string` with integer Korean units and no decimals.
- Preserves: `projectCompoundGrowth(draft): ProjectionResult`.

- [ ] **Step 1: Write failing year-zero projection tests**

```ts
it('returns only the starting principal at year zero', () => {
  const result = projectCompoundGrowth({ ...draft, years: 0 });
  expect(result.points).toHaveLength(1);
  expect(result.finalCurrentPlanWon).toBe(draft.initialInvestmentWon);
  expect(result.finalAllSavingsWon).toBe(draft.initialInvestmentWon);
  expect(result.advantageOverAllSavingsWon).toBe(0);
});
```

- [ ] **Step 2: Write table-driven formatter tests**

```ts
it.each([
  [82_405_500, '8,240만 6천 원'],
  [1_234_567, '123만 5천 원'],
  [999_500, '100만 원'],
  [482_405_500, '4억 8,241만 원'],
  [400_000_000, '4억 원'],
  [-1_234_567, '-123만 5천 원'],
])('formats %i with Korean integer units', (amount, expected) => {
  expect(formatWon(amount)).toBe(expected);
  expect(formatWon(amount)).not.toContain('.');
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts`

Expected: formatter cases FAIL because the current formatter emits decimal 만 units.

- [ ] **Step 4: Implement contextual rounding and unit composition**

```ts
export function formatWon(amountWon: number): string {
  const sign = amountWon < 0 ? '-' : '';
  const absolute = Math.abs(amountWon);
  const unit = absolute >= 100_000_000 ? 10_000 : 1_000;
  const rounded = Math.round(absolute / unit) * unit;
  return `${sign}${composeKoreanWon(rounded)}`;
}
```

`composeKoreanWon` must emit integer `조`, `억`, `만`, and `천` groups, omit zero groups, and return `0원` for zero. `formatChartAxisWon` may omit lower groups only to avoid tick collision, but must never emit a decimal.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/domain/projection.ts src/simulation/ui/format.ts tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts
git commit -m "feat(simulation): format Korean result amounts"
```

### Task 3: Synchronize the latest Main source during bootstrap

**Files:**
- Modify: `src/simulation/application/bootstrap.ts`
- Test: `tests/unit/simulation/bootstrap.test.ts`

**Interfaces:**
- Changes: `bootstrapSimulation(mainResult, simulationResult, now)` accepts a timestamp.
- Produces ready result with `shouldPersist`, `durationAdjusted`, and synchronized `draft`.
- Produces stale result `{ kind: 'stale-main'; draft; persistenceAvailable; shouldPersist; durationAdjusted }` only for unavailable Main reads with a valid saved draft.
- Removes: `mainChanged` user-action branch.

- [ ] **Step 1: Replace the old “flag without overwrite” test with synchronization tests**

```ts
it('replaces only Main-owned source fields and requests persistence', () => {
  const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 200 };
  const result = bootstrapSimulation(
    { status: 'found', source: latest },
    { status: 'found', draft, migration: null },
    999,
  );
  expect(result).toMatchObject({
    kind: 'ready',
    shouldPersist: true,
    draft: {
      source: latest,
      initialInvestmentWon: draft.initialInvestmentWon,
      years: draft.years,
      expectedAnnualReturnPercent: draft.expectedAnnualReturnPercent,
      updatedAt: 999,
    },
  });
});

it('keeps a valid saved result when Main storage is unavailable', () => {
  expect(bootstrapSimulation(
    { status: 'unavailable' },
    { status: 'found', draft, migration: null },
    999,
  )).toEqual({
    kind: 'stale-main',
    draft,
    persistenceAvailable: true,
    shouldPersist: false,
    durationAdjusted: false,
  });
});
```

- [ ] **Step 2: Run bootstrap tests and verify RED**

Run: `npx vitest run tests/unit/simulation/bootstrap.test.ts`

Expected: FAIL because the current bootstrap returns `main-required` or `mainChanged`.

- [ ] **Step 3: Implement pure source synchronization**

```ts
function syncSource(
  draft: CompoundSimulationDraft,
  latest: SimulationMainSource,
  now: number,
): CompoundSimulationDraft {
  return sourcesEqual(draft.source, latest)
    ? draft
    : { ...draft, source: latest, updatedAt: now };
}
```

Set `shouldPersist` when the source changed or repository migration metadata is non-null. Set `durationAdjusted` only for `duration-capped`, including the `stale-main` outcome so a migrated draft can be saved and explained even when Main cannot be read. Keep `empty`, `invalid`, and `zero-contribution` as blocking `main-required` outcomes.

- [ ] **Step 4: Run bootstrap tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/bootstrap.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/application/bootstrap.ts tests/unit/simulation/bootstrap.test.ts
git commit -m "feat(simulation): sync latest Main source"
```

### Task 4: Simplify shared scenario controls

**Files:**
- Modify: `src/simulation/ui/SimulationControls.tsx`
- Test: `tests/unit/simulation/SimulationControls.test.tsx`

**Interfaces:**
- Consumes: `CompoundSimulationDraft` and `onChange(next)`.
- Produces: one 0–30 year slider, one year number input, four return choices, and conditional custom input controls.
- Removes: duration stepper and 10/20/30 duration shortcuts.

- [ ] **Step 1: Rewrite control tests around approved behavior**

```tsx
it('keeps the 0–30 slider and year input synchronized', () => {
  const onChange = vi.fn();
  render(<SimulationControls draft={draft} onChange={onChange} />);
  const slider = screen.getByRole('slider', { name: '기간' });
  expect(slider).toHaveAttribute('min', '0');
  expect(slider).toHaveAttribute('max', '30');
  fireEvent.change(slider, { target: { value: '0' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 0 }));
  expect(screen.queryByRole('button', { name: '기간 1년 늘리기' })).not.toBeInTheDocument();
});

it('shows direct input and 0.25%p buttons only for custom return', () => {
  render(<SimulationControls draft={draft} onChange={vi.fn()} />);
  expect(screen.queryByRole('spinbutton', { name: '연 기대수익률 직접 입력' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
  expect(screen.getByRole('spinbutton', { name: '연 기대수익률 직접 입력' })).toBeVisible();
  expect(screen.getByRole('button', { name: '기대수익률 0.25%p 올리기' })).toBeVisible();
});
```

- [ ] **Step 2: Run controls tests and verify RED**

Run: `npx vitest run tests/unit/simulation/SimulationControls.test.tsx`

Expected: FAIL because current duration range is 1–50 and direct input is always visible.

- [ ] **Step 3: Implement duration and return controls**

Use local raw strings so invalid edits stay visible without mutating the saved draft. `직접 입력` sets local custom mode; preset buttons set both the draft value and custom mode false. Disable `−` at 0 and `+` at 30 rather than silently crossing bounds.

```tsx
<input aria-label="기간" type="range" min="0" max="30" value={draft.years} />
<input aria-label="기간 숫자" type="number" min="0" max="30" value={yearsRaw} />
```

- [ ] **Step 4: Verify invalid-input behavior**

Add this table to the control test. Expected: raw value remains visible, field has `aria-invalid="true"`, the exact correction message appears, and `onChange` is not called.

```tsx
it.each([
  ['기간 숫자', '', '0~30년 사이의 정수를 입력해주세요.'],
  ['기간 숫자', '-1', '0~30년 사이의 정수를 입력해주세요.'],
  ['기간 숫자', '31', '0~30년 사이의 정수를 입력해주세요.'],
  ['연 기대수익률 직접 입력', '9.123', '0~30 사이, 소수점 둘째 자리까지 입력해주세요.'],
])('rejects invalid %s value %s', (name, value, message) => {
  const onChange = vi.fn();
  render(<SimulationControls draft={draft} onChange={onChange} />);
  if (name.includes('기대수익률')) {
    fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
  }
  fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } });
  expect(screen.getByText(message)).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/SimulationControls.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/ui/SimulationControls.tsx tests/unit/simulation/SimulationControls.test.tsx
git commit -m "feat(simulation): simplify scenario controls"
```

### Task 5: Build the two-stage first-run onboarding

**Files:**
- Create: `src/simulation/ui/SimulationOnboarding.tsx`
- Create: `src/simulation/ui/StartingPrincipalStep.tsx`
- Create: `src/simulation/ui/ScenarioSetupStep.tsx`
- Delete: `src/simulation/ui/StartingPrincipalPrompt.tsx`
- Create: `tests/unit/simulation/SimulationOnboarding.test.tsx`

**Interfaces:**
- Consumes: `source`, `now`, and `onComplete(draft)`.
- Uses: `createDefaultSimulationDraft`, `SimulationControls`, `projectCompoundGrowth`, `formatWon`.
- Produces: one complete valid draft only after `결과 보기`.

- [ ] **Step 1: Write failing onboarding-flow tests**

```tsx
it('guides a zero-principal user through two stages', () => {
  const onComplete = vi.fn();
  render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);
  fireEvent.click(screen.getByRole('button', { name: '없어요' }));
  expect(screen.getByRole('heading', { name: '얼마나 오래, 어느 정도 수익을 기대할까요?' })).toBeVisible();
  expect(screen.getByText(/이대로 20년 유지하면/)).toBeVisible();
  expect(screen.getByRole('img', { name: '설정 결과 미리보기' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    initialInvestmentWon: 0,
    years: 20,
    expectedAnnualReturnPercent: 9,
  }));
});
```

Add a second test proving `있어요` reveals the amount input, accepts digits, and carries that amount into stage 2 without saving before completion.

- [ ] **Step 2: Run the new test and verify RED**

Run: `npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement focused stage components**

`SimulationOnboarding` owns `stage` and a local draft. `StartingPrincipalStep` owns only the yes/no and raw principal interaction. `ScenarioSetupStep` renders shared controls, the single live sentence, a small chart preview, the non-recommendation note, and `결과 보기`.

```ts
export interface SimulationOnboardingProps {
  source: SimulationMainSource;
  now(): number;
  onComplete(draft: CompoundSimulationDraft): void;
}
```

- [ ] **Step 4: Verify stage focus and primary-action semantics**

Add assertions that each new heading receives programmatic focus after transition, only one primary action is present per stage, and advanced calculation terms are absent.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/SimulationControls.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/ui/SimulationOnboarding.tsx src/simulation/ui/StartingPrincipalStep.tsx src/simulation/ui/ScenarioSetupStep.tsx src/simulation/ui/StartingPrincipalPrompt.tsx tests/unit/simulation/SimulationOnboarding.test.tsx
git commit -m "feat(simulation): add guided first run"
```

### Task 6: Compose the concise result experience and persistence feedback

**Files:**
- Create: `src/simulation/ui/SimulationHero.tsx`
- Create: `src/simulation/ui/SimulationComparison.tsx`
- Create: `src/simulation/ui/SaveIndicator.tsx`
- Create: `src/simulation/ui/SimulationMenu.tsx`
- Modify: `src/simulation/ui/AdvancedSettings.tsx`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Delete: `src/simulation/ui/SimulationSummary.tsx`
- Create: `tests/unit/simulation/SimulationHero.test.tsx`
- Create: `tests/unit/simulation/SaveIndicator.test.tsx`
- Modify: `tests/unit/simulation/AdvancedSettings.test.tsx`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`

**Interfaces:**
- Produces: `SimulationSaveState = 'saving' | 'saved' | 'error'`.
- Produces: `SimulationMenu({ onReset, resetFailed })` with confirmation.
- Consumes: synchronized bootstrap results from Task 3 and onboarding from Task 5.
- Preserves: repository save/clear operations and Main read-only behavior.

- [ ] **Step 1: Write failing hero and comparison tests**

```tsx
it('renders one result sentence and one nonduplicated condition line', () => {
  render(<SimulationHero draft={draft} result={projectCompoundGrowth(draft)} />);
  expect(screen.getByRole('heading', {
    name: /이대로 20년 유지하면 .*이 됩니다!/
  })).toBeVisible();
  expect(screen.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
  expect(screen.queryByText('월 50만 원')).not.toBeInTheDocument();
});
```

Add year-zero copy assertion `현재 시작 자산은 …입니다!` and comparison assertions for exactly `전부 저축보다` and `납입원금 대비`.

- [ ] **Step 2: Write failing app synchronization, revisit, and reset tests**

Cover:

- valid saved draft skips onboarding;
- latest Main source is persisted once while Simulation-owned settings remain unchanged;
- `duration-capped` shows `기간 범위가 변경되어 30년으로 조정됐어요` once;
- stale Main keeps the last result labeled `이전 Main 기준` and offers retry/Main navigation;
- reset lives under `Simulation 메뉴`, requires confirmation, clears only Simulation, and returns to onboarding;
- clear failure keeps current result and exposes an alert.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npx vitest run tests/unit/simulation/SimulationHero.test.tsx tests/unit/simulation/SaveIndicator.test.tsx tests/unit/simulation/AdvancedSettings.test.tsx tests/unit/simulation/SimulationApp.test.tsx`

Expected: FAIL because result components and new app states do not exist.

- [ ] **Step 4: Implement result components and save indicator**

```ts
export type SimulationSaveState = 'saving' | 'saved' | 'error';
```

`SimulationHero` owns only the heading and condition line. `SimulationComparison` owns only the two metrics. `SaveIndicator` always renders a visible label and uses a polite live region; error adds icon/text emphasis without removing the current calculation.

Change `AdvancedSettings` so `명목 · 실질` remains visible and `기준금리`, `물가상승률 차이`, reinvestment assumption, and non-advisory text live inside `<details><summary>계산 기준</summary>`.

- [ ] **Step 5: Integrate app states without mixing UI details into bootstrap**

`SimulationApp` must:

1. call `bootstrapSimulation(..., now())` once per mount;
2. render blocking Main recovery, stale result, onboarding, or current result;
3. persist a migrated/synchronized draft once;
4. set `saving` before repository save and then `saved` or `error`;
5. keep the active draft when save/clear fails;
6. never call a Main write API.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/SimulationHero.test.tsx tests/unit/simulation/SaveIndicator.test.tsx tests/unit/simulation/AdvancedSettings.test.tsx tests/unit/simulation/SimulationApp.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/ui/SimulationHero.tsx src/simulation/ui/SimulationComparison.tsx src/simulation/ui/SaveIndicator.tsx src/simulation/ui/SimulationMenu.tsx src/simulation/ui/AdvancedSettings.tsx src/simulation/ui/SimulationApp.tsx src/simulation/ui/SimulationSummary.tsx tests/unit/simulation/SimulationHero.test.tsx tests/unit/simulation/SaveIndicator.test.tsx tests/unit/simulation/AdvancedSettings.test.tsx tests/unit/simulation/SimulationApp.test.tsx
git commit -m "feat(simulation): focus result experience"
```

### Task 7: Rebuild graph exploration around a cursor-following card

**Files:**
- Modify: `src/simulation/ui/chartGeometry.ts`
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Create: `src/simulation/ui/GrowthChartTooltip.tsx`
- Modify: `tests/unit/simulation/chartGeometry.test.ts`
- Modify: `tests/unit/simulation/GrowthChart.test.tsx`

**Interfaces:**
- Produces: geometry points with chart `x`, both series `y`, and original projection point.
- Produces: integer x/y tick descriptions using `formatChartAxisWon`.
- Produces: tooltip position `{ side: 'left' | 'right'; anchorX: number }`.
- Preserves: same six approved detail values across pointer, touch, and keyboard.

- [ ] **Step 1: Write failing geometry and tooltip tests**

```ts
it('places the tooltip opposite the nearest viewport edge', () => {
  expect(tooltipSide(620, 680, 240)).toBe('left');
  expect(tooltipSide(120, 680, 240)).toBe('right');
});
```

Add assertions that x ticks include `현재` and `30년`, y ticks use no decimal, and zero-year geometry stays finite.

- [ ] **Step 2: Write failing interaction tests**

Cover:

- pointer move selects the nearest year;
- a vertical guide and two point markers appear;
- tooltip contains year, current plan, all savings, principal, savings, and investment;
- repeated touch toggles the same point off;
- outside touch and Escape dismiss;
- ArrowLeft/ArrowRight move one year without a visible second slider;
- accessible text summary includes current conditions and final values.

- [ ] **Step 3: Run focused graph tests and verify RED**

Run: `npx vitest run tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx`

Expected: FAIL because ticks, collision position, markers, and direct arrow navigation are absent.

- [ ] **Step 4: Implement geometry and tooltip component**

```ts
export function tooltipSide(
  anchorX: number,
  chartWidth: number,
  tooltipWidth: number,
): 'left' | 'right' {
  return anchorX + 12 + tooltipWidth > chartWidth ? 'left' : 'right';
}
```

`GrowthChartTooltip` renders current-plan amount as its primary number and the other four values in a two-column detail grid. It receives already selected numeric values and never recalculates projection.

- [ ] **Step 5: Implement equivalent pointer, touch, and keyboard state**

Use one `activeIndex: number | null`. Pointer/touch converts x to nearest index. A focusable chart interaction surface handles ArrowLeft, ArrowRight, Home, End, and Escape. Do not expose a second visible year slider under the graph.

- [ ] **Step 6: Run focused graph tests and verify GREEN**

Run: `npx vitest run tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/ui/chartGeometry.ts src/simulation/ui/GrowthChart.tsx src/simulation/ui/GrowthChartTooltip.tsx tests/unit/simulation/chartGeometry.test.ts tests/unit/simulation/GrowthChart.test.tsx
git commit -m "feat(simulation): enrich graph exploration"
```

### Task 8: Apply Main-aligned editorial styling and responsive behavior

**Files:**
- Modify: `src/simulation/ui/simulation.css`
- Modify: `src/simulation/ui/SimulationOnboarding.tsx`
- Modify: `src/simulation/ui/StartingPrincipalStep.tsx`
- Modify: `src/simulation/ui/ScenarioSetupStep.tsx`
- Modify: `src/simulation/ui/SimulationControls.tsx`
- Modify: `src/simulation/ui/SimulationHero.tsx`
- Modify: `src/simulation/ui/SimulationComparison.tsx`
- Modify: `src/simulation/ui/AdvancedSettings.tsx`
- Modify: `src/simulation/ui/SaveIndicator.tsx`
- Modify: `src/simulation/ui/SimulationMenu.tsx`
- Modify: `src/simulation/ui/GrowthChart.tsx`
- Modify: `src/simulation/ui/GrowthChartTooltip.tsx`
- Modify: `tests/simulation.spec.ts`

**Interfaces:**
- Consumes: semantic component structure from Tasks 4–7.
- Produces: one full-width result flow, large graph, responsive two-column pairs, 44px controls, tooltip containment, and reduced motion.

- [ ] **Step 1: Replace browser expectations with the approved first-run and result flow**

```ts
await page.getByRole('button', { name: '없어요' }).click();
await expect(page.getByRole('heading', {
  name: '얼마나 오래, 어느 정도 수익을 기대할까요?'
})).toBeVisible();
await page.getByRole('button', { name: '결과 보기' }).click();
await expect(page.getByRole('heading', {
  name: /이대로 20년 유지하면 .*이 됩니다!/
})).toBeVisible();
```

Add external-flow coverage for year 0, 30, direct return input, latest Main auto-sync, reset menu, Main immutability, and amount-mode disclosure.

- [ ] **Step 2: Add responsive and interaction browser assertions**

At 390×844, 768×900, and 1280×900 assert:

- page and graph have no horizontal overflow;
- graph is visible;
- comparison metrics are visible;
- every visible button/input bounding box is at least 44px high;
- touch at chart midpoint opens contained tooltip;
- keyboard focus and ArrowLeft reveal year detail;
- tooltip bounding box stays within viewport;
- `prefers-reduced-motion: reduce` does not hide state.

- [ ] **Step 3: Run browser tests and verify RED before CSS rewrite**

Run: `npx playwright test tests/simulation.spec.ts --reporter=list`

Expected: FAIL on new semantic copy, onboarding stage, and layout assertions.

- [ ] **Step 4: Rewrite scoped CSS around the editorial hierarchy**

Use existing `app-foundation.css` tokens. Keep ISF Pearl canvas, flat white surfaces, single-color borders, Gowun Batang for the hero, Gowun Dodum for controls, Sunset for primary/selected states, and Deep Sea for the current-plan curve. Remove gradients and unnecessary nested card backgrounds from Simulation CSS.

Required breakpoints:

```css
@media (max-width: 767px) { /* 390px behavior */ }
@media (min-width: 768px) { /* tablet and desktop */ }
@media (prefers-reduced-motion: reduce) { /* indicator/chart motion */ }
```

- [ ] **Step 5: Run browser tests and inspect screenshots**

Run: `npx playwright test tests/simulation.spec.ts --reporter=list`

Expected: PASS.

Capture or inspect the three required viewport screenshots. Confirm visually: one dominant sentence, no repeated result card, chart remains central, tooltip is designed rather than plain text, controls do not dominate, and mobile retains useful 2-column pairs.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/ui/simulation.css src/simulation/ui/SimulationOnboarding.tsx src/simulation/ui/StartingPrincipalStep.tsx src/simulation/ui/ScenarioSetupStep.tsx src/simulation/ui/SimulationControls.tsx src/simulation/ui/SimulationHero.tsx src/simulation/ui/SimulationComparison.tsx src/simulation/ui/AdvancedSettings.tsx src/simulation/ui/SaveIndicator.tsx src/simulation/ui/SimulationMenu.tsx src/simulation/ui/GrowthChart.tsx src/simulation/ui/GrowthChartTooltip.tsx tests/simulation.spec.ts
git commit -m "style(simulation): align editorial layout"
```

### Task 9: Align canonical documents and complete regression evidence

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `DESIGN.md`
- Modify: `.planning/REQUIREMENTS.md`
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/codebase/ARCHITECTURE.md`
- Modify: `.planning/codebase/STRUCTURE.md`
- Modify: `.planning/codebase/TESTING.md`
- Modify: `README.md`
- Modify: `tests/app-journey.spec.ts`

**Interfaces:**
- Consumes: completed runtime behavior and evidence from Tasks 1–8.
- Produces: canonical current-product claims matching Main + detailed Simulation + readiness-only Portfolio/Account Map.

- [ ] **Step 1: Update journey regression to detailed Simulation behavior**

Keep the Main CTA and launcher assertions. Replace any readiness wording with the supported first-run heading, and add a revisit case seeded with a valid current draft proving direct result entry and latest Main synchronization.

- [ ] **Step 2: Update canonical product claims**

Make these statements consistent across the listed documents:

- Main and Simulation are current detailed products.
- Portfolio and Account Map remain readiness-only.
- Simulation first run has two stages; revisit is result-first.
- Main contributions sync automatically on Simulation entry without write-back.
- Duration is 0–30 years.
- Results use the approved Korean integer-unit formatting.
- Current detailed Simulation has focused unit/browser evidence at 390px, 768px, and desktop.

Remove stale claims that Simulation is readiness-only, 1–50 years, or requires manual restart to adopt Main changes.

- [ ] **Step 3: Verify document links and state assertions**

Run:

```bash
test -f docs/superpowers/specs/2026-08-03-simulation-experience-redesign-design.md
test -f docs/superpowers/specs/2026-07-30-simulation-compound-growth-design.md
git diff --check
rg -n "Simulation.*준비 중|1~50|1–50|Main.*변경.*다시 시작" docs .planning DESIGN.md README.md
```

Expected: file/link checks PASS; search returns only clearly historical or superseded context, not current-product claims.

- [ ] **Step 4: Run full static and focused unit verification**

Run:

```bash
npm run check
npx vitest run tests/unit/simulation
```

Expected: PASS with zero TypeScript or Vitest failures.

- [ ] **Step 5: Run current browser regressions**

Run:

```bash
npx playwright test tests/simulation.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts --reporter=list
```

Expected: PASS with zero Playwright failures.

- [ ] **Step 6: Run build and legacy-boundary checks**

Run:

```bash
npm run build
rg -n "apps/simulation/app\.js|src/entries/step2|strategyCardGroup|isf-step2-saves" src apps/simulation/index.html tests/simulation.spec.ts tests/app-journey.spec.ts
```

Expected: build PASS; search finds no supported-runtime or focused-test dependency on removed legacy Simulation paths/selectors/storage.

Note: `npm run build` bumps tracked version files in this repository. Review those generated diffs and include them only if repository convention requires the build bump in this branch; otherwise coordinate the version-file ownership before committing.

- [ ] **Step 7: Commit documents and regression updates**

```bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md DESIGN.md .planning/REQUIREMENTS.md .planning/STATE.md .planning/ROADMAP.md .planning/codebase/ARCHITECTURE.md .planning/codebase/STRUCTURE.md .planning/codebase/TESTING.md README.md tests/app-journey.spec.ts
git commit -m "docs(simulation): align current experience"
```

## Final Review Gate

- [ ] Compare every acceptance criterion in `docs/superpowers/specs/2026-08-03-simulation-experience-redesign-design.md` with a passing unit, browser, document, or manual visual check.
- [ ] Run `git status --short` and preserve unrelated user or worker changes.
- [ ] Run `git diff --check` on the final branch.
- [ ] Use `superpowers:requesting-code-review` before integration.
- [ ] Use `superpowers:verification-before-completion` before claiming completion.
