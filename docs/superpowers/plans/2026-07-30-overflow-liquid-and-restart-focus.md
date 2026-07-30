# Overflow Liquid and Restart Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render income-relative overflow as a polished, horizontally compressed liquid extension and remove journey navigation from restart setup without changing saved values or first-setup behavior.

**Architecture:** A pure `overflowPresentation` helper owns deficit-to-visual conversion so both Main bars use identical width, motion, and droplet thresholds. The React components expose that model through CSS custom properties and decorative markup; CSS owns the contained breakout and reduced-motion presentation. `MainApp` derives restart focus from existing `mode` and `applied` state and conditionally omits journey UI.

**Tech Stack:** React 19, TypeScript 5.5, Tailwind CSS 4, Vitest 4, Testing Library, Playwright 1.60, Vite 5.

## Global Constraints

- Keep the income bar at visual length `100` and its current height.
- Display overflow as `min(max(deficitWon / incomeWon * 100, 0), 50) / 5`, producing visual length `0...10`.
- Use continuous fractional width; do not expose hard 10% cell boundaries.
- Show droplets only from `30%` overflow; cap visual width and motion at `50%`.
- Do not render overflow motion when income is zero or the calculation is non-finite.
- Respect `prefers-reduced-motion: reduce` with a static extension and no droplets.
- Preserve the allocation table, status text, hover/tap/focus details, and 44px interaction targets.
- Keep 390px and 768px documents free of horizontal scrolling.
- During restart setup (`mode === 'setup' && applied !== null`), do not render the app launcher or Simulation journey card.
- Preserve the existing prefilled restart draft and Cancel action.
- During first setup (`mode === 'setup' && applied === null`), preserve the launcher and disabled Simulation journey card.
- Do not stage or modify `package.json`, `public/manifest.webmanifest`, `shared/core/utils.js`, or `shared/legacy/sw.js`.

---

## File Structure

- Create `src/main/ui/setup/overflowPresentation.ts`: pure visual model and public types shared by both bars.
- Create `tests/unit/main/overflowPresentation.test.ts`: exact mapping, thresholds, caps, and invalid-input coverage.
- Modify `src/main/ui/setup/FlowContextSummary.tsx`: render shared overflow extension for the compact progress bar.
- Modify `src/main/ui/setup/AllocationBar.tsx`: render the same extension in the review allocation bar.
- Modify `src/main/ui/setup/SetupFlow.tsx`: permit the compact bar to cross the setup card boundary without clipping.
- Modify `src/main/ui/main.css`: breakout geometry, liquid polish, smooth motion, droplets, and reduced-motion fallback.
- Modify `tests/unit/main/FlowContextSummary.test.tsx`: compact-bar integration and accessibility regression coverage.
- Modify `tests/unit/main/AllocationBar.test.tsx`: allocation-bar integration, table regression, and threshold coverage.
- Modify `src/main/ui/MainApp.tsx`: derive restart focus and omit journey UI only during restart setup.
- Modify `tests/unit/main/MainApp.test.tsx`: restart, first setup, cancel, and applied-return visibility.
- Modify `tests/step1.spec.ts`: responsive overflow containment and restart focus user-flow coverage.

---

### Task 1: Shared Overflow Presentation Model

**Files:**
- Create: `src/main/ui/setup/overflowPresentation.ts`
- Create: `tests/unit/main/overflowPresentation.test.ts`

**Interfaces:**
- Consumes: `deficitWon: number`, `incomeWon: number`
- Produces:

```ts
export type OverflowIntensity = 'none' | 'calm' | 'active' | 'liquid' | 'maximum';

export interface OverflowPresentation {
  overflowPercent: number;
  displayLengthPercent: number;
  flowDurationMs: number;
  intensity: OverflowIntensity;
  showDroplets: boolean;
}

export function createOverflowPresentation(
  deficitWon: number,
  incomeWon: number,
): OverflowPresentation;
```

- [ ] **Step 1: Write exact mapping and threshold tests**

