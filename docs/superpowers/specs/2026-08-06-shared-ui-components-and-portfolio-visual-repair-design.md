# 공통 UI 컴포넌트와 Portfolio 시각 복구 설계

- 작성일: 2026-08-06
- 상태: 승인됨
- 범위: Main·Simulation·Portfolio 공통 surface·button, Portfolio 반응형 시각 복구
- 제품 기준: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md)

## 1. 문제

Portfolio는 `app-foundation.css`를 직접 불러온 뒤 전용 CSS에서 `globals.css`를 다시 가져온다. 두 foundation이 Tailwind와 서로 다른 theme·base 규칙을 정의해 뒤에서 로드된 규칙이 공통 토큰과 control 표현을 덮는다. Portfolio의 일부 button, surface, toolbar와 editor 구조는 공통 UI 클래스를 사용하지 않거나 전용 표현이 없어 기능은 동작하지만 Main과 다른 미완성 화면처럼 보인다.

현재 Playwright 검증은 주요 요소 표시, 가로 overflow와 tooltip containment를 확인하지만 공통 surface·button 계약이나 모바일 시각 계층은 직접 검증하지 않는다.

## 2. 목표

1. Main·Simulation·Portfolio가 같은 React `Button`과 `Surface` 컴포넌트를 사용한다.
2. 세 앱이 하나의 공통 foundation에서 색상, typography, control, focus와 surface 규격을 받는다.
3. Portfolio의 정보 구조, 도넛·표·tooltip과 상태 계약을 유지하면서 Main의 시각 문법으로 정돈한다.
4. 390px, 768px와 desktop에서 Portfolio 편집·결과·Apply Bar·dialog를 overflow 없이 사용할 수 있게 한다.

## 3. 범위 밖

- Portfolio 계산, reducer, 저장 schema 또는 Main 동기화 변경
- Simulation 계산, 그래프 geometry, tooltip 또는 저장 변경
- Main 정보 구조나 편집 흐름 변경
- Portfolio 도넛·표 정보 구조 재설계
- Account Map 구현
- Tailwind 또는 Vite 버전 변경

## 4. 선택한 접근

공통 `Button`과 `Surface`를 `src/components/common/`이 소유한다. Main의 기존 경로는 호환 re-export를 제공해 현재 소비자를 한 번에 이동시키지 않는다. Simulation과 Portfolio는 공유 컴포넌트를 직접 사용한다.

세 앱의 entry는 `app-foundation.css`를 공통 foundation으로 사용한다. Portfolio 전용 CSS의 `globals.css` import를 제거한다. 앱별 CSS는 레이아웃, 시각화와 앱 고유 상태 표현만 소유한다.

CSS 선택자만으로 기존 markup을 꾸미는 접근은 공통 계약이 다시 분리되므로 사용하지 않는다. 모든 앱을 한 번에 광범위하게 재작성하는 접근도 현재 버그 범위를 넘으므로 사용하지 않는다.

## 5. 컴포넌트 경계

### 공통 `Button`

- `primary`, `secondary`, `quiet` variant와 native button 속성을 제공한다.
- `ui-button`과 variant class를 일관되게 조립한다.
- 최소 44px touch target, focus ring, disabled와 active 표현은 foundation이 담당한다.
- destructive management action은 기존 journey 계약을 유지하고 일반 variant에 억지로 포함하지 않는다.

### 공통 `Surface`

- `section`, `div`, `aside` element를 선택할 수 있다.
- `ui-surface`와 전달된 class를 조립한다.
- flat panel border, background와 radius는 foundation이 담당한다.
- floating 계층의 shadow, position과 z-index는 각 overlay CSS가 담당한다.

### Main 호환 경계

- `src/main/ui/common/Button.tsx`와 `Surface.tsx`는 새 공통 컴포넌트를 re-export한다.
- Main 동작과 DOM 의미를 바꾸지 않는다.
- 후속 정리에서 소비자를 새 경로로 점진적으로 이동할 수 있지만 이번 범위의 완료 조건은 아니다.

### Simulation

- 일반 surface와 button markup을 공통 React 컴포넌트로 교체한다.
- 결과 순서, 고급 설정, onboarding, 그래프와 tooltip 구조는 유지한다.
- 그래프 선·면, tooltip 배치와 Simulation 고유 레이아웃 CSS는 유지한다.

### Portfolio

