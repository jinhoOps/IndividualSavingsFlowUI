---
type: node
created: 2026-04-17
tags: [refactoring, modularization, es6_modules, step1]
---

# Step1 Modularization Refactoring (Step 1 모듈화 리팩터링)

## 배경 및 원인
- `apps/step1/app.js` 파일이 약 4,600행에 달하는 거대한 단일 파일(Monolithic)로 비대화되었습니다.
- 이로 인해 향후 기능 추가나 버그 수정 시 에이전트(LLM)가 전체 컨텍스트를 파악하기 어렵고 코드가 절삭(Truncate)될 위험이 커졌습니다.

## 리팩터링 전략
**"No-build ES6 Native Modules"** 원칙을 고수하면서, 기능별로 책임(Responsibility)을 완벽히 분리하는 11개의 전문 모듈 체제로 개편했습니다.

### 1. 모듈 디렉토리 구성 (`apps/step1/modules/`)
1. **`constants.js`**: 모든 환경 설정값, 상수(`DEFAULT_INPUTS`, `TONE_COLORS` 등)를 격리.
2. **`dom.js`**: DOM 요소 탐색 및 할당(`document.getElementById` 등)을 한 곳으로 응집.
3. **`state.js`**: 앱의 전역 상태(`draftInputs`, `isViewMode` 등)를 독립적으로 관리.
4. **`input-sanitizer.js`**: 데이터 정합성 유지, 클로닝 및 정규화(Normalization) 전담.
5. **`formatters.js`**: 화폐, 비율, 날짜 등 화면 출력용 데이터 포맷팅 로직 전담.
6. **`calculator.js`**: 가계 흐름(Snapshot), 추이(Projection), 잉여 자금(Summary Cards) 등 복잡한 시뮬레이션 연산 전담.
7. **`sankey-builder.js`**: 생크 다이어그램 렌더링에 필요한 노드와 링크 데이터를 계산하는 데이터 가공 모듈.
8. **`sankey-renderer.js`**: 순수 SVG DOM 조작을 통한 생크 다이어그램 시각화 전담.
9. **`bridge-manager.js`**: Step 1에서 Step 2로 데이터를 연동(Bridge)하기 위한 페이로드 생성 및 저장.
10. **`storage-manager.js`**: `localStorage` 및 `IndexedDB` 접근을 통한 데이터 보존과 공유 스냅샷 관리.

### 2. 경량 컨트롤러 (`apps/step1/app.js`)
기존 4,600행의 `app.js`는 위 모듈들을 `import`하여 **이벤트 바인딩과 렌더링 루프(Orchestration)만 제어**하는 500행 규모의 경량 컨트롤러로 전환되었습니다.

### 3. Shared 유틸리티 통합
`shared/core/utils.js`에 공통 유틸리티(`debounce`, `roundTo`, `idbRequestToPromise`, `idbTransactionDone`)를 추가하여 Step 1과 Step 2의 중복 코드를 제거했습니다.

## 결론 및 교훈
- 빌드 도구 없이도 ES6 모듈 시스템(`type="module"`)만으로 충분히 현대적이고 우아한 아키텍처를 구축할 수 있습니다.
- 복잡한 로직일수록 "순수 계산(Calculator/Builder)"과 "DOM 제어(Renderer/Controller)"를 완벽히 분리해야 안정적인 유지보수가 가능합니다.

## ⚠️ 리팩터링 후 주의사항 (Post-refactoring Pitfalls)
모듈 분리 직후 다음과 같은 결함이 발생할 수 있으므로 검증 단계에서 반드시 확인해야 합니다:
1. **상수 참조 유실**: `state.js` 등 하위 모듈에서 `constants.js`의 값을 참조할 때 `import` 문이 누락되어 `ReferenceError`가 발생하는지 확인하십시오. (예: `HASH_STATE_PARAM` 누락 사례)
2. **렌더링 함수 누락**: 컨트롤러(`app.js`) 슬림화 과정에서 반복적인 UI 업데이트 함수(리스트 렌더러 등)가 소실되지 않았는지 대조하십시오.
3. **이벤트 리스너 복구**: `bindReadonlyAdvancedNavigation`과 같이 동적으로 생성된 요소에 바인딩되는 특수 내비게이션 로직이 유지되었는지 점검하십시오.
4. **계산 함수 호출 오류**: 수입/지출 항목별로 서로 다른 합산 함수(`getMonthlyIncomeTotalMan` vs `getMonthlyAllocationTotalMan`)가 정확히 매핑되었는지 검증하십시오.
5. **모델 버전 누락 (Unit Duplication)**: `input-sanitizer.js`에서 정규화된 데이터를 반환할 때 `modelVersion: 10` (원 단위 표시기)을 누락하지 않도록 주의하십시오. 누락 시, 시스템이 데이터를 여전히 '만원' 단위로 인식하여 `migrateInputsToWon`을 중복 실행, 수치가 10,000배씩 폭증하는 치명적 오류가 발생할 수 있습니다.