```ts
import { describe, expect, it } from 'vitest';
import { createOverflowPresentation } from '../../../src/main/ui/setup/overflowPresentation';

describe('createOverflowPresentation', () => {
  it.each([
    [0, 1_000_000, 0, 0, 'none', false],
    [100_000, 1_000_000, 10, 2, 'active', false],
    [150_000, 1_000_000, 15, 3, 'active', false],
    [300_000, 1_000_000, 30, 6, 'liquid', true],
    [500_000, 1_000_000, 50, 10, 'maximum', true],
    [800_000, 1_000_000, 80, 10, 'maximum', true],
  ] as const)(
    'maps deficit %s with income %s',
    (deficitWon, incomeWon, overflowPercent, displayLengthPercent, intensity, showDroplets) => {
      expect(createOverflowPresentation(deficitWon, incomeWon)).toMatchObject({
        overflowPercent,
        displayLengthPercent,
        intensity,
        showDroplets,
      });
    },
  );

  it.each([
    [100_000, 0],
    [Number.NaN, 1_000_000],
    [100_000, Number.POSITIVE_INFINITY],
    [-100_000, 1_000_000],
  ])('returns the static empty model for invalid input', (deficitWon, incomeWon) => {
    expect(createOverflowPresentation(deficitWon, incomeWon)).toEqual({
      overflowPercent: 0,
      displayLengthPercent: 0,
      flowDurationMs: 0,
      intensity: 'none',
      showDroplets: false,
    });
  });

  it('smoothly decreases duration until the 50% cap', () => {
    const at10 = createOverflowPresentation(100_000, 1_000_000);
    const at15 = createOverflowPresentation(150_000, 1_000_000);
    const at30 = createOverflowPresentation(300_000, 1_000_000);
    const at50 = createOverflowPresentation(500_000, 1_000_000);
    const at80 = createOverflowPresentation(800_000, 1_000_000);

    expect(at10.flowDurationMs).toBeGreaterThan(at15.flowDurationMs);
    expect(at15.flowDurationMs).toBeGreaterThan(at30.flowDurationMs);
    expect(at30.flowDurationMs).toBeGreaterThan(at50.flowDurationMs);
    expect(at80.flowDurationMs).toBe(at50.flowDurationMs);
  });
});
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```bash
npx vitest run tests/unit/main/overflowPresentation.test.ts
```

Expected: FAIL because `overflowPresentation.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

```ts
export type OverflowIntensity = 'none' | 'calm' | 'active' | 'liquid' | 'maximum';

export interface OverflowPresentation {
  overflowPercent: number;
  displayLengthPercent: number;
  flowDurationMs: number;
  intensity: OverflowIntensity;
  showDroplets: boolean;
}

const EMPTY_OVERFLOW: OverflowPresentation = {
  overflowPercent: 0,
  displayLengthPercent: 0,
  flowDurationMs: 0,
  intensity: 'none',
  showDroplets: false,
};

export function createOverflowPresentation(
  deficitWon: number,
  incomeWon: number,
): OverflowPresentation {
  if (
    !Number.isFinite(deficitWon)
    || !Number.isFinite(incomeWon)
    || deficitWon <= 0
    || incomeWon <= 0
  ) {
    return EMPTY_OVERFLOW;
  }

  const overflowPercent = deficitWon / incomeWon * 100;
  const cappedPercent = Math.min(overflowPercent, 50);
  const intensity: OverflowIntensity = cappedPercent >= 50
    ? 'maximum'
    : cappedPercent >= 30
      ? 'liquid'
      : cappedPercent >= 10
        ? 'active'
        : 'calm';

  return {
    overflowPercent,
    displayLengthPercent: cappedPercent / 5,
    flowDurationMs: Math.round(1_400 - cappedPercent / 50 * 950),
    intensity,
    showDroplets: cappedPercent >= 30,
  };
}
```

- [ ] **Step 4: Run focused tests and type checks**

Run:

```bash
npx vitest run tests/unit/main/overflowPresentation.test.ts
npm run check
```

Expected: model tests PASS; both TypeScript checks exit `0`.

- [ ] **Step 5: Commit the model**

```bash
git add src/main/ui/setup/overflowPresentation.ts tests/unit/main/overflowPresentation.test.ts
git commit -m "feat(main): model overflow presentation"
```

---

### Task 2: Liquid Breakout in Both Main Bars

**Files:**
- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/FlowContextSummary.test.tsx`
- Modify: `tests/unit/main/AllocationBar.test.tsx`
- Modify: `tests/step1.spec.ts`

**Interfaces:**
- Consumes: `createOverflowPresentation(deficitWon, incomeWon)` from Task 1.
- Produces:
  - `.flow-overflow-extension`
  - `.flow-overflow-sheen`
  - `.flow-overflow-droplets`
  - `data-overflow-intensity`
  - CSS variables `--overflow-length` and `--overflow-duration`

- [ ] **Step 1: Replace old pressure-hook expectations with liquid integration tests**

In both component suites, use deficit fixtures below the droplet threshold and at or above it:

```ts
const belowDropletData = {
  ...cashflowFixture,
  monthlyInvestmentWon: 1_500_000, // 40만 / 320만 = 12.5%
};
const liquidData = {
  ...cashflowFixture,
  monthlyInvestmentWon: 2_100_000, // 100만 / 320만 = 31.25%
};

