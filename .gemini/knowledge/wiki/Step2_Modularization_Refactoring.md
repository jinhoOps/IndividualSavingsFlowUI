---
type: node
created: 2026-04-21
tags: [refactoring, modularization, es6_modules, step2, simulation]
---

# Step2 Modularization Refactoring (Step 2 배당 시뮬레이션 특화 개편)

## 배경 및 원인
- Step 2 포트폴리오 관리 로직의 비대화를 해소하고, '배당 성장 시뮬레이션'이라는 핵심 가치에 집중하기 위해 구조를 대폭 간소화했습니다. (v0.7.0)
- 기존의 계좌/종목 비중 관리 기능은 Step 1 데이터를 기반으로 추후 Step 3에서 새롭게 구현될 예정입니다.

## 리팩터링 전략: 7개 전문 모듈 최적화 (`apps/step2/modules/`)

1. **`constants.js`**: 앱 전역 설정, 초기값 유지.
2. **`dom.js`**: 포트폴리오 에디터 및 차트 관련 DOM 참조 제거.
3. **`state.js`**: `draftPortfolio`에서 계좌(accounts) 관련 필드 제거 및 상태 관리 간소화.
4. **`calculator.js`**: **[핵심]** 포트폴리오 비중 연산 로직을 제거하고, 고성능 배당 시뮬레이션 엔진에만 집중.
5. **`renderers.js`**: 도넛 차트 및 Sankey 렌더러 제거. 시뮬레이션 차트 및 테이블 렌더링만 유지.
6. **`bridge.js`**: Step 1 연동 데이터(Invest Capacity) 수신 및 브리지 배너 관리 유지.
7. **`storage-handler.js`**: IndexedDB 저장 로직 유지하되, 데이터 정규화 과정에서 계좌 관련 로직 제거.

## 주요 기술 혁신 (v0.7.0 업데이트)

### 1. 배당 시뮬레이션 대시보드 집중
- UI에서 불필요한 입력 단계를 최소화하고, Step 1에서 넘어온 '월 투자 여력'을 즉시 시뮬레이션에 대입하여 결과를 보여줍니다.
- **4대 핵심 변수 연산 보존**: 배당 성장률(DGR), 자본 성장률(CGR), 배당 재투자(DRIP), 실질 가치(Real Value).

### 2. 아키텍처 슬림화 (Logic Decoupling)
- 포트폴리오의 '구성'과 '시뮬레이션'을 분리하여, Step 2는 순수하게 미래 가치를 예측하는 도구로 정체성을 확립했습니다.
- 시각화 로직(D3/SVG)의 복잡도를 낮추어 런타임 안정성을 높였습니다.

## ⚠️ 주의사항 및 교훈
- **단위 정합성**: Step 1에서 넘어오는 데이터는 항상 `IsfUtils.toWon`을 통해 원 단위로 처리되어야 함을 재확인했습니다.
- **데이터 호환성**: `normalizeLoadedPortfolio`에서 과거의 계좌 포함 데이터를 로드하더라도 시뮬레이션에 필요한 필드만 추출하여 안정적으로 동작하게 설계했습니다.
- **향후 계획**: 제거된 포트폴리오 시각화 기능은 Step 1의 실시간 입력값을 활용하는 [[Plan_Step3]]로 계승됩니다.

---
*연결 노드:* [[Architecture_Reference]], [[Data_Model_Reference]], [[Plan_Step3]]

