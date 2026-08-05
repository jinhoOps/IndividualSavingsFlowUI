# Simulation 모바일 그래프 상호작용 설계

- 작성일: 2026-08-05
- 상태: 승인됨
- 범위: Simulation 결과 화면의 그래프 탐색, tooltip 밀도와 금액 줄바꿈
- 선행 문서: [Simulation 경험 재설계](2026-08-03-simulation-experience-redesign-design.md)
- 제품 기준: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md)

## 1. 문제

현재 390px 화면에서 그래프를 터치하면 상세 tooltip이 그래프 너비 대부분을 덮는다. 연도와 여섯 값, 닫기 버튼을 한 카드에 표시해 선택한 곡선과 주변 맥락을 함께 보기 어렵다. 긴 금액에는 임의 글자 단위 줄바꿈이 적용될 수 있어 카드 크기와 결과 영역 밀도도 값에 따라 흔들린다.

그래프 자체, 결과 순서와 기본 여백은 유지하되 모바일 탐색 정보만 작고 안정적으로 만들어야 한다. 데스크톱은 현재 상세 탐색 기능을 보존한다.

## 2. 목표

1. 모바일에서 누른 지점을 따라 연도를 탐색하고 손을 뗀 뒤에도 선택을 확인한다.
2. 모바일 tooltip은 그래프를 가리지 않는 고정된 크기와 정보 구조를 유지한다.
3. 금액과 짧은 label이 의도치 않게 줄바꿈되거나 레이아웃 밖으로 나가지 않는다.
4. 데스크톱 pointer·keyboard 상세 탐색과 계산 결과를 보존한다.

## 3. 범위 밖

- 그래프 곡선, 축, 범례, 높이 또는 결과 화면 순서 재설계
- 복리 계산, 금액 반올림, 저장, Main 동기화 변경
- Simulation 설정이나 onboarding 변경
- 모바일 전용 금액 축약 또는 소수점 표기

## 4. 선택한 접근

반응형 tooltip 표현을 분리한다. `GrowthChart`는 하나의 선택 상태를 유지하고, `GrowthChartTooltip`은 같은 선택 데이터를 모바일 compact 표현과 데스크톱 detailed 표현으로 보여준다.

기존 상세 카드에서 CSS로 항목만 숨기는 방식은 데스크톱 구조와 크기 계산이 모바일에 남아 위치·접근성 경계가 불명확하다. SVG 내부에 tooltip을 그리는 방식은 한국어 금액의 실제 크기, 반응형 배치와 의미 구조 관리가 복잡하다. 별도 표현은 현재 컴포넌트 경계를 유지하면서 모바일 정보량과 치수를 명시할 수 있다.

## 5. 모바일 상호작용

### 5.1 선택과 이동

- 사용자가 그래프를 터치하면 가장 가까운 연도를 즉시 선택한다.
- 누른 채 좌우로 이동하면 연도, 세로 기준선, 두 marker와 tooltip이 함께 이동한다.
- 손을 떼면 마지막 선택을 유지한다.
- 선택을 유지한 상태에서 그래프의 다른 지점을 터치하면 닫힘 단계 없이 새 연도로 이동한다.
- `pointercancel`이 발생하면 마지막 정상 선택을 유지한다.

### 5.2 닫기

- 그래프 밖을 터치하면 닫는다.
- 선택이 열린 상태에서 페이지가 scroll되면 닫는다.
- keyboard의 `Escape`로 닫는다.
- tooltip 내부 닫기 버튼은 모바일과 데스크톱 모두 제공하지 않는다.
- 선택 중에만 외부 pointer와 scroll listener를 등록하고 정리한다.

### 5.3 위치

- compact tooltip은 선택 지점 위에 놓는다.
- 좌우 viewport 또는 그래프 경계와 충돌하면 안쪽으로 이동한다.
- 상단 공간이 부족하면 그래프 안에서 아래쪽 배치로 전환한다.
- 위치만 바뀌며 내용에 따라 폭이나 높이는 바뀌지 않는다.

## 6. 정보 구조

### 6.1 모바일 compact tooltip

다음 정보만 제공한다.

1. 선택 연도
2. 현재 계획 총액
3. 전부 저축 총액

누적 납입원금, 저축 잔액과 투자 잔액은 모바일 tooltip에서 제거한다. 별도 상세 펼치기, carousel 또는 닫기 버튼도 제공하지 않는다. 필요한 결과 비교는 기존 그래프 하단 결과 영역에서 확인한다.

### 6.2 데스크톱 detailed tooltip

현재 상세 정보 구조를 유지한다.

- 선택 연도
- 현재 계획 총액
- 전부 저축 총액
- 누적 납입원금
- 저축 잔액
- 투자 잔액

pointer 추적, Home·End·좌우 방향키와 `Escape` 동작을 유지한다. 닫기 버튼만 제거한다.

### 6.3 접근성

- 그래프의 현재 accessible name과 keyboard 탐색을 유지한다.
- 선택 변경 시 선택 연도, 현재 계획 총액과 전부 저축 총액을 하나의 상태 문장으로 알린다.
- 시각적으로 숨긴 상세값을 모바일 screen reader에 중복 제공하지 않는다.
- pointer만 사용하지 않아도 같은 핵심 비교값에 접근할 수 있다.

