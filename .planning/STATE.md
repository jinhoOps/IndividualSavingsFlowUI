---
milestone: "v1.3"
name: "지능형 자산 관리 및 자문"
status: "in-progress"
progress:
  completed_phases: 9
  total_phases: 12
---

# Project State

## Current Position

Phase: 10
Plan: 01 (Engine Design)
Status: In-Progress
Last activity: 2026-05-11 — Milestone v1.2 finalized. Initiated Phase 10 (AI Integration) research and core engine planning.

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과 제공
**Current focus:** Phase 10 AI Integration - Architecture & Core Engine

## Key Decisions
- **Step 4 (React/TS)**: 복잡한 대시보드 구현을 위해 React 19와 TypeScript를 표준으로 도입함. (D-01, D-03)
- **Leverage & Liquidation**: 레버리지 자산(QLD, TQQQ)의 변동성 드래그 및 원금 전액 손실(청산) 로직을 엔진에 반영함. (v0.9.7)
- **Static Data Architecture**: 과거 데이터의 안정적 처리를 위해 정적 JSON 파일 방식을 채택함. (D-02)
- **Relative Comparison**: 자산 간 성과 비교를 극대화하기 위한 상대 비교 모드를 핵심 UI 기능으로 정의함. (BACK-04)
- **Snapshot Comparison**: 과거와 현재의 지출 패턴을 비교하기 위한 시뮬레이션 도입 예정 (Phase 08).
