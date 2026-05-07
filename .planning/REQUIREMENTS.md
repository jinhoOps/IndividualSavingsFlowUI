# Requirements: IndividualSavings Flow UIUX

**Defined:** 2026-05-03
**Core Value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## v1.1 Requirements (Completed)

Requirements for milestone v1.1: 시뮬레이션 고도화 및 온보딩 UX.

### 시뮬레이션 (SIM)
- [x] **SIM-01**: 사용자가 시뮬레이션 차트에서 각 연도별 데이터 포인트를 시각적으로 확인할 수 있다
- [x] **SIM-02**: 사용자가 데이터 포인트를 호버/탭하면 해당 연도의 세부 수치를 툴팁으로 확인할 수 있다
- [x] **SIM-03**: 사용자가 Y축 금액 눈금과 그리드 라인을 통해 차트의 스케일을 즉시 파악할 수 있다
- [x] **SIM-04**: 사용자가 PR(미투자)과 TR(재투자) 사이 영역 채우기를 통해 복리 효과 차이를 직관적으로 인지할 수 있다
- [x] **SIM-05**: 사용자가 차트 상단의 KPI 요약 카드에서 최종 자산, 최종 연 배당금, 누적 수익률 등 핵심 지표를 한눈에 확인할 수 있다

### 테이블 정리 (TBL)
- [x] **TBL-01**: Step 2 테이블 헤더에서 불필요한 (만원) 표기를 제거하여 시각적 잡음을 줄인다

### 온보딩 (ONB)
- [x] **ONB-01**: Step 1에 처음 접속한 사용자가 프리셋 선택 흐름을 안내하는 Spotlight 가이드를 볼 수 있다
- [x] **ONB-02**: 사용자가 온보딩 가이드를 닫으면 이후 재접속 시 다시 표시되지 않는다

## v1.2 Requirements (Current)

### 백테스트 시뮬레이터 (BACK) - Issue #7
- [ ] **BACK-01**: 사용자가 나스닥, S&P 500 등 주요 지수와 자산의 과거 시계열 데이터를 선택하여 백테스트를 수행할 수 있다.
- [ ] **BACK-02**: 사용자가 거치식(Lump Sum) 또는 적립식(Installment) 투자 방식을 선택하고 기간을 설정할 수 있다.
- [ ] **BACK-03**: 사용자가 배당 재투자(TR) 옵션을 켜거나 꺼서 복리 효과의 차이를 시뮬레이션할 수 있다.
- [ ] **BACK-04**: 사용자가 일반 비교 모드와 특정 자산 기준의 상대 비교 모드를 전환하여 차트를 볼 수 있다.
- [ ] **BACK-05**: 사용자가 CAGR, IRR, MDD, 누적 수익률 등 핵심 KPI 지표를 실시간으로 확인할 수 있다.

## Future Requirements

### 포트폴리오 (PORT)
- **PORT-01**: Step 1의 투자 여력 데이터를 기반으로 계좌/종목 비중 구성 및 시각화(도넛, Sankey) 구현
- **PORT-02**: 목표 비중(Target) vs 실제 보유(Actual) 격차 분석 및 리밸런싱 가이드 통합

### 시각화 확장 (VIZ)
- **VIZ-01**: Step 1 지출 내역 이전 데이터 비교 막대 그래프 추가
- **VIZ-02**: 현금 흐름 Sankey 다이어그램 모바일 가로모드 최적화 및 확대/축소(Zoom/Pan) 기능

## Out of Scope

| Feature | Reason |
|---------|--------|
| 실시간 시세 연동 | 정적 데이터 백테스트 중심 철학 |
| 개별 종목 정밀 분석 | 지수 및 자산군(Asset Class) 레벨 시뮬레이션 지향 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01~04 | Phase 3 | Completed |
| SIM-05, TBL-01 | Phase 4 | Completed |
| ONB-01~02 | Phase 5 | Completed |
| BACK-01~05 | Phase 7 | In Progress |

**Coverage:**
- v1.2 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Last updated: 2026-05-08 after Issue #7 planning*
