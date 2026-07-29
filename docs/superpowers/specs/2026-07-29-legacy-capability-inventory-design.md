# 레거시 기능·데이터 계약 Inventory 설계

## 목적

현재 ISF에서 레거시 코드는 지원 제품이나 신규 기능 기반이 아니라 기능과 데이터 계약을 파악하기 위한 임시자원이다. 이번 작업은 레거시를 기능 단위로 목록화하고 `이관`, `폐기`, `판정 대기`로 분류해 후속 migration spec의 입력물을 만든다.

이번 작업에서는 runtime 코드, 테스트, 저장 key, 문서와 build 설정을 삭제하거나 이전하지 않는다.

## 기준선

- 프론트엔드 지향점은 Bedrock 철학이다.
- Bedrock 기술 기준은 Vite 정적 MPA, React, TypeScript, Tailwind CSS와 Vite PWA다.
- HTML, URL, form, link 같은 웹 표준을 기본 계약으로 사용한다.
- React는 선언적 UI와 화면 상태, TypeScript는 domain·application·infrastructure 경계, Tailwind CSS는 표현 계층을 담당한다.
- 계산과 검증은 React 밖의 순수 함수로 유지한다.
- 데스크톱과 PWA 모바일 화면을 같은 제품 기준선에서 함께 개발한다.
- 서버 계정 없이 local-first로 동작하며 GitHub Pages 정적 배포를 유지한다.
- Main의 실제 entry는 `apps/main/index.html`이 불러오는 `src/main/main.tsx`다.
- Main 현재 schema는 `isf-main-v2`의 scalar cashflow 구조다.
- Main 현재 편집기는 React `ScalarEditor`다. 이전 Financial Detail Modal, Sankey와 Account Map 진입은 현재 Main runtime 기준선이 아니다.
- `apps/main/app.js`와 `apps/main/modules/**/*.js`는 Main entry에서 실행되지 않는다.
- Simulation, Portfolio, Account Map은 현재 제품 목적지다. 해당 앱이 JavaScript로 구현됐다는 이유만으로 레거시로 분류하지 않는다.
- Account Map은 `apps/main/modules/input-sanitizer.js`를 동적 import한다.
- Simulation, Portfolio, Account Map connector는 `isf-rebuild-v1` 또는 과거 Step 1 snapshot 계약을 읽는다.
- `shared/legacy/sw.js`는 이전 Main module을 precache 목록에 포함한다.
- `tests/step1.spec.ts`와 `tests/main-compat.spec.ts`는 이전 Main module과 저장 계약을 직접 검증한다.
- Product PRD와 제품 방향 문서에 남은 Financial Detail Modal, Sankey, Account Map 진입의 현재 상태 주장은 실제 runtime 및 최신 Main spec과 충돌한다. 이번 inventory는 Bedrock runtime을 기준으로 판정하며 기준 문서 정정은 별도 documentation spec에서 처리한다.

## 검토한 접근

### 1. 파일 경로 중심 일괄 삭제

`apps/main/**/*.js`와 이름에 `legacy`가 포함된 파일을 한 번에 제거한다. 빠르지만 Account Map sanitizer, cross-app connector, service worker와 compatibility test 계약을 손상시킬 위험이 크다. 채택하지 않는다.

### 2. 기능·데이터 계약 중심 inventory

기능을 사용자 동작, 계산, 저장, connector, build, test로 나누고 원본 파일, 현재 대체 구현, 소비자, 판정과 삭제 gate를 기록한다. 파일 하나에 여러 책임이 섞인 현재 구조에서도 안전하게 migration 단위를 정할 수 있다. 이 접근을 채택한다.

### 3. inventory와 전체 migration 동시 수행

분석 중 발견한 참조를 바로 TypeScript로 이전하고 레거시를 삭제한다. 작업 범위가 커지고 판정과 구현이 섞여 회귀 원인을 추적하기 어렵다. 후속 spec으로 분리한다.

## 분류 규칙

### 이관

현재 제품 또는 승인된 데이터 호환성에 필요한 기능이지만 현재 책임 경계가 레거시 module이나 schema에 남아 있다.

필수 기록:

- 현재 소비자
- 새 소유 module
- 입력·출력 계약
- 저장 key 또는 snapshot schema
- 이전 전후 사용자 관찰 결과
- 제거 전 검증

### 폐기

현재 제품 기준선에 대체 구현이 있거나 현재 사용자 경계에서 명시적으로 제외된 기능이다.

