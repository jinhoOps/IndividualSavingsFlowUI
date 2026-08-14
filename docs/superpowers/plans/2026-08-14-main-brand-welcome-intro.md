# Main 브랜드 웰컴 인트로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main의 최초 빈 시작, 빈 Main을 포함한 정상 whole-workspace 복원, 그리고 `처음부터 다시`에만 Anime.js 기반의 독립적인 브랜드 인포그래픽 인트로를 표시한다. 기존 setup welcome과 실제 비율 review 조립 장면은 그대로 유지하고, 정적 PWA 아이콘도 같은 다섯 꼭짓점 추세선 브랜드로 갱신한다.

**Architecture:** `bootstrapMain()`은 저장 모델을 바꾸지 않고 `{ state, introEntryReason }`를 반환한다. `MainApp`은 그 일회성 UI 메타데이터를 소비하고, `MainWelcomeIntro`는 인포그래픽 SVG·Anime.js lifecycle·skip만 소유한다. 아이콘과 인트로는 공유 geometry 모듈의 좌표를 사용하며, 생성 스크립트는 SVG 원본에서 manifest PNG를 재생성한다. reduced-motion에서는 인트로 DOM을 mount하지 않고 이유만 소비한 뒤 기존 setup welcome을 즉시 보인다.

**Tech Stack:** React 19, TypeScript 5.5, Anime.js 4, Vite 5 MPA/PWA, sharp, Vitest, Testing Library, Playwright

**Spec:** [Main 브랜드 웰컴 인트로 설계](../specs/2026-08-13-main-brand-welcome-intro-design.md), [Anime.js 공통 모션 시스템 설계](../specs/2026-08-12-animejs-motion-system-design.md)

## Global Constraints

- Main은 다섯 월간 금액만 직접 소유한다. 인트로는 실제 금액·비율·수익·적자를 표현하거나 workspace schema/localStorage key를 추가하지 않는다.
- `fresh`는 빈 Main + 진행 기록 없음, `resume`은 어떤 저장된 setup progress든, `restart`는 현재 UI 세션의 확인된 다시 시작, `none`은 나머지 모든 상태다.
- `fresh`는 normal/reduced branch와 무관하게 `initial / welcome` 진행 기록 저장을 즉시 요청한다. 저장 실패는 현재 경고로 알리되 사용을 막지 않는다.
- `처음부터 다시`는 적용 계획을 유지하고 그 복사본을 restart draft로 사용한다. 인트로와 setup welcome 경험만 최초와 같다.
- `SetupFlow`, `initial-assembly`, `cashflowBarGeometry`, 초과분 실제비율/절단 표현, 상단 launcher의 기존 동작은 변경하지 않는다.
- normal intro는 2.2초 이내이며 loop·화살촉·수익 약속을 사용하지 않는다. 마지막은 가장 높은 좌표의 둥근 점이다.
- interactive intro에는 launcher와 management menu를 렌더하지 않는다. bootstrap loading도 neutral canvas만 보인다.
- `prefers-reduced-motion: reduce`에서는 `MainWelcomeIntro`와 skip button을 mount하지 않는다. welcome heading으로 한 번만 focus가 간다.
- 모든 interactive target은 44px 이상이고, 390×844, 768×900, 1280×900에서 safe area·가로 overflow·focus를 확인한다.
- 이 작업은 차기 돈그릇 앱, route, 데이터, 위험 계산을 추가하지 않는다.
- `npm run build`는 package version을 올리므로, 측정만 필요할 때는 `node ./node_modules/vite/bin/vite.js build`를 사용한다. 최종 PWA 갱신 때만 `npm run build`를 한 번 실행한다.

---

## File Structure

### New files

