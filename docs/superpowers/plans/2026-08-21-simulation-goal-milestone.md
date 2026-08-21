# Simulation Goal Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Simulation's selected-period total headline with a saved goal milestone and its first reachable month within 30 years.

**Architecture:** Extend the Simulation draft to schema v3 with a persisted `targetAmountWon`, while permitting `null` only for migrated high-principal drafts that must answer the goal question. Make workspace parsing surface Simulation-slice migration so the existing persistence queue writes the normalized slice without changing other apps. Keep the graph projection on the user-selected annual horizon and add an independent 360-month domain search for the hero.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Playwright, browser workspace repository.

**Spec:** `docs/superpowers/specs/2026-08-21-simulation-goal-milestone-design.md`

## Global Constraints

- Simulation reads Main monthly savings and investment values but never writes Main or another app slice.
- Start assets below 80,000,000 won target 100,000,000 won; assets from 80,000,000 to below 200,000,000 won target 200,000,000 won; assets at or above 200,000,000 won require a user goal.
- A goal is a positive safe-integer won amount strictly greater than starting assets; no arbitrary amount cap exists.
- The reach search stops at 360 months and uses the selected nominal or real amount mode.
- The reach headline must not alter `draft.years`, graph points, comparison values, or the 0–30 year graph control.
- The first-use flow asks one decision at a time: starting assets, conditional goal, then expected annual return. Do not expose CAGR in the question title.
- Preserve existing v1/v2 workspace data, import/export behavior, focus, 390px, 768px, and desktop containment.

---

## File structure

- `src/simulation/domain/model.ts` — schema v3, target field, and migration result types.
- `src/simulation/domain/validation.ts` — target selection, strict current validation, v1/v2-to-v3 Simulation parsing.
- `src/simulation/domain/projection.ts` — pure 360-month target search sharing the projection's monthly arithmetic.
- `src/workspace/domain/validation.ts` and `src/workspace/domain/migration.ts` — accept a validated migrated Simulation slice and report that a workspace write is needed.
- `src/workspace/infrastructure/workspaceRepository.ts` and `src/simulation/infrastructure/simulationRepository.ts` — carry the Simulation migration signal into the existing persistence queue.
- `src/simulation/application/bootstrap.ts` — return `goal-required` instead of a result-ready state for a draft with no target.
- `src/simulation/ui/GoalAmountStep.tsx` — new focused, accessible single-goal question.
- `src/simulation/ui/ExpectedReturnStep.tsx` — new onboarding-only return question, without period controls or preview chart.
- `src/simulation/ui/SimulationOnboarding.tsx` — select principal, conditional goal, and return stages; resume migrated goal-required drafts.
- `src/simulation/ui/SimulationHero.tsx` — goal reach / 30-year-unreachable copy and existing conditions line.
- `src/simulation/ui/SimulationApp.tsx` — render onboarding for new and migrated goal-required drafts; keep graph and controls result-only.
- `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md` — update the current Simulation first-run contract from fixed two stages to conditional goal milestone flow.
- `tests/unit/simulation/*.test.tsx`, `tests/unit/simulation/*.test.ts`, `tests/unit/workspace/*.test.ts`, `tests/simulation.spec.ts` — domain, migration, accessibility, first-run, revisit, and viewport evidence.

### Task 1: Persist and migrate the Simulation goal contract

**Files:**
- Modify: `src/simulation/domain/model.ts`
- Modify: `src/simulation/domain/validation.ts`
- Modify: `src/workspace/domain/validation.ts`
- Modify: `src/workspace/domain/migration.ts`
- Modify: `src/workspace/infrastructure/workspaceRepository.ts`
- Modify: `src/simulation/infrastructure/simulationRepository.ts`
- Test: `tests/unit/simulation/validation.test.ts`
- Test: `tests/unit/workspace/validation.test.ts`
- Test: `tests/unit/workspace/workspaceRepository.test.ts`
- Test: `tests/unit/simulation/simulationRepository.test.ts`

**Interfaces:**
- Produces `targetForInitialInvestment(initialInvestmentWon: number): number | null` where `null` means a goal question is required.
- Produces `CompoundSimulationDraft` schema v3 with `targetAmountWon: number | null`.
- Produces a workspace load migration signal whenever its raw Simulation draft is v1 or v2, even if the outer workspace is already schema v2.
- Consumes existing `WorkspaceLoadResult.needsMigration` and `SimulationLoadResult.migration` persistence behavior.

- [ ] **Step 1: Write failing domain and workspace migration tests**

