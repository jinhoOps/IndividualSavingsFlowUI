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

### 온보딩 (ONB)
- [x] **ONB-01**: Step 1에 처음 접속한 사용자가 프리셋 선택 흐름을 안내하는 Spotlight 가이드를 볼 수 있다
- [x] **ONB-02**: 사용자가 온보딩 가이드를 닫으면 이후 재접속 시 다시 표시되지 않는다

## v1.2 Requirements (Completed)

### 백테스트 시뮬레이터 (BACK)
- [x] **BACK-01**: 사용자가 주요 지수와 자산의 과거 시계열 데이터를 선택하여 백테스트를 수행할 수 있다. (v0.9.6)
- [x] **BACK-02**: 사용자가 투자 방식(거치/적립) 및 기간을 설정할 수 있다. (v0.9.6)
- [x] **BACK-03**: 사용자가 배당 재투자(TR) 옵션을 통해 복리 효과 차이를 확인할 수 있다. (v0.9.6)
- [x] **BACK-04**: 사용자가 특정 자산 기준의 상대 비교 모드를 전환하여 볼 수 있다. (v0.9.6)
- [x] **BACK-05**: 사용자가 CAGR, IRR, MDD 등 핵심 KPI 지표를 실시간으로 확인할 수 있다. (v0.9.6)
- [x] **BACK-06**: 사용자가 환율을 수동 설정하고 배당금을 KRW로 환산하여 볼 수 있다. (v0.9.42)

### 통합 허브 및 비교 (HUB)
- [x] **HUB-01**: 사용자가 과거 지출 스냅샷을 저장하고 현재와 카테고리별로 비교할 수 있다. (v0.9.43)
- [x] **HUB-02**: 사용자가 은행/카드 문자를 붙여넣어 지출 항목을 자동으로 등록할 수 있다. (v0.9.44)
- [x] **HUB-03**: 사용자가 파트너의 데이터를 병합하여 통합 가계 흐름을 시각화할 수 있다. (v0.9.44)

## Future Requirements (v1.3 AI Integration)

- **AI-01**: 사용자의 지출 패턴을 AI가 분석하여 카테고리 최적화 제안을 할 수 있다.
- **AI-02**: 사용자가 AI에게 세금 정책 및 투자 전략에 대해 질문하고 답변을 받을 수 있다.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01~05 | Phase 3/4 | Completed |
| ONB-01~02 | Phase 5 | Completed |
| BACK-01~06 | Phase 7 | Completed |
| HUB-01 | Phase 8 | Completed |
| HUB-02~03 | Phase 9 | Completed |

**Coverage:**
- v1.2 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Last updated: 2026-05-11 after Milestone v1.2 completion*