- `shared/brand/mainBrandGeometry.js`: 512 viewBox 기준의 gradient, baseline, 3개 bar와 5개 trend vertex를 단일 좌표 계약으로 export한다.
- `src/main/ui/brand/MainBrandIcon.tsx`: 공유 geometry를 SVG markup으로 렌더하는 재사용 가능한 브랜드 그래픽이다.
- `src/main/ui/MainWelcomeIntro.tsx`: full-viewport intro, Anime.js timeline, focus, skip 및 cleanup을 소유한다.
- `src/components/motion/useReducedMotion.ts`: `matchMedia` 구독을 안전하게 제공해 interactive intro mount 전에 reduced-motion을 판별한다.
- `scripts/generate-main-brand-icons.mjs`: SVG source 및 192/512 SVG·PNG asset을 생성하거나 `--check`로 동기화 여부를 검사한다.
- `tests/unit/main/mainBrandGeometry.test.ts`: 다섯 점·가상점·최고점·정적 SVG 좌표 계약을 검사한다.
- `tests/unit/main/MainWelcomeIntro.test.tsx`: normal/fallback/skip/keyboard/unmount 접근성 계약을 검사한다.
- `tests/unit/components/useReducedMotion.test.tsx`: initial media match와 변경 구독을 검사한다.
- `tests/unit/scripts/generateMainBrandIcons.test.ts`: 생성 asset의 SVG 동등성, PNG dimension과 manifest 참조를 검사한다.

### Modified files

- `src/main/application/bootstrap.ts`, `tests/unit/main/bootstrap.test.ts`: Main state와 분리된 bootstrap entry reason을 제공하고 검증한다.
- `src/main/ui/MainApp.tsx`, `tests/unit/main/MainApp.test.tsx`: intro lifecycle, fresh progress 저장, restore/restart와 focus handoff를 연결한다.
- `src/main/ui/main.css`: intro의 viewport containment, visual stages, safe-area skip control 스타일을 추가한다.
- `tests/main-react.spec.ts`: 실제 Main first-run/restart/restore/reduced-motion 사용자 흐름과 timed captures를 추가한다.
- `public/icons/icon-source.svg`, `public/icons/icon-192.svg`, `public/icons/icon-512.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`: 같은 brand geometry의 static PWA assets다.
- `public/manifest.webmanifest`, `shared/legacy/sw.js`, `shared/core/utils.js`, `package.json`, `package-lock.json`: icon generation command, image renderer dependency, release version/cache 동기화 결과를 반영한다.
- `DESIGN.md`: Main의 예외적 앱-진입 인트로와 static brand-icon 계약을 현재 UI contract에 짧게 연결한다.

---

### Task 1: 일회성 bootstrap 진입 이유를 도메인 상태와 분리한다

**Files:**
- Modify: `src/main/application/bootstrap.ts`
- Modify: `tests/unit/main/bootstrap.test.ts`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`

**Interfaces:**

```ts
export type MainBootstrapIntroEntryReason = 'fresh' | 'resume' | 'none';
export type MainIntroEntryReason = MainBootstrapIntroEntryReason | 'restart';

export interface MainBootstrapResult {
  state: MainState;
  introEntryReason: MainBootstrapIntroEntryReason;
}

