# Milestones

## v1.0 — 템플릿 기반 자산 흐름 시각화

**Shipped:** 2026-05-03
**Phases:** 3 (Phase 1, 2, 2.1) | **Plans:** 3 | **Commits:** 18
**Timeline:** 2026-04-30 → 2026-05-03 (4 days)
**Files:** 31 changed, +1,232 / -346 lines

### Delivered

연봉/투자 성향 프리셋 선택만으로 고해상도 자산 흐름(12대 세부 항목)이 자동 시각화되고, 세부 조정 및 IndexedDB 영속화까지 완비된 개인 가계 흐름 계획 도구 MVP.

### Key Accomplishments

1. 연봉/투자 성향 프리셋 선택 UI 구현 및 표준 자산 흐름 즉시 시각화
2. 편집기를 통한 세부 항목 수동 조절 및 Sankey Diagram 실시간 재렌더링
3. 프리셋 적용 후 자동 확장/스크롤/하이라이트의 매끄러운 UX 플로우
4. 고해상도 템플릿 엔진 (12대 세부 항목: 주거비, 식비, 비상금, 연금 등)
5. IndexedDB 기반 데이터 영속성 및 단위 정합성(만원/원) 완벽 수호

### Archive

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---

## v1.1 — 대시보드 고도화 및 온보딩 강화

**Shipped:** 2026-05-06
**Phases:** 3 (Phase 3, 4, 5)
**Status:** Completed

### Delivered

시뮬레이션 차트의 시각적 완성도를 높이고, KPI 대시보드를 통해 핵심 재무 지표를 한눈에 파악할 수 있도록 개선했습니다. 또한 Spotlight UX를 도입하여 신규 사용자의 진입 장벽을 낮췄습니다.

### Key Accomplishments

1. Sankey Diagram 외 시뮬레이션 결과 차트 시각화 고도화.
2. KPI 카드 및 요약 테이블을 통한 재무 건강도 진단 기능.
3. Spotlight 기반의 단계별 온보딩 가이드 시스템 구축.

---

## v1.2 — 백테스트 시뮬레이터 및 자산 관리 확장

**Target Date:** 2026-05-15
**Phases:** 4 (Phase 6, 7, 8, 9)
**Status:** In-Progress (Phase 6, 7, 8-01 Completed)

### Goal

주요 지수 백테스트 시뮬레이터를 구축하고, 포트폴리오 리밸런싱 도구를 통해 실제 자산 관리 여정을 완성하며, 부부 통합 허브를 통해 가계 관리를 확장합니다.

### Key Accomplishments (To-date)

1. Step 3: 계좌/종목별 비중 설정 및 리밸런싱 가이드 엔진 구현 (v0.9.5).
2. Step 4: React 기반 고성능 백테스트 시뮬레이터 및 레버리지 청산 엔진 구축 (v0.9.7).
3. 지출 데이터 과거 비교 분석 도구 (v0.9.8).
