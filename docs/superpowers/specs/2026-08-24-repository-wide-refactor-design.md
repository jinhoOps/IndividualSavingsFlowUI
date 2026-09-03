# Repository-wide Refactor Design

**Date:** 2026-08-24

**Status:** Approved; Phases 2–4 code gates complete with evidence, Task 8 final repository-wide verification pending

**Scope:** Main·Simulation·Portfolio·Account Map과 공통 UI/인프라의 단계적 구조 리팩터링

## 1. Goal

현재 지원 제품의 관찰 가능한 동작과 데이터 계약을 유지하면서, 앱별 오케스트레이션·공통 UI·시각화 계산·저장 경계를 명확히 나눈다. Account Map에서 확인된 대형 조정 파일을 출발점으로 삼되, 한 앱의 국소 정리에 그치지 않고 네 앱이 공유하는 기반과 반복되는 구조를 같은 기준으로 정리한다.

리팩터링은 기능 추가나 시각 재설계가 아니다. 각 단계는 현재 테스트와 반응형 계약을 기준으로 동작 동등성을 증명한 뒤 다음 단계로 넘어간다.

## 2. Product and Data Boundaries

다음 계약은 리팩터링 중에도 변경하지 않는다.

- Main은 다섯 월간 금액의 유일한 편집 소유자다.
- Simulation과 Portfolio는 최신 Main을 읽기 전용으로 사용한다.
- Account Map은 최신 Main을 읽기 전용으로 사용하고 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- Account Map은 Main·Simulation·Portfolio에 write-back하지 않는다.
- Portfolio는 aggregate 배분과 자기 slice를 소유하며 Account Map의 위치 관리 UI를 재사용하지 않는다.
- current workspace schema/key, revision/conflict 의미, URL과 앱 탐색 순서는 current contract와 호환성 evidence를 함께 갱신할 때만 변경한다.
- 390px, 768px, desktop의 여백·overflow·focus·touch target·시각화 가시성 계약은 유지한다.

## 3. Non-goals

- 새로운 금융 기능, 계좌번호·잔액·거래 연동, Portfolio-Account Map 연결
- 제품 문구·목표 계산·시뮬레이션 알고리즘의 변경
- 공통 `BaseApp` 또는 모든 앱을 감싸는 거대한 generic hook 도입
- 레거시 코드를 증거 없이 삭제
- `artifacts/`의 읽기·수정·커밋

## 4. Delivery Strategy

전체 작업은 단계적 혼합형으로 진행하며, 첫 구현 단계는 공통 계층을 우선 정리한다. 각 단계는 독립적으로 검증·롤백할 수 있는 작은 PR 또는 논리적 커밋 묶음으로 유지한다.

### Phase 0 — Baseline and inventory

1. 현재 `origin/main`을 기준으로 `npm run check`, 전체 unit/E2E, production build의 기준 결과를 기록한다.
2. CodeGraph와 정적 참조 검색으로 공통 컴포넌트, 저장소, 라우트, legacy runtime import, selector, storage key, 테스트 fixture를 목록화한다.
3. 각 후보에 owner, consumer, 현재 테스트, 제거 조건을 붙인다.
4. 지원 경로와 legacy 경로를 문서상 분리하고, 이 단계에서는 소스 동작을 바꾸지 않는다.

### Phase 1 — Shared foundation first

실제 두 곳 이상에서 중복 사용되는 안정된 계약만 기존 공통 계층에 흡수한다.

- `AppShell`, 앱 탐색, 페이지 프레임, 공통 가로 여백과 overflow containment
- Button, Surface, 메시지, 모달의 시각·접근성 기반
- reduced-motion, focus restore, delayed pending과 공통 motion token
- 금액·날짜·접근성 라벨의 순수 포맷터
- workspace 저장 결과의 공통 성공/conflict/failure 표현과 revision 전달 규칙