export async function bootstrapMain(repository: MainRepository): Promise<MainBootstrapResult>;
```

- [ ] **Step 1: bootstrap reason의 실패 테스트를 먼저 작성한다.**

`tests/unit/main/bootstrap.test.ts`의 모든 기존 state assertion을 `result.state` 대상으로 바꾸고 다음 table test를 추가한다.

```ts
it.each([
  ['empty without progress', emptyResult, null, 'fresh'],
  ['empty with initial welcome progress', emptyResult, initialWelcome, 'resume'],
  ['current dashboard', currentResult, null, 'none'],
  ['current with restart progress', currentResult, restartWelcome, 'resume'],
  ['recovery with later progress', recoveryResult, restartLiving, 'resume'],
  ['failed load', failedResult, null, 'none'],
])('%s yields %s', async (_name, loaded, progress, expected) => {
  await expect(bootstrapMain(repository(loaded, progress))).resolves.toMatchObject({
    introEntryReason: expected,
  });
});
```

Assert the `fresh` state is still `setup / welcome` with `applied: null`, and a persisted `welcome` progress is always `resume`; no state type gains an entry-reason field.

- [ ] **Step 2: focused bootstrap test가 새 return shape로 실패하는지 확인한다.**

Run:

```bash
npx vitest run tests/unit/main/bootstrap.test.ts
```

Expected: FAIL until call sites and test expectations consume `MainBootstrapResult`.

- [ ] **Step 3: `bootstrapMain()`의 return mapping을 구현한다.**

Keep `setupState`, `dashboardState`, recovery state, clone semantics and error handling intact. Wrap them with these exact mappings:

```ts
case 'empty': {
  const progress = repository.loadSetupProgress();
  return progress === null
    ? { state: setupState(createEmptyMainData(), 'welcome'), introEntryReason: 'fresh' }
    : { state: setupState(progress.draft, progress.step), introEntryReason: 'resume' };
}
case 'current': {
  const progress = repository.loadSetupProgress();
  if (progress?.kind === 'restart' && progress.draft.updatedAt >= result.data.updatedAt) {
    return { state: setupState(progress.draft, progress.step, result.data), introEntryReason: 'resume' };
  }
  return { state: dashboardState(result.data), introEntryReason: 'none' };
}
```

For the existing recovery-progress branch use `resume`; all recovery/error branches use `none`. Do not add persistence or UI logic in `bootstrap.ts`.

- [ ] **Step 4: update MainApp’s bootstrap and restore consumers without changing setup ownership.**

Store `loaded.state` and `loaded.introEntryReason` together in MainApp. On whole-workspace restore, set the fresh/resume/none reason from the same re-bootstrap result before preserving the existing backup success message. `restartSetup()` must retain the existing `persistSetupProgress('welcome', state.applied, 'restart')` call and set its local reason to `restart` before dispatching `restart-setup`.

Use an incrementing in-memory entry id with the reason so React Strict Mode, async bootstrap resolution and unrelated rerenders cannot cause duplicate fresh writes or replay an already-consumed intro:

```ts
interface MainIntroEntry {
  id: number;
  reason: MainIntroEntryReason;
}
```

Keep this metadata in MainApp only; never place it in `MainState`, a repository, backup, or browser storage.

- [ ] **Step 5: add MainApp unit coverage for the entry mapping and immediate fresh save.**

Mock only `MainWelcomeIntro` in `MainApp.test.tsx` with a visible `complete-brand-intro` button, leaving the actual component for its own test file. Cover:

1. a fresh bootstrap invokes `saveSetupProgress('welcome', emptyDraft, 'initial')` once before the mock completes;
2. persisted initial/restart progress never mounts the mock;
3. clicking `처음부터 다시` mounts it and retains the applied plan/draft copy contract;
4. completion consumes the reason so rerendering does not remount it;
5. a failing fresh save exposes the current setup progress warning but completion still reaches setup;
6. an empty Main backup restore mounts it, then completion retains `모든 앱 데이터를 백업에서 복원했습니다.` and focuses the setup heading.

For existing setup tests that start from an empty repository, call the mock completion helper before asserting setup fields; do not silently convert those fixtures into persisted `resume` states.

- [ ] **Step 6: verify and commit the state boundary.**

Run:

```bash
npx vitest run tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx
npm run check
```

Expected: selected suites and type checks PASS. Commit only this boundary:

```bash
git add src/main/application/bootstrap.ts src/main/ui/MainApp.tsx tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx
git commit -m "feat(main): track welcome intro entry reason"
```

---

### Task 2: 공유 브랜드 geometry와 deterministic PWA asset pipeline을 만든다

**Files:**
- Create: `shared/brand/mainBrandGeometry.js`
- Create: `src/main/ui/brand/MainBrandIcon.tsx`
- Create: `scripts/generate-main-brand-icons.mjs`
- Create: `tests/unit/main/mainBrandGeometry.test.ts`
- Create: `tests/unit/scripts/generateMainBrandIcons.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create/Modify: `public/icons/icon-source.svg`, `public/icons/icon-192.svg`, `public/icons/icon-512.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `public/manifest.webmanifest`

**Interfaces:**

```js
export const MAIN_BRAND_GEOMETRY = {
  viewBox: 512,
  background: { from: '#ea5b2a', to: '#1e8b7c', radius: 96 },
  baseline: { x: 150, y: 334, width: 212, height: 38 },
  bars: [
    { id: 'bar-1', x: 150, y: 252, width: 48, height: 82 },
    { id: 'bar-2', x: 232, y: 191, width: 48, height: 143 },
    { id: 'bar-3', x: 314, y: 146, width: 48, height: 188 },
  ],
  trend: {
    stroke: '#173a3a',
    points: [
      { id: 'bar-1', x: 174, y: 236 },
      { id: 'dip-1-2', x: 215, y: 264 },
      { id: 'bar-2', x: 256, y: 204 },
      { id: 'variance-2-3', x: 297, y: 216 },
      { id: 'bar-3-final', x: 338, y: 132 },
    ],
  },
} as const;
```

The three named trend points share only their bar-center x values. `dip-1-2` and `variance-2-3` lie strictly between adjacent centers; `bar-3-final` has the smallest y value and ends in a dot, not an arrow.

- [ ] **Step 1: write failing geometry and asset-contract tests.**

`mainBrandGeometry.test.ts` must assert exactly three ascending bars, exactly five ordered trend points, centers `[174, 256, 338]`, virtual x values `174 < 215 < 256` and `256 < 297 < 338`, and `132` as the unique minimum y. Render `MainBrandIcon` and assert an `aria-hidden` SVG with a polyline/path carrying those five points and a final circle at `(338, 132)`.

`generateMainBrandIcons.test.ts` must run `node scripts/generate-main-brand-icons.mjs --check`, then assert:

```ts
expect(manifest.icons.map(({ src }) => src)).toEqual([
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-192.svg', 'icons/icon-512.svg',
]);
expect(readPngSize('public/icons/icon-192.png')).toEqual({ width: 192, height: 192 });
expect(readPngSize('public/icons/icon-512.png')).toEqual({ width: 512, height: 512 });
```

Implement `readPngSize` in the test by reading the PNG IHDR bytes; do not add a second image decoder just for assertions. Parse each generated SVG’s viewBox and trend `data-brand-trend` attributes to prove all four manifest assets use identical geometry/color data. Assert the source and rendered icon keep every essential primitive inside the 20%–80% maskable safe zone.

- [ ] **Step 2: run new tests and confirm RED.**

```bash
npx vitest run tests/unit/main/mainBrandGeometry.test.ts tests/unit/scripts/generateMainBrandIcons.test.ts
```

Expected: FAIL because the geometry, component and generator do not yet exist.

- [ ] **Step 3: implement one geometry source and a semantic-free React renderer.**

Put data and pure helpers such as `trendPointsAttribute()` and `renderMainBrandSvg(size)` in `shared/brand/mainBrandGeometry.js`; `allowJs` already permits both the Vite React code and Node script to import it. `MainBrandIcon` must use the data rather than duplicate numbers, expose stable `data-brand-*` hooks for animation/captures, and render:

```tsx
<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
  <rect data-brand-background />
  <path data-brand-baseline />
  {bars.map((bar) => <path key={bar.id} data-brand-bar={bar.id} />)}
  <polyline data-brand-trend points={trendPointsAttribute()} strokeLinecap="round" strokeLinejoin="round" />
  <circle data-brand-terminal-dot cx="338" cy="132" />
