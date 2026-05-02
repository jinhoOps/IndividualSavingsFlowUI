# Requirements: IndividualSavings Flow UIUX

**Defined:** 2026-05-03
**Core Value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## v1.1 Requirements

Requirements for milestone v1.1: 시뮬레이션 고도화 및 온보딩 UX.

### 시뮬레이션 (SIM)

- [ ] **SIM-01**: 사용자가 시뮬레이션 차트에서 각 연도별 데이터 포인트를 시각적으로 확인할 수 있다
- [ ] **SIM-02**: 사용자가 데이터 포인트를 호버/탭하면 해당 연도의 세부 수치를 툴팁으로 확인할 수 있다
- [ ] **SIM-03**: 사용자가 Y축 금액 눈금과 그리드 라인을 통해 차트의 스케일을 즉시 파악할 수 있다
- [ ] **SIM-04**: 사용자가 PR(미투자)과 TR(재투자) 사이 영역 채우기를 통해 복리 효과 차이를 직관적으로 인지할 수 있다
- [ ] **SIM-05**: 사용자가 차트 상단의 KPI 요약 카드에서 최종 자산, 최종 연 배당금, 누적 수익률 등 핵심 지표를 한눈에 확인할 수 있다

### 테이블 정리 (TBL)

- [ ] **TBL-01**: Step 2 테이블 헤더에서 불필요한 (만원) 표기를 제거하여 시각적 잡음을 줄인다

### 온보딩 (ONB)

- [ ] **ONB-01**: Step 1에 처음 접속한 사용자가 프리셋 선택 흐름을 안내하는 Spotlight 가이드를 볼 수 있다
- [ ] **ONB-02**: 사용자가 온보딩 가이드를 닫으면 이후 재접속 시 다시 표시되지 않는다

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
| 빌드 필수 차트 라이브러리 (Recharts, Victory 등) | No-build 순수 JS 원칙 위반 |
| Step 2 온보딩 | 이번 마일스톤은 Step 1 한정 |
| 오픈뱅킹/마이데이터 연동 | 미니멀 클라이언트 철학 유지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01 | — | Pending |
| SIM-02 | — | Pending |
| SIM-03 | — | Pending |
| SIM-04 | — | Pending |
| SIM-05 | — | Pending |
| TBL-01 | — | Pending |
| ONB-01 | — | Pending |
| ONB-02 | — | Pending |

**Coverage:**
- v1.1 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 after initial definition*
