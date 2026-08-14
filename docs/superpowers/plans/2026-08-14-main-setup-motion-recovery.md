# Main Setup Motion Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main setup 1/6과 6/6의 Anime.js 모션이 생성 뒤 정지해도 진행 버튼과 돈 조립 시각화가 최종 상태로 복구되게 하고, 웰컴 인트로의 skip은 기존 접근성을 유지한 텍스트형 control로 낮춘다.

**Architecture:** `useAnimeScope`가 consumer cleanup을 scope cleanup보다 먼저 실행하도록 작은 lifecycle 계약을 추가한다. `SetupFlow`는 이 계약 위에서 scope-local deadline과 Anime completion/cancel을 묶어 정상 모션은 유지하고 stalled/failed 모션만 기존 final-style helper로 복구한다. `MainWelcomeIntro`의 markup과 event lifecycle은 그대로 두고 CSS visual token만 바꾸며, Vitest의 stalled fixture와 실제 시간을 쓰는 Playwright 검증을 분리한다.

**Tech Stack:** React 19, TypeScript 5.5, Anime.js 4, Vite 5/PWA, Vitest, Testing Library, Playwright

**Spec:** [Main setup 모션 복구와 조용한 인트로 건너뛰기 설계](../specs/2026-08-14-main-setup-viewport-containment-design.md)

## Global Constraints

- Main이 직접 소유하는 데이터는 월 실수령액·주거비·생활비·저축·투자 다섯 값뿐이며 저장 schema, bootstrap entry reason과 setup 진행 기록을 변경하지 않는다.
- normal motion에서는 현재 welcome reveal과 review assembly의 순서·duration·stagger를 유지한다.
- `prefers-reduced-motion`, Anime scope/timeline의 동기 실패, deadline 초과는 즉시 또는 안전하게 기존 final style로 수렴한다.
- deadline은 해당 Anime scope가 소유하고 normal completion·step change·unmount·Strict Mode replay에서 취소한다.
- 상단 setup progress strip, `FlowContextSummary`, `AllocationBar`, `cashflowBarGeometry`, 실제 초과 비율과 화면 경계 절단, `app-wide-visual` geometry를 변경하지 않는다.
- skip은 실제 `<button>`, accessible name `화면을 눌러 건너뛰기`, 초기 focus, pointer/Enter/Space/Escape 완료, safe-area 위치와 44px 이상 hit area를 유지한다.
- skip의 기본·hover 상태는 border·pill radius·fill 없이 텍스트만 보이고, `:focus-visible`에서만 실제 hit area의 outline을 제공한다.
- UI 완료 검증은 390×844, 768×900, 1280×900에서 수행하며 document overflow와 review 시각화 visibility를 확인한다.
- `npm run build`는 patch version을 변경하므로 최종 PWA 검증에서 한 번만 실행한다. 중간 bundle 검증이 필요하면 `node ./node_modules/vite/bin/vite.js build`를 사용한다.

---

## File Structure

### Modified files

- `src/components/motion/useAnimeScope.ts`: scope consumer가 반환한 cleanup을 `scope.revert()` 전에 실행하는 lifecycle 계약을 제공한다.
- `tests/unit/components/useAnimeScope.test.tsx`: normal scope, create failure fallback, dependency change와 unmount에서 consumer cleanup이 정확히 실행되는지 검증한다.
- `src/main/ui/setup/SetupFlow.tsx`: welcome/review animation에 scope-local deadline, normal completion 정리와 stalled cancel/finalization을 연결한다.
- `tests/unit/main/SetupFlow.test.tsx`: 생성 성공 뒤 tick/completion이 없는 welcome/review와 stale timer 회귀를 검증한다.
- `src/main/ui/main.css`: intro skip의 hit area를 유지하면서 기본/hover를 text-only로 바꾼다.
- `tests/unit/main/MainWelcomeIntro.test.tsx`: skip semantics와 CSS 기본 token을 함께 고정한다.
- `tests/main-react.spec.ts`: 실제 시간의 setup final state와 390/768/1280 intro skip visual/containment를 검증한다.
- `DESIGN.md`: 기존 Main intro/review 계약에 stalled-motion final-state와 text-only skip의 상세 명세 링크를 연결한다.
- `package.json`, `package-lock.json`, `public/manifest.webmanifest`, `shared/legacy/sw.js`, `shared/core/utils.js`: 최종 production build의 단일 patch version/cache 동기화 결과를 반영한다.