</svg>
```

The SVG has no text, `role`, accessible name or data-derived financial claims. Give the polyline enough stroke width and the terminal dot enough radius to remain distinct at 192px.

- [ ] **Step 4: implement generation from SVG and replace all PWA assets.**

Add `sharp` as a dev dependency and the script entry:

```json
"generate:brand-icons": "node scripts/generate-main-brand-icons.mjs"
```

The generator must first write the shared-coordinate vector source to `public/icons/icon-source.svg`, derive the 192/512 SVG files only by width/height metadata, then rasterize that exact source into 192 and 512 PNG files using `sharp`. Its `--check` mode must create all expected buffers in memory and fail non-zero if any committed asset differs, without writing files. Use an explicit root path from `import.meta.url`, never the current shell directory.

Run:

```bash
npm install --save-dev sharp
npm run generate:brand-icons
npm run generate:brand-icons -- --check
```

Keep the existing four manifest entries in their current order and `purpose: "any maskable"`; update only their files’ content, not the manifest shape.

- [ ] **Step 5: verify static assets and commit the brand source.**

```bash
npx vitest run tests/unit/main/mainBrandGeometry.test.ts tests/unit/scripts/generateMainBrandIcons.test.ts
npm run check
```

Expected: PASS. Commit the source, generator, assets and tests together:

```bash
git add shared/brand src/main/ui/brand scripts/generate-main-brand-icons.mjs public/icons public/manifest.webmanifest package.json package-lock.json tests/unit/main/mainBrandGeometry.test.ts tests/unit/scripts/generateMainBrandIcons.test.ts
git commit -m "feat(brand): add rising trend icon system"
```

---

### Task 3: accessible Anime.js MainWelcomeIntro를 TDD로 구현한다

**Files:**
- Create: `src/components/motion/useReducedMotion.ts`
- Create: `src/main/ui/MainWelcomeIntro.tsx`
- Modify: `src/main/ui/main.css`
- Create: `tests/unit/components/useReducedMotion.test.tsx`
- Create: `tests/unit/main/MainWelcomeIntro.test.tsx`

**Interfaces:**

```ts
export function useReducedMotion(): boolean;