필수 기록:

- 폐기 근거
- runtime 비참조 증거
- 관련 test·service worker·문서 참조
- 구버전 데이터 보존 필요 여부

### 판정 대기

현재 기준 문서와 구현이 다르거나 제품 필요 여부가 승인되지 않은 기능이다. 판정 전 구현과 테스트를 삭제하지 않는다.

필수 기록:

- 충돌하는 기준 또는 미정 질문
- 영향 받는 소비자와 데이터
- 제품 결정권자

## 기능 Inventory

| 기능·계약 | 주요 레거시 원본 | 현재 상태·소비자 | 판정 | 후속 gate |
| --- | --- | --- | --- | --- |
| 이전 Main shell, DOM, event, controller | `apps/main/app.js`, `bootstrap-controller.js`, `dom.js`, `event-bindings.js`, `feature-controllers.js`, `ui-controller.js`, `render-orchestrator.js`, `visualization-controller.js` | Main runtime은 React entry 사용. 이전 shell은 직접 실행되지 않음 | 폐기 | legacy Main test와 precache 참조 제거 후 runtime smoke test |
| 이전 Main 상세 항목 편집 | `financial-modal-controller.js`, `list-renderer.js`, `state.js`, `state-helpers.js`, `persistence-controller.js` | 현재 Main은 scalar cashflow 편집과 `isf-main-v2` 저장 사용 | 폐기 | 현재 Main 적용·취소·복구·저장 회귀 유지, v1 데이터 보존 정책 확인 |
| 이전 Main preset·onboarding | `preset-setup-controller.js`, `presets.js`, `onboarding-manager.js` | 현재 Setup Flow가 첫 경험 소유 | 폐기 | 신규·재설정 flow E2E로 대체 증명 |
| 월간 scalar cashflow·검증 | 이전 `calculator.js`, `input-sanitizer.js` 일부 | `src/main/domain/cashflow.ts`, `model.ts`, `validation.ts`가 현재 소유 | 폐기 | 동일 scalar 입력 결과 focused comparison 후 이전 구현 제거 |
| 장기 projection·summary cards | `calculator.js` | 현재 Main TypeScript에 동일 기능 없음. Product PRD의 projection 표현과 현재 UI 사이 확인 필요 | 판정 대기 | 제품 기준 확정 후 Main, Simulation 또는 폐기 중 선택 |
| Sankey build·render·PNG export | `sankey-builder.js`, `sankey-renderer.js` | 현재 Main scalar UI에는 이전 module runtime 연결 없음. 기준 문서는 Sankey를 현재 기능으로도 기술 | 판정 대기 | 현재 제품 요구 정정 또는 새 소유 경계 승인 |
| household budget·historical comparison | `household-budget.js`, `comparison-engine.js`, `comparison-renderer.js` | 현재 Main v2 schema와 UI에서 사용하지 않음. 향후 제품 후보와 일부 의미가 겹침 | 판정 대기 | 향후 기능 spec에서 재사용할 계약만 추출하고 UI 구현은 복사하지 않음 |
| account correction·network map·transfer | `account-correction.js`, `network-map-renderer.js`, sanitizer의 account/transfer 처리 | Main에서는 제외. Account Map은 v1-shaped Main data와 sanitizer를 사용 | 이관 | Account Map 전용 TypeScript 입력 adapter와 schema를 만든 뒤 legacy Main import 제거 |
| Account Map entry summary | `account-map-entry-renderer.js` | 현재 React Main 기준선과 Account Map 진입 계약 대조 필요 | 판정 대기 | 현재 Main 진입 동작 확인 후 폐기 또는 React 소유로 명시 |
| v1 입력 sanitize·구버전 schema | `input-sanitizer.js`, `external-input-guard.js`, `constants.js`의 `isf-rebuild-v1` 계약 | Account Map이 동적 import. 다른 앱 connector도 v1 key와 snapshot shape 사용 | 이관 | 공용 compatibility adapter로 최소 계약 추출, fixture 기반 호환성 검증 |
| v1 snapshot·share·storage | `storage-manager.js`, `snapshot-manager.js`, `persistence-controller.js`, shared storage bridge | Simulation·Portfolio·Account Map이 hub와 과거 snapshot에 의존 | 이관 | 앱별 read/write 방향과 key 목록 확정, current adapter로 이전 |
| 이전 Main formatter·UI renderer | `formatters.js`, `financial-summary.js`, `financial-summary-renderer.js` | Main runtime 미사용. 일부 순수 표현 계약만 중복 가능 | 폐기 | 현재 TypeScript UI snapshot/format test로 필요한 표현 확인 |
| legacy service worker precache | `shared/legacy/sw.js` | 이전 Main module을 precache. version script가 파일을 갱신 | 이관 | 현재 Vite PWA 산출물 소유권 확인, 이전 precache와 version sync 참조 제거 |
| legacy Main browser tests | `tests/step1.spec.ts` | 이전 module, DOM, `isf-rebuild-v1` 동작을 대량 직접 검증 | 폐기 | 현재 사용자 동작·공개 compatibility 계약으로 필요한 coverage 이전 후 삭제 |
| compatibility browser tests | `tests/main-compat.spec.ts` | v2가 legacy store를 건드리지 않는 계약과 sanitizer 비교를 함께 검증 | 이관 | store 비변경 계약은 유지하고 legacy module 직접 import assertion 제거 |
| 다른 앱 JavaScript runtime | `apps/simulation/**`, `apps/portfolio/**`, `apps/account-map/**` | 현재 Vite entry가 실제 로드하는 지원 제품 | 현재 제품 | 별도 현대화 spec 없이는 레거시 삭제 범위에 포함하지 않음 |