### New files

- 없음. 기존 motion hook, setup flow, tests와 canonical documents 안에서 끝낸다.

---

### Task 1: Anime scope가 consumer cleanup을 소유하게 한다

**Files:**
- Modify: `src/components/motion/useAnimeScope.ts`
- Modify: `tests/unit/components/useAnimeScope.test.tsx`

**Interfaces:**

```ts
export type MotionCleanup = () => void;

export function useAnimeScope<T extends HTMLElement>(
  setup: (context: MotionContext<T>) => void | MotionCleanup,
  dependencies: DependencyList,
): RefObject<T | null>;
```

- Consumes: 기존 `MotionContext<T>`, `attemptMotion()`, Anime.js `createScope()`.
- Produces: `SetupFlow`이 timer cleanup을 해당 Anime scope lifecycle에 귀속시킬 수 있는 optional cleanup return 계약.

- [ ] **Step 1: consumer cleanup의 실패 테스트를 작성한다.**

`tests/unit/components/useAnimeScope.test.tsx`에 dependency를 바꿀 수 있는 harness를 추가하고 다음 계약을 고정한다.

```tsx
function CleanupHarness({ generation, onSetup, onCleanup }: {
  generation: number;
  onSetup(): void;
  onCleanup(): void;
}) {
  const root = useAnimeScope<HTMLDivElement>(() => {
    onSetup();
    return onCleanup;
  }, [generation]);
  return <div ref={root} />;
}

it('runs consumer cleanup before scope revert on dependency change and unmount', () => {
  const order: string[] = [];
  animeMocks.scope.revert.mockImplementation(() => order.push('revert'));
  const props = {
    generation: 1,
    onSetup: vi.fn(),
    onCleanup: vi.fn(() => order.push('consumer-cleanup')),
  };
  const { rerender, unmount } = render(<CleanupHarness {...props} />);

  rerender(<CleanupHarness {...props} generation={2} />);
  expect(order.slice(0, 2)).toEqual(['consumer-cleanup', 'revert']);

  unmount();
  expect(props.onCleanup).toHaveBeenCalledTimes(2);
});
```

createScope가 throw하여 `reducedMotion: true` fallback setup을 사용한 경우에도 반환 cleanup이 unmount에서 한 번 실행되는 테스트를 함께 추가한다.

- [ ] **Step 2: focused test가 cleanup 부재로 실패하는지 확인한다.**

Run:

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
```

Expected: 새 cleanup assertion이 FAIL한다. 기존 reduced-motion fallback과 scope revert 테스트는 계속 PASS한다.

- [ ] **Step 3: optional cleanup 계약을 최소 구현한다.**

`useAnimeScope.ts`에서 setup 반환값을 저장하고 모든 종료 경로에서 정확히 한 번 정리한다. consumer cleanup 오류가 Anime scope 복원을 막지 않게 두 호출을 각각 `attemptMotion()`으로 감싼다.

```ts
export type MotionCleanup = () => void;

