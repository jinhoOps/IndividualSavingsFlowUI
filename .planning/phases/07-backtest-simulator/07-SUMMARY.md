# Phase 07 Summary: Backtest Simulator (Step 4)

## Accomplishments
Phase 07은 주요 지수 및 자산의 과거 시계열 데이터를 기반으로 투자 성과를 시뮬레이션하고 비교 분석하는 Step 4(React/TS) 대시보드를 구축했습니다.

- **Simulation Engine (TDD)**: CAGR, IRR, MDD, TR(배당 재투자) 등 금융 지표를 정확하게 계산하는 핵심 엔진을 Vitest 기반 TDD로 구현했습니다.
- **React Dashboard**: React 19와 Tailwind CSS v4를 활용하여 현대적인 고성능 대시보드를 구축했습니다. 외부 라이브러리 없이 순수 SVG로 구현된 맞춤형 시계열 차트를 탑재했습니다.
- **Comparative Analysis**: 특정 자산을 0%로 두어 초과 수익을 분석하는 '상대 비교 모드'와 벤치마크(S&P 500, 나스닥 등) 다중 자산 데이터를 통합했습니다.
- **Leverage & Liquidation (v0.9.7)**: QLD(2x), TQQQ(3x) 등 레버리지 자산의 변동성 드래그와 원금 청산(99% 손실) 로직을 엔진에 반영하고 시각화했습니다.

## Verification Results
- **정확성**: 엔진의 계산 결과가 수동 검증값 및 타 서비스의 데이터와 일치함을 확인했습니다.
- **성능**: 대량의 시계열 데이터(20년치 이상) 로딩 및 시뮬레이션 연산이 브라우저에서 지연 없이 수행됩니다.
- **시스템 통합**: 공통 헤더를 통해 Step 1~4 간의 유기적인 이동과 데이터 공유(`totalInitialAsset` 연동 등)가 정상 작동합니다.

## Impact
사용자는 자신의 과거 투자 선택이 어떤 결과를 가져왔을지 시뮬레이션해봄으로써, 더 나은 투자 의사결정을 내릴 수 있는 근거를 확보하게 되었습니다.
