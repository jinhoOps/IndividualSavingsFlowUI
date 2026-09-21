# Responsive Surfaces Implementation Plan — A

> **For agentic workers:** 승인 후 `superpowers:executing-plans`로 체크박스 순서대로 실행한다. 새 공통 shell은 현재 앱별 데이터 controller와 분리하고 한 앱씩 이관한다.

**Goal:** 웹 우측 편집 패널을 중앙 모달로 바꾸고 모바일 하단 시트·설정·버튼 위치를 통일한다.
**Architecture:** native dialog 기반 `ResponsiveDialog`에 presentation/focus/scroll/dismiss만 모은다. 앱별 controller는 기존 검증·저장·폐기 판단을 제공한다.
**Tech Stack:** React/TypeScript, HTMLDialogElement, 기존 CSS·Anime.js·`useSheetDismiss`, Vitest/Playwright.
**Spec:** [설계 §4–5](../specs/2026-09-21-responsive-overlays-and-result-card-design.md).

## Global Constraints

[총괄 계획](2026-09-21-responsive-experience.md)의 모든 제약을 적용한다. breakpoint는 767px 이하 sheet/768px 이상 modal이다. 기존 저장·account recovery·초안 의미를 바꾸지 않는다. Main의 수동 focus와 Portfolio의 `openDialogs`를 새 shell과 동시에 활성화하지 않는다.

## Review Focus

- resize 중 field focus/scroll/dirty 유지: A1/A2.
- 모바일 Back 이후 폐기 거절·confirm cancel의 이중 닫힘: A1/A3.
- modal에서 계정 상태가 offline/expired로 바뀜: A4 및 account-workspace.
- 샘플 두 열의 기준이 viewport와 dialog 폭에서 달라짐: A3.
- 폼 입력/slider/scroll이 sheet drag로 해석됨: A1 및 motion-system.

## Task A1: 공통 dialog와 종료 계약

**Files**

- Create: `src/components/common/ResponsiveDialog.tsx`, `responsive-dialog.css`, `useDialogBackNavigation.ts`.
- Reuse/수정: `src/components/motion/useSheetDismiss.ts`, `tokens.ts` (새 motion 값 대신 기존 값 사용).
- Test: new `tests/unit/components/ResponsiveDialog.test.tsx`, `useDialogBackNavigation.test.tsx`; existing `tests/unit/components/useSheetDismiss.test.tsx`.

**Interfaces** — 새 타입은 `ResponsiveDialog.tsx`에서 export한다.

```ts
type DialogCloseReason = 'button' | 'escape' | 'backdrop' | 'drag' | 'back';
interface ResponsiveDialogProps {
  open: boolean;
  labelledBy: string;
  size?: 'compact' | 'form' | 'wide';
  mobileHeight?: 'content' | 'full';
  busy?: boolean;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onRequestClose(reason: DialogCloseReason): boolean | Promise<boolean>;
  onClosed(): void;
  children: React.ReactNode;
}
```

`true`면 shell이 종료 애니메이션과 focus 반환 뒤 `onClosed` 호출, `false`면 그대로 유지한다. 중복 종료 요청은 무시한다. 앱은 요청 승인 전에 dirty 확인을 끝낸다. 브라우저 Back helper는 같은 계약을 호출하고 URL을 변경하지 않는다.

- [ ] clean/dirty/busy, 두 번 Escape, focus 반환, `showModal` cleanup·StrictMode를 새 단위 테스트로 고정한다. `onRequestClose=false` 때 `onClosed`가 호출되지 않는 것을 먼저 실패로 확인한다.
- [ ] `native dialog + .header/.body/.footer`를 구현한다. CSS media query로 위치만 바꾸고 편집 subtree는 유지한다. `dialog.showModal()`을 사용하는 동안 배경 inert와 기존 controller의 inert를 중복 소유하지 않게 한다.
- [ ] 모달 stack은 active dialog만 Escape/Tab을 처리하고 첫/마지막 focusable은 현재 visible/disabled/inert 상태로 계산한다. confirm이 사라지면 부모로 반환한다.
- [ ] title-only 초기 focus·특정 필드 focus를 지원하고 연결이 끊긴 trigger에는 앱의 안정된 fallback을 사용한다.
- [ ] 브라우저 history는 현재 state를 보존한 채 overlay token만 추가한다. programmatic close와 popstate cleanup을 구분하며 forward/refresh 후 죽은 overlay를 자동 복구하지 않는다. 다음 테스트 형태로 승인/거절을 고정한다.