export function useAnimeScope<T extends HTMLElement>(
  setup: (context: MotionContext<T>) => void | MotionCleanup,
  dependencies: DependencyList,
): RefObject<T | null> {
  const rootRef = useRef<T>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    let consumerCleanup: MotionCleanup | undefined;
    let scope: ReturnType<typeof createScope>;
    try {
      scope = createScope({
        root,
        mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' },
      });
    } catch {
      const fallbackCleanup = setup({ root, reducedMotion: true });
      return typeof fallbackCleanup === 'function'
        ? () => { attemptMotion(fallbackCleanup); }
        : undefined;
    }

    let consumerFailed = false;
    let consumerError: unknown;
    try {
      scope.add(() => {
        try {
          const result = setup({ root, reducedMotion: scope.matches.reducedMotion === true });
          if (typeof result === 'function') consumerCleanup = result;
        } catch (error) {
          consumerFailed = true;
          consumerError = error;
          throw error;
        }
      });
    } catch {
      try {
        scope.revert();
      } catch {
        // A partial Anime scope must not mask the consumer error or final-state fallback.
      }
      if (consumerFailed) throw consumerError;
      const fallbackCleanup = setup({ root, reducedMotion: true });
      return typeof fallbackCleanup === 'function'
        ? () => { attemptMotion(fallbackCleanup); }
        : undefined;
    }

    return () => {
      if (consumerCleanup !== undefined) attemptMotion(consumerCleanup);
      attemptMotion(() => scope.revert());
    };
  }, dependencies);

  return rootRef;
}
```

이 형태로 현재 `consumerFailed`/`consumerError`, partial scope revert, consumer error 재throw 동작을 모두 유지한다. `scope.add()` 실패 뒤 reduced-motion fallback setup이 cleanup을 반환하면 그 cleanup도 effect 반환값으로 전달한다.

- [ ] **Step 4: hook test와 type check를 실행한다.**

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx
npm run check
```

Expected: focused test와 두 TypeScript project가 PASS한다.

- [ ] **Step 5: lifecycle 계약을 커밋한다.**

```bash
git add src/components/motion/useAnimeScope.ts tests/unit/components/useAnimeScope.test.tsx
git commit -m "fix(motion): clean up scoped consumer effects"
```

---

### Task 2: welcome과 review를 stalled motion에서도 최종 상태로 복구한다

**Files:**
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `tests/unit/main/SetupFlow.test.tsx`

**Interfaces:**

```ts
interface MotionDeadline {
  attachCancel(cancel: () => void): void;
  complete(): void;
  fail(): void;
  dispose(): void;
}

function startMotionDeadline(
  timeoutMs: number,
  applyFinalStyles: () => void,
): MotionDeadline;
```

- Consumes: Task 1의 `useAnimeScope(... setup => cleanup)` 계약, 기존 `setRevealFinalStyles()`/`setAssemblyFinalStyles()`, Anime animation/timeline `cancel()`과 `onComplete`.
- Produces: welcome 최대 예정 시간 뒤 `다음`을 포함한 reveal final state, review 최대 예정 시간 뒤 track/segments/content final state, cleanup-safe cancellation.

- [ ] **Step 1: Anime mock을 completion과 stall을 구분하도록 보강한다.**

`tests/unit/main/SetupFlow.test.tsx`의 hoisted mock이 animation/timeline cancel과 `onComplete`를 관찰할 수 있게 한다.

```ts
const animation = { cancel: vi.fn() };
let animateOptions: Record<string, unknown> | undefined;
let timelineOptions: { onComplete?: () => void } | undefined;

const animate = vi.fn((targets: unknown, parameters: Record<string, unknown>) => {
  animateOptions = parameters;
  applyFinalStyles(targets, parameters);
  return animation;
});

const createTimeline = vi.fn((options: { onComplete?: () => void }) => {
  timelineOptions = options;
  return timeline;
});
```

`timeline`에도 `cancel: vi.fn()`을 추가하고 `afterEach`에서 captured options를 초기화한다. 기본 mock은 final styles를 적용하되 completion을 자동 호출하지 않는다. 각 테스트가 healthy completion 또는 stalled deadline을 명시적으로 선택한다.

- [ ] **Step 2: welcome stalled/deadline/cleanup 실패 테스트를 작성한다.**

fake timer를 사용하고, 해당 테스트에서만 `animate`가 final styles나 completion을 적용하지 않는 animation을 반환하게 한다.

```tsx
it('restores the welcome action when a created Anime reveal never advances', () => {
  vi.useFakeTimers();
  animeMocks.animate.mockImplementationOnce(() => animeMocks.animation);
  renderFlow('welcome');

  const next = screen.getByRole('button', { name: '다음' });
  expect(next).toHaveStyle({ opacity: '0' });
  act(() => vi.runOnlyPendingTimers());

  for (const element of document.querySelectorAll<HTMLElement>('[data-welcome-motion]')) {
    expect(element).toHaveStyle({ opacity: '1', transform: 'translateY(0px)' });
  }
  expect(animeMocks.animation.cancel).toHaveBeenCalledOnce();
});
```

