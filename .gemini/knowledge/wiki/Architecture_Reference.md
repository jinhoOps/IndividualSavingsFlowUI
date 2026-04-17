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
- 거대 단일 파일은 기능별(상태, UI, 계산, 포맷 등) 전문 모듈로 철저히 분리(`modules/` 디렉토리 활용)하여 응집도를 높이고, 최종적으로 컨트롤러 역할을 하는 `app.js`에서 조율합니다. (참고: [[Step1_Modularization_Refactoring]])

## 앱 내 로직 구성 및 복구 원칙

각 앱의 `app.js`는 다음 세 가지 계층으로 구성됩니다.
1. **상태 관리 (State Management):** `state` 객체 내에 `draft`(현재 편집 중인 포트폴리오/가계부)와 `currentId` 등을 관리합니다.
2. **필수 헬퍼 함수 (Core Helpers):** 데이터 무결성과 UI 렌더링을 돕는 유틸리티입니다.
   - 예: `createEmptyDraft`, `getAccountById`, `formatCurrency`, `markDirty`, `markClean`, `sanitizeRate` 등.
3. **렌더링 및 인터랙션 (UI Logic):** DOM 업데이트와 이벤트 리스너를 담당합니다.

**주의사항 (Step 2 교훈):** 리팩터링 시 위 14개 이상의 필수 헬퍼 함수가 소실되면 앱이 정상 작동하지 않거나, 저장 기능이 마비될 수 있습니다. 특히 `markDirty/markClean`과 같은 상태 플래그 관리 함수가 누락되지 않도록 주의해야 합니다.

---
*연결 노드:* [[Data_Model_Reference]], [[UI_Standards_Reference]], [[Operating_Principles]], [[Data_Bridge_Import_Pattern]]
