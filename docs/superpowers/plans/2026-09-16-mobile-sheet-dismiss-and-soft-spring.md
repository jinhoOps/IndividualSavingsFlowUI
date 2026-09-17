# Main·Portfolio Mobile Sheet Dismiss and Soft Spring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main·Portfolio의 모션을 약한 스프링 계열로 통일하고, 모바일 시트 상단을 아래로 끌어 기존 닫기 절차로 종료할 수 있게 한다.

**Architecture:** 공통 모션 프로필과 시트 제스처를 분리한다. 제스처는 닫기 의도만 전달하며 앱별 변경 확인·저장·오류·focus 처리는 기존 소유자가 담당한다. 드래그 중에는 손가락을 직접 따라가고, 자동 이동에는 역할에 맞는 공통 스프링을 사용한다.

**Tech Stack:** React, TypeScript, 설치된 animejs 4.x, Pointer Events, 기존 CSS, Vitest, Playwright. 새 의존성은 추가하지 않는다.

**Spec:** 이 문서의 설계 결정은 2026-09-16 사용자 대화의 ‘모바일 상단을 내려 닫기’와 ‘전체 약한 스프링 기준을 plan에 반영’ 요청을 기록한다. 기준 문서는 [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [공통 모션 설계](../specs/2026-08-12-animejs-motion-system-design.md), [Portfolio 편집 설계](../specs/2026-09-16-portfolio-editor-hierarchy-design.md)다. 구현 시 Task 1에서 변경되는 모션 계약을 원문에 반영한다.

**Status:** Implemented. `npm run check`, all 1087 unit tests, and focused Main·Portfolio gesture, async-guard, focus-return, and viewport browser checks pass. The 214-test full E2E run reported 201 passed, 12 failed, and 1 skipped; relevant Portfolio-only failures passed focused reruns, while several Main load timeouts and brand-welcome launch assertions remain in the full run. Physical iOS Safari·Android Chrome verification remains untested. Detailed evidence is in [the implementation record](../evidence/2026-09-16-mobile-sheet-spring.md). 기존 미추적 `2026-09-16-portfolio-editor-hierarchy.md`는 별도 작업으로 보존한다.

## Global Constraints

- Main의 다섯 월간 금액과 지출 보조 답변 소유권, Portfolio aggregate draft/applied 경계를 유지한다.
- workspace schema v5, 서버 protocol 5, accountMap·locations·백업·복구·revision 계약은 변경하지 않는다.
- Main은 767px 이하 sheet/768px 이상 panel, Portfolio는 768px 이하 sheet/769px 이상 panel이다.
- 조작 영역은 최소 44px이며, 기존 닫기 버튼·취소·Escape·focus trap·초점 복원을 유지한다.
- 애니메이션 완료를 저장·폐기·탐색 성공의 조건으로 사용하지 않는다.
- reduced-motion·초기화 실패·unmount에서 잔여 모션과 이벤트를 정리하고 최종 상태를 보장한다.
- Simulation·브랜드 시작 장면과 기존 CSS hover/focus 효과는 이번 전환 범위에 넣지 않는다. 공유 토큰의 일괄 교체로 이 소비자들을 바꾸지 않는다.

## 설계 결정

### 1. 전체에 같은 스프링 감각, 역할별 반동 조절

이 계획은 ‘복귀에만 탄성’을 두는 앞선 대화안을 대체한다. Main·Portfolio의 기존 등장·펼치기·진행/배분 갱신 모션에 공통 프로필을 적용한다. 정적인 UI에 새로운 움직임을 무조건 추가하지 않는다.

| 역할 | 시작 프로필 | 관찰 가능한 기준 |
| --- | --- | --- |
| 시트·패널 등장, 펼치기 | surface: bounce 0.12, perceived duration 260ms | 부드러운 안착, 반복 출렁임 없음 |
| 짧은 드래그 후 복귀 | return: bounce 0.12, perceived duration 220ms | 현재 위치에서 시작, 눈에 띄는 왕복 반복 없음 |
| 닫기 | exit: bounce 0, perceived duration 180ms | 아래로 단조롭게 이동, 다시 화면으로 튀어 오르지 않음 |
| 숫자·비율·막대·진행률 | value: bounce 0, perceived duration 260ms | 시작값과 목표값 사이에서 단조롭게 이동, 음수 폭·100% 초과·목표 초과 없음 |
| 직접 드래그 | 보간 없음 | 손가락 이동량을 바로 반영 |

opacity는 0~1을 유지한다. 금융 입력 문자열과 접근성 값은 즉시 실제 상태를 반영하며, 기존에 보간하던 시각값만 value 프로필을 사용한다. 연속 갱신은 현재 표시값에서 재시작한다.

시트의 위치 반동은 최종 위치 기준 최대 4px로 제한한다. 화면 전체 높이의 이동에 곡선을 그대로 적용하여 큰 튕김이 생기지 않도록 실제 위치를 제한하고 하단 배경이 노출되지 않게 한다. Portfolio는 fixed footer 기준을 바꾸는 dialog transform을 추가하지 않고 기존 bottom/right 이동을 유지한다.

Anime.js의 spring 객체는 내부 상태가 있으므로 인스턴스를 전역으로 재사용하지 않고 생성 함수를 사용한다. spring의 perceived duration과 실제 settling duration은 다르므로 기존 `duration: 260`을 함께 넣어도 정확히 260ms에 종료된다고 가정하지 않는다. [공식 Spring 문서](https://animejs.com/documentation/easings/spring/)와 [React 가이드](https://animejs.com/documentation/getting-started/using-with-react/)를 따른다.

### 2. 드래그 적용 범위와 판정

- Main: 월 금액 편집, 지출 계산 도우미, 남는 돈 분배 도우미.
- Portfolio: 배분 편집, 투자 대상 추가·수정.
- Portfolio 샘플 전체 화면·확인 dialog·desktop panel에는 드래그 닫기를 활성화하지 않는다. 이 화면의 기존 등장 모션은 surface 프로필을 사용할 수 있다.
- 상단 손잡이와 제목 여백에서만 시작한다. 버튼·링크·입력 등 interactive 자식에서 시작한 입력은 제외한다. 손잡이는 장식이며 별도 키보드 조작을 요구하지 않는다.
- 전용 드래그 영역에만 touch-action 제어를 적용한다. 본문·숫자 입력·빠른 조정·footer는 기존 스크롤과 터치를 유지한다.
- 아래 방향 이동이 8px 이상이고 세로 이동량이 가로 이동량보다 클 때 활성화한다. 활성화 후 pointer capture를 사용한다.
- 닫기 거리 기준은 `min(140, max(80, height * 0.2))`px다. 또는 32px 이상 이동하고 최근 80ms 구간의 아래 방향 속도가 0.6px/ms 이상이면 빠른 닫기로 판정한다.
- pointercancel, capture 손실, 화면 크기 변경, 두 번째 손가락, 최상위 dialog 변경은 종료 요청 없이 복귀시킨다. 드래그 후 합성 click으로 backdrop/버튼이 실행되지 않게 한다.

### 3. 닫기·저장·초점 계약

공통 훅이 `onClose`를 직접 호출하여 unmount하거나 draft를 버리지 않는다. 닫기 요청이 승인되었는지 앱 호스트에서 먼저 결정한다.

| 표면 | 기존 경로를 보존하는 처리 |
| --- | --- |
| Main 월 금액 편집 | saving 중 차단, dirty면 기존 폐기 확인, 취소하면 원위치 유지 |
| Main 지출 도우미 | dirty 답변의 기존 저장 후 닫기, 저장 실패 시 오류와 답변 유지, 기존 pending/offline 복구 경로 보존 |
| Main 남는 돈 분배 | 기존 확인과 onCancel 처리, 미확정 요청의 기존 복구 계약 유지 |
| Portfolio 배분 편집 | applying 중 차단, dirty·현금 입력/오류·샘플 변경이면 기존 확인 dialog |
| Portfolio 대상 편집 | local dirty 폐기 확인 유지, 부모 dialog는 inert, 최상위 대상만 드래그 |

확인 또는 저장이 필요한 경우 패널을 원위치로 복귀시키고 기존 절차를 실행한다. 확인/저장을 기다리는 동안 패널을 화면 밖에 숨기지 않는다. 실패·계속 수정은 입력과 오류에 접근 가능한 상태로 남긴다. Portfolio 드래그가 연 중첩 폐기 확인을 취소하면 부모 시트 안의 이름 입력란 또는 편집기 닫기 버튼으로 초점을 돌려, 제스처가 `document.body`로 초점을 옮긴 경우에도 열린 부모 dialog 안에 초점을 유지한다.

닫기가 확정되면 도메인 결정을 한 번만 실행하고 presentation만 잠시 유지하여 퇴장한다. 정리는 animation callback과 별도로 최대 300ms deadline 및 실패 즉시 경로를 두어 빠짐없이 실행한다. 퇴장 중 내부 재조작·중복 닫기를 막고 overlay/focus containment를 유지하며, 정리 후 원래 trigger로 초점을 한 번 복원한다. reduced-motion에서는 presentation 지연 없이 즉시 정리한다. 이 제한된 presentation 수명은 기존 ‘닫기 즉시 전환’의 명시적 예외로 문서화한다.

## Task 1: 공통 모션 프로필과 사용처 전환

**Files:**

- Modify: `src/components/motion/tokens.ts`, `src/components/motion/animateVisualNumber.ts`, `src/components/motion/useAnimatedProgress.ts`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`, `src/main/ui/common/useAssistantReveal.ts`, `src/main/ui/common/SavingOverlay.tsx`, `src/main/ui/setup/SetupFlow.tsx`, `src/main/ui/setup/AllocationBar.tsx`, `src/main/ui/dashboard/CashflowAllocationSummary.tsx`, `src/main/ui/dashboard/CashflowSummary.tsx`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`, `src/portfolio/ui/AllocationEditor.tsx`, `src/portfolio/ui/PortfolioApplyBar.tsx`, `src/portfolio/ui/PortfolioSummary.tsx`, `src/portfolio/ui/PortfolioEditorSummary.tsx`, `src/portfolio/ui/PortfolioSetupFlow.tsx`
- Test: `tests/unit/components/motionProfiles.test.ts` (new), `tests/motion-system.spec.ts`
- Docs: `DESIGN.md`, `docs/superpowers/specs/2026-08-12-animejs-motion-system-design.md`, `docs/superpowers/specs/2026-09-16-portfolio-editor-hierarchy-design.md`

**Interfaces:** `createProductSpring(role: 'surface' | 'return' | 'exit' | 'value'): ReturnType<typeof spring>`. 기존 shared helper에는 선택적 easing 인자를 추가하고 생략 시 기존 동작을 유지한다. Main·Portfolio가 명시적으로 새 프로필을 선택한다.

- [x] 현재 승인 문서에서 180/260ms 고정 easing 및 즉시 닫기 규칙을 찾아 위 모션 표와 presentation 예외로 갱신한다. 제품 범위·저장 계약은 바꾸지 않는다.
- [x] 테스트에 exit/value 곡선의 0~1 범위와 단조성, 독립 인스턴스, reduced-motion 최종 상태를 추가하고 확인한다. `npx vitest run tests/unit/components/motionProfiles.test.ts`.

```ts
const curve = createProductSpring('value').ease;
const samples = Array.from({ length: 501 }, (_, i) => curve(i / 500));
expect(samples.every(v => v >= 0 && v <= 1)).toBe(true);
expect(samples.every((v, i) => i === 0 || v >= samples[i - 1])).toBe(true);
expect(createProductSpring('surface')).not.toBe(createProductSpring('surface'));
```

- [x] 아래 프로필 생성 함수를 구현하고 기존 useAnimeScope의 cleanup/fallback 안에서 각 consumer를 연결한다. surface·return 위치 overshoot는 browser 테스트에서 최종 위치 기준 4px 이내인지 확인한다.

```ts
import { spring } from 'animejs';
const productSpring = {
  surface: { bounce: 0.12, duration: 260 },
  return: { bounce: 0.12, duration: 220 },
  exit: { bounce: 0, duration: 180 },
  value: { bounce: 0, duration: 260 },
} as const;
export function createProductSpring(role: keyof typeof productSpring) {
  return spring(productSpring[role]);
}
```

- [x] 단위 테스트와 `npm run check`를 실행한다. Main setup의 기존 deadline이 spring을 조기에 잘라내지 않는지 확인하고 실제 최종 상태 복구 테스트를 갱신한다.

## Task 2: 모바일 드래그와 앱별 닫기 경로 연결

**Files:**

- Create: `src/components/motion/useSheetDismiss.ts`
- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`, `src/main/ui/dashboard/MainPlanEditor.tsx`, `src/main/ui/dashboard/ExpenseAssistantDialog.tsx`, `src/main/ui/dashboard/RemainingAllocationDialog.tsx`, `src/main/ui/main.css`
- Modify: `src/portfolio/ui/PortfolioDialog.tsx`, `src/portfolio/ui/PortfolioApp.tsx`, `src/portfolio/ui/PortfolioEditSurface.tsx`, `src/portfolio/ui/PortfolioItemSheet.tsx`, `src/portfolio/ui/portfolio.css`
- Test: `tests/unit/components/useSheetDismiss.test.tsx` (new), `tests/unit/main/MainPlanEditor.test.tsx`, `tests/unit/portfolio/PortfolioDialogs.test.tsx`, `tests/unit/portfolio/PortfolioItemSheet.test.tsx`, `tests/main-react.spec.ts`, `tests/portfolio.spec.ts`

**Interfaces:** hook는 sheet ref, 선택적 backdrop ref, enabled, blocked, isTopmost, 그리고 `onRequestDismiss(): boolean | void | Promise<boolean | void>`를 받는다. `[data-sheet-drag-handle]`의 Pointer Event listener를 직접 관리하고, `false` 또는 거절된 Promise는 기존 close guard의 거절을 뜻한다. 비동기 승인을 기다리는 동안 sheet를 원위치로 복귀시키며, 승인된 Promise는 복귀가 끝난 뒤 퇴장을 시작한다. 승인된 요청은 `onDismissed`로 presentation 종료를 완료한다. hook는 repository나 dirty 모델을 받지 않는다.

- [x] 기존 fixture로 clean 닫기·dirty 거절·저장 실패·중첩 dialog 보호 테스트를 추가하고 관련 단위/E2E가 기존 상태를 보존하는지 확인한다.
- [x] 훅에 위 판정·cancel·capture 규칙을 구현한다. 다음 거리/속도 판정을 사용하고 blocked/topmost는 pointerdown·move·release 시 다시 확인한다. 추가 포인터 입력은 손잡이 외 시트 본문에서 발생해도 드래그를 취소한다.

```ts
const distanceThreshold = Math.min(140, Math.max(80, height * 0.2));
const shouldRequestDismiss = dy >= distanceThreshold
  || (dy >= 32 && recentVelocityY >= 0.6);
```

- [x] 각 header에 손잡이를 연결한다. PortfolioDialog 전체에 자동 활성화하지 않고 대상 모바일 sheet에서만 opt-in한다. 상단 버튼·입력은 제스처 시작에서 제외한다.
- [x] 닫기 요청/승인된 presentation exit를 구분하고 300ms deadline, 실패 fallback, 초점 복원, 기존 비동기 저장과 오류 경로를 연결한다. 창 크기 변경은 드래그·퇴장 위치를 정리한다.
- [x] 관련 단위 테스트와 `npm run check`를 실행하고 Main·Portfolio browser spec을 재실행한다.

## Task 3: 감각·회귀 검증과 인계

**Files:** `tests/motion-system.spec.ts`, `tests/main-react.spec.ts`, `tests/portfolio.spec.ts`; 새 증거 기록 `docs/superpowers/evidence/2026-09-16-mobile-sheet-spring.md`.

- [x] browser 테스트에서 패널 위치를 프레임별로 샘플링해 드래그 추종, 복귀 오버슈트 ≤4px, 닫기 단조성, 금융 시각값 범위, 종료 deadline을 검증한다. 정상 종료 시 초점 복원을 확인하고 animation callback 누락 시 300ms deadline fallback을 단위 테스트한다.
- [x] 390×844, 짧은 모바일 390×600, 768×1024, 1280×900 및 breakpoint 767/769px에서 overflow·overlay containment·44px target·focus·차트 가시성을 확인한다.
- [x] 자동 테스트에서 본문 scroll 영역은 drag handle로 동작하지 않는 점, interactive header 버튼 제외, 빠른 flick, 위/가로 이동, 멀티터치, layout/visual viewport resize, 저장 중·최상위 제한, reduced-motion을 확인한다. 실제 소프트 키보드와 iOS Safari·Android Chrome은 자동 Pointer Event 테스트와 구분해 미검증으로 기록한다.
- [x] Main·Portfolio 양쪽에서 같은 드래그 닫기·복귀 동작을 실행해 공통 시작 프로필을 검증하고 최종 값과 perceived/settling 차이를 문서화한다.
- [x] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=list`, `git diff --check`를 실행한다. 전체 E2E의 남은 실패와 focused rerun 결과는 증거 문서에 기록한다.
- [x] 문서 상대 링크와 PRD·DESIGN·승인 spec 상태를 대조한다. 변경 파일·명령별 결과·실기기 미검증·남은 위험을 증거 문서에 기록한다.

## 인계

다음 소유자는 Main·Portfolio 프론트엔드 구현자이며 이 문서와 각 앱의 기존 닫기 경로부터 시작한다. 핵심 위험은 비동기 저장/확인 우회, spring settling을 기다리는 긴 focus 잠금, Portfolio fixed footer 이동, 모바일 scroll 충돌이다. 모든 승인·폐기·저장 부작용은 기존 경로에서 한 번만 실행되어야 한다.