export interface MainWelcomeIntroProps {
  onComplete(): void;
}

export function MainWelcomeIntro({ onComplete }: MainWelcomeIntroProps): JSX.Element;
```

- [ ] **Step 1: write the reduced-motion hook tests.**

Stub `window.matchMedia` and assert that the hook returns the initial `matches` value, observes later `change` events, and falls back to `true` when `matchMedia` is unavailable. Test cleanup removes the exact listener. This conservative fallback prevents an inaccessible animation in unsupported environments.

- [ ] **Step 2: write failing intro component tests with an Anime.js scope/timeline mock.**

Mock `createScope`, `createTimeline`, `animate`, and `scope.revert`. Include tests that assert:

1. section is labelled by hidden heading `나의 가계 흐름 시작 화면` and description, graphic SVG is `aria-hidden`, app name is a minor visible label;
2. actual `화면을 눌러 건너뛰기` button receives focus, is at least 44px high from computed bounds, and is the only button;
3. pointer on background, click on button, `Enter`, `Space`, and `Escape` each call one idempotent `onComplete` path;
4. button interaction does not require or assign a role to the full-screen section;
5. normal setup initializes background → baseline/bars → line → terminal dot timeline and total automatic completion is at most 2200ms;
6. an Anime scope/timeline failure applies final styles and completes rather than throwing;
7. unmount and early skip call `scope.revert`, clear timer/listener and cannot emit a second completion.

Use `data-brand-background`, `data-brand-baseline`, `data-brand-bar`, `data-brand-trend`, and `data-brand-terminal-dot` rather than brittle class queries. Do not test reduced-motion here: MainApp owns the no-mount branch.

- [ ] **Step 3: confirm the focused component suites are RED.**

```bash
npx vitest run tests/unit/components/useReducedMotion.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx
```

Expected: FAIL because the hook and intro component do not exist.

- [ ] **Step 4: implement noninteractive graphic, scoped animation and one completion gate.**

Use `useAnimeScope` to own Anime scope teardown. Before starting, set deterministic visual initial styles: gradient opacity `0`, baseline and bars `scaleY(0)` from their bottom, trend stroke dashoffset equal to its measured length, terminal dot opacity/scale `0`. Then create one timeline whose cumulative duration including final hold is no more than 2200ms:

```ts
createTimeline({ defaults: { ease: MOTION_EASE.enter }, onComplete: finish })
  .add(background, { opacity: [0, 1], duration: 180 })
  .add([baseline, ...bars], { scaleY: [0, 1], duration: 420, delay: stagger(70) }, '<')
  .add(trend, { strokeDashoffset: [length, 0], duration: 560 }, '+=40')
  .add(dot, { opacity: [0, 1], scale: [0.72, 1], duration: MOTION_DURATION.normal }, '<+=360')
  .add({}, { duration: 260 });
