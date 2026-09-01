# Account Map Visualization Boundary Refactor Design

**Date:** 2026-09-01

**Status:** Proposed; awaiting written-spec review

**Scope:** Repository-wide refactor Phase 3의 세 번째 단위로 Account Map의 의미 그래프, responsive layout, node·edge/detail geometry, 상호작용과 Anime.js 렌더링 경계를 분리한다.

## 1. Goal

Account Map의 계좌 우선 의미와 결정적 배치를 유지하면서 `mapLayout.ts`와 `AccountMapCanvas.tsx`에 섞인 graph 작성, 순서 결정, viewport 배치, edge/detail 좌표, interaction 파생과 DOM 렌더링을 독립적으로 검증 가능한 경계로 나눈다.

기준 문서:

- [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [Repository-wide Refactor Design](2026-08-24-repository-wide-refactor-design.md)
- [Account Map Purpose-Node Flow Design](2026-08-13-account-map-purpose-node-flow-design.md)
- [Account Map Meaningful Layout Design](2026-08-25-account-map-meaningful-layout-design.md)
- [DESIGN](../../../DESIGN.md)

## 2. Current Baseline

- `mapLayout.ts`가 Main reconciliation, graph node/edge 작성, primary income 선택, canonical 정렬, mobile/desktop 크기와 좌표 배치를 함께 소유한다.
- `AccountMapCanvas.tsx`가 ResizeObserver, zoom/pan, graph와 detail graph 생성, canonical table order, focused 관계, edge Bézier path, edge amount 위치, connection-detail 위치, interaction event와 modal props 조립을 함께 소유한다.
- `accountMapConnectionDetail.ts`와 `motion.ts`는 detail 집계와 pin-only animation을 일부 분리한다.

현재 외부 동작은 `mapLayout.test.ts`, `accountMapConnectionDetail.test.ts`, `motion.test.ts`, `AccountMapCanvas.test.tsx`와 Account Map Playwright 흐름을 기준선으로 삼는다.

## 3. Product Boundaries

다음 계약은 변경하지 않는다.

- Main 다섯 월간 금액은 읽기 전용이며 Account Map은 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- link는 월 계획 연결이며 실제 잔액·거래·계좌 간 이체를 뜻하지 않는다.
- 단일 account-first 지도, primary income top-left/topmost anchor와 결정적 순서를 유지한다.
- amount는 배치 순서에만 영향을 주며 node 크기와 edge 두께·색을 바꾸지 않는다.
- desktop은 location-left/purpose-right, mobile은 같은 canonical order의 responsive grid를 사용한다.
- overview/default/detail semantic zoom, pan, transient/pinned/modal 상태와 두 번째 activation 편집을 유지한다.
- hover/focus detail은 정적 final state, 새 pin만 one-shot Anime.js, reduced motion은 즉시 final state를 유지한다.
- accessible linear table, focus order, 44px target과 detail containment를 유지한다.

## 4. Non-goals

- force-directed graph, 저장 좌표, drag-to-rearrange 또는 새 layout preference
- node/edge 시각 weight, arrow, 실제 거래 흐름 또는 Portfolio 연결
- graph 데이터 contract, edit command, conflict recovery, archive/restore 변경
- Account Map UI 재설계나 generic graph engine 도입

## 5. Architecture

```text
MainData + AccountMapApplied + locations
  -> graph model                         # truthful nodes, edges, rank metadata
  -> responsive layout policy            # direction, dimensions, slots
  -> positioned graph                    # deterministic node coordinates
  -> edge/detail geometry                # paths, labels, contained disclosure
  -> interaction view model              # focus, dim, canonical rows, modal relation
  -> React renderer + pin-only motion
```

### 5.1 Graph model

- `accountMapGraph.ts`는 reconciliation 결과에서 node, edge, primary income ID와 canonical rank metadata를 만든다.
- overview 대표 link filtering은 전체 active income link에서 먼저 primary income을 계산한 뒤 적용한다.
- graph model은 viewport, DOM, zoom-specific node 좌표와 React를 알지 못한다. zoom이 바꾸는 visible topology는 명시적인 graph projection 함수로 둔다.
- normalized name tie-break와 stable ID tie-break를 보존한다.

### 5.2 Responsive layout

- `accountMapLayout.ts`는 graph projection, viewport와 semantic zoom을 받아 방향·canvas 크기·node 좌표를 반환한다.
- `accountMapLayoutPolicy.ts`는 breakpoint, margin, row/column capacity와 고정 node dimension을 계산한다.
- node placement는 canonical rank만 사용하고 amount를 width/height로 변환하지 않는다.
- 같은 graph, viewport와 zoom은 항상 byte-equivalent position output을 만든다.

### 5.3 Edge and detail geometry

- `accountMapEdgeGeometry.ts`는 positioned endpoint에서 Bézier path와 focused amount label anchor를 계산한다.
- `accountMapDetailGeometry.ts`는 focused location, positioned nodes, canvas와 pan을 받아 disclosure 위치·max block size·필요 canvas height를 계산한다.
- detail candidate는 node와 actionable control을 가리지 않는 인접 위치를 먼저 선택하고, 맞지 않으면 canvas 아래로 확장한다. viewport 바깥 좌표나 음수 가용 크기를 반환하지 않는다.
- overlap rectangle 계산은 순수 함수로 테스트한다.

### 5.4 Interaction view model and renderer

- `accountMapCanvasModel.ts`는 focused ID에서 connected/dimmed ID, canonical accessible rows, active detail target과 modal-related rows를 파생한다.
- transient/pinned/modal reducer와 command는 현재 application 계층에 남는다.
- `AccountMapCanvas.tsx`는 measurement, pointer/touch pan, zoom event, markup과 callback 연결만 소유한다.
- detail percentage 집계는 `accountMapConnectionDetail.ts`, 표시 반올림은 별도 순수 helper의 단일 결과를 사용한다.
- `motion.ts`는 새 pin의 detail weight만 animate하고 hover/focus/layout measurement에는 motion을 시작하지 않는다.

## 6. Error and State Handling

- 보이지 않게 된 transient/pinned node는 현재 background-clear callback으로 정리한다.
- missing endpoint edge는 렌더하지 않되 graph model test에서 invalid reference가 조용히 잘못된 관계로 표시되지 않음을 검증한다.
- ResizeObserver가 없거나 측정 전이어도 최소 viewport policy로 결정적이고 contained한 결과를 만든다.
- pan은 persisted layout이 아니며 graph/layout 계산에 write를 만들지 않는다.
- Anime.js failure와 reduced motion은 detail bar의 final weight를 즉시 적용한다.

## 7. Delivery and Rollback

Account Map 단위는 Main과 Simulation 단위 완료 후 다음 독립 커밋으로 구현한다.

1. graph model·rank characterization test와 topology 분리
2. responsive policy·node placement 분리
3. edge/detail geometry와 canvas view model 분리
4. renderer·motion 연결과 Account Map viewport 회귀 검증

저장 command, modal editing과 workspace contract는 어느 커밋에서도 변경하지 않는다. 실패하면 Account Map 단위만 마지막 검증 통과 상태로 되돌릴 수 있어야 한다.

## 8. Acceptance Criteria

- 같은 applied data, locations, Main, zoom과 viewport는 분리 전과 같은 visible nodes, edges, 순서와 좌표를 만든다.
- 가장 큰 active income total의 location이 desktop top-left와 mobile first slot이며 tie/no-anchor 규칙이 유지된다.
- amount 변경은 canonical rank 외 node dimensions와 edge styling을 바꾸지 않는다.
- focused 관계, edge amount label, 월 연결 구성 percentage와 accessible table 순서가 같은 graph model에서 파생된다.
- detail은 390px, 768px와 desktop에서 canvas/card 안에 있거나 canvas를 아래로 확장하며 node/action을 덮지 않는다.
- pointer, keyboard와 touch에서 transient/pinned/modal 단계가 유지된다.
- hover/focus는 final static detail, 새 pin은 one-shot motion이며 reduced-motion/Anime.js failure는 같은 final state를 표시한다.
- Main·Simulation·Portfolio slice는 Account Map 상호작용과 렌더링 전후 변경되지 않는다.

## 9. Required Verification

- `accountMapGraph`, layout policy, node placement, edge geometry, detail geometry와 canvas model focused unit
- `mapLayout.test.ts`의 기존 결과를 새 경계별 테스트로 이동하되 behavior assertion은 삭제하지 않음
- `AccountMapCanvas.test.tsx`, `accountMapConnectionDetail.test.ts`, `motion.test.ts`
- Account Map Playwright의 overview/default/detail, pan, hover/focus/pin/modal, 390px/768px/desktop containment
- workspace ownership 회귀와 Main·Simulation·Portfolio deep-equality focused test
- `npm run check`, 관련 unit, `npx playwright test tests/account-map.spec.ts`, 관련 cross-app E2E, `npm run build`, `git diff --check`
