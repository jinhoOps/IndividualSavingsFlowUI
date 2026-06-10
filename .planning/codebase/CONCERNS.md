# Codebase Concerns

**Analysis Date:** 2024-05-24

## 기술 부채 (Tech Debt)

**레거시 앱 진입점 비대화:**
- 이슈: 바닐라 JS 기반의 레거시 진입점 파일들이 비대해지고 DOM과 강하게 결합되어 있습니다.
- 파일: `apps/step1/app.js` (약 1,000라인), `apps/step2/app.js`, `apps/step3/app.js`
- 영향: 테스트 및 유지보수가 어렵고, 단계(Step) 간 컴포넌트 공유가 제한적입니다.
- 해결 방향: 코어 로직을 모듈로 분리하고, Step 4와 같은 React/Vite 기반 구조로 점진적 전환이 필요합니다.

**Modern Hybrid 상태의 패턴 혼재:**
- 이슈: 순수 JS, ES 모듈, Vite/TS가 공존하면서 코드 작성 패턴이 파편화되어 있습니다.
- 파일: `apps/` (JS), `src/` (TS/React), `shared/` (JS/Modules)
- 영향: 개발 환경 설정의 복잡성이 증가하고, 타입 안정성이 전역적으로 보장되지 않습니다.
- 해결 방향: TS 도입 범위를 확대하고 프로젝트 구조를 표준화해야 합니다.

**AI 기능 제거 잔재:**
- 이슈: Phase 10에서 시도되었던 실험적 AI 기능의 잔재가 완벽히 제거되지 않았을 가능성이 있습니다.
- 파일: `shared/components/data-hub-modal.js`
- 영향: 사용되지 않는 코드(Dead code)로 인한 혼선 및 잠재적 버그 유발.
- 해결 방향: 코드베이스 전반에 걸친 오딧(Audit)을 통해 AI 관련 스텁, 설정, 주석을 완전히 제거해야 합니다.

## 알려진 버그 (Known Bugs)

**항목 비교 시 데이터 합산 누락 (수정됨, 회귀 위험):**
- 증상: 동일한 이름을 가진 항목 비교 시 데이터가 덮어씌워지는 현상.
- 파일: `apps/step1/modules/comparison-engine.js`
- 트리거: 입력 필드에 동일한 이름의 항목을 여러 번 입력할 때 발생.
- 예방책: 입력 단계에서 동일 항목 이름을 자동으로 집계(Aggregate)하도록 강제해야 합니다.

## 보안 고려 사항 (Security Considerations)

**교차 사이트 스크립팅 (XSS):**
- 위험: ISF CODE 공유 또는 부부 데이터 병합 시 악성 코드가 주입될 위험이 있습니다.
- 파일: `apps/step1/modules/input-sanitizer.js`, `shared/core/utils.js`
- 현재 완화책: 데이터 병합 시 `sanitizeInputs`를 강제 적용 중입니다.
- 권장 사항: 모든 입력 필드에 대해 전역적인 검증 로직을 강화하고, DOM 렌더링 전 새니타이징(Sanitizing)을 의무화해야 합니다.

## 성능 병목 구간 (Performance Bottlenecks)

**복잡한 차트 렌더링 부하:**
- 문제: Sankey 차트 및 시뮬레이션 결과 렌더링 시 UI 블로킹 발생 가능성.
- 파일: `apps/step1/modules/sankey-renderer.js`
- 원인: 대량의 데이터에 대해 메인 스레드에서 직접 SVG를 생성하고 innerHTML을 초기화하는 방식.
- 개선 경로: 계산 로직을 Web Worker로 분리하거나, 변경된 부분만 업데이트하는 가상화/디바운싱 기법 도입이 필요합니다.

## 취약 영역 (Fragile Areas)

**오프라인 데이터 동기화:**
- 파일: `shared/pwa/pwa-manager.js`, `shared/storage/hub-storage.js`
- 취약 원인: PWA 오프라인 캐싱과 IndexedDB 동기화 과정에서 네트워크 불안정 시 예외 케이스 발생 가능.
- 안전한 수정 방법: 오프라인 환경을 시뮬레이션하여 모든 CRUD 작업의 정합성을 검증해야 합니다.
- 테스트 커버리지: 자동화된 E2E 오프라인 테스트가 부족합니다.

**핵심 헬퍼 함수 유실 위험:**
- 파일: `apps/step1/app.js` (내부의 14종 이상 필수 헬퍼)
- 취약 원인: 비대한 파일을 리팩토링할 때 `markDirty` 등 시스템 무결성에 필수적인 함수들이 소실될 위험이 큼.
- 안전한 수정 방법: 리팩토링 전후의 헬퍼 함수 존재 여부 및 동작을 대조하는 체크리스트 활용 필수.

**전역 이벤트 리스너 관리:**
- 파일: `shared/components/app-header.js`
- 취약 원인: 전역 클릭 리스너 등이 적절히 해제되지 않을 경우 메모리 누수 발생.
- 안전한 수정 방법: `connectedCallback`과 `disconnectedCallback` 생명주기를 엄격히 준수하여 리스너를 등록/해제해야 합니다.

## 누락된 핵심 기능 (Missing Critical Features)

**런타임 데이터 검증:**
- 문제: 단계(Step) 간 데이터 교환 시 엄격한 런타임 스키마 검증이 부재함.
- 차단 요소: 타입 안정성 및 데이터 교환의 예측 가능성을 저해합니다.

## 테스트 커버리지 간극 (Test Coverage Gaps)

**단위 및 통합 테스트 부재:**
- 테스트되지 않은 영역: 대부분의 비즈니스 로직 및 UI 컴포넌트.
- 파일: `apps/**/*.js`, `src/**/*.tsx`
- 위험: 코드 수정 시 예상치 못한 부작용(Side effects)을 사전에 감지하기 어려움.
- 우선순위: 높음

---

*Concerns audit: 2024-05-24*