```

Use the existing `attemptMotion` boundary; if scope/timeline creation fails, synchronously apply final styles then call `finish`. Guard `finish` with a ref, and cancel listeners/timers in cleanup. Do not animate layout width, text, financial values or page navigation.

Render a full viewport `<section>` with `onPointerDown={finish}` but no role. `onPointerDown` on the actual button must stop propagation before invoking the same `finish`. Add the visually-hidden heading/description and connect `aria-labelledby`/`aria-describedby`; set the SVG `aria-hidden="true"`. Use a real low-priority button in the bottom safe area with `min-height: 44px`, adequate contrast and `env(safe-area-inset-bottom)`. Focus it in a layout effect.

- [ ] **Step 5: add contained responsive CSS.**

Add only `.main-welcome-intro*` selectors to `src/main/ui/main.css`. It must use `position: fixed; inset: 0; min-height: 100dvh; overflow: clip; isolation: isolate`, contain the visual in `min(100% - 2rem, 32rem)`, and reserve bottom padding with `max(1rem, env(safe-area-inset-bottom))`. The SVG must have a stable square box rather than a percentage layout that can trigger horizontal scrolling. Keep Main’s shared 48rem content frame and existing review’s 75rem exception unchanged.

- [ ] **Step 6: run unit tests and commit the self-contained intro.**

```bash
npx vitest run tests/unit/components/useReducedMotion.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx
npm run check
```

Expected: PASS. Commit:

```bash
git add src/components/motion/useReducedMotion.ts src/main/ui/MainWelcomeIntro.tsx src/main/ui/main.css tests/unit/components/useReducedMotion.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx
git commit -m "feat(main): add accessible brand welcome intro"
```

---

### Task 4: MainApp에서 intro/no-intro rendering과 persistence/focus handoff를 완성한다

**Files:**
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/main/MainWelcomeIntro.test.tsx`

**Consumes:** Task 1의 `MainBootstrapResult`/`MainIntroEntryReason`, Task 3의 `useReducedMotion` and `MainWelcomeIntro`.

- [ ] **Step 1: add the MainApp integration tests that initially fail.**

Using the controllable intro mock from Task 1, test these exact observable contracts:

```tsx
expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
expect(screen.getByTestId('main-welcome-intro')).toBeInTheDocument();
expect(repository.saveSetupProgress).toHaveBeenCalledWith('welcome', expect.objectContaining({ schemaVersion: 2 }), 'initial');
```

Also stub `useReducedMotion()` as true and assert the intro mock and skip button never mount, setup welcome is directly rendered, fresh progress still saves, and only `[data-setup-heading]` receives focus. Verify `restart` uses the normal intro path even though its `applied` remains non-null. Add an error-path test where intro callback fires twice and confirm welcome appears once.

- [ ] **Step 2: implement the rendering order.**

Use the hook before any intro JSX:

```ts
const reducedMotion = useReducedMotion();
const showIntro = state?.mode === 'setup'
  && state.setupStep === 'welcome'
  && (entry.reason === 'fresh' || entry.reason === 'restart')
  && !reducedMotion;
```

When `state === null`, return only a neutral `main` loading canvas — do not wrap it in `AppShell`, do not pass `managementMenu`, and do not render the launcher. When `showIntro`, return `MainWelcomeIntro` directly; it is not inside `AppShell`.

For normal completion, set the same entry id’s reason to `none` before setup can render. A `useEffect` for active `fresh` entries must call the existing queued `persistSetupProgress('welcome', state.draft, 'initial')` exactly once for that id. A second effect consumes active `fresh`/`restart` when `reducedMotion` is true, with no intro mount. Preserve all existing save queue semantics and warning text.

Do not set entry reason for `startEmptySetup()` or recovery discard; these are recovery flows outside the approved display conditions. Do not clear `backupStatus` during an intro. Let existing `SetupFlow`’s `data-setup-heading` focus effect run only after the intro unmounts.

