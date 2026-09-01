# Simulation Chart Boundary Refactor Design

**Date:** 2026-09-01

**Status:** Approved for implementation

**Scope:** Repository-wide refactor Phase 3의 두 번째 단위로 Simulation projection 표시 모델, chart geometry, 탐색과 tooltip, Anime.js SVG 렌더링 경계를 분리한다.

## 1. Goal

Simulation의 복리 계산, 명목/실질 의미와 현재 그래프 경험을 유지하면서 `GrowthChart`에 모인 표시값 선택, 좌표 계산, pointer/keyboard 탐색, tooltip model, path transition과 DOM mutation을 독립적으로 검증 가능한 모듈로 나눈다.

기준 문서:

- [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [Repository-wide Refactor Design](2026-08-24-repository-wide-refactor-design.md)
- [Simulation Mobile Chart Interaction Design](2026-08-05-simulation-mobile-chart-interaction-design.md)
- [DESIGN](../../../DESIGN.md)

## 2. Current Baseline

- domain projection은 `ProjectionPoint[]`를 계산한다.
- `chartGeometry.ts`는 순수 함수지만 명목/실질 필드 선택, 축 포맷, 좌표와 tooltip placement를 함께 소유한다.
- `GrowthChart.tsx`는 active index, pointer capture, keyboard navigation, compact media query, tooltip values/status, path resampling·interpolation, Anime.js reveal와 SVG 렌더링을 함께 소유한다.
- `GrowthChartTooltip.tsx`는 tooltip markup을 소유한다.

현재 외부 동작은 `projection.test.ts`, `chartGeometry.test.ts`, `GrowthChart.test.tsx`와 Simulation Playwright 흐름을 기준선으로 삼는다.

## 3. Product Boundaries

다음 계약은 변경하지 않는다.

- Simulation은 Main의 저축·투자 금액을 읽기 전용으로 사용한다.
- 복리 공식, 목표 도달 headline, 명목/실질 전환, 최대 30년과 기간별 sampling은 변경하지 않는다.
- 3년 이하는 현재부터 매월, 4~30년은 현재와 연말 point를 표시한다.
- chart는 현재 계획과 전부 저축을 비교하고 상세 탐색에서 누적 납입원금·저축·투자 잔액을 제공한다.
- compact tooltip은 기간·현재 계획 총액·누적 납입원금을 표시한다.
- pointer, touch drag, keyboard Home/End/Arrow와 Escape/outside/scroll dismiss를 유지한다.
- chart 크기, 축, 범례, 색상, 문구, accessible name과 motion timing은 변경하지 않는다.

## 4. Non-goals

- projection 알고리즘, 입력 흐름, 목표 금액 또는 계산 기준 UI 변경
- responsive chart 재설계나 새 chart library 도입
- Main/Portfolio chart와 공통 renderer 구축
- repository, persistence, Simulation orchestration 변경

## 5. Architecture

```text
ProjectionResult + amountMode
  -> display series model                # nominal/real field selection
  -> chart geometry                      # plot, points, paths, ticks
  -> navigation/tooltip model            # selected point and placement
  -> React SVG renderer                  # semantic/static final paths
  -> chart motion adapter                # reveal and path interpolation
```

### 5.1 Display series model

- `chartSeries.ts`는 `ProjectionPoint`의 명목/실질 필드를 `currentPlanWon`, `allSavingsWon`, `principalWon`, `savingsWon`, `investmentWon`의 한 표시 모델로 변환한다.
- `GrowthChart`, accessible status와 tooltip은 원본 projection field를 각각 재선택하지 않고 같은 표시 모델을 사용한다.
- sampling과 금융 계산은 domain projection에 남고 display model은 값을 재계산하지 않는다.

### 5.2 Geometry and interaction

- `chartGeometry.ts`는 표시 series와 명시적인 chart size를 받아 plot, 좌표, path와 tick을 계산한다. amount mode나 원본 domain field 이름을 알지 못한다.
- 빈 series와 단일 point도 유효한 geometry를 반환한다. renderer에서 non-null assertion으로 마지막 point를 가정하지 않는다.
- `chartInteraction.ts`는 client X와 SVG bounds에서 가장 가까운 point index를 선택하고, keyboard intent에서 다음 index를 계산하며, tooltip placement를 계산한다.
- pointer capture와 outside/scroll listener는 브라우저 effect이므로 `GrowthChart`에 남는다.
- `chartTooltipModel.ts`는 선택된 display point와 compact 여부로 visible values와 screen-reader status를 한 번만 만든다.

### 5.3 Motion and rendering

- `chartMotionGeometry.ts`는 static chart geometry를 motion path point로 변환하고 서로 다른 point 수를 resample·interpolate한다.
- `chartMotion.ts`는 reveal clip과 세 visual path에 target frame을 적용한다.
- semantic path는 항상 final `d` 값을 가지고 motion layer만 `aria-hidden`으로 전환된다.
- 최초 reveal 완료 전 result가 바뀌어도 현재 reveal width에서 이어가며, 완료 뒤 변경은 전체 폭에서 path만 전환한다.
- Anime.js 실패와 reduced motion은 reveal clip과 path를 final state로 즉시 commit한다.

## 6. Error and State Handling

- stale animation callback은 generation guard로 새 series를 덮어쓰지 못한다.
- active index가 새 series 길이를 벗어나면 명시적으로 clamp 또는 clear하고 존재하지 않는 tooltip을 만들지 않는다.
- zero-width SVG bounds는 선택 없음으로 처리한다.
- compact breakpoint 변화는 tooltip 표현만 바꾸고 선택 기간을 초기화하지 않는다.

## 7. Delivery and Rollback

Simulation 단위는 Main 단위 완료 후 다음 독립 커밋으로 구현한다.

1. display series와 tooltip characterization test
2. geometry·interaction 경계 분리
3. motion geometry·Anime.js adapter 분리
4. Simulation viewport·interaction 회귀 검증

각 커밋은 Simulation 파일과 테스트만 포함하며 projection, storage와 Main source adapter를 변경하지 않는다. 실패하면 Simulation 단위만 되돌릴 수 있어야 한다.

## 8. Acceptance Criteria

- 같은 projection과 amount mode는 분리 전과 같은 두 series 값, 축, path와 tooltip 값을 만든다.
- 3년 이하 monthly series와 4~30년 yearly series의 point 수·기간 label·keyboard step이 유지된다.
- pointer와 touch drag가 가장 가까운 같은 point를 선택하며 keyboard Home/End/Arrow 동작이 유지된다.
- compact/detailed tooltip 문구와 dismiss 규칙이 유지되고 viewport 밖으로 나가지 않는다.
- semantic final paths는 motion에 의존하지 않고 접근성 트리에 남는다.
- Anime.js 정상·reduced-motion·throw 경로에서 reveal clip과 motion path가 같은 final state로 끝난다.
- 390px, 768px와 desktop에서 그래프·축·범례·tooltip·비교값이 보이고 가로 overflow가 없다.

## 9. Required Verification

- `chartSeries`, `chartGeometry`, `chartInteraction`, `chartTooltipModel`, `chartMotionGeometry` focused unit
- `GrowthChart.test.tsx`의 pointer/touch/keyboard, dismiss, compact/detailed, series update와 motion failure cases
- Simulation Playwright의 3년 이하 monthly, 장기 yearly, nominal/real, 390px/768px/desktop 탐색
- `npm run check`, 관련 unit, 관련 E2E, `npm run build`, `git diff --check`
