# Simulation 단기 기간 월별 그래프 상세 설계

- 작성일: 2026-08-24
- 상태: 구현 완료
- 범위: Simulation 그래프의 compact tooltip 정보 우선순위와 3년 이하 월별 탐색
- 선행 문서: [Simulation 모바일 그래프 상호작용 설계](2026-08-05-simulation-mobile-chart-interaction-design.md), [Simulation 목표 도달 요약 설계](2026-08-21-simulation-goal-milestone-design.md)
- 제품 기준: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md)

## 1. 문제

모바일 compact tooltip은 현재 계획과 전부 저축 총액을 함께 보여준다. 두 곡선의 비교는 이미 선과 범례로 계속 읽을 수 있지만, 사용자가 짧은 기간에 가장 직접적으로 확인하려는 기준은 실제로 납입한 원금이다.

또한 복리 계산은 이미 매월 실행하지만 graph projection은 연말만 점으로 꺼낸다. 1~3년처럼 가까운 기간에서는 사용자가 월별 납입과 잔액 변화를 탐색할 수 없다.

## 2. 목표

1. 모바일 compact tooltip의 보조 비교값을 `전부 저축 총액`에서 `누적 납입원금`으로 바꾼다.
2. 사용자가 설정한 기간이 3년 이하이면 시작점을 포함한 월별 projection point를 그래프와 모든 탐색 입력에 제공한다.
3. 4년 이상은 기존 연 단위 graph density를 유지한다.
4. 기존 월 복리 식, 명목·실질 모드, Main read-only 경계와 저장 schema는 바꾸지 않는다.

## 3. 범위 밖

- 4년 이상 기간의 월별 zoom, 별도 확대 control 또는 새 chart mode
- 전부 저축 곡선·범례·하단 비교값 제거
- tooltip에 추가 펼치기, carousel 또는 닫기 버튼
- 목표 도달 headline의 월 단위 계산 규칙 변경
- Simulation draft, workspace 저장·import·backup schema 변경

## 4. 선택한 접근

`projectCompoundGrowth`는 같은 월별 계산 loop를 유지하되 runtime graph point의 추출 간격만 기간에 따라 바꾼다.

| 선택 기간 | graph point | 탐색 단위 | x축 라벨 |
| --- | --- | --- | --- |
| 0년 | 현재 1점 | 현재 | 현재 |
| 1~3년 | 0~종료월의 모든 월 | 1개월 | 현재·6개월 간격·마지막 월 |
| 4~30년 | 현재와 매년 말 | 1년 | 현재·5년 간격·마지막 연도 |

매월 계산 결과를 tooltip에서 따로 재계산하는 방법은 선택한 곡선, keyboard 위치와 표시값이 달라질 위험이 있다. 하나의 point 배열을 curve, marker, pointer/touch, keyboard와 tooltip이 같이 사용하도록 유지한다.

## 5. 정보 구조와 상호작용

### 5.1 모바일 compact tooltip

고정 크기와 두 금액 구조를 유지한다.

1. 선택 시점: `현재`, `7개월`, `1년`, `1년 7개월` 중 하나
2. 현재 계획 총액
3. 누적 납입원금

전부 저축 총액은 compact tooltip에서 제거한다. 전부 저축의 비교 의미는 같은 chart의 보조 곡선과 범례로 유지한다. 선택 시 상태 문장도 compact 표현과 동일하게 현재 계획 총액과 누적 납입원금을 알린다.

### 5.2 desktop 상세 tooltip

desktop tooltip의 금액 구조는 유지한다.

- 현재 계획 총액
- 전부 저축 총액
- 누적 납입원금
- 저축 잔액
- 투자 잔액

단, 3년 이하에서는 제목과 keyboard/pointer 선택 시점을 연도가 아니라 월 단위로 표기한다. 4년 이상에서는 현재의 연도 표기를 유지한다.

### 5.3 선택 입력

- 3년 이하의 touch drag와 desktop pointer는 가장 가까운 월을 선택한다.
- keyboard `ArrowLeft`/`ArrowRight`는 한 달씩, `Home`/`End`는 처음·마지막 point로 이동한다.
- 4년 이상은 현재와 같은 연도 단위 이동을 유지한다.
- `Escape`, graph 밖 pointer, scroll과 `pointercancel`의 닫힘·유지 규칙은 변경하지 않는다.

## 6. 데이터·렌더링 경계

### Projection

- 저장되는 `CompoundSimulationDraft`와 `ProjectionPoint`의 필드는 변경하지 않는다.
- `ProjectionPoint.month`를 정규 시점 값으로 사용한다. `year`는 계속 `month / 12` 파생값이다.
- `projectCompoundGrowth`는 기간이 36개월 이하일 때 매월 `appendPoint(month)`를 호출하고, 그 밖에는 12개월마다 호출한다.
- 최종 point, headline과 하단 비교값은 추출 간격과 무관하게 같은 최종 월 잔액을 사용한다.

### Chart geometry와 시간 표기