공통 계층은 도메인 상태나 저장 write를 소유하지 않는다. 소비자가 하나뿐인 컴포넌트는 앱 내부에 둔다. `src/components/common`, `src/components/motion`, `src/components/feedback`, 기존 workspace 인프라의 경계를 우선 활용하고, 새 `shared` 디렉터리는 실제 공통 계약이 생길 때만 만든다.

### Phase 2 — Application orchestration

앱 화면은 `domain → application → ui` 흐름을 유지하면서 조정 파일의 책임을 나눈다.

- Main: 734줄의 `MainApp`에서 bootstrap/repository effect, setup command, dashboard view model, management effect를 단계적으로 분리한다. Main의 다섯 값 편집과 review/assembly 순서는 `MainApp`이 계속 최종 조정한다.
- Account Map: `AccountMapApp`에서 저장·충돌·복구 command와 modal/restore view model을 분리한다. `AccountMapCanvas`는 지도 상호작용과 표시 조정만, `AccountMapSetup`은 setup 입력과 draft 표시만 담당한다.
- Portfolio: `PortfolioApp`의 repository/plan command와 summary/edit surface 조정을 분리하되 Portfolio slice ownership은 유지한다.
- Simulation: onboarding 입력·projection command·summary/chart view model을 분리하되 복리 계산과 목표 헤드라인 의미는 변경하지 않는다.

추출된 모듈은 UI 이벤트를 직접 저장하지 않고 명시적인 command/result와 typed callback을 통해 앱 조정자와 통신한다. 비동기 저장은 기존 revision/conflict 처리를 유지하고, 입력·modal·recovery 상태를 초기화하지 않는다.

### Phase 3 — Visualization and motion boundaries

시각화는 순수 계산과 DOM/SVG 렌더링을 분리한다.

Phase 3는 다음 세 상세 명세를 Main → Simulation → Account Map 순서의 독립 구현·검증·rollback 단위로 수행한다.

- [Main Visualization Boundary Refactor Design](2026-09-01-main-visualization-boundary-design.md)
- [Simulation Chart Boundary Refactor Design](2026-09-01-simulation-chart-boundary-design.md)
- [Account Map Visualization Boundary Refactor Design](2026-09-01-account-map-visualization-boundary-design.md)

- Account Map의 `buildAccountMapGraph`와 `layoutAccountMap`을 graph model, responsive layout, node placement 단위로 나누고 순수 테스트를 유지한다.
- Simulation의 projection/chart geometry와 `GrowthChart` 렌더링을 분리한다.
- Main의 cashflow bar/donut geometry와 실제 표시 컴포넌트를 분리한다. 초과 비율의 의도된 연장, viewport clipping, review-only bar 표시 규칙은 geometry 테스트와 E2E로 고정한다.
- Anime.js는 공통 lifecycle/reduced-motion 경계를 통해 호출하고, 앱별 연출 순서·최초 방문/처음부터 다시 조건은 해당 앱이 소유한다.

시각화 리팩터링은 색상·문구·레이아웃을 임의로 바꾸지 않는다. 계산 결과가 같은지와 실제 DOM이 컨테이너를 벗어나지 않는지를 함께 검증한다.

### Phase 4 — Legacy disposition and removal

Phase 0의 목록을 기준으로 다음 순서를 지킨다.

1. 지원 경로에서 legacy import, route, selector, storage key 소비가 없는지 검색한다.
2. 필요한 구데이터·backup·fixture 호환성을 focused test로 입증한다.
3. 대체 구현과 rollback 근거를 문서화한다.
4. 한 묶음씩 삭제하고 type/unit/E2E/build 및 참조 검색을 다시 실행한다.

증거가 부족한 legacy는 제거하지 않고 “보존 이유·소유자·다음 제거 조건”을 기록한다.

### Completion status (2026-09-03)

