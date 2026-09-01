# Repository Refactor Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네 지원 앱의 공통 페이지 프레임·버튼·reveal motion 기반을 동작 변경 없이 하나의 기준으로 정리한다.

**Architecture:** 먼저 기준선과 레거시/중복 목록을 고정한 뒤, `src/components/common`, `src/components/motion`, `src/styles/app-foundation.css`에 이미 존재하는 경계를 확장한다. 앱별 도메인 상태와 저장 command는 이번 계획에서 이동하지 않고, 공통 primitive를 callback·native attribute 중심으로 소비하게 만든다.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Playwright, Anime.js, CodeGraph

**Spec:** `docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md`

## Global Constraints

- Main은 다섯 월간 금액의 유일한 편집 소유자다.
- Simulation과 Portfolio는 최신 Main을 읽기 전용으로 사용한다.
- Account Map은 최신 Main을 읽기 전용으로 사용하고 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- Account Map은 Main·Simulation·Portfolio에 write-back하지 않는다.
- Portfolio는 aggregate 배분과 자기 slice를 소유하며 Account Map의 위치 관리 UI를 재사용하지 않는다.
- 저장 키, workspace schema, revision/conflict 의미, URL과 앱 탐색 순서는 유지한다.
- 390px, 768px, desktop의 여백·overflow·focus·touch target·시각화 가시성 계약은 유지한다.
- 공통 계층은 도메인 상태나 저장 write를 소유하지 않는다.
- 레거시는 참조·호환성·회귀 증거가 확보되기 전 삭제하지 않는다.
- `artifacts/`는 읽거나 수정하거나 커밋하지 않는다.

---

## Task 1: Baseline and refactor inventory

**Files:**
- Read: `AGENTS.md`, `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`, `DESIGN.md`, `docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md`
- Read: `package.json`, `src/components/common/*`, `src/components/motion/*`, `src/journey/ui/*`, current app entry/UI files
- Create: `docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md`
- Test: none; this task produces a durable baseline and inventory

**Interfaces:**
- Consumes: the approved refactor design and current `origin/main`
- Produces: baseline commands/results and an inventory table that later tasks use to avoid broad, unverified extraction

- [ ] **Step 1: Verify an isolated execution worktree**

Before changing source, invoke `superpowers:using-git-worktrees` and create a fresh branch from the current `origin/main`. Confirm the new worktree is clean with:

```bash
git status --short --branch
git log -1 --oneline
```

Expected: no modified files and the branch points at the approved design commit or a newer `origin/main` that contains it.

- [ ] **Step 2: Capture the baseline checks**

Run each command from the isolated worktree and record its exit status, test count, intentional skips, and any generated-file changes in the baseline document:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run build
git status --short
git diff --check
```

Do not treat a failed baseline as a refactor regression. Record the exact failure and stop to classify it before touching source.

- [ ] **Step 3: Build the dependency and duplicate inventory**

Use CodeGraph before text search, then run the following focused searches:

```bash
codegraph explore "AppShell Button Surface Toast useReducedMotion useAnimeScope animateVisualNumber AppLauncher and all supported app consumers"
rg -n 'className="app-content-frame|<button[^>]+ui-button|setRevealFinalState|prefers-reduced-motion|localStorage|sessionStorage|apps/main/modules|legacy' src apps tests
```

Record each candidate with its current owner, consumers, focused tests, planned phase, and removal condition. At minimum include `app-content-frame`, direct `ui-button` markup, duplicate reveal final-state helpers, app orchestration files, and `apps/main/modules` legacy references.

The baseline document must use these durable headings and columns:

```markdown
# Shared Foundation Baseline
## Commands and results
## Inventory
| Candidate | Current owner | Consumers | Focused tests | Planned phase | Removal condition |
## Intentional exceptions
## Follow-up risks
```

- [ ] **Step 4: Commit the baseline evidence**

```bash
git add docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md
git commit -m "docs: capture refactor baseline and inventory"
```

## Task 2: Introduce and adopt the shared content frame

**Files:**
- Create: `src/components/common/AppContentFrame.tsx`
- Create: `tests/unit/components/AppContentFrame.test.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`

**Interfaces:**
- Consumes: existing `app-content-frame` CSS contract and native element attributes
- Produces: `AppContentFrameProps` and an `AppContentFrame` component that preserves the `app-content-frame` class and all caller-supplied classes/attributes

The public interface is:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

export interface AppContentFrameProps extends HTMLAttributes<HTMLElement> {
  as?: 'main' | 'section' | 'div';
  children: ReactNode;
}

export function AppContentFrame({
  as = 'main',
  className = '',
  children,
  ...props
}: AppContentFrameProps): JSX.Element;
```

