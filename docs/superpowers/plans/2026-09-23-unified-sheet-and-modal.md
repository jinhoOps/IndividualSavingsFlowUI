# 통합 바텀시트·통합 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 사용자가 앞서 선택한 native 방식으로 순차 실행한다.

**Goal:** 세 앱의 모바일 바텀시트와 웹 모달을 각각 일관된 규격으로 제공하고, 모바일 비상호작용 영역 드래그와 잔여 움직임을 포함한 400–500ms 모션을 구현한다.

**Architecture:** `ResponsiveDialog`의 native dialog·종료 승인·초점·배경 잠금은 공유하고, `data-presentation="sheet|modal"`에 따라 외형과 모션을 구분한다. `ResponsiveDialogLayout`은 내부 슬롯과 행동 배치를 공유한다. 기존 드래그 훅을 확장하고 표면 전용 모션 모듈을 추가하며, 앱별 dialog 엔진을 새로 만들지 않는다.

**Tech Stack:** React 19, TypeScript, native HTML dialog, Anime.js 4, CSS media queries, Vitest, Playwright.

**Spec:** [공통 표면 설계](../specs/2026-09-22-unified-bottom-sheet-design.md), [DESIGN](../../../DESIGN.md), [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md). 2026-09-23 사용자 수정 사항은 기존 92dvh·손잡이 전용 드래그·공통 모션을 대체한다. 작업 추적과 최종 검증 결과는 아래 checkbox와 [검증 증거](../evidence/2026-09-23-unified-sheet-and-modal/verification.md)에 기록한다.

## Global Constraints

- 모바일 `<=767px`: 최대 **88dvh**, 하단 부착, 내용이 짧으면 내용 높이. 전체 높이가 필요한 샘플·미리보기도 88dvh 상한을 따른다.
- 웹 `>=768px`: 중앙 모달, 손잡이 없음, 왼쪽 제목·오른쪽 닫기. 아래에서 올라오는 모션 없음.
- 모션의 목표는 **잔여 움직임까지 포함한 총 400–500ms**. 기준 450ms. 직접 드래그 중에는 보간 지연 없이 손가락을 따른다. reduced-motion 및 초기화 실패는 즉시 최종 상태다.
- 드래그 시작 허용: 손잡이, 제목·설명, 본문·footer의 비상호작용 공간. 입력·버튼·링크·토글·슬라이더·편집 가능한 텍스트와 해당 label은 제외한다.
- 본문 스크롤을 우선한다. 본문 맨 위에서 **새로 시작한** 아래 방향 제스처만 시트를 움직인다. 한 제스처로 스크롤하다 맨 위에 도착했다고 닫기로 바꾸지 않는다.
- 종료는 기존 clean/미완료 입력/saving/오류/충돌 판단을 재사용한다. 서버에 저장된 초안이나 조회만 한 상태에 새 폐기 확인을 추가하지 않는다.
- Main 다섯 금액 소유권, Simulation 자동 저장, Portfolio 단계·복구, schema v5/protocol 5 및 accountMap/locations 보존 계약을 유지한다.
- 표면 전용 모션을 분리해 그래프·금액 애니메이션의 기존 공통 토큰 시간을 변경하지 않는다.
- 44px 이상 조작 영역, body 단일 스크롤, footer 노출, 초점 복원, 최상위 dialog만 조작 가능이라는 계약을 유지한다.

## Review Focus

1. 터치 브라우저가 pointercancel을 발생시키는 경우: 합성 pointer 이벤트 성공만으로 드래그 성공을 판정하지 않는다. Task 2·5의 실제 브라우저 터치 경로로 검증한다.
2. 키보드 표시·가로 화면·767↔768px 전환: 입력과 초점은 보존하고 오래된 transform·capture가 남지 않아야 한다. Task 1·3·5에서 검증한다.
3. 폐기 확인을 기다리는 동안 재드래그·Escape: 종료 승인과 onClosed가 중복 실행되지 않아야 한다. Task 2·3에서 검증한다.
4. 표면 진입 중 닫기·드래그, 복귀 중 재드래그: 현재 표시 위치에서 이어지고 강제 완료 타이머가 다음 모션을 종료하지 않아야 한다. Task 3에서 검증한다.
5. 이미지 로딩·긴 이름·오류·200% 확대: 내용 높이 모달이 viewport 밖으로 커지거나 footer가 가려지지 않아야 한다. Task 4·5에서 검증한다.

