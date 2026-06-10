# Phase 3: 시뮬레이션 차트 시각화 고도화 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 3-chart-visualization
**Areas discussed:** 차트 라이브러리 도입 여부, 툴팁 동작 방식, Y축 스케일 및 듀얼 축

---

## 차트 라이브러리 도입 여부

| Option | Description | Selected |
|--------|-------------|----------|
| 기존 SVG 고도화 | 툴팁/그리드 등을 직접 구현, 무거운 라이브러리 방지 | ✓ |
| 경량 라이브러리 | uPlot, Chart.js 등 No-build ESM 호환 라이브러리 도입 | |

**User's choice:** 1. 계속 보류
**Notes:** 기존 바닐라 구현을 계속 유지하며 차트 시각화를 개선.

---

## 모바일 툴팁 동작 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 차트 상/하단 고정 | 고정 영역에 툴팁 데이터 표시 (터치 영역 가리지 않음) | |
| 플로팅 (데이터 포인트 근처) | 터치(호버) 시 마우스 근처에 플로팅 툴팁 띄우기 | ✓ |

**User's choice:** 2. 플로팅 or 토스트
**Notes:** 사용자가 직접 포인트 근처 혹은 토스트 형태로 표시되기를 원함.

---

## Y축 스케일 및 듀얼 축

| Option | Description | Selected |
|--------|-------------|----------|
| 배당금 스케일 맞춤 | 배당금 변화를 보기 위해 축 기준 변경 | |
| 자산 단일 스케일 통합 | 자산 규모 기준으로 Y축 통합 유지 | ✓ |

**User's choice:** 3. 시뮬레이션은 어차피 자산을 보여주는거고 마우스 올렸을때 배당금 재투자하는 값이나 그런것만 호버 표시해주면되는거아닌가
**Notes:** 차트 시각적인 축은 자산에 맞추고 배당금 세부 사항은 툴팁을 활용하기로 함.

---

## the agent's Discretion
- 플로팅 툴팁의 구체적 위치 및 애니메이션 스타일, 토스트 형태 병행 고려.

## Deferred Ideas
없음.
