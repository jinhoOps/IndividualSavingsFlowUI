# Milestones

## v1.8 적립식 포트폴리오 관리 및 전체 UI/UX 개선 (Shipped: 2026-06-19)

**Delivered:** Step 3 portfolio persistence, Step 1 modular/editorial rebuild, Step 2 strategy-choice simulation, and Step 1 financial setup rebuild shipped as one coherent UI/UX milestone.

**Phases completed:** 5 phases, 18 plans, 42 tasks

**Key accomplishments:**

1. Shipped Step 3 portfolio creation with dynamic asset rows, allocation percentages, final confirmation, and persistent listing.
2. Split Step 1 into focused controllers and reduced the main CSS surface while preserving responsive layout and visualization behavior.
3. Rebuilt Step 2 around a strategy choice guide with index/SCHD/covered-call comparisons, editable conservative assumptions, KPI cards, charting, and LocalStorage fallback.
4. Reworked Step 1 financial setup into summary-first cards, category detail modals, guided item/account creation, and compact mobile editing.
5. Stabilized Sankey account repair, total-income aggregation, tooltip readability, and source-account-based automatic flow balancing.
6. Closed Phase 05-09 verification gates with UAT artifacts, milestone audit, `npm run check`, and targeted Playwright regression evidence.

**Archive:**

- [v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md)
- [v1.8-REQUIREMENTS.md](milestones/v1.8-REQUIREMENTS.md)
- [v1.8-MILESTONE-AUDIT.md](milestones/v1.8-MILESTONE-AUDIT.md)

---

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