## 구현 전 기준선 확인

- 조사 당시 `responsive-dialog.css`: 손잡이가 웹에도 보이고 제목이 중앙 정렬됐다. form/wide 높이가 고정돼 있으며 모바일 상한은 92dvh였다.
- 조사 당시 `useSheetDismiss.ts`: 손잡이에만 pointer listener가 붙고, 복귀·닫기 fallback은 각각 300ms였다. 이 타이머를 그대로 둔 채 모션 설정만 늘리면 중간에 끊기는 상태였다.
- 조사 당시 `ResponsiveDialog.tsx`: 모바일 등장만 opt-in이고 웹은 즉시 나타났다. 버튼/Escape/backdrop 종료는 승인 후 즉시 finishClose했고, 드래그만 별도 퇴장 모션이 있었다.
- 조사 당시 `useSheetDismiss.test.tsx`: 본문에서는 드래그하지 않는 기존 테스트를 새 스크롤 우선 계약으로 교체해야 했다.
- 기존 설계 문서의 modal 너비와 조사 당시 CSS 수치가 달라 이번 구현에서 선택한 규격에 맞춰 코드·문서를 정리했다.
- 설치된 Anime.js 확인 결과 surface spring의 perceived duration=260ms, settlingDuration=600ms다. 전체 easing 함수를 명시적 duration=450ms와 전달한 실행 객체의 animation.duration=450ms를 확인했다. 브라우저 시각 검증은 Task 5에서 수행한다.

## 파일별 책임

| 파일 | 변경 책임 |
| --- | --- |
| `src/components/common/ResponsiveDialog.tsx` | 반응형 presentation, 승인 후 모션을 거치는 종료, 수명·초점 관리 |
| `src/components/common/ResponsiveDialogLayout.tsx` | 모바일 손잡이, 제목/뒤로/닫기, 공통 행동 행 |
| `src/components/common/responsive-dialog.css` | 88dvh, 손잡이, 모달 크기·여백·행동 배치 |
| `src/components/motion/useSheetDismiss.ts` | 비상호작용 영역과 스크롤을 구분하는 드래그 상태 |
| 신규 `src/components/motion/dialogMotion.ts` | 표면 전용 450ms 모션 및 완료·취소·fallback |
| Main/Simulation/Portfolio/Journey의 dialog 호출부 | 공통 규격 연결, 앱별 외형 override 제거 |
| `tests/unit/components/*Dialog*.test.tsx`, `useSheetDismiss.test.tsx` | 종료·드래그·배치 회귀 |
| 신규 `tests/unit/components/dialogMotion.test.ts` | 실제 Anime easing·설정과 수명 검증 |
| `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/app-journey.spec.ts` | 실제 사용자 흐름과 반응형·터치·모션 검증 |

## Task 1: 두 표면의 외형과 배치

**Files:** `ResponsiveDialogLayout.tsx`, `responsive-dialog.css`, `tests/unit/components/ResponsiveDialogLayout.test.tsx`, `tests/simulation.spec.ts`.

**Interfaces:** 기존 `ResponsiveDialogProps.size = 'compact' | 'form' | 'wide'`, `mobileHeight = 'content' | 'full'`, `data-presentation`을 유지한다. header/context/body/status/footer 슬롯 순서도 유지한다.

- [x] 1. `tests/simulation.spec.ts`에 `surface geometry` 그룹을 추가한다. 기존 `seedMain`·`openFirstResult`로 편집기를 열고 아래 경계를 실패하는 테스트로 고정한다.

```ts
const dialog = page.getByRole('dialog', { name: '시뮬레이션 조건' });
const box = await dialog.boundingBox();
expect(box).not.toBeNull();
if (viewport.width < 768) {
  expect(box!.height).toBeLessThanOrEqual(viewport.height * 0.88 + 1);
  await expect(dialog.locator('.responsive-dialog__drag-handle')).toBeVisible();
} else {
  await expect(dialog.locator('.responsive-dialog__drag-handle')).toBeHidden();
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
}
```

- [x] 2. `npx playwright test tests/simulation.spec.ts --grep 'surface geometry'` 실행. 기존 규격의 실패를 확인하고 새 presentation 경계를 검증한다.
- [x] 3. CSS를 변경한다. 모바일 손잡이 표시선은 `clamp(72px, 22vw, 104px)`·높이 4px, 실제 손잡이 행은 가로 전체·높이 44px 이상이다. 좁은 40px 요소만 잡도록 하지 않는다. 제목·손잡이·본문 사이의 불필요한 높이는 줄인다.

