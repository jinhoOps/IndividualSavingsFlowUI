<!-- generated-by: gsd-doc-writer -->
# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 12대 세부 항목 기반의 고해상도 프리셋 템플릿이 자동 적용되며, 사용자는 Sankey Diagram으로 시각화된 예산 흐름을 직관적으로 확인하고 세부 카테고리를 수동으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Next Milestone: v1.3 지능형 자산 관리 및 자문 (AI Integration)

**Goal:** LLM 기반의 지출 패턴 분석 및 절세 가이드를 제공하고, 실시간 시장 데이터 연동을 통해 개인화된 자산 관리 경험을 고도화한다.

**Target features:**
- AI 기반 지출 카테고리 분석 및 자동 최적화 제안
- 금융소득종합과세 및 절세 시나리오 AI 자문
- 실시간 시장 데이터 연동 API 탐색

## Current State

**Shipped:** v0.9.45 (2026-05-11)
**Tech Stack:** Modern Hybrid (Vite/TS/Tailwind v4), React 19, PWA, IndexedDB
**Codebase:** Step 1/2 (JS Modules), Step 3 (JS/TS), Step 4 (React Components)
**Key Feature:** 백테스트(Step 4) + 현금흐름(Step 1) + 배당시뮬(Step 2) + 자산관리(Step 3) + 지출비교(활성화) + 부부병합(Harmony Hub)

## Requirements

### Validated

- ✓ 월 가계 흐름 Sankey Diagram 시각화 엔진 — Phase 1
- ✓ 바닐라 JS 기반 No-build 지향 (Modern Hybrid) 아키텍처 — Phase 2
- ✓ IndexedDB 기반 데이터 허브 및 백업 — Phase 4
- ✓ Step 1 첫 접속 Spotlight UX 온보딩 가이드 — Phase 5 (v0.8.3)
- ✓ Step 3: 포트폴리오 리밸런싱 가이드 및 자산 관리 — Phase 6 (v0.9.5)
- ✓ Step 4: 백테스트 시뮬레이터 및 고성능 연산 엔진 — Phase 7 (v0.9.42)
- ✓ 지출 데이터 과거 비교 분석 (Grouped Bar Chart) — Phase 8 (v0.9.43)
- ✓ 신혼부부 통합 허브 (Newlywed Harmony Hub) — Phase 9 (v0.9.44)

### Active

- [ ] 시뮬레이션 차트 고도화 — 영역 채우기(Area Fill), 그리드 최적화
- [ ] UI/UX 애니메이션 및 피드백 디테일 강화

### Out of Scope

- [오픈뱅킹/마이데이터 계좌 자동 연동] — 미니멀하고 빠르며 독립적인 클라이언트(No-Build/PWA) 환경을 유지하는 것이 목표이며, 수동 입력을 통한 예산 '계획' 중심이므로 배제.
- [오프라인 모드] — PWA 서비스 워커로 기본 오프라인 지원은 있으나, 완전한 오프라인 전용 모드는 현재 범위 밖.

## Context

- v1.2 출시 완료: 백테스트 엔진 고도화, 과거 지출 비교, 부부 통합 허브 구축.
- 사용자 입력 피로도를 줄이기 위해 프리셋 및 클립보드 파서 기능을 강화함.
- PWA와 Vanilla JS만으로 브라우저에서 가볍고 빠르게 동작하며, 복잡한 대시보드는 React로 운영.

## Constraints

- **[Tech]**: Modern Hybrid (No-Build Oriented) — Vite/TS/Tailwind 인프라를 활용하되 프레임워크 의존성을 최소화.
- **[Design]**: Mobile-First 무결성 — 반응형 레이아웃 및 미디어 쿼리 보존.
- **[Data]**: 클라이언트 로컬 저장 — 서버리스, 오프라인 환경에서도 PWA를 통해 동작.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 선 템플릿 제공, 후 세부 조절 UX | 극단적 단순화라는 가치를 지키기 위해 빈 화면부터 입력하는 대신, 완성된 흐름을 먼저 보여주고 편집하도록 유도 | ✓ Good |
| 단위 분리 (UI: 만원, 연산: 원) | UX 가독성과 데이터 정합성 사이의 타협 | ✓ Good |
| 반올림 오차 보정 (첫 번째 항목 흡수) | 세부 항목 합산이 카테고리 총액과 정확히 일치하도록 보장 | ✓ Good |
| TDD 기반 금융 연산 엔진 (Step 4) | CAGR, IRR, MDD 등 복잡한 금융 수식의 정확성을 담보하기 위해 테스트 주도 개발 도입 | ✓ Good |
| React 도입 (Step 4) | 복잡한 상태 관리와 동적 차트 렌더링이 필요한 백테스트 대시보드 개발 효율성 | ✓ Good |
| 지연 적용 (Pending Bar) 패턴 | 대량 연산 시 UX 끊김 방지 및 사용자의 명시적 적용 유도 | ✓ Good |
| 클립보드 파서 (Phase 9) | 모바일 입력 편의성을 극대화하기 위한 카드/은행 문자 자동 파싱 도입 | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-11 after Milestone v1.2 completion*
