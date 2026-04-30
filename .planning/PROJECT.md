# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(예: 연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 복잡한 계산은 백그라운드에서 처리하고, 사용자는 시각화된 예산 흐름과 결과만 직관적으로 확인하며, 원할 경우 세부 카테고리 수동 입력으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ 월 가계 흐름 Sankey Diagram 시각화 엔진 — existing
- ✓ 카테고리별(수입/생활비/저축/투자) 수동 입력 및 뷰포트 UI — existing
- ✓ 바닐라 JS 기반 No-build 3계층 상태 관리(State/Helper/UI) 아키텍처 — existing
- ✓ IndexedDB 기반의 브리지 데이터 자동 백업 및 복원 — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] 연봉 수준 및 투자 스타일(공격적/안정적 등) 선택에 따른 프리셋 템플릿 로드 기능
- [ ] 템플릿 로드 시 표준 자산 흐름(수입 분배) 자동 계산 및 시각화 즉시 반영
- [ ] 생성된 템플릿에서 기존 카테고리별 세부 항목을 수동으로 조절하고 재계산하는 흐름 연결

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- [오픈뱅킹/마이데이터 계좌 자동 연동] — 미니멀하고 빠르며 독립적인 클라이언트(No-Build/PWA) 환경을 유지하는 것이 목표이며, 수동 입력을 통한 예산 '계획' 중심이므로 배제.

## Context

- 사용자의 입력 피로도를 줄이기 위해 프리셋 기능을 가장 전면에 내세웁니다.
- PWA와 Vanilla JS만으로 브라우저에서 가볍고 빠르게 동작해야 합니다.
- 금전 관련 수치는 UI에서는 만원, 내부 연산에서는 원 단위를 엄격히 지켜야 합니다.

## Constraints

- **[Tech]**: Vanilla JS, No-Build — 프레임워크나 빌드 도구 의존성 없이 지속 가능성 확보
- **[Design]**: Mobile-First 무결성 — 반응형 브레이크포인트 하단의 미디어 쿼리가 손상되지 않아야 함
- **[Data]**: 클라이언트 로컬 저장 — 서버리스, 오프라인 환경에서도 PWA를 통해 완벽히 동작해야 함

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 선 템플릿 제공, 후 세부 조절 UX | 극단적 단순화라는 가치를 지키기 위해 빈 화면부터 입력하는 대신, 완성된 흐름을 먼저 보여주고 편집하도록 유도 | — Pending |
| 단위 분리 (UI: 만원, 연산: 원) | UX 가독성과 데이터 정합성 사이의 타협 | ✓ Good |

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
*Last updated: 2026-04-30 after initialization*