- [x] Phase 2 application-orchestration gates are complete with their focused code and verification evidence.
- [x] Phase 3 visualization/motion boundary gates are complete with their focused code and verification evidence.
- [x] Phase 4 code gates are complete: strict v3 persistence, read-only v1/v2 conversion and rollback-source preservation, format-v2 backup, supported-route closure, replacement tests, and the classified runtime deletion are recorded in the Phase 4 evidence and implementation reports.
- [ ] Task 8 independently reruns final repository-wide verification. This status records completed phase code gates and evidence only; it does not claim that final rerun.

## 5. Module Rules

- domain 모듈은 React, DOM, 저장소를 import하지 않는다.
- application 모듈은 저장소와 reducer/command를 조정하지만 화면 markup을 만들지 않는다.
- ui 모듈은 application command를 callback으로 받고 직접 localStorage를 호출하지 않는다.
- 공통 컴포넌트는 앱별 문구·도메인 상태·write ownership을 알지 못한다.
- pure geometry/formatting은 입력과 출력이 명확한 함수로 유지하고, 브라우저 의존성은 렌더러에 둔다.
- 모듈을 이동할 때 기존 public import 경로가 두 곳 이상이면 한 단계 동안 re-export를 유지하고 소비자를 옮긴 뒤 제거한다.
- 파일 분할은 책임을 기준으로 하며, 단순히 줄 수만 맞추기 위한 추출은 하지 않는다.

## 6. Verification Matrix

각 단계에서 변경 표면에 맞는 검증을 통과해야 한다.

| 표면 | 필수 검증 |
| --- | --- |
| 공통 TypeScript/계약 | `npm run check`, 영향 소비자 focused unit |
| Main·Simulation·Portfolio·Account Map 흐름 | 관련 unit + `npm run test:e2e` |
| 시각화·motion | geometry/motion unit, reduced-motion, 관련 Playwright |
| UI 공통 계층 | 390×844, 768×1024, 1280×900에서 여백·overflow·focus·touch target·visibility |
| storage/import/backup | focused compatibility tests와 atomic failure 검증 |
| legacy 제거 | runtime import/route/selector/storage key 검색, 전체 type/unit/E2E/build |
| 문서 | 상대 링크, `git diff --check`, PRD·DESIGN·승인 spec 상태 대조 |

완료 보고에는 변경 파일·계약 영향·실행 명령과 결과·의도적 skip·남은 위험을 포함한다. 검증 실패는 해결하거나 미해결로 명시하며 성공으로 요약하지 않는다.

## 7. Risks and Rollback

- 공통 추출로 앱별 spacing이나 focus order가 바뀔 위험: 추출 전후 DOM/viewport snapshot과 focused accessibility 검증을 비교한다.
- 저장 command 추출 중 stale conflict 입력이 사라질 위험: conflict fixture에서 input/modal/recovery state 보존을 검증한다.
- geometry 분리 중 초과 막대가 viewport를 탈출할 위험: desired/visible/clipped 값을 pure test와 desktop/mobile E2E에서 확인한다.
- legacy 삭제로 구데이터가 사라질 위험: parser/backup round-trip과 raw preservation 테스트가 통과하기 전 삭제하지 않는다.
- 단계별 실패 시 마지막 검증 통과 커밋으로 되돌릴 수 있도록 각 phase를 독립 커밋/PR로 유지한다.

## 8. Acceptance Criteria

- 네 지원 앱의 제품 동작·데이터 ownership·URL과 current storage contract가 evidence-backed migration 이외의 이유로 변경되지 않는다.
- 공통 UI/feedback/motion 계약이 단일 기준으로 사용되고 앱별 중복은 근거와 함께 제거된다.
- 대형 조정 파일은 책임별 모듈로 나뉘며 각 모듈의 경계와 테스트가 명확하다.
- 시각화 계산은 순수 테스트로 검증되고, 실제 렌더링은 390px·768px·desktop에서 containment와 visibility를 통과한다.
- 레거시는 참조·호환성·회귀 증거가 있는 항목만 제거된다.
- PRD, DESIGN, AGENTS와 승인 spec의 현재 제품 상태 주장이 코드·테스트 결과와 일치한다.