```css
.responsive-dialog[data-presentation='modal'] .responsive-dialog__drag-handle { display: none; }
.responsive-dialog[data-presentation='modal'] .responsive-dialog__heading { text-align: left; }
  .responsive-dialog[data-presentation='modal'][data-size='compact'] { height: auto; }
  .responsive-dialog[data-presentation='modal'][data-size='form'] { height: min(46rem, calc(100dvh - 48px)); }
  .responsive-dialog[data-presentation='modal'][data-size='wide'] { height: min(54rem, calc(100dvh - 48px)); }
.responsive-dialog[data-size='compact'] { --responsive-dialog-width: 27.5rem; }
.responsive-dialog[data-size='form'] { --responsive-dialog-width: 40rem; }
.responsive-dialog[data-size='wide'] { --responsive-dialog-width: 67.5rem; }
```

  웹 header에만 빈 왼쪽 spacer를 제거하고, 뒤로가기가 있는 경우 실제 버튼 열은 유지한다. 웹 좌우 여백 24px·모바일 20px를 기준으로 한다. **검증 후 조정:** 처음에는 모든 modal 높이를 auto로 두려 했으나, focus로 Main 빠른 조정이 접힐 때 desktop Apply 버튼의 pointerup 대상이 footer로 바뀌는 회귀가 재현됐다. 따라서 compact만 내용 높이를 사용하고 form/wide는 위의 안정된 canvas와 자식 `height:100%`를 유지한다. 모바일 full은 최대 88dvh, content는 짧으면 intrinsic height를 쓰며 body에는 내부 scroll을 둔다.
- [x] 4. 테스트를 통과시키고 긴 본문과 footer 없는 설정 화면에서도 내부 스크롤만 생기는지 확인한다.
- [x] 5. `git diff --check`와 작성자 확인 후 관련 파일만 커밋: `feat: separate sheet and modal presentation`.

## Task 2: 여백 드래그와 스크롤 중재

**Files:** `useSheetDismiss.ts`, `ResponsiveDialogLayout.tsx`, `responsive-dialog.css`, `tests/unit/components/useSheetDismiss.test.tsx`, `tests/main-react.spec.ts`.

**Interfaces:** `UseSheetDismissOptions`의 기존 승인/완료 콜백을 유지한다. `[data-surface-body]`를 본문 스크롤 경계로 사용하고 `[data-sheet-no-drag]`를 커스텀 상호작용 영역의 명시적 제외 표식으로 지원한다.

- [x] 1. 단위 Harness에 제목 여백·본문 여백·footer 여백·input/label/button/slider를 추가한다. 기존 `dispatchPointer`를 재사용해 다음 실패 테스트를 작성한다.

```ts
const target = screen.getByTestId('sheet-body');
Object.defineProperty(target, 'scrollTop', { configurable: true, value: 0, writable: true });
dispatchPointer(target, 'pointerdown', { clientY: 100 });
dispatchPointer(target, 'pointermove', { clientY: 220 });
dispatchPointer(target, 'pointerup', { clientY: 220 });
expect(onRequestDismiss).toHaveBeenCalledOnce();
```

  별도 테스트로 시작 시 scrollTop=40이면 0에 도달한 뒤에도 그 제스처에서는 dismiss=0, 다음 새 제스처에서만 dismiss=1임을 고정한다. 상호작용 요소/label, 가로·위 방향, 멀티터치, non-topmost, busy는 dismiss=0이다.
- [x] 2. `npx vitest run tests/unit/components/useSheetDismiss.test.tsx`로 새 요구사항의 실패를 확인한다.
- [x] 3. listener를 손잡이에서 표면 내부로 확장한다. native backdrop은 제외하고, 시작 지점의 interactive 조상과 중첩 scrollable 조상의 scrollTop을 확인한다. 제스처 상태를 `pending → dragging | scrolling → end`로 고정하고 scrolling으로 판정된 제스처는 다시 dragging으로 전환하지 않는다. 활성화 전에는 preventDefault/capture하지 않는다.