별도 테스트에서 welcome 직후 `다음`으로 income으로 이동한 다음 현재 button style을 sentinel 값으로 바꾸고 timer를 진행해 stale welcome deadline이 새 step button을 덮어쓰지 않는지 확인한다. unmount 뒤 detached welcome element에도 final style이 뒤늦게 적용되지 않는지 확인한다.

- [ ] **Step 3: review stalled와 healthy completion 실패 테스트를 작성한다.**

filled draft로 review를 mount하고 timeline `.add()`가 style을 진행시키지 않도록 설정한다. deadline 전에는 track `scaleX(0)`, segment/content opacity `0`, deadline 뒤에는 각각 `scaleX(1)`, opacity `1`, `translateY(0px)`이며 timeline `cancel()`이 한 번 호출되어야 한다.

healthy case에서는 captured `onComplete`를 직접 호출한 뒤 pending timer를 진행한다.

```ts
act(() => animeMocks.timelineOptions?.onComplete?.());
act(() => vi.runOnlyPendingTimers());
expect(animeMocks.timeline.cancel).not.toHaveBeenCalled();
```

이 테스트는 normal completion이 deadline을 취소하고 final state를 Anime.js가 소유한다는 계약을 고정한다.

- [ ] **Step 4: 새 tests가 현재 구현에서 실패하는지 확인한다.**

```bash
npx vitest run tests/unit/main/SetupFlow.test.tsx
```

Expected: stalled final-state, cancel, stale timer와 completion cleanup assertions가 FAIL한다. 기존 동기 생성 실패, Strict Mode replay와 setup journey 테스트는 PASS한다.

- [ ] **Step 5: scope-local deadline helper를 구현한다.**

`SetupFlow.tsx` 상단에 현재 세 welcome elements와 최대 네 allocation segments를 기준으로 기존 token/offset/stagger와 여유 `MOTION_DURATION.fast`를 합친 deadline을 선언한다.

```ts
const WELCOME_STAGGER_MS = 40;
const REVIEW_OFFSET_MS = 80;
const MAX_REVIEW_SEGMENT_COUNT = 4;
const WELCOME_MOTION_DEADLINE_MS = MOTION_DURATION.normal
  + (2 * WELCOME_STAGGER_MS)
  + MOTION_DURATION.fast;
const REVIEW_MOTION_DEADLINE_MS = MOTION_DURATION.emphasis
  + REVIEW_OFFSET_MS
  + MOTION_DURATION.normal
  + ((MAX_REVIEW_SEGMENT_COUNT - 1) * WELCOME_STAGGER_MS)
  + MOTION_DURATION.fast;
```

`startMotionDeadline()`은 다음 상태 전이를 구현한다.

```ts
function startMotionDeadline(timeoutMs: number, applyFinalStyles: () => void): MotionDeadline {
  let settled = false;
  let cancelMotion: (() => void) | undefined;
  let timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    if (cancelMotion !== undefined) attemptMotion(cancelMotion);
    applyFinalStyles();
  }, timeoutMs);

  const clear = () => {
    window.clearTimeout(timer);
  };
  const recover = () => {
    if (settled) return;
    settled = true;
    clear();
    if (cancelMotion !== undefined) attemptMotion(cancelMotion);
    applyFinalStyles();
  };

  return {
    attachCancel(cancel) { cancelMotion = cancel; },
    complete() {
      if (settled) return;
      settled = true;
      clear();
    },
    fail: recover,
    dispose() {
      if (settled) return;
      settled = true;
      clear();
    },
  };
}
```

실제 구현에서는 timer handle을 `number | undefined`로 두고 clear 뒤 `undefined`로 바꿔 중복 clear를 피한다.

- [ ] **Step 6: welcome animation에 deadline과 completion을 연결한다.**

기존 non-welcome 단계는 현재 `attemptMotion(animate)`와 동기 실패 finalization을 그대로 사용한다. `step === 'welcome'`에서만 `setRevealInitialStyles(elements)` 뒤 deadline을 만들고 `animate()` 반환 animation의 cancel을 연결한다.

