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
- 리팩터링 시 단일 비대 파일(예: `apps/step1/app.js`)을 기능별 모듈로 분리하되, 빌드 도구가 필요 없는 구조를 유지해야 합니다.

---
*연결 노드:* [[Data_Model_Reference]], [[UI_Standards_Reference]], [[Operating_Principles]]