```ts
const interactiveSelector = [
  'input', 'textarea', 'select', 'button', 'a[href]', 'label', 'summary',
  '[contenteditable]:not([contenteditable="false"])', '[role="button"]',
  '[role="slider"]', '[role="switch"]', '[role="checkbox"]',
  '[role="radio"]', '[role="combobox"]', '[tabindex]:not([tabindex="-1"])',
  '[data-sheet-no-drag]',
].join(',');
```

  pointer mouse/pen 경로와 touch 경로가 중복 처리되지 않도록 분기한다. 터치 본문은 passive:false touchmove에서 시작 시점·방향·스크롤 소유권을 판단하고 **드래그로 확정한 경우에만** preventDefault한다. 본문 전체에 `touch-action:none`을 적용하지 않는다. 손잡이만 touch-action:none을 사용할 수 있다. 텍스트 선택 중·두 손가락 입력에서는 취소하고 스크롤/확대를 보존한다.
- [x] 4. 8px 방향 판정, 거리/최근 속도 닫기 기준, 저장 승인과 취소 복귀를 유지한다. 드래그 후 click이 footer 버튼이나 backdrop 닫기를 실행하지 않도록 표면 capture 단계에서 억제한다.
- [x] 5. `tests/main-react.spec.ts`에 `surface touch gesture` 테스트를 추가한다. Chromium CDP `Input.dispatchTouchEvent`로 실제 터치를 보내 본문 스크롤·맨 위 여백 드래그·입력 조작을 검증한다. JS `dispatchEvent`만으로 통과시키지 않는다. iOS 실기기 확인은 별도 증거로 기록한다.
- [x] 6. 단위 및 새 Playwright 그룹을 통과시킨 뒤 커밋: `feat: dismiss mobile sheets from noninteractive space`.

## Task 3: 총 450ms 표면 모션과 종료 수명

**Files:** 신규 `dialogMotion.ts`, `ResponsiveDialog.tsx`, `useSheetDismiss.ts`, 신규 `tests/unit/components/dialogMotion.test.ts`, `tests/unit/components/ResponsiveDialog.test.tsx`, `tests/unit/components/useSheetDismiss.test.tsx`.

**Interfaces:** 신규 모듈은 `DIALOG_MOTION_MS = 450`, `createDialogMotionTiming(bounce: number): { duration: number; ease: (progress: number) => number }`를 제공한다. 종료·복귀도 이 시간 규격을 사용한다. 기존 `createProductSpring('value')` 등 다른 제품 모션은 유지한다.

- [x] 1. 실제 Anime.js를 사용하는 모션 테스트를 먼저 작성한다. easing 객체를 animate에 직접 전달해 duration이 재정의되는 실수를 잡는다.

```ts
const timing = createDialogMotionTiming(0.12);
expect(timing.duration).toBe(450);
expect(typeof timing.ease).toBe('function');
expect(timing.ease(0)).toBeCloseTo(0);
expect(timing.ease(1)).toBeCloseTo(1, 2);
```

  `animate({ value: 0 }, { value: 1, autoplay: false, ...timing })`로 얻은 실제 animation.duration도 450인지 확인하고 cancel한다. fake timer 테스트에는 300ms에 종료되지 않음, 완료 콜백 1회, reduced-motion 즉시 완료를 추가한다.
- [x] 2. 위 단위 테스트 실패를 확인한 뒤 스프링의 완전한 settling 곡선을 450ms에 재생한다.