```ts
const recovery = startMotionDeadline(
  WELCOME_MOTION_DEADLINE_MS,
  () => setRevealFinalStyles(elements),
);
const started = attemptMotion(() => {
  const animation = animate(elements, {
    opacity: [0, 1],
    y: [MOTION_DISTANCE_PX.reveal, 0],
    duration: MOTION_DURATION.normal,
    delay: step === 'welcome' ? stagger(WELCOME_STAGGER_MS) : 0,
    ease: MOTION_EASE.enter,
    onComplete: recovery.complete,
  });
  recovery.attachCancel(() => animation.cancel());
});
if (!started) recovery.fail();
return recovery.dispose;
```

`motionPreset === 'none'`, reduced motion, already-played와 element 부재 경로는 timer를 만들지 않고 현재 즉시-final 동작을 유지한다.

- [ ] **Step 7: review timeline에 같은 deadline을 연결한다.**

`setAssemblyInitialStyles()` 뒤 `createTimeline({ defaults, onComplete: recovery.complete })`을 만들고 `.add()` 전에 cancel callback을 연결한다. 기존 track/segment/content의 add 순서, duration, `'<+=80'`, `'<'` 위치는 그대로 둔다. construction 또는 `.add()`가 throw하면 `recovery.fail()`이 partial timeline을 cancel한 뒤 final styles를 적용한다. callback은 `return recovery.dispose`로 scope cleanup에 귀속한다.

- [ ] **Step 8: focused motion tests와 type check를 실행한다.**

```bash
npx vitest run tests/unit/components/useAnimeScope.test.tsx tests/unit/main/SetupFlow.test.tsx tests/unit/main/AllocationBar.test.tsx tests/unit/main/FlowContextSummary.test.tsx
npm run check
```

Expected: stalled/healthy/cleanup cases와 기존 geometry 소비자 tests가 모두 PASS한다.

- [ ] **Step 9: setup 복구를 커밋한다.**

```bash
git add src/main/ui/setup/SetupFlow.tsx tests/unit/main/SetupFlow.test.tsx
git commit -m "fix(main): recover stalled setup motion"
```

---

### Task 3: intro skip을 hit area가 유지되는 텍스트형 control로 낮춘다

**Files:**
- Modify: `src/main/ui/main.css`
- Modify: `tests/unit/main/MainWelcomeIntro.test.tsx`

**Interfaces:**

- Consumes: 변경하지 않는 `.main-welcome-intro__skip` button markup과 `MainWelcomeIntro.finish()` input handlers.
- Produces: transparent/default/hover visual, 44px 이상 full-width bottom hit area, focus-visible outline.

- [ ] **Step 1: text-only visual token의 실패 테스트를 작성한다.**

기존 `focuses the one 44px skip button` 테스트를 semantics와 visual contract로 확장한다.

```ts
const styles = getComputedStyle(button);
expect(styles.minHeight).toBe('44px');
expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
expect(styles.borderTopWidth).toBe('0px');
expect(styles.borderRadius).toBe('0px');
expect(styles.textAlign).toBe('center');
```

기존 one-button, focus, accessible name과 모든 completion input tests는 수정하지 않는다. JSDOM이 pseudo-class computed style을 제공하지 않으므로 `:focus-visible`의 실제 outline은 browser 단계에서 확인한다.

- [ ] **Step 2: 현재 pill CSS로 실패하는지 확인한다.**

```bash
npx vitest run tests/unit/main/MainWelcomeIntro.test.tsx
```

Expected: background, border와 radius assertion이 FAIL한다.

- [ ] **Step 3: CSS만 최소 변경한다.**

```css
.main-welcome-intro__skip {
  position: absolute;
  inset-inline: 1rem;
  bottom: max(1rem, env(safe-area-inset-bottom));
  min-height: 44px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: rgb(23 58 58 / 54%);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
}

.main-welcome-intro__skip:hover {
  background: transparent;
}

.main-welcome-intro__skip:focus-visible {
  outline: 3px solid rgb(30 139 124 / 60%);
  outline-offset: 3px;
}
```

`MainWelcomeIntro.tsx`의 button, accessible name, ref와 handlers는 수정하지 않는다.

