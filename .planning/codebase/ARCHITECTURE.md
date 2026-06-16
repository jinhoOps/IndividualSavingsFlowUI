# 아키텍처 (Architecture)

**분석 날짜:** 2026-06-16

## 시스템 개요 (System Overview)

본 프로젝트는 현대화된 빌드 시스템(Vite/TypeScript/Tailwind CSS v4)을 도입하면서도 기존 Vanilla JS 애플리케이션의 강점인 브라우저 가용성을 동시에 확보하는 **현대적 하이브리드 아키텍처(Modern Hybrid Architecture)**를 채택하고 있습니다. 

```text
┌───────────────────────────────────────────────────────────────────┐
│                       애플리케이션 엔트리                         │
│  [index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/index.html)                                                     │
│  [apps/step1/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/index.html) -> [step1.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/entries/step1.ts)                         │
│  [apps/step2/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step2/index.html) -> [step2.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/entries/step2.ts)                         │
│  [apps/step3/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/index.html) -> [step3.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/entries/step3.ts)                         │
├───────────────────┬───────────────────┬───────────────────────────┤
│    Step 1 (JS)    │    Step 2 (JS)    │    Step 3 (JS)            │
│  개인 자산 흐름   │  포트폴리오 시뮬  │   종합 대시보드           │
└─────────┬─────────┴─────────┬─────────┴─────────────┬─────────────┘
          │                   │                       │
          ▼                   ▼                       ▼
┌───────────────────────────────────────────────────────────────────┐
│                    비즈니스 로직 계층 (Logic Layer)               │
│  - [apps/step1/modules/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/) (Modular Vanilla JS)                          │
│  - [shared/core/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/) (Common Utilities & Parsers)                        │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│         외부 데이터 브릿지 계층 (Compatibility Bridge Layer)       │
│  - [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts) (Legacy APIs to TypeScript Redirects)  │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│              현대화 저장소 및 타입 계층 (Storage Layer)           │
│  - [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts) (Modern IndexedDB Engine)                      │
│  - [BackupService.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/BackupService.ts) (Automated & Manual Backup Services)        │
│  - [models.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/models.ts) & [money.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/money.ts) (Type definitions)              │
└───────────────────────────────────────────────────────────────────┘
```

## 컴포넌트 역할 (Component Responsibilities)

| 컴포넌트 | 역할 | 파일 경로 |
|:---|:---|:---|
| **App Orchestrator** | 화면 단위 모듈 이벤트 흐름 조율 및 렌더링 오케스트레이션 | [apps/step1/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js) |
| **Logic Modules** | 금융 시뮬레이션 계산, 데이터 정제, 상태 가공 헬퍼 | [apps/step1/modules/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/) |
| **Compatibility Bridge** | 레거시 스토리지 전역 변수(`IsfStorageHub`, `IsfBackupManager`) 및 유틸리티를 현대 TS 서비스로 맵핑 | [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts) |
| **IsfStore** | 현대화된 IndexedDB (`isf-v2-db`) 기반의 다중 테이블 상태/이력 영속화 스토어 | [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts) |
| **BackupService** | 주기적 자동 백업(12시간 주기) 및 수동 백업 생성/삭제 관리 (최대 60개 보존) | [BackupService.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/BackupService.ts) |
| **Shared Web Components** | 공통 UI 뷰 계층 (상단 글로벌 헤더, 데이터 허브 모달, 알림 피드백) | [shared/components/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/) |
| **React Components** | 현대적 컴포넌트 점진 도입 (Toast 알림 등) | [src/components/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/components/) |

## 주요 디자인 패턴 (Key Design Patterns)

### 1. 외부 데이터 브릿지 패턴 (Compatibility Bridge Pattern)
* **목적:** 기존 Vanilla JS 앱 코드의 대규모 파괴를 방지하면서도 현대적인 데이터 무결성을 확보하기 위해 전역 API 호출을 가로챕니다.
* **동작:** Vite 빌드로 각 step의 HTML이 파싱될 때 [step1.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/entries/step1.ts) 등의 엔트리 파일에서 [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts)를 Side Effect로 가장 먼저 임포트합니다. 
* **효과:** `window.IsfStorageHub`와 `window.IsfBackupManager`가 동적으로 덮어씌워져, 레거시 JS 앱에서 동작하는 모든 스토리지 API 호출이 TypeScript로 구현된 IndexedDB 기반의 `isfStore`와 `backupService`로 완벽히 리다이렉트됩니다.

