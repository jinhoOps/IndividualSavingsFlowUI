# 테스트 전략 및 검증 상태 (Testing Strategy & Practices)

본 문서는 개인 저축 흐름 UI(Individual Savings Flow UI) 프로젝트의 테스트 자동화 스택, 검증 절차, 그리고 구현된 테스트 케이스 현황을 설명합니다.

## 1. 테스트 인프라 및 도구 (Testing Infrastructure)

*   **Playwright (E2E 테스트):** UI 및 브라우저 상호작용 검증을 담당합니다. 설정 파일인 [playwright.config.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/playwright.config.ts)를 기반으로 작동하며, `npm run test:e2e` 명령어를 통해 실행할 수 있습니다.
*   **Vitest (단위 테스트):** 패키지 설정([package.json](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/package.json))에 `vitest` 및 `@vitest/ui`가 구성되어 있으며, 점진적 이관 및 통합을 위해 준비되어 있습니다.
*   **커스텀 테스트 스크립트:** 현재 비즈니스 로직 단위 테스트 중 일부(예: 클립보드 파서)는 경량 Node.js 스크립트로 동작하며, assertions 결과를 표준 출력(`console.log`) 형태로 시각화하여 확인하도록 구축되어 있습니다.
*   **정적 분석 (Static Analysis):** TypeScript 컴파일러 설정([tsconfig.json](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/tsconfig.json))을 바탕으로 `npm run check` (`tsc --noEmit`) 명령어를 실행하여 타입 무결성 및 컴파일 에러를 빌드 전 단계에서 필터링합니다.

## 2. 주요 테스트 케이스 및 검증 상태 (Test Cases & Validation Status)

### Playwright E2E 테스트
*   **경로:** [tests/step1.spec.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/tests/step1.spec.ts)
*   **검증 항목:**
    *   **레이아웃 로드 검증:** 메인 `main` 컨테이너와 헤더 타이틀이 올바르게 로드되는지 검증합니다.
    *   **Sankey 다이어그램 높이 제한:** Sankey 뷰포트 영역의 높이가 디자인 요구 사양에 맞게 `440px` 이하로 제한되는지 체크하여 UI 넘침 현상을 감시합니다.
    *   **UI 곡률 정합성:** 선택 상자, 입력란, 버튼의 `border-radius` 스타일이 CSS 토큰 변수인 `var(--rd-sm)` (8px) 사양에 완벽히 정합하는지 직접 계산하여 회귀 현상을 잡아냅니다.
    *   **Sankey 뷰 토글 크기:** 토글 버튼의 높이가 레이아웃 간격 표준인 `28px`에 정확히 수렴하는지 소수점 단위 정밀도로 평가합니다.

### 클립보드 SMS 파서 커스텀 테스트
*   **경로:** [clipboard-parser.test.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/clipboard-parser.test.js)
*   **검증 항목:**
    *   사용자가 금융권 알림(SMS 등)을 복사/붙여넣기하여 스마트하게 소비 항목을 등록할 수 있는 [clipboard-parser.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/clipboard-parser.js) 모듈의 정상 동작 유무를 평가합니다.
    *   신한카드, 현대카드, 토스뱅크, 국민카드(KB) 승인 SMS 포맷에 대해 정규표현식 파싱 기능이 동작하여 정확한 금액(원 단위), 가맹점명, 승인 날짜를 가져오는지 테스트 케이스를 통해 점검합니다.

## 3. 에이전트 주도 검증 파이프라인 (Agent-Driven Testing Methodology)

이 프로젝트는 에이전트의 개발 비중이 높기 때문에 코드가 작성되는 즉시 아래의 3단계 가이드라인을 강제합니다.

1.  **목표 중심의 검증 계획 명시:** 모든 작업 계획서 및 실행 전 단계에서는 아래의 규격과 같이 명시적인 확인(verify) 루프를 정의해야 합니다.
    ```
    1. [구현 단계] → verify: [관측 가능한 확인 항목 / Assertion]
    2. [구현 단계] → verify: [관측 가능한 확인 항목 / Assertion]
    ```
2.  **반응형 및 모바일 품질 보증:** 스타일 시트나 HTML 요소가 수정될 경우, 760px 이하의 모바일 레이아웃 구조가 깨지지 않는지 시각적으로 검증해야 합니다.
3.  **향후 이관 로드맵:** 기존에 작성된 개별 유틸 스크립트 기반 테스트들(예: [clipboard-parser.test.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/clipboard-parser.test.js))을 Vitest 환경 내 유닛 테스트 스위트로 정식 마이그레이션하여 모던 API 검증 체계로의 전환이 요구됩니다.
