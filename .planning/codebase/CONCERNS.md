# Codebase Concerns

**Analysis Date:** 2026-06-16

## 기술 부채 (Tech Debt)

**단위 변환 헬퍼 명칭과 의미적 괴리:**
- 이슈: 단위 변환 관련 데이터 정합성 강화 과정에서 `toWon`과 `toMan` 함수는 단위를 변경하지 않고 1:1 패스스루 형태로 작동하도록 수정되었습니다. 그러나 JSDoc 주석, 타입 시그니처(`ManWon` 브랜드 타입), 그리고 주요 설정 및 규칙 문서들에는 여전히 이 함수들이 만원 단위 변환을 수행한다고 명시되어 있습니다.
- 파일:
  - [money.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/money.ts)
  - [utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/utils.js)
- 영향: 향후 React 마이그레이션 및 유지보수 시 단위가 이미 '원' 단위로 조정된 상태에서 중복 계산(예: 직접 `/ 10000` 연산 후 헬퍼를 추가 통과시키는 행위)을 유발하거나 데이터가 소실 및 왜곡될 가능성이 큽니다.
- 해결 방향: 실제 1:1 변환 주기에 맞춰 함수명을 `roundWon` 등으로 수정하거나, 문서 및 주석을 최신 변환 정책에 맞춰 통일해야 합니다.

**레거시 바닐라 JS 기반 3계층 구조의 리팩토링 복잡성:**
- 이슈: `apps/step1/app.js`와 같은 레거시 바닐라 JS 진입점들이 비대해지고, 상태 관리 및 UI 연동을 위해 `state-helpers.js` 내 14종의 필수 헬퍼 함수와 강하게 결합되어 있습니다.
- 파일:
  - [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js)
  - [state-helpers.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state-helpers.js)
- 영향: React 점진적 적용 과정에서 React의 선언형 렌더링 주기 및 상태 흐름(useState/Zustand 등)에 이 헬퍼 로직을 부드럽게 이식하기 어렵고, 과도기적인 코드 파편화가 증가합니다.
- 해결 방향: 상태 모델링과 UI 관리 계층을 React 컴포넌트 내부로 이식하는 명확한 마이그레이션 규칙을 정립해야 합니다.

**AI 기능 제거 잔재:**
- 이슈: 과거 실험적 AI 기능의 잔재가 완벽히 제거되지 않았을 가능성이 있습니다.
- 파일:
  - [data-hub-modal.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/data-hub-modal.js)
- 영향: 사용되지 않는 코드(Dead code)로 인한 혼선 및 잠재적 버그 유발.
- 해결 방향: 코드베이스 전반에 걸친 오딧(Audit)을 통해 AI 관련 스텁, 설정, 주석을 완전히 제거해야 합니다.

## 알려진 버그 (Known Bugs)

**항목 비교 시 데이터 합산 누락 (수정됨, 회귀 위험):**
- 증상: 동일한 이름을 가진 항목 비교 시 데이터가 덮어씌워지는 현상.
- 파일: [comparison-engine.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/comparison-engine.js)
- 트리거: 입력 필드에 동일한 이름의 항목을 여러 번 입력할 때 발생.
- 예방책: 입력 단계에서 동일 항목 이름을 자동으로 집계(Aggregate)하도록 강제해야 합니다.

## 아키텍처적 위험 요소 (Architectural Risks)

**전역 CompatibilityBridge에 대한 과도한 결합:**
- 이슈: 바닐라 JS 레거시 앱이 현대화된 TS 스토어에 접근할 수 있도록 글로벌 `window` 객체에 `IsfStorageHub`, `IsfBackupManager`, `IsfUtils`를 강제 주입하고 있습니다.
- 파일: [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts)
- 영향: 브라우저 전역 객체에 의존하므로 로드 순서 및 모듈 초기화 타이밍에 따라 전역 객체 미정의 오류가 발생할 수 있으며, 네임스페이스 충돌의 가능성이 높습니다.
- 해결 방향: React 마이그레이션 과정에서 전역 객체 의존성을 제거하고, ESM 임포트 패턴으로 전면 전환해야 합니다.

**비동기 IndexedDB와 동기식 레거시 로직의 흐름 불일치:**
- 이슈: `IsfStore`는 IndexedDB를 사용하여 완전히 비동기(Promise/Async-Await)로 쓰기 및 백업 작업을 수행하는 반면, 레거시 앱의 제어 흐름은 동기식 `localStorage` 동작 방식에 맞춰 설계되어 있습니다.
- 파일:
  - [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts)
  - [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts)
- 영향: 레거시 코드에서 비동기 데이터 저장이 끝나기 전에 화면 갱신이나 페이지 후속 작업이 실행될 경우, 레이스 컨디션(Race Condition)으로 인한 데이터 유실이나 미반영 결함이 생길 수 있습니다.
- 해결 방향: 브릿지 메서드 내부에 동기화 완료 대기 로직을 엄격하게 구현하거나, 레거시 컨트롤러를 비동기 이벤트 기반으로 전면 리팩토링해야 합니다.