### 2. 3계층 구조 (State/Helper/UI)
* **State (상태 계층):** 애플리케이션의 핵심 데이터 객체로, [state.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state.js)에서 한곳에 모아 관리합니다.
* **Helper/Logic (비즈니스 로직 계층):** DOM에 의존하지 않는 순수 계산 함수들로 구성됩니다. 예: [calculator.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/calculator.js), [input-sanitizer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/input-sanitizer.js).
* **UI/Renderer (렌더링 계층):** 상태의 변화를 감지하고 렌더링에만 집중하는 파일들입니다. 예: [sankey-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js), [list-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/list-renderer.js).

### 3. 편집/확정 2중 상태 관리 패턴 (Draft State Pattern)
* 사용자의 빈번한 입력 수정 도중 불안정한 상태가 직접 DB에 반영되는 것을 막기 위해 `draftInputs`와 `inputs`로 구성된 2중 버퍼 구조를 사용합니다.
* 사용자가 입력을 수정하기 시작하면 [state-helpers.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state-helpers.js)의 `markDirty`를 통해 `state.draftInputs`가 할당되고, 임시 변경사항을 여기에 기록합니다.
* 저장을 누르면 `draftInputs`가 `inputs`에 머지되고 `markClean`으로 임시 버퍼를 초기화한 뒤 IndexedDB에 동기화합니다.

## 데이터 흐름 (Data Flow)

### 1. 사용자 입력 및 실시간 금융 계산 흐름
```text
[사용자 입력 (UI)]
      │
      ▼
[input-sanitizer.js] ──► 원(Won) 단위 정제 및 데이터 구조 검증
      │
      ▼
[state-helpers.js] ──► markDirty() 호출로 draftInputs 임시 버퍼 활성화
      │
      ▼
[calculator.js] ──► 월간 자산 흐름 계산 및 이자/배당 금융종합소득 연산
      │
      ├───────────────────────────────┐
      ▼ (금융종합소득과세 한도 검증)   ▼ (Sankey 빌더)
[AppHeader (Warning Trigger)]   [sankey-builder.js]
  - 1,900만원 초과: warn          - 노드/링크 데이터 가공
  - 3,400만원 초과: crit
      │                               │
      ▼                               ▼
[글로벌 헤더 경고 툴팁 표시]    [sankey-renderer.js / UI 렌더링]
```

### 2. 영속화 및 백업 흐름
1. **스냅샷 저장:** 사용자가 '저장' 버튼을 클릭하면 `app.js`에서 `IsfStorageHub.saveStep1Snapshot`을 호출합니다.
2. **브릿지 가로채기:** [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts)가 이 호출을 받아 [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts)의 `isfStore.saveStep1`로 전달합니다.
3. **IndexedDB 영속화:** `isfStore`는 활성 데이터를 `localStorage`에 임시 캐싱하고, IndexedDB의 `step1_history` 테이블에 영속화합니다. 이 과정에서 최대 50개의 스냅샷 이력을 초과하면 가장 오래된 이력을 청소(trim)합니다.
4. **자동 백업:** 데이터가 저장될 때마다 [BackupService.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/BackupService.ts)는 마지막 자동 백업 시점을 비교하여 12시간이 경과한 경우 `backups` 테이블에 새로운 자동 스냅샷을 생성합니다 (최대 60개 제한).

## 아키텍처 제약 사항 (Architectural Constraints)

* **단위 정합성 (Unit Consistency):**
  * 모든 내부 연산, 저장소(IndexedDB, LocalStorage, 백업본)에 보존되는 금액 데이터는 반드시 **원(Won) 단위**의 정수 형태로 보존되어야 합니다.
  * UI 계층에서 입력을 쉽게 받거나 표시할 때만 `toMan`을 통해 **만원 단위**로 변환하며, 1억 원 이상의 경우 가독성을 위해 `X억 Y만원`으로 변환 렌더링합니다.
* **물리적 무결성 (Physical Integrity):**
  * CSS 및 HTML 수정 시, 모바일 해상도(760px 이하)를 지원하기 위한 `@media` 쿼리가 빌드 파이프라인에서 절삭되거나 누락되지 않도록 철저히 검증되어야 합니다.
* **점진적 현대화 가이드라인:**
  * React 및 TypeScript는 코어 엔진(스토리지, 백업, 단위 처리 유틸) 영역에서 우선 주도하며, Vanilla UI는 점진적으로 React 컴포넌트로 이식되어야 합니다. 과도기 상태에서는 브릿지 모듈을 필수로 준수해야 합니다.
