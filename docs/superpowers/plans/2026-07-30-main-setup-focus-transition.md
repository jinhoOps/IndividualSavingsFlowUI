# Main Setup Focus Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1/6~6/6 설정 중 외부 방해 요소를 숨기고 6/6에서 단순 흐름 바가 배분 바와 표로 이어지는 전환을 구현한다.

**Architecture:** `MainApp`이 설정 모드의 집중 레이아웃과 재설정 취소 위치를 소유한다. `SetupFlow`는 단계 전환 상태를 바탕으로 검토 전환 레이어와 최종 `AllocationBar` 노출 시점을 관리하고, 기존 계산·저장 계약은 그대로 재사용한다.

**Tech Stack:** React, TypeScript, Tailwind CSS, CSS transitions/keyframes, Vitest, Testing Library, Playwright

## Global Constraints

- 최초 설정과 기존 계획 재설정 모두 설정 카드 밖의 앱 런처와 연결 안내를 숨긴다.
- 재설정 `취소`만 설정 카드 내부에 유지한다.
- 6/6 최종 상태에는 색상 배분 바와 표만 남고 단순 `flow-bar`는 없어야 한다.
- `prefers-reduced-motion: reduce`에서는 최종 상태를 즉시 표시한다.
- 6/6 전환은 화면 진입 후 350ms 정지한 다음 시작하며 기존 620ms 이동 시간은 유지한다.
- Main 데이터, 계산, 저장 계약은 변경하지 않는다.

---

### Task 1: 설정 집중 레이아웃

**Files:**
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Test: `tests/unit/main/MainApp.test.tsx`
- Test: `tests/unit/main/SetupFlow.test.tsx`

**Interfaces:**
- Consumes: `MainState.mode`, `MainState.applied`, 기존 `cancelDraft()`
- Produces: `SetupFlowProps.onCancel?: () => void`, 설정 카드 내부 취소 버튼

- [ ] **Step 1: 설정 중 외부 요소가 사라지는 실패 테스트 작성**

`tests/unit/main/MainApp.test.tsx`의 최초 설정 테스트를 다음 계약으로 변경한다.

```tsx
expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
expect(screen.queryByText('Simulation으로 이어가기')).not.toBeInTheDocument();
```

재설정 테스트에는 카드 내부 취소를 확인한다.

```tsx
const cancel = screen.getByRole('button', { name: '설정 취소' });
expect(cancel.closest('.setup-flow-surface')).not.toBeNull();
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/main/MainApp.test.tsx`

Expected: 최초 설정에서 런처가 발견되거나 재설정 취소가 카드 밖에 있어 FAIL.

- [ ] **Step 3: 집중 레이아웃 최소 구현**

`MainApp`의 setup 분기에서 `MainAppShell`에 항상 `showLauncher={false}`를 전달하고 `journeyEntry`를 렌더링하지 않는다. 카드 밖 취소 영역을 제거하고 재설정일 때만 `SetupFlow`에 `onCancel={cancelDraft}`를 전달한다.

`SetupFlowProps`에 다음 선택 속성을 추가한다.

```ts
onCancel?: () => void;
```

카드 내부 상단 행에 취소 버튼을 렌더링한다.

```tsx
{onCancel ? (
  <Button type="button" variant="secondary" aria-label="설정 취소" onClick={onCancel}>
    취소
  </Button>
) : null}
```

진행률 트랙은 카드 경계에서 떼어 내부 여백과 완전한 라운드를 사용한다.

```tsx
<div className="mx-6 mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 sm:mx-10">
```

- [ ] **Step 4: 집중 레이아웃 테스트 통과 확인**