- geometry의 x좌표는 `month / finalMonth`를 기준으로 계산해 월별·연별 point 모두 같은 시간 비율을 갖는다.
- `formatProjectionPeriod(month)`가 유일한 시점 표기 함수다. `0`은 `현재`, 12개월 미만은 `N개월`, 12개월의 배수는 `N년`, 나머지는 `N년 N개월`을 반환한다.
- tooltip 제목, graph의 최종 screen reader 요약, active selection status와 x축은 모두 `formatProjectionPeriod(month)`를 사용한다. short horizon에서 `ProjectionPoint.year`를 사용자에게 직접 표시하지 않는다.
- short horizon x축은 매월 라벨을 렌더하지 않는다. 6개월 간격, 마지막 월과 현재만 표기해 390px에서 겹침을 막는다.
- chart path motion은 point 수가 37개로 늘거나 4년 경계에서 annual path로 바뀌어도 기존 resampling 경로를 사용해 final semantic path와 reduced-motion fallback을 보존한다.

### Tooltip

- `GrowthChart`은 `GrowthChartTooltip`에 원시 `year` 대신 `periodLabel`과 금액 payload를 전달한다. tooltip은 시점 계산이나 금액 재계산을 하지 않는다.
- `GrowthChartTooltip`은 `variant`에 따라 compact의 보조 row를 `principalWon`, detailed의 첫 row를 `allSavingsWon`으로 선택한다. 같은 `variant`가 active selection status의 금액 구성을 결정한다.
- 명목·실질 모드에서 principal은 각각 `contributedPrincipalWon`과 `contributedPrincipalRealWon`을 표시한다.
- compact tooltip의 치수는 현재 고정값을 유지한다. label·금액은 한 줄이고 overflow하지 않아야 한다.

## 7. 접근성·반응형

- graph의 accessible name은 두 곡선 비교를 계속 설명한다.
- active selection의 status는 현재 선택 시점과 compact/detailed 정보 구조를 따르며, compact에 숨긴 전부 저축 총액을 중복 공지하지 않는다.
- 390px touch drag, 768px pointer/focus, desktop keyboard에서 동일한 시간 단위와 선택값을 제공한다.
- 기존 44px touch target, tooltip containment, scroll dismissal과 `prefers-reduced-motion` 계약을 유지한다.

## 8. 오류와 경계

- 0년은 `현재` 한 point만 렌더하고 월별 이동 control을 만들지 않는다.
- 3년은 37개 point(현재 + 36개월), 4년은 5개 point(현재 + 4개 연말)를 제공한다.
- point 배열이 비어 있거나 chart 폭이 유효하지 않으면 새 선택을 만들지 않는다.
- 큰 원화, 명목·실질, 월 납입 0원과 3년/4년 경계에서도 x축·tooltip이 가로 overflow를 만들지 않는다.

## 9. 검증

### Unit

- 3년 projection이 0~36개월 37개 point와 올바른 최종값을 제공한다.
- 4년 projection은 현재와 연말 point만 제공한다.
- 월별 point의 명목·실질 principal과 최종값이 같은 월 복리 결과를 사용한다.
- month 기반 geometry, `현재`/개월/년·개월 시간 표기와 short-horizon x tick density를 검증한다.
- compact tooltip은 누적 납입원금을 표시하고 전부 저축 총액을 표시하지 않는다.
- detailed tooltip은 전부 저축 총액과 기존 잔액 상세를 유지한다.
- 3년 이하 keyboard 이동이 한 달씩 이동하고 animation/reduced-motion fallback이 point 수 변화에서도 final state를 보존한다.
- `formatProjectionPeriod`가 tooltip·최종 요약·상태 문장·x축에서 `현재`/개월/년·개월을 일관되게 만드는지 검증한다.

### Playwright

- 390px에서 3년 그래프 touch drag가 월별 tooltip 시점을 이동하고, compact tooltip에 현재 계획·누적 납입원금만 보인다.
- 768px과 desktop에서 short-horizon pointer·keyboard가 월별 시점을 선택하고 detailed tooltip의 전부 저축·잔액 상세가 남는다.
- 4년 이상에서는 연 단위 선택이 유지된다.
- 390px, 768px, desktop에서 tooltip containment, 가로 overflow, focus, touch target과 visualization visibility를 확인한다.

### 필수 명령

- `npm run check`
- 영향받는 Simulation unit test
- `npx playwright test tests/simulation.spec.ts`
- `git diff --check`

## 10. 인수 조건

1. 모바일 compact tooltip의 두 금액은 현재 계획 총액과 누적 납입원금이다.
2. 3년 이하 graph는 매월을 정확히 선택·표시하고, 4년 이상 graph는 연 단위 밀도를 유지한다.
3. 전부 저축 곡선과 desktop 상세 tooltip의 비교 정보는 보존된다.
4. 명목·실질, Main read-only, Simulation 저장 schema와 목표 도달 계산은 회귀하지 않는다.
5. 모든 지원 viewport에서 tooltip과 graph가 containment·접근성·motion 계약을 지킨다.

## 11. 기존 문서와의 관계

이 문서는 [Simulation 모바일 그래프 상호작용 설계](2026-08-05-simulation-mobile-chart-interaction-design.md)의 mobile compact 정보 구조를 `현재 계획 총액 + 누적 납입원금`으로 대체한다. 또한 [Simulation 목표 도달 요약 설계](2026-08-21-simulation-goal-milestone-design.md)의 “graph는 연 단위 결과만 표시” 비목표를 short horizon(3년 이하)에 한해 대체한다. 나머지 tooltip dismissal, Main read-only, 목표 headline의 독립 계산 계약은 유지한다.

구현은 [DESIGN](../../../DESIGN.md)의 Simulation compact tooltip 문장도 이 계약으로 갱신한다. 구현 상태와 검증 결과는 이 문서와 관련 커밋에 반영한다.