## 데이터 계약 Inventory

| 계약 | 현재 소비자 | 상태 | 처리 원칙 |
| --- | --- | --- | --- |
| `isf-main-v2` | React Main, Main history | 현재 | 변경하지 않음 |
| `isf-main-v2-pending`, setup progress, recovery keys | React Main | 현재 | 변경하지 않음 |
| `isf-rebuild-v1` | Account Map, Simulation, Portfolio, legacy tests | 이관 대상 | 소비 field를 앱별로 목록화한 adapter spec 필요 |
| 이전 Step 1 IndexedDB snapshot | Simulation, Portfolio, Account Map | 이관 대상 | fallback 순서와 timestamp 의미 보존 |
| `IsfStorageHub` global API | non-Main apps | compatibility bridge | 호출 method와 실패 fallback을 inventory한 뒤 typed facade 검토 |
| legacy share/hash schema | legacy Main tests와 module | 판정 대기 | 현재 지원 여부와 사용자 데이터 보존 정책 확정 전 삭제 금지 |

## 후속 작업 경계

Inventory 결과는 다음 순서의 독립 spec으로 나눈다.

1. Cross-app Main read adapter
   - `isf-main-v2`에서 Simulation, Portfolio, Account Map이 필요한 최소 projection을 제공한다.
   - v1 snapshot은 read-only compatibility fallback으로 격리한다.
2. Account Map sanitizer extraction
   - Account Map이 `apps/main/modules/input-sanitizer.js`를 import하지 않게 한다.
3. Storage bridge migration
   - non-Main 앱의 `IsfStorageHub` 사용 method와 fallback을 typed facade로 이동한다.
4. Legacy Main test replacement
   - 사용자 관찰 동작과 공개 데이터 계약만 현재 test suite로 이전한다.
5. Legacy Main runtime removal
   - runtime, precache, version script, test와 문서 참조가 모두 제거된 뒤 파일을 삭제한다.

장기 projection, Sankey, household budget, historical comparison과 Account Map entry는 제품 판정 후 별도 기능 spec으로 이동한다.

## 검증

이번 inventory 문서의 검증:

- 모든 `apps/main/modules/*.js`가 기능 표 항목에 포함되는지 확인한다.
- Main과 다른 앱의 실제 HTML/Vite entry를 대조한다.
- `apps/main/modules`, `isf-rebuild-v1`, `shared/legacy/sw.js`, `IsfStorageHub` 참조를 검색한다.
- `git diff --check`를 실행한다.
- Product PRD의 현재 제품, migration transition, future expansion 경계와 모순이 없는지 확인한다.

## 완료 조건

- 레거시가 지원 제품이 아니라 임시자원임을 명시한다.
- 파일이 아니라 기능·데이터 계약 단위로 분류한다.
- 각 항목에 `이관`, `폐기`, `판정 대기` 또는 `현재 제품` 상태가 있다.
- 현재 소비자와 삭제 gate가 기록된다.
- 코드 삭제나 migration 구현을 이번 범위에 포함하지 않는다.
- 후속 spec 순서와 제품 판정이 필요한 항목이 분리된다.
