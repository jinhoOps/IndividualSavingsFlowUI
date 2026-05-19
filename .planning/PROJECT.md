# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 12대 세부 항목 기반의 고해상도 프리셋 템플릿이 자동 적용되며, 사용자는 Sankey Diagram으로 시각화된 예산 흐름을 직관적으로 확인하고 세부 카테고리를 수동으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Current Milestone: v1.4 코어 안정화 및 UX 고도화 (Phase 11~12)

**Goal:** 시스템의 물리적/데이터 무결성을 확보하고, Step 1~3 전반의 UX 일관성을 고도화한다.

**Target features:**
- 전역 스타일 가이드 통합 (shared/styles/step-theme.css)
- 보안 강화 (XSS 방어 및 데이터 Sanitize)
- 메모리 및 성능 최적화 (이벤트 리스너 관리, Sankey 렌더링 최적화)
- Step 1 'Smart Add' 및 부부 데이터 병합 안정성 확보

## Current State

**Shipped:** v0.10.0 (2026-05-12)
**Tech Stack:** Modern Hybrid (Vite/TS/Tailwind), React 19 (Partial), PWA, IndexedDB
**Codebase:** ~2,500 LOC (JavaScript/TS), Mobile-First 반응형
**Key Feature:** 프리셋 기반 시각화 + 데이터 허브(백업/복원) + 부부 데이터 병합 + 포트폴리오 리밸런싱

## Requirements

### Validated

- ✓ 연봉/투자 스타일 프리셋 로드 및 시각화 (v1.0)
- ✓ 시뮬레이션 차트 고도화 (데이터 포인트, 툴팁, KPI 카드) (v1.1)
- ✓ Step 1 Spotlight UX 온보딩 가이드 (v1.1)
- ✓ IndexedDB 기반 브리지 데이터 자동 백업/복원 (v1.0)
- ✓ 백테스트 기능 이관 및 제거 (Phase 10)
- ✓ 보안(XSS) 및 메모리 누수 방지 (v0.10.0)

### Active

- [ ] **STAB-01**: 전역 스타일 가이드 정립 및 Step 간 UI 일관성 확보
- [ ] **STAB-02**: 데이터 검증 로직 강화 및 PWA 오프라인 동기화 예외 처리
- [ ] **ADV-01**: Sankey 및 시뮬레이션 엔진 렌더링 최적화
- [ ] **ADV-02**: 다국어 지원을 위한 리소스 분리 및 브릿지 설계

### Out of Scope

- [백테스트 시뮬레이터] — `stock-snowball` 프로젝트로 이관됨.
- [실시간 시세 연동] — 정적 데이터 및 수동 계획 중심 철학 유지.

## Context

- v0.10.0 릴리즈 완료: Phase 10(백테스트 이관) 이후 시스템 안정화에 집중.
- 실험적 기능(AI, 백테스트)을 제거하여 코어 엔진의 신뢰성 확보.
- PWA와 Vanilla JS/React 하이브리드 구조로 전환 중.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 백테스트 기능 이관 (Phase 10) | 프로젝트 복잡도 감소 및 코어 안정성 집중을 위해 stock-snowball 프로젝트로 분리 | ✓ Good |
| AI 기능 제거 | 실험적 기능보다 데이터 무결성과 정적 웹의 신뢰성이 우선됨 | ✓ Good |
| 전역 스타일 공유 (shared/styles) | Step 간 디자인 파편화를 막고 유지보수 효율 증대 | ✓ Good |
| React 19 점진적 도입 | 복잡한 UI 상태 관리 및 타입 안정성을 위해 현대적 스택으로 전환 시작 | — Ongoing |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-19 for v1.4 Milestone Audit*