## 7. 밀도와 줄바꿈

- 결과 화면의 현재 순서와 기본 여백을 유지한다.
- compact tooltip은 모바일 breakpoint 안에서 고정 폭과 고정 내부 행 구조를 사용한다.
- 연도, label과 금액은 한 줄을 유지한다.
- 금액에는 `white-space: nowrap`을 적용하고 컨테이너 폭에 맞는 제한된 반응형 글자 크기를 사용한다.
- `4억 8,240만 원` 같은 기존 한국식 정수 표기를 유지한다. 모바일 전용 `4.8억 원` 같은 소수점 축약은 사용하지 않는다.
- 비교 영역 금액의 임의 글자 단위 줄바꿈을 제거한다. 공간이 부족하면 글자 크기를 제한하며 가로 overflow를 만들지 않는다.
- 제목과 설명은 기존 한국어 어절 단위 줄바꿈을 유지한다.
- 그래프 높이, 축, 범례와 결과 영역 배치는 변경하지 않는다.

## 8. 컴포넌트 경계와 데이터 흐름

### `GrowthChart`

- 선택 index, pointer 종류와 drag 상태를 소유한다.
- pointer 좌표를 기존 chart geometry의 가장 가까운 연도로 변환한다.
- 선택, 이동, 유지, 외부 pointer, scroll, `pointercancel`과 keyboard 종료를 조정한다.
- 계산된 동일 선택 데이터를 tooltip에 전달한다.

### `GrowthChartTooltip`

- 전달받은 선택값을 표시만 한다.
- 모바일 compact와 데스크톱 detailed 의미 구조를 제공한다.
- 자체 선택 상태나 계산 상태를 소유하지 않는다.
- 닫기 버튼을 렌더링하지 않는다.

### 위치 계산

- 선택점, 그래프 경계와 명시된 tooltip 치수를 입력으로 받는다.
- 좌우 충돌과 상단 충돌을 보정한 위치를 반환한다.
- 금액 문자열 길이에 따른 DOM 측정값을 위치 결정의 주 입력으로 사용하지 않는다.

복리 projection, 명목·실질 전환, `formatWon`, 저장소와 Main source에는 변경이 없다.

## 9. 오류와 예외 처리

- 유효한 그래프 폭을 얻지 못하면 새 선택을 만들지 않는다.
- pointer가 그래프 범위를 벗어나도 첫 연도와 마지막 연도 사이로 clamp한다.
- scroll 닫힘은 passive listener로 처리하고 그래프 탐색이나 페이지 scroll을 막지 않는다.
- component unmount 시 pointer와 scroll listener를 모두 제거한다.
- 0년, 30년과 매우 큰 금액에서도 tooltip 치수와 그래프 containment가 유지되어야 한다.

## 10. 검증

### 단위 테스트

- touch `pointerdown`과 `pointermove`가 가장 가까운 연도로 선택을 이동한다.
- `pointerup` 후 마지막 선택이 유지된다.
- 그래프 밖 pointer, scroll과 `Escape`가 선택을 닫는다.
- `pointercancel`은 마지막 정상 선택을 유지한다.
- 모바일 compact에는 연도와 두 총액만 있고 상세값과 닫기 버튼은 없다.
- 데스크톱 detailed에는 기존 여섯 정보가 있고 닫기 버튼은 없다.
- 첫 연도와 마지막 연도의 tooltip 위치가 경계 안으로 보정된다.

### Playwright

- 390px에서 touch drag 중 선택 연도와 tooltip 값이 이동한다.
- 손을 뗀 뒤 선택이 유지되고 scroll 또는 그래프 밖 터치로 닫힌다.
- 0년, 30년과 서로 다른 금액에서 compact tooltip의 폭과 높이가 동일하다.
- tooltip 전체가 viewport와 그래프 상호작용 영역 안에 유지된다.
- tooltip label·금액과 비교 영역 금액이 줄바꿈되지 않는다.
- document 가로 overflow가 없다.
- 768px과 desktop에서 pointer·keyboard 상세 탐색이 회귀하지 않는다.

### 필수 명령과 시각 확인

- `npm run check`
- 영향받는 Simulation 단위 테스트
- focused Simulation Playwright spec
- 390px, 768px와 desktop에서 overflow, tooltip containment, focus와 touch 동작 확인

## 11. 인수 조건

- 모바일 사용자는 누른 채 연도를 이동하고 손을 뗀 뒤 두 계획 총액을 확인할 수 있다.
- 모바일 tooltip은 선택값과 위치가 달라져도 크기가 변하지 않는다.
- tooltip은 선택 지점 위를 우선하며 화면이나 그래프 밖으로 나가지 않는다.
- tooltip이 그래프 대부분을 덮지 않고 세부 잔액이나 닫기 버튼을 표시하지 않는다.
- 데스크톱은 닫기 버튼을 제외한 현재 상세 탐색을 유지한다.
- 긴 한국식 금액이 임의 글자 단위로 줄바꿈되거나 가로 overflow를 만들지 않는다.
- Simulation 계산, 저장, Main 읽기 전용 경계와 결과 순서는 변하지 않는다.