- [ ] **Step 1: Write the failing primitive tests**

Add tests that prove the default tag, alternate tag, native attributes, and class composition:

```tsx
it('renders a main with the shared frame class by default', () => {
  render(<AppContentFrame data-testid="frame">내용</AppContentFrame>);
  expect(screen.getByTestId('frame').tagName).toBe('MAIN');
  expect(screen.getByTestId('frame')).toHaveClass('app-content-frame');
});

it('preserves an explicit tag, class, and accessibility attributes', () => {
  render(<AppContentFrame as="section" className="account-map-page" aria-label="계좌 연결">내용</AppContentFrame>);
  expect(screen.getByRole('region', { name: '계좌 연결' })).toHaveClass('app-content-frame', 'account-map-page');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
npx vitest run tests/unit/components/AppContentFrame.test.tsx
```

Expected: FAIL because `AppContentFrame` does not yet exist.

- [ ] **Step 3: Implement the minimal frame component**

Render only the requested native tag, prepend `app-content-frame`, and forward all other props. Do not add layout styles to the component; `src/styles/app-foundation.css` remains the single CSS owner.

- [ ] **Step 4: Run the primitive test and verify it passes**

```bash
npx vitest run tests/unit/components/AppContentFrame.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Migrate existing frame markup without changing class order or layout classes**

Replace repeated `className="app-content-frame ..."` wrappers in the listed files with `AppContentFrame`. Use `as="main"` for existing `<main>` elements and `as="div"`/`as="section"` only where the current semantic tag differs. Preserve every existing app-specific class (`simulation-content`, `portfolio-recovery`, `account-map-page`, etc.), child order, and attributes.

- [ ] **Step 6: Run all affected focused tests**

```bash
npx vitest run \
  tests/unit/components/AppContentFrame.test.tsx \
  tests/unit/main/MainApp.test.tsx \
  tests/unit/main/SummaryDashboard.test.tsx \
  tests/unit/simulation/SimulationApp.test.tsx \
  tests/unit/portfolio/PortfolioApp.test.tsx \
  tests/unit/account-map/AccountMapApp.test.tsx
```

Expected: PASS with no changed accessible names or route assertions.

- [ ] **Step 7: Commit the frame extraction**

```bash
git add src/components/common/AppContentFrame.tsx tests/unit/components/AppContentFrame.test.tsx src/main/ui/MainApp.tsx src/main/ui/dashboard/SummaryDashboard.tsx src/simulation/ui/SimulationApp.tsx src/portfolio/ui/PortfolioApp.tsx src/account-map/ui/AccountMapApp.tsx
git commit -m "refactor(ui): centralize app content frame"
```


## Task 3: Adopt the shared Button primitive for direct button markup

**Files:**
- Modify: `src/journey/ui/ManagementConfirmationDialog.tsx`
- Modify: `src/journey/ui/JourneyEntryCard.tsx`
- Modify: `src/account-map/ui/AccountMapLocationPicker.tsx`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/AccountMapSetup.tsx`
- Modify: `src/account-map/ui/AccountMapModal.tsx`
- Modify: `tests/unit/components/Button.test.tsx`
- Create: `tests/unit/account-map/AccountMapLocationPicker.test.tsx`
- Test: `tests/unit/journey/AppLauncher.test.tsx`, `tests/unit/journey/JourneyEntryCard.test.tsx`, and the focused Account Map tests for each changed component

