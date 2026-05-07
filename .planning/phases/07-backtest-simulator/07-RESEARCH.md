# Phase 07 Research: Backtest Simulator Strategy

## 1. 데이터 수집 및 관리 전략 (Data Strategy)

### 정적 파일 기반 아키텍처 (Static File Architecture)
- **이유**: 실시간 데이터가 아닌 과거 시계열 데이터(Backtest)이므로, API 호출 지연 및 CORS 문제를 피하고 즉각적인 렌더링을 위해 정적 JSON 파일을 선호함.
- **형식**: `public/data/indices/{index_id}.json`
- **구조**:
  ```json
  [
    { "date": "1990-01-01", "price": 100.0, "dividend": 0.0, "rate": 0.08 },
    ...
  ]
  ```
- **대상**: Nasdaq-100 (QQQ), S&P 500 (SPY), Dow Jones (DIA), KOSPI (200), Gold, US/KR Base Interest Rate.

### 데이터 업데이트 정책
- 데이터는 월별 종가(Monthly Close) 기준으로 구성하여 파일 크기 최적화.
- 연 1~2회 수동 업데이트 또는 필요 시 GitHub Actions를 통한 자동 크롤링 검토.

## 2. 시뮬레이션 엔진 (Simulation Engine)

### 계산 모듈 (Calculators)
- **Lump Sum (거치식)**: `Final = Initial * (1 + Cumulative_Return)`.
- **Installment (적립식)**: 매월 정해진 금액을 해당 시점의 가격으로 매수(Fractional share 가정).
- **TR (Total Return)**: 배당 발생 시 해당 시점 가격으로 재투자 처리.
- **KPI Metrics**:
    - **CAGR**: `(End Value / Start Value) ^ (1 / Years) - 1`.
    - **IRR**: 적립식 현금 흐름에 대한 내부 수익률 계산 (Newton-Raphson method 또는 단순화).
    - **MDD**: `(Peak - Trough) / Peak` 중 최대값.

## 3. 기술 스택 및 아키텍처 결정

### Step 4 신설 (React + TypeScript)
- **결정**: 기존 Step 1, 2의 레거시 구조(Legacy JS + Web Components)를 벗어나, 복잡한 대시보드와 상태 관리를 위해 **React 19**와 **Tailwind CSS v4**를 전면 도입함.
- **위치**: `apps/step4/` (Entry: `src/entries/step4.ts`)
- **상태 관리**: React Context 또는 단순 `useState/useMemo` (서버 연동이 없으므로 단순화 가능).
- **차트**: `shared/`에 있는 SVG 기반 렌더러를 확장하거나, 경량 Chart.js/D3 기반 커스텀 래퍼 사용 (No-build 원칙과 Vite 빌드 간의 균형 유지).

## 4. UI/UX 디자인 가이드라인

### 모드 전환 (Relative vs Absolute)
- **Absolute**: 각 자산의 실제 수익 곡선 표시.
- **Relative**: 특정 자산(또는 기준점)을 0%로 평탄화하고 타 자산의 초과 수익/손실 시각화.

### 피드백 시스템
- **Toast UI**: 시뮬레이션 완료, 데이터 로드 실패 등 알림.
- **Warning**: "적금 거치식 오류" (적금은 적립식이 기본이므로 거치 시 예금과 동일해짐을 안내) 등 주의 문구 상시 노출.

## 5. 단계별 구현 이정표 (Milestones)

1. **Foundation**: 데이터 파일 규격 확정 및 샘플 데이터 적재 (Wave 1)
2. **Engine**: 핵심 시뮬레이션 알고리즘 TS 구현 및 테스트 (Wave 1)
3. **UI Components**: 대시보드 레이아웃 및 차트 컴포넌트 개발 (Wave 2)
4. **Integration**: Step 1/2와의 연결 및 최종 UAT (Wave 3)
