# UAT Report: Phase 07 Backtest Simulator (Step 4)

## Test Environment
- **Browser**: Chrome 124, Edge 124
- **Version**: v0.9.7
- **Base Data**: public/data/indices/*.json

## Test Cases & Results

| Case ID | Feature | Test Step | Expected Result | Status |
|---------|---------|-----------|-----------------|--------|
| UAT-07-01 | Engine Accuracy | QQQ 거치식 10년 시뮬레이션 | CAGR 및 MDD 수치가 벤치마크 데이터와 오차 범위 내 일치 | Pass |
| UAT-07-02 | Dashboard UI | 자산 선택 및 기간 슬라이더 조절 | SVG 차트와 KPI 카드가 즉각(Real-time) 업데이트됨 | Pass |
| UAT-07-03 | Relative Mode | '상대 비교 모드' 활성화 | 벤치마크 자산이 0% 직선으로 변하며 타 자산이 상대 수익률로 표시됨 | Pass |
| UAT-07-04 | TR Option | '배당 재투자' 체크박스 토킹 | 수익률 곡선이 배당금만큼 상향 조정됨 | Pass |
| UAT-07-05 | Liquidation | TQQQ(3x) 2000년 닷컴버블 구간 시뮬레이션 | 99% 손실 시 '청산' 경고 표시 및 수익률 -100% 수렴 확인 | Pass |
| UAT-07-06 | Navigation | 헤더 메뉴를 통한 Step 1 <-> Step 4 이동 | 앱 상태 유지 및 유기적인 페이지 전환 확인 | Pass |

## Final Verdict
Step 4 백테스트 시뮬레이터는 복잡한 금융 연산과 고성능 UI 요구사항을 모두 충족하며, 안정적인 분석 환경을 제공합니다.
