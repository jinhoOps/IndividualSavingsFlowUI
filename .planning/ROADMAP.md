# Roadmap: v1.1 ~ v1.2 시뮬레이션 고도화 및 자산 관리 확장

**Milestone:** v1.1 (Phase 3~5), v1.2 (Phase 6~9)
**Requirements covered:** 8/8 ✓ + New Features from Issues

---

## Phase 3: 시뮬레이션 차트 시각화 고도화 (v0.7.15 완료)
## Phase 4: KPI 대시보드 카드 및 테이블 정리 (v0.7.15 완료)
## Phase 5: Step 1 Spotlight 온보딩 가이드 (v0.8.1 완료)

---

## Phase 6: 포트폴리오 자산 구성 및 리밸런싱 (Step 3)

**Goal:** Step 1의 투자 여력 데이터를 기반으로 실제 계좌/종목 비중을 구성하고, 목표 비중과의 격차를 분석하여 리밸런싱 가이드를 제공한다.

---

## Phase 7: 백테스트 시뮬레이터 대시보드 (Step 4 - Issue #7)

**Goal:** 주요 지수 및 자산의 과거 시계열 데이터를 기반으로 거치식/적립식 수익률을 시뮬레이션하고, 비교 분석 기능을 제공한다.

**Success Criteria:**
1. **정적 데이터 엔진**: 나스닥, S&P 500 등 주요 지수의 JSON 데이터 로딩 및 파싱.
2. **복리 계산 엔진**: CAGR, IRR, MDD 등 금융 지표 계산 로직 구현 (TS).
3. **인터랙티브 대시보드**: React 기반의 반응형 UI 및 SVG/Canvas 기반 수익률 차트.
4. **상대 비교 모드**: 특정 자산을 0%로 둔 상대 수익률 시각화 기능.

**Plans:** 3 plans
- [ ] 07-01-PLAN.md — 데이터 구조 확립 및 시뮬레이션 엔진 구현
- [ ] 07-02-PLAN.md — React 기반 대시보드 레이아웃 및 차트 컴포넌트 개발
- [ ] 07-03-PLAN.md — KPI 요약 카드 및 최종 통합 검증

---

## Phase 8: 지출 데이터 과거 비교 분석 (Issue #4)

**Goal:** `DataHub`에 저장된 이전 스냅샷 데이터를 불러와 현재 지출과 카테고리별로 비교하는 시각화 도구를 제공한다.

---

## Phase 9: 신혼부부 통합 허브 (Newlywed Harmony Hub - Issue #2)

**Goal:** 부부 간의 현금 흐름을 통합하고, 지출 예산 관리 및 입력 편의성을 극대화한다.

---

## Phase 10: 백테스트 관련 기능 제거 및 이관

**Goal:** 현재 프로젝트(`IndividualSavingsFlowUI`)의 백테스트 관련 코드와 기능들을 모두 제거하고, 해당 설계 및 로직을 `D:\jhkSandBox\CODE\stock-snowball\.planning` 에 이관한다.

---

*Roadmap updated: 2026-05-12 (Reflecting Backtest Migration)*