- result summary, editor, recovery와 gate의 일반 panel에 `Surface`를 사용한다.
- toolbar, editor action, Apply Bar와 dialog action에 `Button` variant를 사용한다.
- 도넛, 표, tooltip, field error와 allocation 상태 표현은 Portfolio CSS에 남긴다.

## 6. Portfolio 시각 및 반응형 계약

### 공통 위계

- 페이지는 ISF Pearl canvas와 공통 typography를 사용한다.
- summary와 editor는 흰색 flat panel, 단색 hairline과 공통 radius를 사용한다.
- 결과 화면은 투자금 headline, 도넛, 표 순서를 유지한다.
- editor는 제목, 입력 방식, 투자 대상, 현금과 적용 행동의 구분을 spacing으로 명확히 한다.
- 일반 content surface에는 shadow를 사용하지 않는다.

### 390px

- launcher는 한 줄을 유지한다.
- summary와 editor는 단일 열이다.
- 도넛, 표, 입력 행과 tooltip이 viewport 밖으로 나가지 않는다.
- 투자 대상 행은 이름, 값, 계산 결과와 삭제 action을 읽을 수 있는 세로 흐름으로 배치한다.
- Apply Bar는 safe area를 포함한 좌우·하단 여백을 지키고 본문 마지막 입력을 가리지 않는다.
- 모든 주요 button과 input은 최소 44px이다.

### 768px

- summary는 단일 열 또는 읽을 수 있는 compact layout을 유지한다.
- editor 행은 공간이 충분할 때만 다중 열을 사용한다.
- table 금액과 비율은 임의 글자 단위 줄바꿈 없이 표시한다.

### Desktop

- summary는 도넛과 표의 2열 구조를 유지한다.
- editor 행은 이름, 값, 계산 결과와 action을 명확한 열로 배치한다.
- content 최대 폭과 외곽 spacing은 Main 앱 shell 단계에 맞춘다.

## 7. Overlay 계약

- Apply Bar는 공통 flat panel과 button variant를 사용하며 fixed floating 계층을 유지한다.
- dialog는 viewport 안에 머물고 내용이 길면 내부 스크롤을 제공한다.
- dialog backdrop은 배경과 현재 행동을 분리하지만 과도한 투명 효과를 사용하지 않는다.
- 기존 초기 focus, Tab 순환, Escape 취소와 trigger focus 복귀를 유지한다.
- tooltip은 Portfolio 고유 표현과 containment 계산을 유지한다.
- `prefers-reduced-motion`에서는 transition과 animation을 제거한다.

## 8. 오류와 상태

- 저장 실패, 초안 정리 실패와 field error 문구·role을 변경하지 않는다.
- 오류는 해당 입력 또는 현재 활성 overlay 안에서 계속 읽을 수 있어야 한다.
- zero-investment gate와 stale-Main recovery 동작을 유지한다.
- 시각 수정이 저장 성공이나 실패 상태를 숨기지 않아야 한다.

## 9. 검증

### 단위 테스트

- 공통 `Button`의 variant, class 병합과 native 속성 전달
- 공통 `Surface`의 element 선택, class 병합과 semantic 속성 전달
- Main 호환 re-export
- Simulation과 Portfolio 주요 surface·button의 공통 컴포넌트 계약

### Playwright

- 390px, 768px와 desktop에서 Portfolio result와 editor의 가로 overflow 부재
- 세 viewport에서 summary·editor surface와 button이 공통 class 계약을 사용함
- 390px 투자 대상 행, table, Apply Bar와 dialog containment
- 주요 button과 input의 최소 44px touch target
- 도넛, 표, tooltip, focus와 reduced-motion 회귀 부재
- Simulation 주요 surface·button과 그래프 표시 회귀 부재

### 필수 명령

- `npm run check`
- 관련 공통 UI·Simulation·Portfolio 단위 테스트
- `npx playwright test tests/portfolio.spec.ts tests/simulation.spec.ts --reporter=list`
- `git diff --check`

## 10. 인수 조건

- Portfolio가 Main과 같은 canvas, typography, flat panel, button, input과 focus 문법을 사용한다.
- Portfolio는 390px, 768px와 desktop에서 정보 손실이나 가로 overflow 없이 동작한다.
- Main·Simulation·Portfolio가 같은 React `Button`과 `Surface` 구현을 공유한다.
- Portfolio CSS가 두 번째 Tailwind foundation을 로드하지 않는다.
- Main, Simulation과 Portfolio의 데이터·계산·저장·navigation 계약은 변하지 않는다.
- Simulation 그래프와 Portfolio 도넛·표·tooltip의 고유 표현은 유지된다.