- [ ] **Step 3: run the Main unit boundary and commit.**

```bash
npx vitest run tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx tests/unit/components/useReducedMotion.test.tsx
npm run check
```

Expected: PASS. Commit:

```bash
git add src/main/ui/MainApp.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx
git commit -m "feat(main): gate setup with brand intro"
```

---

### Task 5: browser-level intro, restore, capture, and regression coverage를 추가한다

**Files:**
- Modify: `tests/main-react.spec.ts`
- Modify: `tests/motion-system.spec.ts` only if shared cross-app capture helpers require a neutral first-frame assertion

- [ ] **Step 1: create a deterministic first-entry capture helper.**

In `tests/main-react.spec.ts`, add `captureMainBrandIntro(page, testInfo, viewport)` that:

1. installs Playwright clock before navigation;
2. clears localStorage and opens `apps/main/` with `reducedMotion: 'no-preference'`;
3. asserts `data-testid="main-welcome-intro"` and no `ISF 앱` navigation or setup welcome flash;
4. captures `main-brand-intro-${width}-bars.png` during bar rise;
5. captures `main-brand-intro-${width}-trend.png` while `strokeDashoffset` is between full length and zero;
6. captures `main-brand-intro-${width}-final.png` after the terminal point is visible but before automatic completion;
7. reads `data-brand-trend` points from the DOM and asserts five points, virtual x ordering, final y minimum, terminal dot alignment, document-width containment, and safe-area-contained skip button.

Use `page.clock.runFor()` with times derived from the implementation timeline, not arbitrary long waits. Keep artifacts in Playwright’s `testInfo.outputPath`; do not commit screenshots.

- [ ] **Step 2: add normal-motion behavior tests at all required viewports.**

Loop 390×844, 768×900, 1280×900 and assert each capture phase above. At mount, assert the skip button has focus; then separately test pointer background skip, button skip, and each `Enter`/`Space`/`Escape` route reaches existing welcome heading exactly once. After auto completion, assert setup welcome is visible/focused and no launcher is visible during first setup.

After the first `fresh` load has saved progress, reload and assert the welcome route is rendered directly with no intro. This must use the actual storage, not an injected resume fixture.

- [ ] **Step 3: add restart, reduced-motion and fault tolerance browser tests.**

Seed a current Main plan, open `처음부터 다시`, confirm it, and assert the intro appears before existing welcome while the persisted progress has `kind: 'restart'` and the applied plan is still retained. Emulate `reduce` before a fresh page and before confirming restart; assert no `[data-testid="main-welcome-intro"]`, no skip label, immediate welcome heading focus and the appropriate progress write.

Inject a test-only Anime.js failure by monkey-patching the exported scope/timeline before page navigation (or use the existing Vite test injection seam); assert final styles are applied and welcome is reachable rather than error boundary/recovery. The production build must not include a test flag.

- [ ] **Step 4: update canonical backup restore expectation.**

Split the existing `empty Main` restore case from progress restore cases. For normal motion, first assert the empty restore intro and backup success status after completion, then assert welcome heading focus. For `initial`/`restart` progress restore, assert no intro and current direct focus behavior remains. Verify the restored workspace has the correct atomic revision/slices; fresh’s immediate progress write may advance the revision, so assert Main’s resulting `initial / welcome` contract and the unchanged non-Main slices rather than the obsolete fixed revision value.

- [ ] **Step 5: keep existing assembly and launcher contracts as explicit regressions.**

Run the present `review assembly captures timed deficit geometry and reduced motion` test unchanged except for any initial intro bypass caused by its persisted review fixture. Keep all assertions for actual overflow ratio, clipping, app-wide review visual and no setup launcher. Run `AppLauncher` focused tests as a known baseline separately; do not modify their layout behavior for this feature.

- [ ] **Step 6: run focused browser suites.**

```bash
npx playwright test tests/main-react.spec.ts --grep "(brand intro|new user|canonical backup restores|review assembly)"
npx playwright test tests/motion-system.spec.ts
```

