# IndividualSavings Flow UIUX

## What This Is

개인 자산 흐름 프로젝트는 사용자가 극단적으로 단순화된 입력(연봉, 투자 성향 프리셋 선택)만으로 자신의 전체 가계 흐름과 자산 배분 계획을 한눈에 볼 수 있도록 돕는 미니멀한 UI/UX 도구입니다. 12대 세부 항목 기반의 고해상도 프리셋 템플릿이 자동 적용되며, 사용자는 Sankey Diagram으로 시각화된 예산 흐름을 직관적으로 확인하고 세부 카테고리를 수동으로 조절할 수 있습니다.

## Core Value

단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## Current State

**Shipped:** v1.8 Phase 07 (2026-06-17)
**Tech Stack:** Modern Hybrid (Vite/TS/Tailwind), React 19 (Partial), PWA, IndexedDB
**Codebase:** ~3,000 LOC (JavaScript/TS), Mobile-First 반응형
**Key Features:** 프리셋 기반 시각화 + 데이터 허브(백업/복원) + 부부 데이터 병합 + 포트폴리오 리밸런싱 + Step 1/2 모듈러 아키텍처 현대화 + 통장 쪼개기 계좌 관리 + 고해상도 PNG 저장

---

## Current Milestone: v1.8 적립식 포트폴리오 관리 및 전체 UI/UX 개선

**Goal:** Step 3 포트폴리오 영속화를 완료하고, 이를 기반으로 Step 1과 Step 2의 UI/UX를 전면 개선하여 일관된 에디토리얼 피드백 시스템을 완성한다.

**Target features:**
- Step 1 UI/UX 리팩터링 및 컨트롤러 모듈화 완료
- Step 2 목표 중심 재기획 및 에디토리얼 레이아웃 구현
- 포트폴리오 저장 허브와 단계 간 피드백 흐름 통합

---

## Requirements Evolution

### Validated (Shipped)

- ✓ 연봉/투자 스타일 프리셋 로드 및 시각화 (v1.0)
- ✓ 시뮬레이션 차트 고도화 (데이터 포인트, 툴팁, KPI 카드) (v1.1)
- ✓ Step 1 Spotlight UX 온보딩 가이드 (v1.1)
- ✓ IndexedDB 기반 브리지 데이터 자동 백업/복원 (v1.0)
- ✓ 백테스트 기능 이관 및 제거 (Phase 10)
- ✓ 보안(XSS) 및 메모리 누수 방지 (v1.4)
- ✓ Step 2 아키텍처 현대화 및 모듈화 통합 (v1.4)
- ✓ 전역 디자인 가이드라인 정립 (DESIGN.md 수립) (v1.4)
- ✓ 3계층 구조(상태/헬퍼/UI) 모듈화 및 단위/무결성 오류 수정 (v1.6)
- ✓ DESIGN.md 기반 ISF Pearl 캔버스 및 Glass Panel 컴포넌트 이식 (v1.6)
- ✓ 768px 모바일 반응형 레이아웃 개선 및 줌/리사이즈 대응 (v1.6)
- ✓ SVG ➔ 2배 고해상도 PNG 이미지 내보내기 및 공유 기능 (v1.6)
- ✓ 수입/지출 통장 쪼개기(계좌 관리) 모델 및 4단계 레이어 Sankey 자동 연산 (v1.6)
- ✓ PORT-02: 포트폴리오(계좌/종목) 고도화 및 비중 관리 기능 이식 — Phase 5
- ✓ UI-01/UI-02: Step 1 DESIGN.md 기반 Pearl 캔버스 적용, CSS 감축, 컨트롤러 모듈화, 안전 렌더링, 모바일 회귀 검증 — Phase 7

### Active (Next Milestone: v1.8)

- [ ] **UI-03**: Step 2 목표 중심 재기획 및 에디토리얼 레이아웃 구현

### Out of Scope

- [백테스트 시뮬레이터] — `stock-snowball` 프로젝트로 이관됨.
- [실시간 시세 연동] — 정적 데이터 및 수동 계획 중심 철학 유지.

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 백테스트 기능 이관 (Phase 10) | 프로젝트 복잡도 감소 및 코어 안정성 집중을 위해 stock-snowball 프로젝트로 분리 | ✓ Good |
| AI 기능 제거 | 실험적 기능보다 데이터 무결성과 정적 웹의 신뢰성이 우선됨 | ✓ Good |
| 전역 스타일 공유 (shared/styles) | Step 간 디자인 파편화를 막고 유지보수 효율 증대 | ✓ Good |
| React 19 점진적 도입 | 복잡한 UI 상태 관리 및 타입 안정성을 위해 현대적 스택으로 전환 시작 | — Ongoing |
| Step 2 모듈화 및 컨트롤러 이식 | Step 1 모듈화 사양과 일관성 유지 및 app.js 경량화 | ✓ Good |
| 수동 경로 임포트 오류 즉각 해결 | app.js 내의 404 경로 참조 버그를 발견하여 외과적 핫픽스 단행 | ✓ Good |
| 통장 쪼개기 도입 (Phase 17) | 단순 수입 입력 방식에서 급여/생활비/주식 계좌 레이어를 Sankey에 융합해 실가계 매핑 무결성 제공 | ✓ Good |
| 네이티브 고해상도 이미지 내보내기 (Phase 16) | 클라이언트 사이드에서 Gowun Dodum 폰트 및 그라디언트를 인라인 주입해 2배 선명도로 PNG 다운로드 구현 | ✓ Good |
| Step 1 컨트롤러 모듈화 (Phase 07) | bootstrap-controller를 startup-only로 축소하고 event/persistence/render/visualization/item-editor 컨트롤러로 분리해 Phase 07 검증 gap을 해소 | ✓ Good |

---

## Evolution History

<details>
<summary>v1.0 ~ v1.4 Evolution Details</summary>

- v1.0 Shipped: 프리셋 기반 자산 시각화 MVP 완비.
- v1.1~v1.3 Shipped: 시뮬레이션 고도화, 온보딩 가이드, 포트폴리오 기본 탑재 완료.
- v1.4 Shipped: 코어 모듈러 안정화, XSS 보안 패치, 디자인 시스템 변수 적용 완료.
</details>

<details>
<summary>v1.6 Evolution Details</summary>

- v1.6 Shipped: 3계층 구조 리팩터링, 테마 및 모바일 반응형 캔버스 줌 보완, PNG 저장소 내보내기 및 계좌 관리 통장 쪼개기 모델 도입 완료.
</details>

---

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
*Last updated: 2026-06-17 after Phase 7*
