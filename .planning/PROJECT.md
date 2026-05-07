<!-- generated-by: gsd-doc-writer -->
# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 12대 세부 항목 기반의 고해상도 프리셋 템플릿이 자동 적용되며, 사용자는 Sankey Diagram으로 시각화된 예산 흐름을 직관적으로 확인하고 세부 카테고리를 수동으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Current Milestone: v1.2 백테스트 시뮬레이터 및 자산 관리 확장

**Goal:** 주요 지수 백테스트 시뮬레이터를 구축하고, 포트폴리오 리밸런싱 도구를 통해 실제 자산 관리 여정을 완성하며, 부부 통합 허브를 통한 가계 관리를 확장한다.

**Target features:**
- Step 4 백테스트 시뮬레이션 엔진 및 React 대시보드 구축 (Pending Polish - MoneyUtils.formatMan 적용 완료)
- Step 3 포트폴리오 리밸런싱 가이드 및 자산 관리 (v0.9.5 완료)
- 지출 데이터 과거 비교 분석 및 스냅샷 관리 (In Progress - UI 미구현)
- Phase 9: 신혼부부 통합 허브 (In Progress)

## Current State

**Shipped:** v0.9.19 (2026-05-10)
**Tech Stack:** Modern Hybrid (Vite/TS/Tailwind v4), React 19, PWA, IndexedDB
**Codebase:** Step 1/2 (JS Modules), Step 3 (JS/TS), Step 4 (React Components)
**Key Feature:** 백테스트(Step 4, 고도화 중) + 현금흐름(Step 1) + 배당시뮬(Step 2) + 자산관리(Step 3) + 지출비교(UI 개발 중)

## Requirements

### Validated

- ✓ 월 가계 흐름 Sankey Diagram 시각화 엔진 — Phase 1
- ✓ 바닐라 JS 기반 No-build 지향 (Modern Hybrid) 아키텍처 — Phase 2
- ✓ IndexedDB 기반 데이터 허브 및 백업 — Phase 4
- ✓ Step 1 첫 접속 Spotlight UX 온보딩 가이드 — Phase 5 (v0.8.3)
- ✓ Step 3: 포트폴리오 리밸런싱 가이드 및 자산 관리 — Phase 6 (v0.9.5)
- ✓ Step 4: 레버리지 자산 및 청산 로직 구현 — Phase 7 (v0.9.7)
- ✓ Step 2 테이블 헤더 간소화 및 가독성 개선 — Phase 6 (v0.9.14)

### Active

- [ ] Phase 7: 백테스트 시뮬레이션 엔진 (CAGR, IRR, MDD, TR) 고도화 (MoneyUtils.formatMan 적용 완료, 추가 작업 필요)
- [ ] Phase 7: React 기반 상대 비교 차트 및 KPI 대시보드 Polish
- [ ] Phase 8: 지출 데이터 스냅샷 저장 및 관리 시스템 (UI 미구현)
- [ ] Phase 8: 지출 데이터 과거 비교 Grouped Bar Chart — 카테고리별 [이전] vs [현재] 비교 시각화 (UI 미구현)
- [ ] Phase 9: 신혼부부 통합 허브 (Issue #2) — 부부 간 데이터 해시 병합 및 통합 Sankey 렌더링
- [ ] 시뮬레이션 차트 고도화 — 영역 채우기(Area Fill), 그리드 최적화, 모바일 터치 대응 강화
- [ ] Smart Clipboard Parser — 은행/카드 문자 자동 파싱 엔진 개발

### Out of Scope

- [오픈뱅킹/마이데이터 계좌 자동 연동] — 미니멀하고 빠르며 독립적인 클라이언트(No-Build/PWA) 환경을 유지하는 것이 목표이며, 수동 입력을 통한 예산 '계획' 중심이므로 배제.
- [오프라인 모드] — PWA 서비스 워커로 기본 오프라인 지원은 있으나, 완전한 오프라인 전용 모드는 현재 범위 밖.

## Context

- v1.1 출시 완료: Spotlight 온보딩, KPI 대시보드 고도화, PWA 안정화.
- v1.2 진행 중: 백테스트 엔진(Step 4) 고도화 및 자산 관리(Step 3) 도구의 유기적 연결.
- 사용자 입력 피로도를 줄이기 위해 프리셋 기능을 가장 전면에 배치.
- PWA와 Vanilla JS만으로 브라우저에서 가볍고 빠르게 동작하며, 복잡한 대시보드는 React로 전환 중.

## Constraints

- **[Tech]**: Modern Hybrid (No-Build Oriented) — 프레임워크나 빌드 도구 의존성 없이 지속 가능성을 확보하되, 타입 안정성과 DX를 위해 Vite/TS/Tailwind 인프라를 적극 수용함.
- **[Design]**: Mobile-First 무결성 — 반응형 브레이크포인트 하단의 미디어 쿼리가 손상되지 않아야 함.
- **[Data]**: 클라이언트 로컬 저장 — 서버리스, 오프라인 환경에서도 PWA를 통해 완벽히 동작해야 함.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 선 템플릿 제공, 후 세부 조절 UX | 극단적 단순화라는 가치를 지키기 위해 빈 화면부터 입력하는 대신, 완성된 흐름을 먼저 보여주고 편집하도록 유도 | ✓ Good |
| 단위 분리 (UI: 만원, 연산: 원) | UX 가독성과 데이터 정합성 사이의 타협 | ✓ Good |
| 반올림 오차 보정 (첫 번째 항목 흡수) | 세부 항목 합산이 카테고리 총액과 정확히 일치하도록 보장 | ✓ Good |
| TDD 기반 금융 연산 엔진 (Step 4) | CAGR, IRR, MDD 등 복잡한 금융 수식의 정확성을 담보하기 위해 테스트 주도 개발 도입 | ✓ Good |
| React 도입 (Step 4) | 복잡한 상태 관리와 동적 차트 렌더링이 필요한 백테스트 대시보드의 개발 효율성을 위해 React 프레임워크 부분 수용 | ✓ Good |
| 지연 적용 (Pending Bar) 패턴 | 대량의 시뮬레이션 연산이 수반되는 설정 변경 시 UX 끊김을 방지하고 사용자의 명시적 적용을 유도 | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-10 after v0.9.19 status update*
