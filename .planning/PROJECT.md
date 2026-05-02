# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 12대 세부 항목 기반의 고해상도 프리셋 템플릿이 자동 적용되며, 사용자는 Sankey Diagram으로 시각화된 예산 흐름을 직관적으로 확인하고 세부 카테고리를 수동으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Current Milestone: v1.1 시뮬레이션 고도화 및 온보딩 UX

**Goal:** 배당 시뮬레이션 대시보드의 정보 밀도를 높이고, Step 1 첫 접속 사용자를 위한 입력 가이드를 제공한다.

**Target features:**
- 시뮬레이션 차트 고도화 (데이터 포인트, 호버 툴팁, Y축 눈금/그리드, 영역 채우기, KPI 요약 카드)
- Step 2 테이블 헤더 간소화 (불필요한 만원 표기 제거)
- Step 1 첫 접속 Spotlight UX 온보딩 가이드

## Current State

**Shipped:** v1.0 (2026-05-03)
**Tech Stack:** Vanilla JS, No-Build PWA, IndexedDB, Sankey Diagram
**Codebase:** ~1,200 LOC (JavaScript), Mobile-First 반응형
**Key Feature:** 연봉/투자 성향 기반 고해상도 프리셋 템플릿 로드 → 시각화 → 세부 편집 → 영속화

## Requirements

### Validated

- ✓ 월 가계 흐름 Sankey Diagram 시각화 엔진 — existing
- ✓ 카테고리별(수입/생활비/저축/투자) 수동 입력 및 뷰포트 UI — existing
- ✓ 바닐라 JS 기반 No-build 3계층 상태 관리(State/Helper/UI) 아키텍처 — existing
- ✓ IndexedDB 기반의 브리지 데이터 자동 백업 및 복원 — existing
- ✓ 연봉 수준 및 투자 스타일 선택에 따른 프리셋 템플릿 로드 기능 — v1.0
- ✓ 템플릿 로드 시 표준 자산 흐름 자동 계산 및 시각화 즉시 반영 — v1.0
- ✓ 세부 항목 수동 조절 및 재계산 흐름 — v1.0
- ✓ 고해상도 12대 세부 항목 기반 프리셋 데이터 — v1.0

### Active

- [ ] 시뮬레이션 차트 고도화 — 데이터 포인트, 호버 툴팁, Y축 눈금/그리드, 영역 채우기
- [ ] KPI 요약 카드 — 최종 자산, 최종 연 배당금, 누적 수익률 등 핵심 지표 시각화
- [ ] Step 2 테이블 헤더 간소화 — 불필요한 (만원) 표기 제거
- [ ] Step 1 첫 접속 Spotlight UX 온보딩 가이드

### Out of Scope

- [오픈뱅킹/마이데이터 계좌 자동 연동] — 미니멀하고 빠르며 독립적인 클라이언트(No-Build/PWA) 환경을 유지하는 것이 목표이며, 수동 입력을 통한 예산 '계획' 중심이므로 배제.
- [오프라인 모드] — PWA 서비스 워커로 기본 오프라인 지원은 있으나, 완전한 오프라인 전용 모드는 현재 범위 밖.

## Context

- v1.0 출시 완료: 프리셋 선택 → 시각화 → 편집 → 영속화 전체 흐름 구축.
- 사용자 입력 피로도를 줄이기 위해 프리셋 기능을 가장 전면에 배치.
- PWA와 Vanilla JS만으로 브라우저에서 가볍고 빠르게 동작.
- 금전 관련 수치는 UI에서는 만원, 내부 연산에서는 원 단위를 엄격히 준수.

## Constraints

- **[Tech]**: Vanilla JS, No-Build — 프레임워크나 빌드 도구 의존성 없이 지속 가능성 확보
- **[Design]**: Mobile-First 무결성 — 반응형 브레이크포인트 하단의 미디어 쿼리가 손상되지 않아야 함
- **[Data]**: 클라이언트 로컬 저장 — 서버리스, 오프라인 환경에서도 PWA를 통해 완벽히 동작해야 함

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 선 템플릿 제공, 후 세부 조절 UX | 극단적 단순화라는 가치를 지키기 위해 빈 화면부터 입력하는 대신, 완성된 흐름을 먼저 보여주고 편집하도록 유도 | ✓ Good |
| 단위 분리 (UI: 만원, 연산: 원) | UX 가독성과 데이터 정합성 사이의 타협 | ✓ Good |
| 프리셋 적용 시 고급 설정 자동 노출 | 사용자가 세부 편집 가능하다는 점을 즉시 인지하도록 유도 | ✓ Good |
| 12대 세부 항목 기반 고해상도 템플릿 | 단일 항목 대비 현실적 가계 시뮬레이션 가능, 기존 API 변경 없이 데이터만 교체 | ✓ Good |
| 반올림 오차 보정 (첫 번째 항목 흡수) | 세부 항목 합산이 카테고리 총액과 정확히 일치하도록 보장 | ✓ Good |
| 마일스톤 버전 = 앱 버전 (v1.0 이후) | v1.0은 계획 레이블로 유지, 다음 마일스톤부터 앱 버전(0.8.x)과 통일 | — Pending |
| 경량 차트 라이브러리 허용 (v1.1) | DESIGN.md 원칙(Glassmorphism, ISF 팔레트, No-build ESM)을 준수하는 경량 라이브러리에 한해 도입 가능 | — Pending |

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
*Last updated: 2026-05-03 after v1.1 milestone start*