```ts
import { spring } from 'animejs';
export const DIALOG_MOTION_MS = 450;
export function createDialogMotionTiming(bounce: number) {
  const curve = spring({ bounce, duration: 260 });
  return {
    duration: DIALOG_MOTION_MS,
    ease: (progress: number) => progress <= 0 ? 0 : progress >= 1 ? 1 : curve.ease(progress),
  };
}
```

  이는 체감 duration=450을 설정하는 방식이 아니다. 전체 곡선을 재생하는 함수형 easing을 명시적 450ms와 함께 사용한다. 공식 근거: [Anime.js spring](https://animejs.com/documentation/easings/spring/)은 spring 객체를 전달하면 animation duration을 settling duration으로 대체한다.
- [x] 3. 모바일 enter는 실제 높이+16px→0, modal enter는 중앙 `scale 0.97→1`·opacity 0→1로 구현한다. 모달의 y는 항상 0이다. exit는 현재 위치에서 sheet 아래 이동/modal scale 1→0.97로 진행한다. enter/return bounce=0.12, exit bounce=0을 시작값으로 사용한다.
- [x] 4. `requestClose`가 승인되면 버튼·Escape·backdrop 모두 exit를 기다려 `finishClose`한다. 드래그는 훅이 이미 exit를 소유하므로 이중 애니메이션하지 않는다. 확인창 승인 대기·저장 pending 동안 중복 요청은 차단한다. 정상 종료 시점에만 native close·scroll unlock·focus 복원이 실행된다.
- [x] 5. 300ms fallback을 정상 450ms 모션보다 긴 **550ms 오류 복구용** 타이머로 바꾼다. 정상 완료에서는 즉시 타이머를 취소한다. 애니메이션 초기화 실패는 기다리지 않고 완료한다. 외부 unmount/open=false·presentation 전환은 애니메이션을 취소하고 잔여 스타일과 타이머를 정리한다.
- [x] 6. 진입 도중 드래그는 기존 transform을 지우고 0부터 시작하지 않고 현재 화면 위치에서 이어간다. 복귀 중 재드래그, 새 dialog 열기, StrictMode effect 재실행도 이전 완료 콜백이 다음 모션을 건드리지 않도록 취소/세대 검사를 둔다.
- [x] 7. `npx vitest run tests/unit/components/dialogMotion.test.ts tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/useSheetDismiss.test.tsx` 통과 후 커밋: `feat: unify dialog motion with bounded settling time`.

## Task 4: 세 앱의 공통 행동 배치와 호출부 이관

**Files:** `ResponsiveDialogLayout.tsx`, `responsive-dialog.css`; `src/main/ui/dashboard/{SummaryDashboard,ExpenseAssistantDialog,RemainingAllocationDialog}.tsx`, `src/main/ui/editor/ApplyBar.tsx`, `src/main/ui/main.css`; `src/simulation/ui/SimulationApp.tsx`; `src/portfolio/ui/{PortfolioEditSurface,PortfolioItemSheet,PortfolioSetupFlow,PortfolioApplyBar,PortfolioResultCardPreview}.tsx`, `portfolio.css`; `src/journey/ui/{AppManagementMenu,ManagementConfirmationDialog}.tsx`.

**Interfaces:** `ResponsiveDialogLayout.tsx`에 `ResponsiveDialogActionRow({ children, className }: { children: ReactNode; className?: string })`를 export한다. status/help text는 이 행 밖에 두고 행동 버튼만 포함한다. Simulation 자동 저장 편집에는 footer를 추가하지 않는다.

- [x] 1. 기존 단위 테스트에 실제 소비자의 버튼 순서와 accessible name을 고정한다. 주요 버튼이 마지막이고 초기화 같은 위험 작업은 다른 버튼과 분리되는지 확인한다. 상태 안내가 button group에 섞이거나 사라지지 않도록 한다.
- [x] 2. 공통 행동 행을 구현하고 Main/Portfolio/관리 확인/미리보기 footer에 적용한다.

```tsx
export function ResponsiveDialogActionRow({ children, className = '' }: {
  children: ReactNode; className?: string;
}) {
  return <div className={`responsive-dialog__actions ${className}`}>{children}</div>;
}
```

  모바일은 버튼들이 가용 폭을 나누고 줄바꿈 가능, 웹은 오른쪽 정렬·내용 너비·최소 44px다. 위험 행동을 왼쪽에 두는 기존 관리 확인은 modifier로 보존한다. 이미지 미리보기의 3:4 비율과 금액 표시 토글을 유지한다.
- [x] 3. 앱별 같은 역할의 grid/flex/width/height override를 제거한다. 단순히 공통 CSS에 !important를 추가하지 않는다. `mobileEntranceMotion`의 호출부 opt-in 차이는 제거하고 모든 표면에서 presentation에 맞는 모션을 기본 적용한다. prop 제거 시 타입 검사로 모든 사용처를 확인한다.
- [x] 4. `npx vitest run tests/unit/components tests/unit/main tests/unit/simulation tests/unit/portfolio tests/unit/journey`로 소비자 회귀를 확인한다. 구조 변경 때문에 깨진 테스트는 사용자 행동 계약을 유지하면서 갱신한다.
- [x] 5. `npm run check` 통과 후 커밋: `refactor: align app dialogs with shared surface standards`.

## Task 5: 브라우저 검증과 실제 모션 증거

**Files:** `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, `tests/app-journey.spec.ts`, `tests/account-workspace.spec.ts`; 신규 `docs/superpowers/evidence/2026-09-23-unified-sheet-and-modal/verification.md` 및 필요한 캡처.

- [x] 1. 390×844, 390×600, 320×568, 768×1024, 1280×900에서 편집·설정·확인·미리보기를 순회한다. sheet 88% 상한, modal 중앙 정렬, 전체 가로 overflow 없음, footer와 focused input 가시성, 44px 버튼을 확인한다. 200% 확대와 긴 Portfolio 이름/오류도 포함한다.
- [x] 2. `requestAnimationFrame`으로 transform/opacity를 기록해 초기·중간·종료 프레임을 검사한다. 진입/닫기/복귀의 animation duration=450ms와 정상 환경의 완료 400–500ms를 확인한다. 실제 측정값은 evidence에 기록한다.
- [x] 3. 실제 브라우저 터치로 본문에서 위·아래 스크롤, 맨 위 새 아래 드래그, 긴 손잡이 양 끝 드래그, 입력·토글·slider 조작, 드래그 취소를 수행한다. 웹에서는 같은 여백 드래그로 위치나 종료가 바뀌지 않는지 확인한다.
- [x] 4. 변경 후 드래그→폐기 확인→계속 수정/버리기, 저장 중 종료 차단, 깨끗한 상태 즉시 승인, 중첩 확인 focus trap/복원을 검증한다. 진입·복귀 중 다시 조작, 열린 상태에서 767↔768px 전환·viewport 높이 축소도 확인한다.
- [x] 5. `npm run check:ci` 및 전체 `npx playwright test`를 실행했다. 전체 E2E에서 확인된 실패는 반복·집중 재실행으로 원인을 분리해 evidence에 기록했다. 기존 Main tooltip resize 검사는 변경 전 main에서도 같은 간헐 실패가 재현됐고, 변경 브랜치의 단독 실행은 통과했다.
- [x] 6. 검증 기록에 명령·결과·모션 측정값·화면 캡처·실기기 미검증 범위를 적었다. 새 종료 잠금과 회귀 검증은 코드/테스트 커밋에 포함한다.

## Task 6: 문서 정합성·리뷰·푸시

**Files:** `DESIGN.md`, 위 기존 공통 표면 spec, PRD의 공통 surface 항목, 이 계획과 evidence.

- [x] 1. `DESIGN.md`의 Main side panel/우측 panel, 92dvh, 손잡이 전용 드래그, 즉시 표시 웹 모달 계약을 새 규격으로 갱신했다. 제품 소유권과 저장 계약은 바꾸지 않았다.
- [x] 2. 기존 spec에 compact=440/form=640/wide=1080px, 88dvh, 손잡이, 스크롤 우선, 총 450ms와 fallback 차이를 적었다. PRD는 두 표면 규격과 상세 spec 링크만 유지한다.
- [x] 3. 편집 문서의 상대 링크·상태 주장을 확인하고 `git diff --check`를 실행한다. 계획 체크박스는 실제 완료된 작업만 체크한다.
- [x] 4. 전체 diff와 공통 종료·터치·focus 회귀 리뷰를 수행했다. 리뷰 결과: 추가 Critical/Important 지적 없음.
- [x] 5. `git var GIT_AUTHOR_IDENT`가 `KIM JINHO <okho04@gmail.com>`인지 확인하고 문서/evidence를 커밋한다. 구현을 위한 Orca 작업공간을 사용했다면 main 통합 후 원격 푸시와 작업공간 정리까지 수행한다. PR #21 병합 후 로컬 main을 원격과 동기화하고 병합된 원격 브랜치와 Orca 작업공간을 정리했다.

## 완료 인수 조건

- [x] 모든 모바일 표면이 88dvh 이하이고 손잡이·비상호작용 공간에서 정상 드래그된다.
- [x] 본문 스크롤·입력·토글 조작이 닫기로 오인되지 않는다.
- [x] 웹은 손잡이 없는 중앙 modal과 공통 행동 정렬을 사용한다. form/wide는 focus 변화 중 footer 위치를 유지한다.
- [x] 모달에 수직 등장 이동이 없고 전체 모션은 잔여까지 400–500ms 안에 종료된다.
- [x] 세 앱의 저장·단계·오류·focus 계약과 reduced-motion을 보존한다.
- [x] 필수 검증 증거, 문서 갱신, 리뷰, 통합·푸시·작업공간 정리가 완료된다.