**Interfaces:**
- Consumes: existing `Button` signature from `src/components/common/Button.tsx`: `ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'bare' }`
- Produces: identical native button semantics and CSS classes without direct duplication of `ui-button ui-button--*` markup

`bare`는 별도 공통 danger variant가 아니다. 파괴적 확인 다이얼로그에서만 투명한 배경과 앱 소유의 오류 색(`journey-management__danger`)을 결합하는 의도적 예외이며, 도메인 문구·상태·색상은 `Button`으로 옮기지 않는다.

- [ ] **Step 1: Strengthen the shared primitive test**

Add assertions that `Button` forwards `type`, `aria-*`, `data-*`, `disabled`, children, and a caller class while preserving the selected variant. Keep the test framework-level; app-specific intent remains in app tests.

- [ ] **Step 2: Run the primitive test before migration**

```bash
npx vitest run tests/unit/components/Button.test.tsx
```

Expected: PASS against the existing primitive. This establishes that migration is mechanical rather than an API redesign.

- [ ] **Step 3: Replace direct button markup in journey and Account Map UI**

Import `Button` from `src/components/common/Button` (or the existing Main re-export where the file already follows that local convention) and preserve every native prop and handler. The target shape is:

```tsx
<Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>
  취소
</Button>
```

Keep app-specific classes such as `journey-management__danger` and `account-map-modal__archive` in `className`. Do not replace `<a className="ui-button ...">` because the anchor semantics are intentional, and do not move domain handlers into the primitive.

- [ ] **Step 4: Search for unsupported direct button duplication**

Run:

```bash
rg -n '<button[^>]+className="[^"]*ui-button|className="ui-button' src/journey src/account-map
```

Expected: no remaining direct button with a shared `ui-button` class in the migrated surfaces, except an explicitly documented semantic exception. Record any exception in the baseline inventory rather than silently skipping it.

- [ ] **Step 5: Run focused journey and Account Map tests**

```bash
npx vitest run \
  tests/unit/components/Button.test.tsx \
  tests/unit/journey/AppLauncher.test.tsx \
  tests/unit/journey/AppManagementMenu.test.tsx \
  tests/unit/journey/JourneyEntryCard.test.tsx \
  tests/unit/account-map/AccountMapLocationPicker.test.tsx \
  tests/unit/account-map/AccountMapModal.test.tsx \
  tests/unit/account-map/AccountMapCanvas.test.tsx \
  tests/unit/account-map/AccountMapSetup.test.tsx \
  tests/unit/account-map/AccountMapApp.test.tsx
```

Expected: PASS; accessible names, focus restoration, recovery actions, disabled states, and touch-sized controls remain unchanged.

- [ ] **Step 6: Commit the Button adoption**

```bash
git add src/journey/ui/ManagementConfirmationDialog.tsx src/journey/ui/JourneyEntryCard.tsx src/account-map/ui/AccountMapLocationPicker.tsx src/account-map/ui/AccountMapCanvas.tsx src/account-map/ui/AccountMapSetup.tsx src/account-map/ui/AccountMapModal.tsx tests/unit/components/Button.test.tsx
git commit -m "refactor(ui): adopt shared button primitive"
```

## Task 4: Consolidate duplicated reveal final-state handling

**Files:**
- Create: `src/components/motion/setMotionFinalState.ts`
- Create: `tests/unit/components/setMotionFinalState.test.ts`
- Modify: `src/components/common/Toast.tsx`
- Modify: `src/journey/ui/ReadinessApp.tsx`
- Modify: `src/journey/ui/ManagementConfirmationDialog.tsx`

**Interfaces:**
- Consumes: existing `useAnimeScope` final-state fallback behavior
- Produces: `setMotionFinalState(target: HTMLElement): void`, which commits `opacity: 1` and `transform: translateY(0px)` for reveal surfaces

- [ ] **Step 1: Write the failing pure DOM test**

```ts
it('commits the visible reveal state without animation', () => {
  const target = document.createElement('div');
  target.style.opacity = '0';
  target.style.transform = 'translateY(24px)';

  setMotionFinalState(target);

  expect(target.style.opacity).toBe('1');
  expect(target.style.transform).toBe('translateY(0px)');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
npx vitest run tests/unit/components/setMotionFinalState.test.ts
```