## 미결 과제 (Pending Tasks)

**런타임 데이터 검증 부재:**
- 이슈: 수입/지출/저축/투자 항목 등 단계(Step) 간에 데이터를 교환하거나 부부 데이터 병합(ISF CODE)을 처리할 때, 데이터의 구조적 런타임 스키마 검증이 이루어지지 않습니다.
- 파일: [input-sanitizer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/input-sanitizer.js)
- 영향: 비정상적이거나 스키마 버전이 다른 외부 데이터가 영속성 스토어에 곧바로 적재되어 데이터 정합성을 파괴할 우려가 있습니다.
- 해결 방향: 데이터가 로드 및 병합되는 접점에 Zod 또는 컴팩트한 스키마 검증기를 도입해 런타임 정합성을 강제해야 합니다.

**IndexedDB 차단 시 환경적 폴백 설계 부재:**
- 이슈: 브라우저의 프라이빗 브라우징(Private Mode) 또는 로컬 보안 정책에 의해 IndexedDB 초기화가 차단될 때, 이를 보완하여 LocalStorage 등으로 실시간 전환되는 투명한 폴백 메커니즘이 부족합니다.
- 파일: [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts)
- 영향: 차단 환경에서 스토어 호출 시 예외를 던지며 웹 어플리케이션 전체가 먹통이 될 수 있습니다.
- 해결 방향: 데이터 저장 실패 시 LocalStorage에 캐싱 처리하고, IndexedDB가 활성화될 때 마이그레이션하는 복구 로직이 요구됩니다.

## 보안 고려 사항 (Security Considerations)

**DOM 수동 렌더링에 의한 XSS 공격 위험:**
- 위험: 부부 데이터 병합 및 외부 ISF CODE 파싱 시 `sanitizeInputs`를 통해 데이터 정화를 거치고 있지만, 바닐라 JS 렌더러들은 여전히 `IsfUtils.escapeHtml`과 `innerHTML` 수동 생성 방식을 혼재하고 있습니다.
- 파일:
  - [input-sanitizer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/input-sanitizer.js)
  - [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js)
- 영향: DOM 직접 삽입 구조로 인해 필터링되지 않은 특수문자나 기이한 구조의 페이로드가 유입될 경우, Cross-Site Scripting 취약점을 제공할 위험이 남아있습니다.
- 해결 방향: 모든 DOM 조작 시 `textContent`를 사용하거나, React의 JSX 자동 이스케이프 시스템으로 전환하여 인젝션을 원천 봉쇄해야 합니다.

## 성능 병목 구간 (Performance Bottlenecks)

**Sankey 차트의 DOM 직접 재빌드 부하:**
- 문제: Sankey 차트 및 시뮬레이션 렌더링 시, 캔버스를 이용한 실시간 폰트 측정(`measureSankeyTextWidth`)과 모든 SVG 엘리먼트를 수동으로 비우고 재생성하는 연산이 메인 스레드 상에서 매번 수행됩니다.
- 파일: [sankey-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js)
- 영향: 데이터 노드가 많아지거나 모바일 장치에서 화면을 확대/축소(Zoom) 또는 윈도우 크기를 조절할 때 심각한 UI 렉 및 프레임 드랍이 발생합니다.
- 개선 경로: 렌더링 디바운싱 강화, 레이아웃 계산 결과 캐싱, SVG 렌더링 연산의 React 가상 DOM 최적화 적용 등이 필요합니다.

**루프 내 개별 트랜잭션을 통한 백업 삭제 정리 오버헤드:**
- 문제: `BackupService.trimBackups`에서 최대 백업 개수(60개)를 유지하기 위해 오래된 데이터를 삭제할 때, 루프를 돌며 개별 `isfStore.perform` 비동기 트랜잭션을 호출합니다.
- 파일: [BackupService.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/BackupService.ts)
- 영향: 한 번에 삭제해야 할 백업이 많아질 경우 불필요한 트랜잭션 락(Lock)과 중복 디스크 I/O가 발생하여 브라우저 성능을 지연시킵니다.
- 개선 경로: 단일 'readwrite' 트랜잭션 내에서 여러 개의 삭제(`.delete(b.id)`) 처리를 묶어서 한 번에 승인(Commit)하도록 변경해야 합니다.

## 테스트 커버리지 간극 (Test Coverage Gaps)

**단위 및 E2E 테스트 범위 부족:**
- 테스트되지 않은 영역: 대부분의 핵심 비즈니스 로직(시뮬레이션 가치 상승 공식 등) 및 동기화 흐름, 모바일 뷰에서의 UI 레이아웃 안정성.
- 파일: `apps/**/*.js`, `src/**/*.tsx`
- 영향: 데이터 동기화, 병합 로직, 단위 환산 연산 수정 시 의도치 않은 회귀(Regression) 오류 감지가 늦어집니다.
- 우선순위: 높음

---

*Concerns audit: 2026-06-16*
