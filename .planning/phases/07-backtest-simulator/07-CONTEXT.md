# Phase 07 Context: Backtest Simulator Decisions

## Decisions (Locked)

- **D-01**: 시뮬레이터는 **Step 4**로 명명하며, 별도의 독립적인 앱 진입점을 갖는다. (per user request: "새로운 Step(Step 4) 또는 기존 Step 확장 여부 결정")
- **D-02**: 과거 시계열 데이터는 `public/data/` 내의 **정적 JSON 파일**로 관리한다. (per user request: "시계열 데이터 정적 파일화")
- **D-03**: 기술 스택은 **React 19 + TypeScript + Tailwind CSS v4**를 사용한다. (per PROJECT.md 및 대시보드 복잡도 고려)
- **D-04**: 필수 자산군: 나스닥, S&P 500, 다우존스, 코스피, 금 현물, 기준금리.
- **D-05**: 핵심 KPI: CAGR(거치), IRR(적립), MDD, 누적 수익률.

## the agent's Discretion

- **AD-01**: 차트 라이브러리는 가급적 가볍고 커스터마이징이 용이한 `recharts` 또는 `lucide-react`와 연계된 가벼운 SVG 컴포넌트를 직접 구현하여 사용함. (No-build 지향 원칙과의 타협점)
- **AD-02**: 데이터 샘플링은 월 단위(Monthly)로 수행하여 로딩 속도와 정확성 사이의 균형을 맞춤.

## Deferred Ideas

- **DI-01**: 실시간 자산 가격 API 연동 (v1.2 이후 고려)
- **DI-02**: 개별 종목(Stock) 단위의 무제한 백테스트 (데이터 관리 부하로 인해 이번 단계에서는 지수 위주로 제한)