- [ ] **Step 4: intro unit tests를 실행한다.**

```bash
npx vitest run tests/unit/main/MainWelcomeIntro.test.tsx
```

Expected: visual token과 기존 semantics/skip/cleanup tests가 모두 PASS한다.

- [ ] **Step 5: quiet skip을 커밋한다.**

```bash
git add src/main/ui/main.css tests/unit/main/MainWelcomeIntro.test.tsx
git commit -m "fix(main): quiet welcome intro skip control"
```

---

### Task 4: 실제 시간과 필수 viewport에서 사용자 관찰 동작을 고정한다

**Files:**
- Modify: `tests/main-react.spec.ts`
- Modify: `DESIGN.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/manifest.webmanifest`
- Modify: `shared/legacy/sw.js`
- Modify: `shared/core/utils.js`

**Interfaces:**

- Consumes: Task 2의 final-state deadline, Task 3의 text-only skip, 기존 `appliedWorkspaceV1`/setup progress fixture와 review geometry assertions.
- Produces: real-time 1/6·6/6 browser proof, 390/768/1280 containment proof, canonical UI contract와 synchronized PWA version.

- [ ] **Step 1: intro capture에 quiet skip browser assertion을 추가한다.**

기존 `captureMainBrandIntro()`의 geometry read에 다음 computed values를 추가한다.

```ts
const skipStyle = getComputedStyle(skipButton);
const skipVisual = {
  backgroundColor: skipStyle.backgroundColor,
  borderTopWidth: skipStyle.borderTopWidth,
  borderRadius: skipStyle.borderRadius,
  minHeight: skipStyle.minHeight,
  outlineStyle: skipStyle.outlineStyle,
};
```

위 `skipVisual`을 기존 geometry return object의 동명 property로 추가한다. 각 390×844, 768×900, 1280×900 capture에서 transparent background, `0px` border/radius와 44px 이상 geometry를 assert한다. focus outline은 skip을 blur한 뒤 실제 `Tab` keyboard input으로 다시 focus하고 `outlineStyle !== 'none'`을 확인한다. `skipContained`, initial focus와 기존 pointer/keyboard completion assertions를 유지한다.

- [ ] **Step 2: setup final state를 실제 시간으로 확인하는 helper/test를 추가한다.**

Playwright clock을 설치하지 않는 새 test에서 각 필수 viewport를 순회한다. 먼저 `initial / welcome` setup progress를 저장해 별도 brand intro를 bypass하고 실제 browser timer/Anime runtime을 사용한다.

```ts
await expect.poll(() => page.getByRole('button', { name: '다음' }).evaluate((element) => {
  const style = getComputedStyle(element);
  return { opacity: Number(style.opacity), transform: style.transform };
})).toEqual({ opacity: 1, transform: 'none' });
```

브라우저가 `translateY(0px)`를 matrix 또는 `none`으로 정규화할 수 있으므로 실제 assertion은 opacity `1`과 `DOMMatrixReadOnly(transform).f`가 `0`에 가까운지를 각각 poll한다.

그 다음 filled `review` progress fixture로 reload하고 다음을 실제 시간으로 poll한다.

```ts
const final = await page.locator('.setup-flow-surface').evaluate((root) => ({
  scaleX: new DOMMatrixReadOnly(
    getComputedStyle(root.querySelector<HTMLElement>('.allocation-bar__visual-track')!).transform,
  ).a,
  segmentOpacities: [...root.querySelectorAll<HTMLElement>('.allocation-bar__visual-segment')]
    .map((element) => Number(getComputedStyle(element).opacity)),
  contentOpacities: [...root.querySelectorAll<HTMLElement>('[data-assembly-content]')]
    .map((element) => Number(getComputedStyle(element).opacity)),
}));
```

`scaleX === 1`, 모든 opacity `1`, `계획 적용` visible, `.allocation-bar__visual-stage.app-wide-visual` 유지, document `scrollWidth <= innerWidth`를 확인한다. test 이름에 `real time`을 넣고 `page.clock.install()`/`runFor()`를 사용하지 않는다.

- [ ] **Step 3: 기존 fake-clock geometry regression을 그대로 실행한다.**