Expected: selected tests PASS, capture artifacts exist only in test output, and all three viewports have no document horizontal overflow.

- [ ] **Step 7: commit browser tests.**

```bash
git add tests/main-react.spec.ts tests/motion-system.spec.ts
git commit -m "test(main): cover brand intro journey"
```

---

### Task 6: documentation, PWA version/cache update, and release verification을 마무리한다

**Files:**
- Modify: `DESIGN.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/manifest.webmanifest`
- Modify: `shared/legacy/sw.js`
- Modify: `shared/core/utils.js`
- Regenerated: `public/icons/*`

- [ ] **Step 1: update the current UI contract without duplicating the approved spec.**

In `DESIGN.md`, add one concise Main entry contract: only fresh/restart use a brief information-graphic welcome before existing setup, all persisted setup resumes bypass it, reduced motion bypasses interactive intro, and review assembly stays the only wide Main exception. Add a short brand-icon note that its three bars and five-point non-guarantee trend line are shared static/intro geometry, with a terminal dot rather than arrow. Link to the approved spec for timings and detailed behavior; do not add the future 돈그릇 app as current scope.

- [ ] **Step 2: regenerate/check icon assets, then intentionally update PWA version and cache key.**

```bash
npm run generate:brand-icons
npm run generate:brand-icons -- --check
npm run build
npm install --package-lock-only --ignore-scripts
npm run generate:brand-icons -- --check
```

Expected: the final build is the one deliberate patch-version bump. `sync-version` updates manifest version, legacy `APP_VERSION` cache namespace and shared utility fallback to the identical package version. Confirm `git diff` shows no accidental `dist/` files and no unrelated dependency upgrades.

- [ ] **Step 3: perform full verification with baseline awareness.**

```bash
git diff --check
npm run check
npx vitest run tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx tests/unit/main/mainBrandGeometry.test.ts tests/unit/components/useReducedMotion.test.tsx tests/unit/scripts/generateMainBrandIcons.test.ts
npm run test:unit
npm run test:e2e
git status --short
```

Expected: source checks, new focused tests and E2E PASS. The pre-existing `tests/unit/journey/AppLauncher.test.tsx` three overflow-layout failures were observed before this work in both the parent and isolated worktree; report them with their exact command if they remain, but do not change launcher behavior or label a failing full unit suite as passing. Any new failure must be fixed before handoff.

- [ ] **Step 4: review generated-artifact and product invariants.**

Confirm:

```bash
node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const m=JSON.parse(fs.readFileSync("public/manifest.webmanifest","utf8")); console.log({ package:p.version, manifest:m.version })'
rg -n "APP_VERSION" shared/legacy/sw.js shared/core/utils.js
rg -n "MainWelcomeIntro|introEntryReason|MainIntroEntryReason" src tests
rg -n "cashflowBarGeometry|initial-assembly|allocation-bar" src/main/ui/setup tests/main-react.spec.ts
```

The first command must print equal package/manifest versions. The searches must show the intro is isolated from `SetupFlow`/cashflow geometry and no new storage key/schema exists. Visually inspect the six 390/768/desktop timed artifacts plus 192px and circular-mask icon crops before closing the task.

- [ ] **Step 5: commit release-facing documentation/assets.**

```bash
git add DESIGN.md package.json package-lock.json public/manifest.webmanifest shared/legacy/sw.js shared/core/utils.js public/icons
git commit -m "docs: document Main brand intro"
```

---

## Integration and Handoff

- Before rebasing or opening a PR, fetch/re-read the then-current root `AGENTS.md`, any newly added Codex-harness instructions, current Product PRD/DESIGN, and the approved intro spec. Do not overwrite concurrent harness or Account Map work.
- Rebase this isolated branch onto the latest `main`; resolve only documentation/version conflicts required by this feature, regenerate icons if a brand asset changes, then repeat `git diff --check`, `npm run check`, focused Main tests and the required Playwright intro capture suite.
- Handoff must name changed files, all verification commands/results, the automatic build version bump, icon geometry validation, and the known unrelated AppLauncher baseline failures if they still exist.