```ts
expect(targetForInitialInvestment(79_999_999)).toBe(100_000_000);
expect(targetForInitialInvestment(80_000_000)).toBe(200_000_000);
expect(targetForInitialInvestment(199_999_999)).toBe(200_000_000);
expect(targetForInitialInvestment(200_000_000)).toBeNull();

expect(parseStoredSimulationDraft({ ...v2Draft, schemaVersion: 2 })).toEqual({
  draft: { ...v3Draft, targetAmountWon: 100_000_000 },
  migration: 'schema-upgraded',
});
expect(parseStoredSimulationDraft({ ...v2Draft, initialInvestmentWon: 200_000_000 }))
  .toEqual({
    draft: { ...v3Draft, initialInvestmentWon: 200_000_000, targetAmountWon: null },
    migration: 'schema-upgraded',
  });
expect(parseSimulationDraft({ ...v3Draft, targetAmountWon: v3Draft.initialInvestmentWon }))
  .toBeNull();
```

Add a workspace fixture whose outer `schemaVersion` remains `2` but whose `simulation.draft.schemaVersion` is `2`; assert `BrowserWorkspaceRepository.load()` returns the v3-normalized Simulation draft with `needsMigration: true`, preserves the Main/Portfolio/locations/Account Map values byte-for-value after a `migrate`, and rejects a malformed legacy target without accepting a partial workspace.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx vitest run tests/unit/simulation/validation.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/simulation/simulationRepository.test.ts`

Expected: FAIL because schema v3, target selection, and Simulation-slice migration signaling do not exist.

- [ ] **Step 3: Implement the smallest compatible schema and migration path**

```ts
export const SIMULATION_SCHEMA_VERSION = 3 as const;

export function targetForInitialInvestment(initialInvestmentWon: number): number | null {
  if (initialInvestmentWon < 80_000_000) return 100_000_000;
  if (initialInvestmentWon < 200_000_000) return 200_000_000;
  return null;
}

function isValidTarget(initialInvestmentWon: number, targetAmountWon: unknown): boolean {
  return targetAmountWon === null
    ? initialInvestmentWon >= 200_000_000
    : isPositiveSafeInteger(targetAmountWon) && targetAmountWon > initialInvestmentWon;
}
```

Make `createDefaultSimulationDraft()` include the automatic 100,000,000-won target for its zero starting assets. Parse current v3 drafts only with the exact v3 key set. Parse v1/v2 source drafts through a dedicated legacy key list, copy every existing validated field, calculate `targetAmountWon` with `targetForInitialInvestment`, and return `schema-upgraded` (while retaining the existing duration-cap behavior where applicable).

Change workspace slice parsing to call `parseStoredSimulationDraft`, retain its normalized draft, and expose whether that slice migrated through `VersionedWorkspaceParse`. Set `WorkspaceLoadResult.needsMigration` when either the outer workspace or its Simulation slice needs migration. Let `BrowserSimulationRepository.load()` translate that signal to its existing migration result so `SimulationApp` saves the normalized v3 slice through the established revision/conflict guard. Do not add a storage key or alter the workspace's outer schema version.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npx vitest run tests/unit/simulation/validation.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/simulation/simulationRepository.test.ts`

Expected: PASS, including v1/v2 normalization, high-principal `null` targets, exact-key rejection, and other-slice preservation.

- [ ] **Step 5: Commit the persistence boundary**

```bash
git add src/simulation/domain/model.ts src/simulation/domain/validation.ts src/workspace/domain/validation.ts src/workspace/domain/migration.ts src/workspace/infrastructure/workspaceRepository.ts src/simulation/infrastructure/simulationRepository.ts tests/unit/simulation/validation.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/simulation/simulationRepository.test.ts
git commit -m "feat(simulation): persist goal milestone"
```

### Task 2: Add a pure, monthly target-reach calculation

**Files:**
- Modify: `src/simulation/domain/projection.ts`
- Test: `tests/unit/simulation/projection.test.ts`
- Test: `tests/unit/simulation/format.test.ts`

**Interfaces:**
- Consumes a v3 `CompoundSimulationDraft` with a non-null target.
- Produces `findTargetReachMonth(draft: CompoundSimulationDraft): number | null` and `formatTargetReachDuration(month: number): string`.
- Does not change `projectCompoundGrowth()` points, final amounts, or selected graph duration.

- [ ] **Step 1: Write failing target-reach tests**