it('renders a compressed overflow extension and adds droplets only at 30%', () => {
  const { rerender } = render(<FlowContextSummary data={belowDropletData} />);
  const wrapper = screen.getByRole('progressbar').parentElement;
  expect(wrapper).toHaveAttribute('data-overflow-intensity', 'active');
  expect(document.querySelector('.flow-overflow-extension')).toHaveStyle({
    '--overflow-length': '2.5%',
  });
  expect(document.querySelector('.flow-overflow-droplets')).not.toBeInTheDocument();

  rerender(<FlowContextSummary data={liquidData} />);
  expect(wrapper).toHaveAttribute('data-overflow-intensity', 'liquid');
  expect(document.querySelector('.flow-overflow-extension')).toHaveStyle({
    '--overflow-length': '6.25%',
  });
  expect(document.querySelectorAll('.flow-overflow-droplet')).toHaveLength(2);
});
```

Use the equivalent test with `AllocationBar`, keep its existing table row assertions, and assert an `80%` fixture produces `--overflow-length: 10%` while the table still reports `80.0%`.

- [ ] **Step 2: Run both component suites and verify RED**

Run:

```bash
npx vitest run tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
```

Expected: FAIL because the old pressure elements remain and the extension/custom properties do not exist.

- [ ] **Step 3: Render the shared decorative extension**

In each component:

```tsx
const overflow = createOverflowPresentation(cashflow.deficitWon, cashflow.incomeWon);
const overflowStyle = {
  '--overflow-length': `${overflow.displayLengthPercent}%`,
  '--overflow-duration': `${overflow.flowDurationMs}ms`,
} as React.CSSProperties;
```

Set `data-overflow-intensity={overflow.intensity}` on the existing wrapper. Replace pressure markup with:

```tsx
{overflow.intensity === 'none' ? null : (
  <span aria-hidden="true" className="flow-overflow-extension" style={overflowStyle}>
    <span className="flow-overflow-sheen" />
    {overflow.showDroplets ? (
      <span className="flow-overflow-droplets">
        <span className="flow-overflow-droplet" />
        <span className="flow-overflow-droplet" />
      </span>
    ) : null}
  </span>
)}
```

Import `type CSSProperties` from React and type `overflowStyle` as `CSSProperties`. Do not change the progressbar ARIA values, allocation table, segment targets, tooltip state, or deficit status copy.

- [ ] **Step 4: Replace pressure CSS with contained breakout geometry**

Implement these geometry rules in `main.css`:

```css
.flow-bar-wrapper {
  @apply relative;
  isolation: isolate;
}

.flow-overflow-extension {
  --overflow-length: 0%;
  --overflow-duration: 1400ms;
  @apply pointer-events-none absolute left-full top-1/2 z-2 block -translate-y-1/2;
  width: var(--overflow-length);
  height: 0.375rem;
  border-radius: 0 999px 999px 0;
  transform-origin: left center;
  background: linear-gradient(90deg, rgb(225 29 72 / 92%), rgb(251 146 60 / 88%));
  box-shadow: 0 2px 10px rgb(225 29 72 / 24%);
  transition:
    width 450ms cubic-bezier(.2, .8, .2, 1),
    box-shadow 450ms cubic-bezier(.2, .8, .2, 1);
}

.flow-overflow-sheen {
  @apply absolute inset-0 overflow-hidden rounded-r-full;
}

.flow-overflow-sheen::after {
  content: "";
  @apply absolute inset-y-0 w-2/5 rounded-full;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 48%), transparent);
  animation: overflow-liquid-flow var(--overflow-duration) ease-in-out infinite;
}
```

Use low-amplitude opacity/translate keyframes for the sheen. Keep extension height equal to the existing `h-1.5` track. Position droplets absolutely so they never affect document height. Remove `.flow-overflow-pressure`, `.allocation-bar__pressure`, old stripe animation, and their pressure keyframes.

Reserve a fixed maximum gutter regardless of current deficit:

```css
.allocation-bar,
.flow-context-summary {
  margin-inline-end: min(10%, 2.5rem);
}

