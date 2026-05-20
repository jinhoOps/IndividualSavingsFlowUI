# Phase 10: 백테스트 관련 기능 제거 및 이관 - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Source:** PRD Express Path (prd-10.md)

<domain>
## Phase Boundary

현재 프로젝트(`IndividualSavingsFlowUI`) 내에 포함되어 있는 백테스트 시뮬레이터 기능을 제거하고, 관련 자산을 `stock-snowball` 프로젝트로 이관하기 위한 작업을 수행합니다. `stock-snowball`은 독립된 백테스트 프로젝트로 운영될 예정입니다.
</domain>

<decisions>
## Implementation Decisions

### 제거 대상 기능
- `src/components/backtest/` 내의 전체 파일 제거 (AssetChart.tsx, BacktestDashboard.tsx, CalculationGuideModal.tsx, KpiGrid.tsx, PendingChangesBar.tsx, SimulationWarning.tsx)
- `src/core/backtest/` 내의 전체 파일 제거 (engine.test.ts, engine.ts, types.ts)
- `src/App.tsx`, `package.json` 또는 `index.html` 내에서 백테스트와 관련된 의존성, 라우팅, 네비게이션 항목 삭제
- `.planning/phases/07-backtest-simulator/` 관련 파일 보존 또는 아카이브 명시

### 이관 대상 
- `D:\jhkSandBox\CODE\stock-snowball\.planning` 에 백테스트 기능 설계 내용(CONTEXT, RESEARCH, PLAN 등)을 옮기거나, 관련 파일을 복사/이동
- 필요한 경우 `stock-snowball` 프로젝트의 초기 세팅에 참조할 수 있도록 파일 덤프 폴더를 구성하거나 스크립트를 작성하여 복사

### the agent's Discretion
- 파일 복사 시, `stock-snowball` 디렉토리가 존재하지 않을 경우 자동 생성 로직 필요 여부
- 기존 `07-backtest-simulator` 기획 문서를 `stock-snowball`의 `.planning` 구조에 맞게 이관하는 구체적 방법

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `.planning/ROADMAP.md` — Phase 10의 목표 정의

</canonical_refs>

<specifics>
## Specific Ideas

- 단순히 파일을 지우는 것에 그치지 않고, `stock-snowball` 개발자가 참고할 수 있도록 `src/components/backtest/` 와 `src/core/backtest/` 폴더 전체를 먼저 `stock-snowball` 프로젝트 내의 임시 저장소나 `.planning/archive` 등에 복사해 둡니다.
- 복사가 완료된 것을 확인한 후 `IndividualSavingsFlowUI` 에서 관련 코드를 안전하게 삭제합니다.

</specifics>

<deferred>
## Deferred Ideas

- `stock-snowball` 내에서의 기능 재구현 자체는 이 Phase의 범위를 벗어나며(해당 프로젝트에서 별도 진행), 본 Phase는 순수히 '이관(Migration 복사)' 및 '현재 레포지토리에서의 제거(Cleanup)'에 집중합니다.

</deferred>
