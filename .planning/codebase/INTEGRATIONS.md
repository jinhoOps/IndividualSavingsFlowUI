<!-- generated-by: gsd-doc-writer -->
# System Integrations (시스템 통합)

이 문서는 Individual Savings Flow UI(ISF)의 각 단계 간 통신, 데이터 저장 방식 및 PWA 동기화 메커니즘을 설명합니다.

## 1. 단계 간 통신 (Inter-Step Communication)

ISF는 각 단계를 독립적인 앱처럼 운영하면서도, 데이터를 공유하기 위해 **브릿지 패턴(Bridge Pattern)**을 사용합니다.

- **IndexedDB 기반 동기화**:
  - **Step 1 (Snapshot 생성)**: 사용자가 현금 흐름을 설정하면 `IsfStorageHub`를 통해 `step1Snapshots` 스토어에 데이터 스냅샷을 저장합니다.
  - **Step 2 (Data Import)**: `Step1Connector`가 IndexedDB에서 최신 스냅샷을 감지하여 사용자가 시뮬레이션에 반영할 수 있도록 안내(배너 노출) 및 데이터 동기화를 수행합니다.
  - **Step 3 (Rebalancing)**: Step 1의 자산/투자 여력 데이터를 참조하여 계좌별 자산 재배분 시뮬레이션을 초기화합니다.
- **SessionStorage**: 단일 세션 내에서 페이지 이동 시 발생하는 임시 상태(Draft)를 유지하기 위해 사용됩니다.
- **URL Hash (Shared State)**: `LZ-based compression`을 사용하여 현재 앱 상태를 URL 해시로 인코딩하며, 이를 통해 설치나 로그인 없이도 상태 공유가 가능합니다.

## 2. 데이터 저장소 (Storage Architecture)

ISF는 서버가 없는 오프라인 우선(Offline-first) 앱으로, 브라우저 스토리지에 전적으로 의존합니다.

### IndexedDB (`isf-hub-db-v1`)
- **Primary Storage**: `IsfStorageHub`를 통해 관리되는 핵심 저장소입니다.
- **주요 스토어**:
  - `step1Snapshots`: Step 1의 입력값 이력 (최대 20개 유지).
  - `step2Entries`: Step 2의 시뮬레이션 결과물 및 포트폴리오 설정.
  - `backups`: `IsfBackupManager`가 관리하는 버전별 자동/수동 백업 데이터.

### LocalStorage
- **설정 및 메타데이터**: 앱 테마, 온보딩 완료 여부, 마지막 확인 버전 등 가벼운 상태값을 저장합니다.
- **Current View Data**: 현재 화면에 표시되는 입력 데이터의 실시간 보존을 위해 사용됩니다.

## 3. PWA 및 동기화 (PWA & Sync)

`IsfPwaManager`가 관리하며, 네트워크 상태와 상관없이 안정적인 사용자 경험을 제공합니다.

- **Service Worker (`sw.js`)**: 정적 자산을 캐싱하여 오프라인 실행을 보장하고, 업데이트 발생 시 제어권을 가집니다.
- **버전 관리 (Version Awareness)**:
  - `manifest.webmanifest`의 `version` 필드를 주기적으로 체크하여 새 버전 배포를 감지합니다.
  - 새 버전 발견 시, 사용자 데이터를 보호하기 위해 **업데이트 직전 자동 백업**을 수행한 후 `skipWaiting`을 통해 앱을 갱신합니다.
- **네트워크 상태 피드백**: 온라인/오프라인 상태 변화를 감지하여 사용자에게 알림을 제공합니다.

## 4. 공통 코어 유틸리티 (Shared Core Utilities)

`shared/core/` 디렉토리의 유틸리티는 모든 단계에서 동일한 계산 로직과 포맷팅을 보장합니다.

- **IsfUtils (`utils.js`)**:
  - **금융 계산**: 금융소득종합과세 임계치 체크, 누진세율 기반 소득세 계산 등 한국 금융 환경에 특화된 계산 로직.
  - **데이터 정제**: 금액(`sanitizeMoney`), 이율(`sanitizeRate`) 등 사용자 입력값의 무결성 검증.
  - **포맷팅**: 금액(억원/만원 단위 변환), 타임스탬프 등 UI 일관성을 위한 유틸리티.
- **IsfShare (`share-utils.js`)**: 
  - 상태 데이터의 압축 및 해시 생성/해독을 담당합니다.
- **Components**: `app-header`, `data-hub-modal` 등의 웹 컴포넌트는 모든 단계에서 동일한 GNB와 데이터 관리 UI를 제공합니다.

---
*최종 업데이트: 2026-05-08 (v0.9.16 기준)*