```ts
expect(findTargetReachMonth({ ...draft, targetAmountWon: 10_600_000 })).toBe(12);
expect(findTargetReachMonth({ ...draft, targetAmountWon: 10_050_000 })).toBe(1);
expect(formatTargetReachDuration(12)).toBe('1년');
expect(formatTargetReachDuration(19)).toBe('1년 7개월');
expect(formatTargetReachDuration(9)).toBe('9개월');
expect(findTargetReachMonth({ ...draft, targetAmountWon: Number.MAX_SAFE_INTEGER }))
  .toBeNull();
expect(findTargetReachMonth({ ...draft, amountMode: 'real' }))
  .not.toBe(findTargetReachMonth({ ...draft, amountMode: 'nominal' }));
```

Use a fixture with known monthly contributions to assert the first month, not a later yearly graph point. Include a zero-return/zero-contribution case that remains unreachable at month 360 and assert `projectCompoundGrowth({ ...draft, years: 10 })` still returns eleven annual points ending at month 120.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts`

Expected: FAIL because the reach calculation and duration formatter are absent.

- [ ] **Step 3: Implement the 360-month search without changing graph output**

```ts
export function findTargetReachMonth(draft: CompoundSimulationDraft): number | null {
  if (draft.targetAmountWon === null) return null;
  const target = draft.targetAmountWon;
  let savingsBalance = 0;
  let investmentBalance = draft.initialInvestmentWon;
  for (let month = 1; month <= 360; month += 1) {
    savingsBalance = savingsBalance * (1 + savingsMonthlyRate) + draft.source.monthlySavingsWon;
    investmentBalance = investmentBalance * (1 + investmentMonthlyRate)
      + draft.source.monthlyInvestmentWon;
    const amount = draft.amountMode === 'nominal'
      ? Math.round(savingsBalance) + Math.round(investmentBalance)
      : Math.round((savingsBalance + investmentBalance) / Math.pow(1 + inflationAnnualRate, month / 12));
    if (amount >= target) return month;
  }
  return null;
}
```

Factor the shared rate and month-balance arithmetic into a private helper if needed, then use that helper from both the reach search and `projectCompoundGrowth`. Preserve the current rounding semantics in `ProjectionPoint`: savings and investment are individually rounded before the nominal total, while real current-plan total follows the existing selected-mode calculation. Keep duration formatting in `format.ts` or a clearly named pure formatting export and never render `0개월`.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npx vitest run tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts`

Expected: PASS, with first-month precision, nominal/real divergence, unreachable 30-year behavior, and unchanged annual graph projection.

- [ ] **Step 5: Commit the calculation**

```bash
git add src/simulation/domain/projection.ts src/simulation/ui/format.ts tests/unit/simulation/projection.test.ts tests/unit/simulation/format.test.ts
git commit -m "feat(simulation): calculate goal reach month"
```

### Task 3: Build the single-decision onboarding stages

**Files:**
- Create: `src/simulation/ui/GoalAmountStep.tsx`
- Create: `src/simulation/ui/ExpectedReturnStep.tsx`
- Modify: `src/simulation/ui/SimulationOnboarding.tsx`
- Delete: `src/simulation/ui/ScenarioSetupStep.tsx`
- Test: `tests/unit/simulation/SimulationOnboarding.test.tsx`
- Test: `tests/unit/simulation/ExpectedReturnStep.test.tsx`

**Interfaces:**
- `GoalAmountStep({ initialInvestmentWon, onContinue })` calls `onContinue(targetAmountWon: number)` only when target is a safe integer greater than starting assets.
- `ExpectedReturnStep({ draft, onChange, onComplete })` owns onboarding return controls only and calls `onComplete()` with no period adjustment.
- `SimulationOnboarding` accepts an optional migrated draft with `targetAmountWon: null` and starts directly at the goal stage.

- [ ] **Step 1: Write failing first-use and resumed-goal tests**

```tsx
fireEvent.click(screen.getByRole('button', { name: '있어요' }));
fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
  target: { value: '200000000' },
});
fireEvent.click(screen.getByRole('button', { name: '다음' }));
expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();

fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), {
  target: { value: '200000000' },
});
expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
expect(screen.getByRole('alert')).toHaveText('현재 모아둔 투자금보다 큰 금액을 입력해주세요.');
```

Assert 79,999,999 won and 80,000,000 won skip the goal question with automatic 100,000,000 and 200,000,000 targets respectively. Assert the final return screen's only adjustable data is expected return, its heading is `매년 어느 정도 수익을 기대하나요?`, it retains the non-recommendation note, and its completion passes `years: 20` plus the selected rate. Assert `initialDraft` with `targetAmountWon: null` lands on the goal question and preserves the original rate after completion.

- [ ] **Step 2: Run the focused component tests to verify they fail**

Run: `npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/ExpectedReturnStep.test.tsx`

Expected: FAIL because the conditional goal stage and return-only component do not exist.

