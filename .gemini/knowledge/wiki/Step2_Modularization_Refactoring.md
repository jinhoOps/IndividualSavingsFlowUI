---
type: node
created: 2026-04-21
tags: [refactoring, modularization, es6_modules, step2, simulation]
---

# Step2 Modularization Refactoring (Step 2 모듈화 및 시뮬레이션 고도화)

## 배경 및 원인
- Step 2 포트폴리오 관리 로직이 비대해짐에 따라 유지보수 효율을 높이고, 정교한 배당 시뮬레이션 엔진을 도입하기 위해 7개 전문 모듈 체제로 리팩터링을 진행했습니다. (v0.5.12)

## 리팩터링 전략: 7개 전문 모듈 구성 (`apps/step2/modules/`)

1. **`constants.js`**: 앱 전역 설정, 초기값, 스타일 상수 격리.
2. **`dom.js`**: DOM 요소 탐색 및 초기화 로딩 조율.
3. **`state.js`**: `draftPortfolio`, `isDirty` 등 전역 상태 관리 및 유틸리티 매핑.
4. **`calculator.js`**: **[핵심]** 포트폴리오 비중 연산 및 고성능 배당 시뮬레이션(DGR, DRIP, 인플레이션 반영 실질 가치) 엔진.
5. **`renderers.js`**: 도넛 차트(D3/SVG), 자산 테이블, 시뮬레이션 결과 화면 렌더링.
6. **`bridge.js`**: Step 1 연동 데이터(Invest Capacity) 수신 및 브리지 배너 관리.
7. **`storage-handler.js`**: IndexedDB(`step2Portfolios`) 저장, 로드 및 백업 동기화.

## 주요 기술 혁신

### 1. 배당 시뮬레이션 엔진 고도화
단순 선형 계산을 넘어 실제 투자 환경을 반영한 4대 핵심 변수를 통합 연산합니다:
- **배당 성장률 (DGR)**: 매년 배당금이 복리로 증가하는 효과 반영.
- **자본 성장률 (CGR)**: 주가 상승에 따른 원금 가치 증가 반영.
- **배당 재투자 (DRIP)**: 수령한 배당금을 원금에 산입하여 복리 극대화.
- **실질 가치 (Real Value)**: 목표 인플레이션율을 적용하여 미래의 금액을 현재 구매력 가치로 역산.

### 2. Sankey 흐름도 통합
- `월 투자 여력 -> 계좌 -> 종목`으로 이어지는 자금 흐름을 시각화하여 포트폴리오의 구조적 건전성을 직관적으로 파악할 수 있게 개선했습니다.

## ⚠️ 주의사항 및 교훈
- **단위 정합성**: Step 1에서 넘어오는 데이터는 항상 `IsfUtils.toMan`을 통해 UI용 단위로 변환되어야 하며, 저장 시에는 원 단위(`modelVersion: 10`)를 준수해야 합니다.
- **CSS 명시성**: 브리지 배너(`hidden` 속성)와 같이 CSS `display` 속성이 충돌할 경우 `!important`를 활용한 강제 제어가 필요할 수 있습니다.
- **비동기 처리**: IndexedDB 로드 중 에러 발생 시에도 `finally` 구문을 통해 로딩 인디케이터나 배너를 적절히 닫아 UX 중단을 방지해야 합니다.

---
*연결 노드:* [[Architecture_Reference]], [[Data_Model_Reference]], [[Step1_Modularization_Refactoring]]