```tsx
const requestClose = vi.fn().mockResolvedValue(false);
const closed = vi.fn();
render(<ResponsiveDialog open labelledBy="title" returnFocusRef={{current: null}}
  onRequestClose={requestClose} onClosed={closed}><h2 id="title">편집</h2></ResponsiveDialog>);
fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
await waitFor(() => expect(requestClose).toHaveBeenCalledWith('escape'));
expect(closed).not.toHaveBeenCalled();
```

- [ ] `npm run test:unit -- tests/unit/components/ResponsiveDialog.test.tsx tests/unit/components/useDialogBackNavigation.test.tsx tests/unit/components/useSheetDismiss.test.tsx`와 `npm run check`를 통과시킨다.

## Task A2: Main 세 편집기를 중앙 모달로 이관

**Files**

- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`, `MainPlanEditor.tsx`, `ExpenseAssistantDialog.tsx`, `RemainingAllocationDialog.tsx`, `src/main/ui/main.css`.
- Preserve/필요한 연결만: `src/main/ui/useMainPlanEditorController.ts`.
- Test: `tests/unit/main/MainPlanEditor.test.tsx`, `tests/unit/main/useMainPlanEditorController.test.tsx`, `tests/main-react.spec.ts`, `tests/account-workspace.spec.ts`, `tests/motion-system.spec.ts`.

**Interfaces:** 기존 draft/validation/saving callbacks를 `ResponsiveDialog.onRequestClose`에 연결한다. MainPlanEditor는 content만 제공하고 `presentation='panel'`/`aside` 경로는 소비자 이관 후 제거한다.

- [ ] existing Main E2E의 `getEditor`가 desktop `.main-editor-panel`을 기대하는 부분을 실제 modal 기대값으로 바꾸고, desktop 중심/배경 비활성/focus 회귀가 먼저 실패하는지 확인한다.
- [ ] Main 월 금액의 mobile/desktop 두 mount 경로를 단일 shell로 합친다. 편집 버튼과 특정 금액 field 진입은 같은 controller를 사용한다. 다섯 월 금액을 새 모달 상태에 복제 저장하지 않는다.
- [ ] 지출·남는 돈의 기존 footer/중간 답변/반영/저장 복구를 보존한 채 shell만 이관한다. cleanup 과정에서 recovery key를 지우지 않는다.
- [ ] 390→768→1280 resize 중 raw 입력 유지, 첫 오류 focus, 취소·dirty 거절, Tab trap, 닫은 뒤 trigger focus/페이지 scroll 복원을 확인한다.
- [ ] desktop 결과가 흐리게 비활성화되고 editor가 화면 중앙에 위치하는지 수치로 확인한다. 기존 `getEditor`/fixture를 같은 파일에서 재사용한다.

```ts
await page.setViewportSize({width:1280, height:900});
await page.getByRole('button', {name:'월 금액 편집', exact:true}).click();
const editor = page.getByRole('dialog', {name:'월 자금 계획 편집'});
const box = await editor.boundingBox();
expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThanOrEqual(2);
await expect(page.locator('.main-editor-panel')).toHaveCount(0);
```

- [ ] `npm run check`, `npm run test:unit -- tests/unit/main`, `npm run test:e2e -- tests/main-react.spec.ts tests/motion-system.spec.ts tests/account-workspace.spec.ts` 실행. 실패한 기존 panel 가정은 새 UX로 갱신하되 저장 assertion은 줄이지 않는다.
- [ ] PRD Main, DESIGN Main/지출/남는 돈 및 2026-09-10 두 관련 spec에 중앙 modal 대체 범위를 기록한다.

## Task A3: Portfolio 배분·샘플의 한 표면 전환

**Files**

- Modify: `src/portfolio/ui/PortfolioDialog.tsx`, `PortfolioEditSurface.tsx`, `PortfolioSetupFlow.tsx`, `PortfolioExamplePicker.tsx`, `PortfolioApplyBar.tsx`, `PortfolioItemSheet.tsx`, `portfolio.css`.
- Verify/필요 시 연결: `AllocationEditor.tsx`, `PortfolioApp.tsx`.
- Test: `tests/unit/portfolio/PortfolioDialogs.test.tsx`, `PortfolioApp.test.tsx`, `PortfolioExamplePicker.test.tsx`, `tests/portfolio.spec.ts`, `tests/account-workspace.spec.ts`.

**Interfaces:** `PortfolioDialog`는 호환 adapter로 시작해 `ResponsiveDialog`를 사용한다. 새 UI 상태는 `allocation | examples` 단계와 현재 선택만 소유하며 Portfolio draft/action/repository는 그대로 사용한다. `dataPresentation='panel'`은 전 소비자 이관 뒤 제거한다.

- [ ] 768px은 중앙 modal, 767px은 sheet인 계약을 실패 테스트로 추가한다. 인라인 추가가 새로운 dialog를 만들지 않는 기존 테스트를 보존한다.
- [ ] 부모 배분 화면을 중앙화하고 샘플 진입은 부모 단계 전환으로 표시한다. 새 표면 위에 부모 panel을 계속 보이게 하지 않는다. 이름/비율 조정/샘플 선택 상태는 왕복 때 보존한다.
- [ ] 넓은 modal 실제 content width≥960px에서만 목록·상세 두 열을 사용한다. 좁으면 상세→목록→배분 back 순서를 유지한다. 부모 적용 footer는 샘플 화면에서 숨긴다.
- [ ] 항목 인라인 상태의 Escape는 항목 종료만, 그다음 Escape가 부모 종료를 요청한다. 적용 확인·폐기 확인만 최상위 작은 modal로 연다. 새 공통 stack과 옛 `openDialogs`를 함께 유지하지 않는다.
- [ ] 기존 Main 투자금 동기화, 최대 10개, cash raw 오류, sample replace 확인, 계정 저장 실패·오프라인 recovery tests를 유지한다.
- [ ] `npm run check`, `npm run test:unit -- tests/unit/portfolio`, `npm run test:e2e -- tests/portfolio.spec.ts tests/account-workspace.spec.ts tests/motion-system.spec.ts` 실행.
- [ ] DESIGN/README/PRD Portfolio와 2026-09-16 두 관련 spec, 2026-09-19 VOC spec에 형태/breakpoint/샘플 단계 대체 범위를 연결한다.

## Task A4: 설정 진입과 라벨/조작 순서

**Files**

- Modify: `src/components/common/AppShell.tsx`, `src/journey/ui/AppLauncher.tsx`, `AppManagementMenu.tsx`, `ManagementConfirmationDialog.tsx`, `journey.css`, `src/portfolio/ui/PortfolioManagementMenu.tsx`, `portfolio.css`.
- Reuse: `src/auth/AccountManagementContext.tsx`, 계정 menu item API.
- Test: `tests/unit/journey/AppManagementMenu.test.tsx`, `AppLauncher.test.tsx`, `tests/unit/components/AppShell.test.tsx`, `tests/app-journey.spec.ts`, `tests/account-workspace.spec.ts`.

**Interfaces:** `AppManagementItem[]`의 기존 action/confirmation/control 계약을 유지하며 container만 settings dialog로 교체한다. trigger의 accessible name은 `관리 메뉴`를 유지하고 popup 유형은 dialog로 알린다.

- [ ] 390/768/1280에서 settings shell 형태·close focus·세 앱 동일 trigger 위치를 먼저 테스트한다. mobile menu의 왼쪽 쏠림을 viewport와 control bounding box로 확인한다.
- [ ] launcher와 gear를 별도 layout 열로 나누고 최우측 콘텐츠 edge에 gear를 둔다. overflow/long press/current-app underline 동작을 보존한다.
- [ ] `금액 보기`, `비율순`, `입력순` DOM을 `<label><span>라벨</span><input ... /></label>` 순서로 옮긴다. 행 전체 클릭이 1회만 상태를 바꾸도록 한다. 선택/미선택을 색 외에 checked/radio로 전달한다.
- [ ] `role=menu/menuitem` 대신 settings dialog의 일반 button/group semantics를 사용한다. confirmation으로 이동할 때 settings를 먼저 닫고 confirm이 끝나면 gear로 focus를 돌린다.
- [ ] 로그아웃/복구 action이 account `readOnly`에 의해 함께 disabled되지 않는지 cloud 테스트한다. 긴 이메일·저장 시각·복구 항목이 footer/viewport를 벗어나지 않게 한다.
- [ ] `npm run check`, `npm run test:unit -- tests/unit/journey tests/unit/components/AppShell.test.tsx`, `npm run test:e2e -- tests/app-journey.spec.ts tests/account-workspace.spec.ts` 실행.
- [ ] DESIGN launcher/settings와 PRD Journey, README의 현행 동작을 갱신한다. 새 screenshot과 미검증 실기기 항목을 기록하고 총괄 A만 완료 표시한다.
