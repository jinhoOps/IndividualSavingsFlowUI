# Roadmap: Individual Savings Flow (ISF)

**Milestones:** v1.0~v1.7 (Completed) | **Current:** v1.8 (Active)

## Active Roadmap: v1.8 적립식 포트폴리오 관리 및 전체 UI/UX 개선

**Goal:** Step 3 포트폴리오 영속화를 완료하고, 이를 기반으로 Step 1과 Step 2의 UI/UX를 전면 개선(Step 1 모듈화 및 대역폭 축소, Step 2 목표 중심 재기획)하여 일관된 에디토리얼 피드백 시스템을 완성한다.

**5 phases** | **5 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 5 | Portfolio Creation & Target Allocation UI | 나만의 포트폴리오 만들기 화면, 종목명 입력, 주기 선택 및 종목 비중 실시간 편집 UI 구현 | PORT-01, PORT-02 | 2 |
| 6 | Confirmation & Portfolio Storage Hub | 포트폴리오 추가 최종 확인 모달 구현 및 IndexedDB 영속화 저장소 연동 | PORT-03 | 2 |
| 7 | Step 1 UI/UX Refactoring & Modularization | Step 1의 거대한 CSS 다이어트, 모듈 쪼개기, DESIGN.md 기반 UI/UX 전면 개편 | UI-01, UI-02 | Complete (7/7, 2026-06-17) |
| 8 | Step 2 Redesign & Re-planning | 4/4 | Complete   | 2026-06-17 |
| 9 | Step 1 Financial Settings Input UIUX Rebuild | Step 1 재무설정 입력 화면을 Step 3 경험 기준으로 재설계하고, 계좌/항목 추가 흐름 및 Sankey 총수입 집계 노드를 안정화 | TBD | TBD |

### Phase Details

### Phase 5: Portfolio Creation & Target Allocation UI

- **Goal:** 나만의 포트폴리오 만들기 화면, 종목명 입력, 주기 선택 및 종목 비중 실시간 편집 UI 구현
- **Requirements:** PORT-01, PORT-02
- **Success Criteria**:
  1. 최소 2개 이상 종목 선택 및 포트폴리오 이름 지정 폼이 정상 동작하는지 확인
  2. 비중 편집 팝업에서 총금액 대비 각 종목의 비중 %가 실시간 계산되어 정확히 노출되는지 확인

### Phase 6: Confirmation & Portfolio Storage Hub

- **Goal:** 포트폴리오 추가 최종 확인 모달 구현 및 IndexedDB 영속화 저장소 연동
- **Requirements:** PORT-03
- **Success Criteria**:
  1. 추가 확인 모달에 종목 개수, 구매 금액, 설정일, 주기가 정확히 요약 표시되는지 확인
  2. 확인 버튼 클릭 시 IndexedDB에 안전하게 영속화되고, 포트폴리오 목록에 정상 리스팅되는지 확인

### Phase 7: Step 1 UI/UX Refactoring & Modularization

- **Goal:** Step 1의 거대한 CSS 다이어트, 모듈 쪼개기, DESIGN.md 기반 UI/UX 전면 개편
- **Requirements:** UI-01, UI-02
- **Plans:** 7/7 plans complete

**Wave 1**

- [x] 07-01-PLAN.md — Step 1 app.js 모듈화 및 렌더링/외부 데이터 경계 강화
- [x] 07-02-PLAN.md — Step 1 CSS 50% 감축, DESIGN.md 적용, 모바일 레이아웃 재정렬

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — Step 1 라인 카운트, grep, Playwright 모바일 회귀 검증
- **Success Criteria**:
  1. styles.css 크기를 50% 이상 감축하고 공통 theme 변수로 통합 적용되는지 확인
  2. app.js 내의 거대 바인딩 로직을 세부 모듈로 완전히 분리하고, 768px 이하 모바일 뷰에서 레이아웃 파손이 없는지 확인

### Phase 8: Step 2 Redesign & Re-planning

- **Goal:** 배당성장과 커버드콜의 개념적 이해를 돕고, 단순 지수추종 및 성장주 대비 총수익률의 열세에도 불구하고 이를 선택하는 이유(월 현금 흐름 확보, 은퇴 계획 등)를 투자자 본인이 판단할 수 있도록 돕는 미래 자산 시뮬레이션을 전면 재기획 및 구현
- **Requirements:** UI-03
- **Plans:** 4/4 plans complete

**Wave 1**

- [x] 08-01-PLAN.md — Step 2 저장/Step 1 월 투자금 import/reset 계약 복구 및 LocalStorage 폴백

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — 지수/배당성장/커버드콜 비교 계산 모델, 보수 가정, 회귀 테스트

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — Step 2 첫 화면, 모바일 레이아웃, KPI/그래프/카드/상세 검증 게이트
- [x] 08-04-PLAN.md — 정적 시장 데이터 문서화 및 root QQQ CSV backdata 정리
- **Success Criteria**:
  1. 복잡한 입력 항목을 간소화하고, 직관적인 미래 자산 성장 그래프와 KPI 카드로 화면이 전면 재배치되는지 확인
  2. IndexedDB 차단 환경(Private Mode)에서도 LocalStorage를 통한 오프라인 폴백 동작이 정상 작동하는지 확인
  3. 배당에 투자할 수 있는 순수 투자자산이 5천만 원(5,000만 원) 이하일 때 배당 투자의 효과가 미미하다는 안내 힌트/경고가 UI 상에 명시적으로 노출되는지 확인
  4. 지수추종(성장형) vs 배당성장 vs 커버드콜의 장단점(장기 총수익률 vs 월 현금 흐름 창출 및 심리적 안정감)을 직관적으로 대조하여, 투자자 스스로 자산 선택 여부를 쉽게 판단할 수 있는 가이드 카드 및 비교 기능이 제공되는지 확인

### Phase 9: Step 1 Financial Settings Input UIUX Rebuild

- **Goal:** Step 1 재무설정 입력 화면을 Step 3 경험 기준으로 재설계하고, 계좌/항목 추가 흐름 및 Sankey 총수입 집계 노드를 안정화
- **Requirements:** TBD
- **Depends on:** Phase 8
- **Plans:** 4 plans

Plans:

**Wave 1**

- [ ] 09-01-PLAN.md — 계좌 자동 보정 및 `총수입` Sankey 토폴로지 기반
- [ ] 09-02-PLAN.md — 퍼센트 기반 프리셋 빠른 설정과 최종 확인 흐름

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-03-PLAN.md — Step 3형 요약 카드, 상세 모달, 항목/계좌 생성 흐름

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 09-04-PLAN.md — Sankey 보정 새로고침, 툴팁 가독성, 모바일/Playwright 검증
