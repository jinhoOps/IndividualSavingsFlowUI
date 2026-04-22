---
type: node
created: 2026-04-16
tags: [architecture, no_build, vanilla_js, reference]
---

# Architecture Reference (아키텍처 참조)

IndividualSavingsFlowUI 프로젝트는 빌드 과정이 없는 순수 웹 기술(Vanilla JS, HTML, CSS)을 기반으로 합니다.

## 디렉토리 구조

- `apps/`: 독립적인 실행 단위 (예: `step1`, `step2`). 각 앱은 자체 `index.html`, `app.js`, `styles.css`를 가집니다.
- `shared/`: 여러 앱에서 공유하는 핵심 모듈.
  - `components/`: UI 컴포넌트 (예: `feedback-manager.js`).
  - `core/`: 유틸리티 및 공유 함수 (예: `share-utils.js`, `utils.js`).
  - `pwa/`: Service Worker 및 PWA 관련 로직.
  - `storage/`: IndexedDB 기반의 데이터 허브 및 백업 관리.
  - `styles/`: 공통 CSS 변수 및 테마.

## 모듈 관리

- ES6 Native Modules를 사용하여 빌드 도구 없이 브라우저에서 직접 로드합니다.
- HTML에서 `<script type="module">`을 사용하여 진입점을 정의합니다.
- 거대 단일 파일은 기능별(상태, UI, 계산, 포맷 등) 전문 모듈로 철저히 분리(`modules/` 디렉토리 활용)하여 응집도를 높이고, 최종적으로 컨트롤러 역할을 하는 `app.js`에서 조율합니다. (참고: [[Step1_Modularization_Refactoring]], [[Step2_Modularization_Refactoring]])

## 앱 내 로직 구성 및 복구 원칙 (모듈형 체계)

과거(v0.5 로듈화 전)에는 단일 `app.js` 내부에 3계층이 존재했으나, 현재는 `apps/*/modules/` 안에 역할별로 분리되어 응집도를 높였습니다.

### Step 1 (11개 모듈 체제)
상태(`state`), 상수(`constants`), DOM(`dom`), 정합성(`input-sanitizer`), 포맷터(`formatters`), 계산기(`calculator`), Sankey 빌더(`sankey-builder`), Sankey 렌더러(`sankey-renderer`), 브리지 매니저(`bridge-manager`), 스토리지 매니저(`storage-manager`)로 세분화되어 운영됩니다.

### Step 2 (7개 모듈 체제)
상태(`state`), 상수(`constants`), DOM(`dom`), 계산기(`calculator`), 렌더러(`renderers`), 브리지(`bridge`), 스토리지 핸들러(`storage-handler`)로 구성되어 포트폴리오 관리와 배당 시뮬레이션에 최적화된 구조를 가집니다.

**주의사항 (모듈 이관 교훈):** 
모듈을 분리하거나 리팩터링할 때, 기존 필수 헬퍼 함수 14종 (단위 환산(`toWon`), 미결 변경 기록(`markDirty/markClean`), 정규화(`sanitizeInputs`) 등)이 소실되지 않아야 합니다. 이 함수들 중 하나라도 유실되면 데이터 정합성이나 브리지 저장/불러오기 기능이 즉각 마비됩니다. 
기존의 모든 구현 스펙은 [[Feature_Archive_v0.5]]를 기준으로 동작 파손 여부를 대조해야 합니다.

---
*연결 노드:* [[Data_Model_Reference]], [[UI_Standards_Reference]], [[Operating_Principles]], [[Data_Bridge_Import_Pattern]]
