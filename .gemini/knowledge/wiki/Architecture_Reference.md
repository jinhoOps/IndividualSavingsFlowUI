---
type: node
created: 2026-05-04
tags: [architecture, modernization, vite, typescript, reference]
---

# Architecture Reference (아키텍처 참조)

IndividualSavingsFlowUI 프로젝트는 v1.1.0-alpha.1부터 **현대적 개발 스택(Modern DX)**을 기반으로 하며, 빌드 도구(Vite)를 사용하여 성능과 안정성을 극대화합니다.

## 기술 스택 (Tech Stack)

- **Runtime**: Vite 8 (Modern ESM)
- **Language**: TypeScript (TS) & Modern JavaScript
- **Styling**: TailwindCSS v4 (@theme 기반 설정)
- **Framework**: React/Preact (v1.1.0+ 도입 시작) 및 Native Web Components
- **Deployment**: GitHub Actions를 통한 자동 PWA 배포

## 디렉토리 구조

- `src/`: 현대화된 소스 코드의 중심.
  - `core/`: 핵심 로직 및 타입 정의.
    - `storage/`: `IsfStore.ts`, `BackupService.ts` 등 신규 스토리지 레이어.
    - `types/`: `money.ts` (Branded Types), `models.ts` 등 SSOT 타입 정의.
  - `entries/`: Vite의 멀티 페이지(MPA) 진입점 (`step1.ts`, `step2.ts` 등).
  - `styles/`: `globals.css` (Tailwind v4 기반 글로벌 스타일).
- `apps/`: 레거시 바닐라 JS 앱들. 점진적으로 `src/` 하위로 마이그레이션 중.
  - 각 앱은 `index.html`을 가지며, `src/entries/`를 참조하여 현대화된 인프라를 활용함.
- `shared/`: 레거시 공유 모듈. (신규 기능은 `src/core/` 활용 권장)

## 모듈 및 빌드 관리

- **Vite MPA**: 멀티 페이지 애플리케이션 구조를 유지하면서 번들링 및 코드 스플리팅을 자동화합니다.
- **PWA 자동화**: `vite-plugin-pwa`를 통해 Service Worker(`sw.js`) 및 매니페스트를 자동 생성하고 캐시 정책을 관리합니다.
- **TypeScript**: 정적 타입 검사를 통해 런타임 에러를 방지하며, 특히 '원 vs 만원' 단위 실수를 코드 레벨에서 차단합니다.

## 스토리지 아키텍처 (Modern Storage v2)
v1.1.0부터 모든 데이터 영속화 로직은 `src/core/storage/IsfStore.ts`로 현대화되었습니다.

### 핵심 철학: 시스템 무결성 (Integrity First)
- **Branded Types**: `Won`, `ManWon` 타입을 구분하여 산술 연산 시 단위 실수를 방지합니다. ([[Data_Model_Reference]] 참조)
- **Legacy Wipe (v2 DB)**: 기존 `isf-hub-db-v1`의 복잡한 마이그레이션 부채를 제거하고 깨끗한 `isf-v2-db` 체제로 전환했습니다.
- **Compatibility Bridge**: 레거시 바닐라 JS 앱들이 수정 없이도 새 스토리지 레이어를 사용할 수 있도록 `CompatibilityBridge.ts`가 구형 API(`window.IsfStorageHub`)를 가로채어 새 서비스로 연결합니다.

### 데이터 흐름 (Data Flow)
1. **Input**: 사용자가 UI에서 '만원' 단위로 입력.
2. **Sanitize**: `MoneyUtils.toWon`을 통해 내부 데이터인 '원' 단위로 즉시 변환.
3. **Persist**: `IsfStore`가 IndexedDB 및 LocalStorage에 '원' 단위로 영속화.
4. **Bridge**: Step 2 등 다른 페이지에서 필요 시 `IsfStore`를 통해 원 단위 데이터를 조회하여 정밀한 계산 수행.

---
*연결 노드:* [[Data_Model_Reference]], [[UI_Standards_Reference]], [[Operating_Principles]]
