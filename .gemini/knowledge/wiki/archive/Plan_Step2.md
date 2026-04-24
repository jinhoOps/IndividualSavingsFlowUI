---
type: node
created: 2026-04-14
status: budding
tags: [plan, step2, roadmap]
---

# [DEPRECATED] 🗺️ Step2: 포트폴리오 구성 개발 계획 (Roadmap)

> [!WARNING]
> 본 문서는 v0.2.0 ~ v0.6.0 시절의 포트폴리오 구성 계획서입니다.
> v0.7.0 리팩터링을 통해 포트폴리오 구성 기능은 [[Plan_Step3]]로 이관되었으며, 
> Step 2는 **배당 시뮬레이션 전용**으로 개편되었습니다.
> 최신 설계 정보는 **[[Architecture_Reference]]**를 참조하십시오.

기준 시점: 2026-04-23 (v0.7.0)

## 1) 변경된 상태 요약
- **핵심 목표**: Step 1 투자 여력을 바탕으로 한 즉각적인 배당 복리 시뮬레이션 제공.
- **제거된 기능**: 계좌/자산군 CRUD, 도넛 차트, Sankey 흐름도 (Step 3로 이관).
- **유지된 기능**: Step 1 브리지 데이터 연동, 고성능 배당 시뮬레이션 엔진.

## 2) Step 2 최종 MVP 범위 (v0.7.0+)
- `S2-Sim-1`: 월 투자 가능 금액(Invest Capacity) 실시간 연동.
- `S2-Sim-2`: 4대 변수(Yield, DGR, CGR, DRIP) 기반 대시보드.
- `S2-Sim-3`: 명목 vs 실질 가치 비교 테이블 및 추이 그래프.

---
*연결 노드:* [[Plan_Step3]], [[Step2_Modularization_Refactoring]], [[Project_History]]