.setup-flow-surface {
  overflow: visible;
}
```

In `SetupFlow.tsx`, replace `className="overflow-hidden shadow-float"` with `className="setup-flow-surface shadow-float"`. Add `overflow-hidden rounded-t-[inherit]` to the top progress-track wrapper so only that decoration remains clipped to the card radius. This lets the compact bar cross the setup card boundary while keeping the maximum extension inside the page. Do not vary the gutter with deficit size.

- [ ] **Step 5: Add reduced-motion assertions and CSS**

Add this Playwright assertion to the existing responsive Main suite:

```ts
await page.emulateMedia({ reducedMotion: 'reduce' });
const motion = await page.locator('.flow-overflow-extension').first().evaluate((element) => {
  const extension = getComputedStyle(element);
  const sheen = getComputedStyle(element.querySelector('.flow-overflow-sheen')!, '::after');
  const droplets = element.querySelector('.flow-overflow-droplets');
  return {
    extensionAnimation: extension.animationName,
    extensionTransition: extension.transitionDuration,
    sheenAnimation: sheen.animationName,
    dropletsDisplay: droplets === null ? 'absent' : getComputedStyle(droplets).display,
  };
});
expect(motion.extensionAnimation).toBe('none');
expect(motion.extensionTransition).toBe('0.01ms');
expect(motion.sheenAnimation).toBe('none');
expect(motion.dropletsDisplay).toBe('none');
```

Render droplets conditionally with a CSS reduced-motion hide as defense in depth:

```css
@media (prefers-reduced-motion: reduce) {
  .flow-overflow-extension,
  .flow-overflow-sheen::after,
  .flow-overflow-droplet {
    animation: none !important;
  }

  .flow-overflow-extension {
    transition-duration: 0.01ms !important;
  }

  .flow-overflow-droplets {
    display: none;
  }
}
```

- [ ] **Step 6: Add maximum-breakout responsive E2E coverage**

In `tests/step1.spec.ts`, create a valid applied fixture with an `80%` deficit, load Main, and test both viewports:

```ts
for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  await page.setViewportSize(viewport);
  await page.reload();
  const geometry = await page.locator('.flow-overflow-extension').first().evaluate((extension) => {
    const bar = extension.parentElement!.querySelector('.flow-bar')!.getBoundingClientRect();
    const liquid = extension.getBoundingClientRect();
    return {
      ratio: liquid.width / bar.width,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      insideViewport: liquid.right <= document.documentElement.clientWidth,
      sameHeight: Math.abs(liquid.height - 6) < 1,
    };
  });
  expect(geometry.ratio).toBeCloseTo(0.1, 2);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(4);
  expect(geometry.insideViewport).toBe(true);
  expect(geometry.sameHeight).toBe(true);
}
```

Expected first run before geometry completion: FAIL on ratio or containment. After CSS completion: PASS.

- [ ] **Step 7: Run focused and full Main verification**

Run:

```bash
npx vitest run tests/unit/main/overflowPresentation.test.ts tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx
npx playwright test tests/step1.spec.ts --reporter=list
npm run check
```

Expected: all focused unit tests PASS; current `step1` E2E suite PASS; TypeScript checks exit `0`.

- [ ] **Step 8: Commit both bar integrations**

```bash
git add src/main/ui/setup/FlowContextSummary.tsx src/main/ui/setup/AllocationBar.tsx src/main/ui/setup/SetupFlow.tsx src/main/ui/main.css tests/unit/main/FlowContextSummary.test.tsx tests/unit/main/AllocationBar.test.tsx tests/step1.spec.ts
git commit -m "feat(main): render liquid overflow breakout"
```

---

### Task 3: Restart Setup Journey Isolation

**Files:**
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/step1.spec.ts`

**Interfaces:**
- Consumes: existing `MainState.mode`, `MainState.applied`, `cancelDraft`, `journeyEntry`.
- Produces: `MainAppShell` prop `showLauncher?: boolean`; no new persisted state.

- [ ] **Step 1: Add restart-focus component tests**

Extend the existing restart test:

```ts
it('focuses restart setup by omitting journey navigation while preserving values and cancel', async () => {
  const applied = data(3_000_000);
  render(<MainApp repository={repository({ status: 'current', data: applied, original: {} })} />);
  await screen.findByRole('heading', { name: 'dashboard' });

  fireEvent.click(screen.getByRole('button', { name: 'restart-setup' }));

  expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Simulation으로 이어가기' })).not.toBeInTheDocument();
  expect(screen.getByText('3000000')).toBeVisible();
  expect(screen.getByRole('button', { name: '취소' })).toBeVisible();
});
```

Add a cancel restoration test:

```ts
fireEvent.click(screen.getByRole('button', { name: '취소' }));
expect(await screen.findByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
```

Keep the existing first-setup test asserting launcher visibility and disabled Simulation CTA.

- [ ] **Step 2: Run the MainApp suite and verify RED**

Run:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx
```

Expected: FAIL because restart setup still renders both journey elements.

- [ ] **Step 3: Derive restart focus and conditionally omit journey UI**

In the setup branch:

```tsx
const isRestartSetup = state.applied !== null;

return (
  <MainAppShell journeyError={journeyError} showLauncher={!isRestartSetup}>
    <main>
      {/* warnings and Cancel remain unchanged */}
      {isRestartSetup ? null : journeyEntry}
      <SetupFlow {...props} />
    </main>
  </MainAppShell>
);
```

Update the shell:

```tsx
function MainAppShell({
  children,
  journeyError,
  showLauncher = true,
}: {
  children: ReactNode;
  journeyError: string | null;
  showLauncher?: boolean;
}) {
  return (
    <div>
      {showLauncher ? (
        <div className="mx-auto w-full max-w-[1200px] px-5 pt-5 sm:px-8">
          <AppLauncher currentApp="main" />
          {journeyError === null ? null : (
            <p className="mt-4 text-sm font-bold text-rose-700" role="alert">{journeyError}</p>
          )}
        </div>
      ) : null}
      {children}
    </div>
  );
}
```

Do not clear `journeyError`, change reducer state, or alter persistence. A journey error cannot be created inside restart setup because the CTA is absent.

- [ ] **Step 4: Add E2E restart and restoration flow**

Extend `tests/step1.spec.ts` using the existing applied-plan setup helpers:

```ts
await page.getByRole('button', { name: '처음부터 다시 설정' }).click();
await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toHaveCount(0);
await page.getByRole('button', { name: '다음' }).click();
await expect(page.getByRole('textbox', { name: '월 실수령액' })).toHaveValue('3,000,000');

await page.getByRole('button', { name: '취소' }).click();
await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
```

- [ ] **Step 5: Run focused restart verification**

Run:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx
npx playwright test tests/step1.spec.ts --reporter=list
npm run check
```

Expected: MainApp unit suite and `step1` E2E suite PASS; TypeScript checks exit `0`.

- [ ] **Step 6: Commit restart isolation**

```bash
git add src/main/ui/MainApp.tsx tests/unit/main/MainApp.test.tsx tests/step1.spec.ts
git commit -m "fix(main): focus restart setup"
```

---

### Task 4: Full Regression and Runtime Verification

**Files:**
- Verify only; no intended production changes.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: fresh completion evidence.

- [ ] **Step 1: Run source and unit verification**

Run:

```bash
npm run check
npm run test:unit
```

Expected: both commands exit `0`; Vitest reports no failures.

- [ ] **Step 2: Run current-product E2E verification**

Run:

```bash
npx playwright test --reporter=list
```

Expected: all non-migration-reference tests pass; `account-map.spec.ts` and `step2.spec.ts` remain excluded by Playwright configuration.

- [ ] **Step 3: Build without touching preserved version files**

Because `npm run build` invokes `scripts/bump-version.js`, first record the four preserved files and restore only build-generated changes without overwriting the user's pre-existing content. Prefer the non-mutating Vite command:

```bash
npx vite build
```

Expected: build exits `0`.

- [ ] **Step 4: Verify formatting, scope, and preserved files**

Run:

```bash
git diff --check
git status --short
git diff -- package.json public/manifest.webmanifest shared/core/utils.js shared/legacy/sw.js
```

Expected: no whitespace errors; only the four pre-existing version files remain uncommitted after feature commits; their content is unchanged from the task start.

- [ ] **Step 5: Request final code review**

Use `superpowers:requesting-code-review` against the full branch diff. Resolve Critical and Important findings through `superpowers:receiving-code-review` and rerun affected verification.

- [ ] **Step 6: Finish the branch**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Preserve the Orca worktree unless the user explicitly requests removal.