Expected: FAIL because the helper does not yet exist.

- [ ] **Step 3: Implement and adopt the helper**

Create the pure helper, then replace only the identical local `setRevealFinalState` implementations in Toast, ReadinessApp, and ManagementConfirmationDialog. Do not change AppLauncher, PortfolioDialog, Main setup, or Account Map motion in this task; their final states have different geometry and belong in the later visualization/motion plan.

- [ ] **Step 4: Run motion and affected UI tests**

```bash
npx vitest run \
  tests/unit/components/setMotionFinalState.test.ts \
  tests/unit/components/useAnimeScope.test.tsx \
  tests/unit/journey/ReadinessApp.test.tsx \
  tests/unit/journey/AppLauncher.test.tsx
```

Expected: PASS, including reduced-motion and Anime.js failure fallback assertions.

- [ ] **Step 5: Commit the motion helper**

```bash
git add src/components/motion/setMotionFinalState.ts tests/unit/components/setMotionFinalState.test.ts src/components/common/Toast.tsx src/journey/ui/ReadinessApp.tsx src/journey/ui/ManagementConfirmationDialog.tsx
git commit -m "refactor(motion): share reveal final-state fallback"
```

## Task 5: Shared-foundation verification and handoff

**Files:**
- Read: `docs/superpowers/specs/2026-08-24-repository-wide-refactor-design.md`
- Modify: `docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md` with final results and intentional exceptions
- Test: full repository checks and responsive/manual evidence

**Interfaces:**
- Consumes: the three refactor commits and baseline results
- Produces: a verified shared-foundation phase and a concrete input list for the next app-orchestration plans

- [ ] **Step 1: Run source and unit checks**

```bash
npm run check
npm run test:unit
git diff --check
```

Expected: PASS with no uncommitted source changes.

- [ ] **Step 2: Run the supported user flows**

```bash
npm run test:e2e -- tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts tests/account-map.spec.ts tests/reading-width.spec.ts tests/motion-system.spec.ts
```

Expected: PASS for navigation, Main, Simulation, Portfolio, Account Map, reading-width and motion regressions. If Playwright is configured to run the whole suite instead of path filtering, run `npm run test:e2e` and record the full result.

- [ ] **Step 3: Verify responsive and accessibility behavior**

At 390×844, 768×1024, and 1280×900 inspect Main, Simulation, Portfolio, and Account Map entry/setup/map surfaces. Confirm:

```text
shared frame has the intended horizontal gutter;
launcher remains outside the content reading-width primitive;
no horizontal overflow or clipped focus ring appears;
buttons retain accessible names, focus order, and touch-sized hit areas;
reduced motion leaves content in its final visible state.
```

- [ ] **Step 4: Run the production build and inspect generated changes**

```bash
npm run build
git status --short
git diff --check
```

Record build/deploy evidence separately from source commits. Do not mix generated version or deployment artifacts into the refactor commits without an explicit release decision.

- [ ] **Step 5: Record follow-up plan inputs and hand off**

Update the baseline document with exact commands/results, intentional direct-button or frame exceptions, remaining motion duplication not safe for this phase, the next plan’s first candidates (`MainApp`, `AccountMapApp`, `PortfolioApp`, `SimulationApp` orchestration), and legacy references still requiring Phase 4 evidence.

Then run `git status --short --branch` and hand off the branch with the three focused refactor commits plus verification evidence.

- [ ] **Step 6: Commit the verification evidence**

```bash
git add docs/superpowers/plans/2026-08-24-repository-refactor-shared-foundation-baseline.md
git commit -m "docs: record shared foundation verification"
```

## Follow-up Plans (not part of this execution)

After this plan passes, create and review separate plans for:

1. Main application orchestration and setup/review motion boundaries.
2. Account Map command/recovery orchestration and graph/layout split.
3. Simulation projection/chart orchestration and Portfolio application orchestration.
4. Legacy runtime disposition and evidence-based removal.

Each follow-up plan must preserve the Global Constraints above and end with its own focused tests, responsive QA, and rollback point.