Run: `npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/main/SetupFlow.test.tsx`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/main/ui/MainApp.tsx src/main/ui/setup/SetupFlow.tsx tests/unit/main/MainApp.test.tsx tests/unit/main/SetupFlow.test.tsx
git commit -m "fix(main): focus setup flow"
```

### Task 2: 검토 단계 바 전환

**Files:**
- Modify: `src/main/ui/setup/SetupFlow.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/main.css`
- Test: `tests/unit/main/SetupFlow.test.tsx`
- Test: `tests/unit/main/AllocationBar.test.tsx`

**Interfaces:**
- Consumes: `SetupStep`, `AllocationBarProps.data`
- Produces: `AllocationBarProps.transitioning?: boolean`, `.setup-review-transition`, `.setup-review-transition__track`

- [ ] **Step 1: 검토 최종 DOM과 전환 재실행 실패 테스트 작성**

`tests/unit/main/SetupFlow.test.tsx`에서 review 진입 후 다음을 검증한다.

```tsx
expect(screen.queryByRole('progressbar', { name: '수입 대비 현재 계획' })).not.toBeInTheDocument();
expect(screen.getByLabelText('월 수입 나누기')).toBeVisible();
expect(screen.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
expect(document.querySelector('.setup-review-transition')).not.toBeNull();
```

`이전` 후 다시 `다음`을 눌렀을 때 새로운 전환 레이어가 생성되는지 `data-transition-run` 값 증가로 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/main/SetupFlow.test.tsx`

Expected: review에도 `FlowContextSummary` progressbar가 남아 있고 전환 레이어가 없어 FAIL.

- [ ] **Step 3: 전환 상태와 최종 DOM 구현**

`showContext`에서 `review`를 제거한다.

```ts
const showContext = step === 'housing'
  || step === 'living'
  || step === 'saving-investment';
```

`SetupFlow`에 review 진입 횟수와 전환 완료 상태를 둔다.

```ts
const [reviewRun, setReviewRun] = useState(0);
const [reviewTransitioning, setReviewTransitioning] = useState(false);
```

`step === 'review'` 진입 시 run을 증가시키고 모션 감소가 아니면 전환을 시작한다. `transitionend`와 700ms 안전 타이머 중 먼저 도착한 신호로 완료한다. cleanup에서 타이머를 제거한다.

`ReviewStep`은 `AllocationBar` 위에 `aria-hidden="true"` 전환 레이어를 렌더링하고 `transitioning`을 전달한다. 전환 중에도 최종 배분 정보는 DOM에 유지하되 CSS로만 숨겨 접근성 정보가 사라지지 않게 한다.

- [ ] **Step 4: 배분 구간을 단일 계산 원천으로 추출**

`AllocationBar.tsx`에서 시각 구간 계산을 다음 함수로 추출하고 export한다.

```ts
export interface AllocationVisualSegment {
  id: 'consumption' | 'saving' | 'investment' | 'remaining';
  visualPercentage: number;
}

export function createAllocationVisualSegments(data: MainData): AllocationVisualSegment[];
```

`AllocationBar`와 전환 레이어가 이 함수를 함께 사용해 같은 폭과 색상 순서를 렌더링한다.

- [ ] **Step 5: 전환 CSS 구현**

`main.css`에 다음 상태를 추가한다.

```css
.setup-review-transition {
  pointer-events: none;
  transform-origin: center;
}

.setup-review-transition__track {
  @apply flex h-1.5 overflow-hidden rounded-full bg-slate-200;
  animation: setup-review-track 560ms cubic-bezier(.22, 1, .36, 1) both;
}

.allocation-bar[data-transitioning="true"] {
  animation: setup-review-content 220ms ease-out 420ms both;
}
```

키프레임은 전환 트랙을 이전 요약 바 위치감에서 배분 바 위치로 `translateY`·`scaleX`하고, 단색 오버레이 opacity를 낮추면서 아래 색상 구간을 드러낸다. 표는 `opacity: 0; transform: translateY(8px)`에서 최종 상태로 전환한다.

```css
@media (prefers-reduced-motion: reduce) {
  .setup-review-transition { display: none; }
  .allocation-bar[data-transitioning="true"] { animation: none; }
}
```

- [ ] **Step 6: 전환 테스트 통과 확인**

Run: `npx vitest run tests/unit/main/SetupFlow.test.tsx tests/unit/main/AllocationBar.test.tsx`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/main/ui/setup/SetupFlow.tsx src/main/ui/setup/AllocationBar.tsx src/main/ui/main.css tests/unit/main/SetupFlow.test.tsx tests/unit/main/AllocationBar.test.tsx
git commit -m "feat(main): animate review allocation"
```

### Task 3: 브라우저 흐름과 반응형 회귀

**Files:**
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: 설정 단계 접근성 이름, `.setup-review-transition`, `.allocation-bar`
- Produces: 설정 집중 화면과 검토 전환의 사용자 관찰 회귀 계약

- [ ] **Step 1: 브라우저 실패 테스트 작성**

최초 설정에서 다음을 확인한다.

```ts
await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
await expect(page.getByText('Simulation으로 이어가기')).toHaveCount(0);
```

6/6 진입 직후 전환 레이어와 최종 상태를 확인한다.

```ts
await expect(page.locator('.setup-review-transition')).toBeVisible();
await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
```

390px, 768px, desktop 각각에서 `document.documentElement.scrollWidth <= innerWidth`를 확인한다. 모션 감소 컨텍스트에서는 전환 레이어가 숨겨지고 배분 표가 즉시 보이는지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npx playwright test tests/main-react.spec.ts`

Expected: 새 집중 화면 또는 전환 계약에서 FAIL.

- [ ] **Step 3: 테스트가 드러낸 레이아웃 차이만 조정**

전환 레이어는 `.setup-flow-surface`의 실제 content box 안에 유지하고, 모바일에서 고정 px 폭이나 viewport 기준 위치를 사용하지 않는다. 필요한 경우 `main.css`의 전환 거리만 CSS custom property로 조정한다.

- [ ] **Step 4: 전체 검증**

Run:

```bash
npm run check
npx vitest run
npx playwright test
npx vite build
git diff --check
```

Expected: 타입 검사 통과, 전체 단위 테스트 통과, 지원 E2E 통과와 의도적 레거시 skip만 존재, 프로덕션 빌드 통과, whitespace 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add tests/main-react.spec.ts src/main/ui/main.css
git commit -m "test(main): cover focused setup transition"
```