- [ ] **Step 3: Implement focused stages and remove the old mixed scenario surface**

```tsx
type Stage = 'principal' | 'goal' | 'return';

function continueFromPrincipal(initialInvestmentWon: number): void {
  const targetAmountWon = targetForInitialInvestment(initialInvestmentWon);
  setDraft((current) => ({ ...current, initialInvestmentWon, targetAmountWon }));
  setStage(targetAmountWon === null ? 'goal' : 'return');
}
```

Give `GoalAmountStep` the same `Surface`, heading focus, numeric input mode, submit semantics, primary action, and error association as `StartingPrincipalStep`; do not add presets or extra controls. Build `ExpectedReturnStep` from the existing 5/9/13/direct-input behavior, but do not import `SimulationControls`, `GrowthChart`, or `projectCompoundGrowth`. Delete `ScenarioSetupStep.tsx` only after all imports and tests move to `ExpectedReturnStep`; retain the result-page `SimulationControls` unchanged.

- [ ] **Step 4: Run focused component tests to verify they pass**

Run: `npx vitest run tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/ExpectedReturnStep.test.tsx tests/unit/simulation/sharedComponents.test.ts`

Expected: PASS, including stage focus, validation error association, automatic threshold targets, no onboarding period control, and retained shared components.

- [ ] **Step 5: Commit the onboarding flow**

```bash
git add src/simulation/ui/GoalAmountStep.tsx src/simulation/ui/ExpectedReturnStep.tsx src/simulation/ui/SimulationOnboarding.tsx src/simulation/ui/ScenarioSetupStep.tsx tests/unit/simulation/SimulationOnboarding.test.tsx tests/unit/simulation/ExpectedReturnStep.test.tsx tests/unit/simulation/sharedComponents.test.ts
git commit -m "feat(simulation): guide goal and return setup"
```

### Task 4: Route goal-required drafts and render the milestone hero

**Files:**
- Modify: `src/simulation/application/bootstrap.ts`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/simulation/ui/SimulationHero.tsx`
- Test: `tests/unit/simulation/bootstrap.test.ts`
- Test: `tests/unit/simulation/SimulationApp.test.tsx`
- Test: `tests/unit/simulation/SimulationHero.test.tsx`

**Interfaces:**
- `bootstrapSimulation()` produces `{ kind: 'goal-required'; draft; latestMainSource; persistenceAvailable; shouldPersist; durationAdjusted }` when a found draft has `targetAmountWon: null`.
- `SimulationHero` consumes a non-null target and `findTargetReachMonth()`.
- Result rendering is permitted only for a draft with a numeric `targetAmountWon`.

- [ ] **Step 1: Write failing bootstrap, app, and hero tests**

```tsx
expect(bootstrapSimulation(
  { status: 'found', source },
  { status: 'found', draft: { ...draft, initialInvestmentWon: 200_000_000, targetAmountWon: null }, migration: 'schema-upgraded' },
  999,
)).toMatchObject({ kind: 'goal-required', shouldPersist: true });

render(<SimulationHero draft={{ ...draft, targetAmountWon: 100_000_000 }} result={result} />);
expect(screen.getByRole('heading', { name: /1억 원을 모으려면 \d+년/ })).toBeVisible();

render(<SimulationHero draft={{ ...draft, targetAmountWon: Number.MAX_SAFE_INTEGER }} result={result} />);
expect(screen.getByRole('heading', { name: /현재 조건으로는 30년 안에 .*에 도달하기 어려워요/ })).toBeVisible();
```

In `SimulationApp` tests, assert a migrated high-principal draft renders the goal heading rather than `SimulationHero` or `GrowthChart`, completing the target returns to the saved result flow, and a source refresh preserves `targetAmountWon`. Assert changing `draft.years` does not change the hero copy while changing expected return or amount mode can change it.

- [ ] **Step 2: Run the focused integration tests to verify they fail**

Run: `npx vitest run tests/unit/simulation/bootstrap.test.ts tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationHero.test.tsx`

Expected: FAIL because bootstrap has no goal-required branch and the hero still uses selected-period total copy.

- [ ] **Step 3: Implement the guarded result route and milestone copy**

```tsx
const goalRequired = draft !== null && draft.targetAmountWon === null;