```bash
npx playwright test tests/main-react.spec.ts --grep "review assembly captures timed deficit geometry and reduced motion"
```

Expected: start/mid/final timing, slight/large deficit의 actual ratio와 edge clipping, reduced motion, restart `app-wide-visual` assertions가 PASS한다. 이 실패를 fallback deadline에 맞춰 geometry나 기존 timing을 바꾸는 방식으로 해결하지 않는다.

- [ ] **Step 4: 새 browser test와 intro regression을 실행한다.**

```bash
npx playwright test tests/main-react.spec.ts --grep "(brand intro|setup motion reaches final state in real time)"
```

Expected: 세 viewport에서 quiet skip, welcome `다음`, filled review track/segments/content, focus와 document containment가 PASS한다.

- [ ] **Step 5: canonical UI contract에 상세 명세를 연결한다.**

`DESIGN.md`의 Main 항목에 다음 한 문장을 추가한다.

```md
- 인트로 skip은 접근 가능한 hit area를 유지한 text-only control이며, setup reveal이 진행되지 않아도 1/6 진행 action과 6/6 조립 시각화는 final state로 복구된다. 상세 cleanup·timing 계약은 [Main setup 모션 복구와 조용한 인트로 건너뛰기 설계](docs/superpowers/specs/2026-08-14-main-setup-viewport-containment-design.md)를 따른다.
```

PRD의 데이터·앱 ownership과 setup 단계/문구는 바뀌지 않으므로 PRD는 수정하지 않는다.

- [ ] **Step 6: 문서와 전체 focused regression을 확인한다.**

```bash
git diff --check
npm run check
npx vitest run tests/unit/components/useAnimeScope.test.tsx tests/unit/main/SetupFlow.test.tsx tests/unit/main/MainWelcomeIntro.test.tsx tests/unit/main/AllocationBar.test.tsx tests/unit/main/FlowContextSummary.test.tsx
npx playwright test tests/main-react.spec.ts --grep "(brand intro|setup motion reaches final state in real time|review assembly captures timed deficit geometry and reduced motion|keyboard-only setup)"
```

Expected: 문서 링크, TypeScript, focused unit/browser regression이 모두 PASS한다.

- [ ] **Step 7: production build를 한 번 실행해 patch version을 동기화한다.**

```bash
npm run build
npm install --package-lock-only --ignore-scripts
```

Expected: `0.11.93`에서 `0.11.94`로 한 번만 증가하고 `package.json`, `package-lock.json`, manifest, legacy service-worker cache namespace와 shared fallback version이 모두 `0.11.94`다. `dist/`나 unrelated dependency upgrade를 stage하지 않는다.

- [ ] **Step 8: 전체 검증과 최종 invariant 검색을 실행한다.**

```bash
git diff --check
npm run check
npm run test:unit
npm run test:e2e
node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const m=JSON.parse(fs.readFileSync("public/manifest.webmanifest","utf8")); console.log({ package:p.version, manifest:m.version })'
rg -n "APP_VERSION" shared/legacy/sw.js shared/core/utils.js
rg -n "WELCOME_MOTION_DEADLINE_MS|REVIEW_MOTION_DEADLINE_MS|main-welcome-intro__skip" src tests
git status --short
```

Expected: source checks, 82개 이상 unit files, 전체 E2E가 PASS하며 package/manifest/cache version이 같다. 검색 결과는 fallback이 `SetupFlow`과 관련 tests에 한정되고 `AllocationBar`/`cashflowBarGeometry`에는 새 deadline이나 geometry 변경이 없음을 보여야 한다.

- [ ] **Step 9: 문서, browser proof와 release 변경을 커밋한다.**

```bash
git add DESIGN.md tests/main-react.spec.ts package.json package-lock.json public/manifest.webmanifest shared/legacy/sw.js shared/core/utils.js
git commit -m "test(main): verify setup motion recovery"
```

최종 handoff에는 변경 파일·목적, 모든 실행 명령과 결과, 390/768/1280 확인 결과, 남은 위험을 기록한다. 최신 검증이 실패하면 완료나 수정 성공을 주장하지 않는다.
