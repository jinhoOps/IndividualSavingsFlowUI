# 코드베이스 구조 (Codebase Structure)

**분석 날짜:** 2026-06-16

## 디렉토리 레이아웃 (Directory Layout)

```text
[project-root]/
├── [apps/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/)                    # 단계별 애플리케이션 로직 (Vanilla JS 기반)
│   ├── [step1/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/)                # 개인 자산 흐름 계획 (입력, 계산 및 Sankey 시각화)
│   │   ├── [modules/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/)          # Step 1 전용 서브 모듈 (계산, 입력 정제, 상태 및 렌더러)
│   │   ├── [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js)            # Step 1 메인 오케스트레이터
│   │   ├── [index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/index.html)        # Step 1 HTML 뷰 엔트리
│   │   └── [styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css)        # Step 1 전용 반응형 스타일시트
│   ├── [step2/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step2/)                # 포트폴리오 조정 및 배당 시뮬레이션
│   └── [step3/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/)                # 종합 대시보드 및 KPI 요약
├── [shared/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/)                  # 공통 리소스 및 브라우저 호환성 코드
│   ├── [components/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/)          # 재사용 가능한 Web Components (헤더, 데이터 허브 등)
│   ├── [core/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/)                # 공유 비즈니스 유틸리티, 파서 및 클립보드 파서
│   ├── [legacy/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/legacy/)              # 서비스 워커 파일 등 레거시 인프라
│   ├── [storage/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/storage/)            # 레거시 스토리지 엔진 (IsfHubStorage 등)
│   └── [styles/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/styles/)             # 공유 디자인 시스템 CSS 변수 및 공통 테마
├── [src/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/)                     # 현대화된 TypeScript/React 소스 코드
│   ├── [components/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/components/)           # 점진 도입 중인 React 컴포넌트 레이어
│   ├── [core/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/)                 # 현대적 저장소 로직 및 데이터 타입 정의
│   │   ├── [storage/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/)           # IndexedDB 엔진, 백업 서비스 및 브릿지
│   │   └── [types/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/)             # 모델 인터페이스 및 화폐(Money) 정합성 유틸리티
│   ├── [entries/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/entries/)             # Vite 다중 페이지 번들링용 TS 엔트리 포인트
│   └── [styles/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/styles/)              # 전역 Tailwind CSS v4 설정 파일
├── [public/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/public/)                  # 정적 자산 및 마켓 지수 역사 데이터
├── [scripts/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/scripts/)                 # 버전 관리, 릴리즈용 백엔드 파이프라인 스크립트
└── [.planning/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/)              # 로드맵, 분석 상태 및 지식 위키 데이터
```

## 디렉토리 상세 역할 (Directory Purposes)

### **1. [apps/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/)**
* **목적:** 애플리케이션의 단계별 비즈니스 시나리오를 구성하는 메인 페이지들을 격리 보존합니다.
* **구조:** 각 스텝(`step1/`, `step2/`, `step3/`) 하위에 `app.js`를 배치하고, 내부적인 세부 계산 및 렌더링 동작은 `modules/` 디렉토리의 단일 목적 모듈로 세분화하여 **거대 오케스트레이터 안티패턴**을 방지합니다.

### **2. [shared/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/)**
* **목적:** Vite 빌드 환경과 레거시 비빌드(No-build) 환경 모두에서 전역적으로 사용 가능한 유틸리티 및 UI 컴포넌트를 보유합니다.
* **핵심 모듈:**
  * [app-header.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/app-header.js): 글로벌 상태 바인딩 및 종합소득세 한도 경고를 관리하는 HTML Web Component.
  * [data-hub-modal.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/data-hub-modal.js): 데이터 가져오기/내보내기 및 스냅샷 복원 통합 모달 Shadow DOM Component.
  * [clipboard-parser.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/clipboard-parser.js): 금융 SMS 및 클립보드 원문 데이터 파싱 엔진.

### **3. [src/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/)**
* **목적:** 애플리케이션의 데이터 신뢰성 및 타입 안정성을 강화하기 위해 도입된 TypeScript 및 React 인프라입니다.
* **핵심 모듈:**
  * [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts): 데이터 무결성 보장을 위해 구현된 Repository Pattern 기반의 IndexedDB 연동 코어.
  * [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts): 레거시 애플리케이션 코드의 파괴 없이 전역 스토리지를 IndexedDB로 교체하는 Adapter Pattern 브릿지.
  * [money.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/money.ts): 원 단위 금융 계산 정합성을 수호하기 위한 변환 및 포맷 유틸리티.

### **4. [public/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/public/)**
* 시뮬레이션용 역사적 시장 데이터(`indices/*.json`) 및 PWA 오프라인 구동에 필수적인 `manifest.webmanifest`, 아이콘 자산들을 포함합니다.

---

## 신규 코드 추가 가이드 (Code Extension Guidelines)

새로운 기능을 추가하거나 기존 구조를 리팩토링할 때는 아래 가이드를 엄격히 따라 올바른 디렉토리에 코드를 배치해야 합니다.

* **새로운 UI 공통 컴포넌트를 만들 때:**
  * 웹 컴포넌트 형태로 모든 단계에 적용해야 하는 경우: [shared/components/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/) 에 `.js` 파일로 작성하십시오.
  * 점진 도입 중인 React 컴포넌트로 구현할 경우: [src/components/common/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/components/common/) 하위에 `.tsx` 파일로 작성하십시오.
* **새로운 비즈니스 계산 및 도메인 로직을 추가할 때:**
  * 특정 스텝 전용 로직일 경우: [apps/step[N]/modules/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/) 에 추가하십시오.
  * 여러 스텝에서 공통으로 재사용하는 자산 파서 등일 경우: [shared/core/](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/) 에 추가하십시오.
* **데이터 모델 정의 또는 스토리지 확장이 필요할 때:**
  * 새로운 데이터 타입/인터페이스 정의: [src/core/types/models.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/types/models.ts) 에 정의하십시오.
  * IndexedDB 스토어 테이블 추가 및 쿼리 구현: [IsfStore.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/IsfStore.ts) 의 스키마 업데이트 및 관련 데이터베이스 액션 메서드를 추가하십시오.
  * 레거시 JS 앱에서의 노출 바인딩: [CompatibilityBridge.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/core/storage/CompatibilityBridge.ts) 에 어댑터를 작성하여 전역 윈도우에 연결하십시오.