{draft === null && latestSource !== null ? (
  <SimulationOnboarding source={latestSource} now={now} onComplete={saveDraft} />
) : goalRequired ? (
  <SimulationOnboarding initialDraft={draft} now={now} onComplete={saveDraft} />
) : draft !== null && result !== null ? (
  // existing result, chart, comparison, controls, and advanced settings
) : null}
```

Handle `goal-required` before rendering a result in `SimulationApp`. Preserve the current persistence queue and only save a completed target; never show the current stale-main recovery as a normal completed result while the target is missing. In `SimulationHero`, call the target search and render either `formatWon(target) + '을 모으려면 ' + formatTargetReachDuration(month) + '이 걸려요'` or `현재 조건으로는 30년 안에 ${formatWon(target)}에 도달하기 어려워요`. Keep exactly one heading and the existing condition line.

- [ ] **Step 4: Run focused integration tests to verify they pass**

Run: `npx vitest run tests/unit/simulation/bootstrap.test.ts tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationHero.test.tsx`

Expected: PASS, including guarded migrated drafts, headline reactivity, unchanged graph/period controls, and unreachable copy.

- [ ] **Step 5: Commit the result integration**

```bash
git add src/simulation/application/bootstrap.ts src/simulation/ui/SimulationApp.tsx src/simulation/ui/SimulationHero.tsx tests/unit/simulation/bootstrap.test.ts tests/unit/simulation/SimulationApp.test.tsx tests/unit/simulation/SimulationHero.test.tsx
git commit -m "feat(simulation): show goal reach summary"
```

### Task 5: Update product contract and prove the user journey

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/app-journey.spec.ts` only if existing Simulation navigation assertions use removed onboarding copy

**Interfaces:**
- Documents the conditional three-stage first-run flow and the result headline's 30-year target-reach meaning.
- Verifies the supported browser route at 390px, 768px, and desktop.

- [ ] **Step 1: Write failing end-to-end assertions**

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: '있어요' }).click();
await page.getByRole('textbox', { name: '현재 모아둔 투자금' }).fill('200000000');
await page.getByRole('button', { name: '다음' }).click();
await expect(page.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
await page.getByRole('textbox', { name: '목표 금액' }).fill('300000000');
await page.getByRole('button', { name: '다음' }).click();
await page.getByRole('button', { name: '결과 보기' }).click();
await expect(page.getByRole('heading', { name: /3억 원을 모으려면|현재 조건으로는 30년 안에 3억 원/ })).toBeVisible();
expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
```

Add 768px and desktop cases asserting the hero bounding box intersects the viewport after result entry, the graph period input remains at 20, and changing it to 0 then 30 does not change the goal headline. Add a persisted v2 high-principal workspace fixture that opens the goal question, completes it, and verifies Main's applied slice is unchanged. Replace old assertions for `얼마나 오래, 어느 정도 수익을 기대할까요?` and selected-period headline copy with the approved return question and goal copy.

- [ ] **Step 2: Run the focused E2E test to verify it fails**

Run: `npx playwright test tests/simulation.spec.ts`

Expected: FAIL because the current route has the mixed period/return onboarding and selected-period hero.

- [ ] **Step 3: Update the canonical PRD and align selectors only where needed**

Replace the Simulation first-setup statement in the PRD with the conditional start-assets → goal (at 200,000,000 won or more) → expected annual return flow; state that the result headline searches goal reach to 30 years independently of the graph's 0–30 user-selected period. Keep the Main read-only and Simulation slice ownership language intact. Do not change unrelated app claims or historical specifications.

- [ ] **Step 4: Run focused E2E at all required viewports**

Run: `npx playwright test tests/simulation.spec.ts`

Expected: PASS, including fresh automatic-target flows, high-principal goal input, migrated v2 recovery, reach headline, unchanged Main, focus, and 390px/768px/desktop containment.

- [ ] **Step 5: Run the complete required verification set**

Run: `npm run check`

Expected: PASS.

Run: `npm run test:e2e -- --reporter=list`

Expected: PASS with any intentional project-level skips reported separately.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 6: Commit contract and verification updates**

```bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md tests/simulation.spec.ts
git commit -m "test(simulation): cover goal milestone journey"
```

If `tests/app-journey.spec.ts` was changed to remove an obsolete Simulation selector, include that file in the same commit.

## Plan self-review

- Spec coverage: Tasks 1 and 4 cover schema v3, target persistence, high-principal migration, and goal-required recovery; Task 2 covers the independent 360-month nominal/real calculation and copy; Task 3 covers the single-decision onboarding flow; Task 5 covers the PRD, Main read-only behavior, responsive user flow, and full verification.
- Placeholder scan: no TBD/TODO, generic validation, or unspecified test steps remain.
- Type consistency: `targetForInitialInvestment`, `findTargetReachMonth`, `formatTargetReachDuration`, `GoalAmountStep`, `ExpectedReturnStep`, and `goal-required` are defined before their consuming tasks and use the same names throughout.
