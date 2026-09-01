# Main Visualization Boundary Refactor Design

**Date:** 2026-09-01

**Status:** Proposed; awaiting written-spec review

**Scope:** Repository-wide refactor Phase 3의 첫 단위로 Main cashflow bar와 dashboard donut의 의미 계산, geometry, 상호작용, Anime.js 렌더링 경계를 분리한다.

## 1. Goal

Main의 다섯 월간 금액, 현재 문구와 시각 결과를 유지하면서 `AllocationBar`와 `CashflowDonutSummary` 안에 섞인 순수 계산, 화면 좌표, 상호작용 파생, DOM mutation을 독립적으로 검증 가능한 경계로 나눈다.

기준 문서:

- [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [Repository-wide Refactor Design](2026-08-24-repository-wide-refactor-design.md)
- [Main Cashflow Donut Summary Design](2026-08-03-main-cashflow-donut-summary-design.md)
- [Overflow Liquid and Restart Focus Design](2026-07-30-overflow-liquid-and-restart-focus-design.md)
- [DESIGN](../../../DESIGN.md)

## 2. Current Baseline

- `cashflow.ts`와 `cashflowInsight.ts`가 금액·비율 의미를 계산한다.
- `cashflowBarGeometry.ts`는 순수 함수지만 `MainData`에서 cashflow를 다시 계산하면서 viewport clipping도 함께 결정한다.
- `AllocationBar.tsx`는 측정, geometry 조립, hover/focus/tap, tooltip target 판정, Anime.js 상태와 DOM 렌더링을 함께 소유한다.
- `CashflowDonutSummary.tsx`는 insight 선택, donut segment geometry, pointer hit-test 연결, motion state와 SVG mutation을 함께 소유한다.
- `donutHitTest.ts`는 이미 순수 경계이며 유지한다.

현재 외부 동작은 `cashflowBarGeometry.test.ts`, `AllocationBar.test.tsx`, `cashflowInsight.test.ts`, `donutHitTest.test.ts`, `CashflowDonutSummary.test.tsx`와 Main Playwright 흐름을 기준선으로 삼는다.

## 3. Product Boundaries

다음 계약은 변경하지 않는다.

- Main만 다섯 월간 금액을 편집한다.
- setup review의 조립 시각화와 dashboard의 `자세히 보기`는 현재 표시 조건을 유지한다.
- 100% 이하는 컨테이너 안에서 실제 비율을 표시한다.
- 계획이 수입을 초과하면 실제 초과 비율만큼 100% 기준선을 넘어 연장하고, viewport를 벗어날 때만 절단한다.
- donut은 100%까지만 채우고 실제 초과 비율과 초과 문구는 유지한다.
- pointer, keyboard, touch가 같은 금액·비율 정보를 제공하고 tooltip은 컨테이너와 viewport를 벗어나지 않는다.
- Anime.js 예외, 취소 실패와 reduced motion에서도 최종 geometry가 DOM에 남는다.
- 문구, 색상, DOM 읽기 순서, accessible name, CSS selector와 motion timing은 바꾸지 않는다.

## 4. Non-goals

- Main UI 재설계, 새 chart, 새 tooltip 또는 금융 계산 변경
- setup review/dashboard에서 bar 표시 위치나 공개 범위 변경
- 공통 범용 chart/donut engine 도입
- Simulation 또는 Account Map 시각화 모듈 재사용
- workspace schema, 저장, command, Main orchestration 변경

## 5. Architecture

```text
MainData
  -> cashflow / cashflowInsight          # 금융 의미
  -> bar/donut semantic model            # 표시할 항목과 순서
  -> pure geometry                       # 비율, offset, clipping
  -> pure interaction selectors          # 활성 항목, target/tooltip 위치
  -> React renderer                      # semantic DOM/SVG
  -> app-owned Anime.js adapter          # visual-only transition
```

`AllocationBar`와 `CashflowDonutSummary`는 최종 markup과 브라우저 이벤트를 소유한다. 새 순수 모듈은 React, DOM, Anime.js를 import하지 않는다. motion 모듈은 금융 의미를 계산하지 않고 target geometry를 DOM에 적용하는 책임만 가진다.

### 5.1 Cashflow bar

- `cashflowBarModel.ts`는 `calculateCashflow()` 결과에서 고정 순서 segment와 실제 비율을 만든다.
- `cashflowBarGeometry.ts`는 semantic model과 `{ barWidthPx, availableRightPx }`만 받아 `desiredEndPercent`, `visibleEndPercent`, `clipped`와 segment 좌표를 반환한다.
- 0 또는 비정상 수입은 빈 geometry를 반환하며 텍스트 대체 정보는 그대로 남긴다.
- 작은 segment의 독립 44px target 가능 여부, clipped segment 여부와 tooltip 기준점은 순수 interaction helper가 계산한다.
- `AllocationBar.tsx`는 ResizeObserver 측정, 이벤트 상태, markup만 조정한다.
- bar motion helper는 이전/다음 geometry 사이 상태를 만들고 cancel·failure·reduced-motion 때 최종 상태를 commit한다.

### 5.2 Dashboard donut

- `cashflowInsight.ts`가 allocation 금액, 실제 비율, display 비율과 초과 의미의 유일한 원천이다.
- `cashflowDonutGeometry.ts`는 allocation 순서를 받아 각 원호의 visible percentage와 dash offset을 계산한다. 총 visible arc는 100%를 넘지 않는다.
- 기존 `donutHitTest.ts`는 순수 pointer 좌표 선택기로 유지하고 geometry의 allocation 순서와 같은 canonical ID 순서를 사용한다.
- `cashflowDonutMotion.ts`는 entering/current/exiting segment의 visual state와 최종 SVG attribute 적용을 소유한다. Anime.js 호출 실패나 취소 실패 시 모든 현재 segment를 즉시 final state로 복구한다.
- `CashflowDonutSummary.tsx`는 hover/focus/tap 우선순위, 접근 가능한 버튼/라벨, SVG와 중앙 상세 표시를 유지한다.

## 6. Error and Motion Handling

- 순수 계산은 입력이 유효하지 않을 때 throw하지 않고 명시적인 empty geometry를 반환한다.
- renderer가 측정 전 받은 `0px` viewport는 overflow가 없는 최종 의미 데이터를 숨기지 않는다.
- Anime.js는 semantic DOM을 생성하거나 제거하지 않는다. 숨겨진 초기 CSS 상태가 최종 콘텐츠의 유일한 상태가 될 수 없다.
- animation cancellation과 callback은 generation guard를 사용해 오래된 animation이 새 geometry를 덮어쓰지 못하게 한다.
- reduced motion과 Anime.js 예외 경로는 정상 완료 경로와 같은 final geometry assertion을 공유한다.

## 7. Delivery and Rollback

Main 단위는 다음 순서의 독립 커밋으로 구현한다.

1. 현재 출력의 characterization test와 semantic model 분리
2. bar geometry·interaction 분리와 renderer 연결
3. donut geometry·motion 분리와 renderer 연결
4. Main viewport·motion 회귀 검증

각 커밋은 이전 public import를 소비자가 모두 이동할 때까지 유지한다. 실패하면 마지막 검증 통과 커밋으로 Main 단위만 되돌릴 수 있어야 하며 Simulation과 Account Map 변경을 포함하지 않는다.

## 8. Acceptance Criteria

- 같은 `MainData`와 viewport는 분리 전과 같은 segment 순서, 실제 비율, donut arc와 tooltip 정보를 만든다.
- 100% 초과 bar는 실제 비율만큼 연장되며 화면 밖으로 나갈 때만 `visibleEndPercent`에서 절단된다.
- setup review의 assembly bar와 dashboard `자세히 보기` bar가 현재 조건에서만 표시된다.
- donut은 실제 초과 의미를 잃지 않으면서 visible arc 합이 100%를 넘지 않는다.
- pointer, keyboard와 touch로 같은 항목을 탐색할 수 있고 작은/clipped segment의 대체 target이 유지된다.
- Anime.js 정상·reduced-motion·throw·cancel-failure 경로에서 최종 DOM/SVG 상태가 동일하다.
- 390px, 768px와 desktop에서 bar, target, tooltip과 donut이 surface/viewport를 벗어나지 않는다.

## 9. Required Verification

- `cashflowBarModel`, `cashflowBarGeometry`, bar interaction helper focused unit
- `cashflowDonutGeometry`, `cashflowDonutMotion`, `donutHitTest` focused unit
- `AllocationBar.test.tsx`, `CashflowDonutSummary.test.tsx`, `SetupFlow.test.tsx`, `SummaryDashboard.test.tsx`
- Main Playwright의 setup review, dashboard details, overflow, pointer/keyboard/touch와 reduced-motion 흐름
- 390×844, 768×1024, 1280×900 containment와 visualization visibility
- `npm run check`, 관련 unit, 관련 E2E, `npm run build`, `git diff --check`
