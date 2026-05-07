<!-- generated-by: gsd-doc-writer -->
# Coding Conventions (코딩 컨벤션)

이 문서는 Individual Savings Flow UI (ISF) 프로젝트의 코딩 표준, 명명 규칙 및 워크플로우를 정의합니다. 모든 에이전트와 개발자는 시스템의 무결성을 위해 이 규칙을 준수해야 합니다.

## 1. 기본 원칙 (Core Principles)
- **언어 및 인코딩**: 모든 응답, 코드 주석, 가이드는 **한국어(존댓말)**와 **UTF-8**을 사용합니다.
- **에이전트 행동 지침**:
    - **외과적 수정**: 요청받은 범위 외의 코드를 임의로 수정하지 않으며, 기존 스타일을 존중합니다.
    - **주석 최소화**: 에이전트 간 효율적인 컨텍스트 전달을 위해 설명형 주석을 지양하고 코드 자체의 가독성을 높입니다.
    - **단순성 우선**: 불필요한 추상화를 피하고 검증 가능한 가장 단순한 구현 방식을 선택합니다.

## 2. 기술 스택 및 개발 표준 (Tech Stack & Standards)
- **주요 언어**: **TypeScript (TS/TSX)**를 기본으로 사용하며, 엄격한 타입 정의를 권장합니다.
- **UI 프레임워크**: **React** (Functional Components)를 사용하여 현대적인 UI를 구축합니다.
- **스타일링**:
    - **Tailwind CSS (v4)** 유틸리티 클래스를 우선적으로 사용합니다.
    - 레거시 CSS의 경우 BEM 또는 Snake Case 명명 규칙을 유지합니다.
    - **Mobile-First**: 760px 이하 모바일 레이아웃 무결성을 최우선으로 하며, 미디어 쿼리는 파일 하단에 배치합니다.
- **테스트**: **Vitest**를 사용하며, 테스트 파일은 `*.test.ts` 형식을 따릅니다.

## 3. 명명 규칙 (Naming Conventions)
- **React 컴포넌트**: PascalCase (예: `AssetChart.tsx`, `BacktestDashboard.tsx`).
- **일반 함수 및 변수**: camelCase.
- **상수**: UPPER_SNAKE_CASE.
- **파일 및 디렉터리**:
    - 컴포넌트 파일은 PascalCase를 사용합니다.
    - 로직 및 유틸리티 파일은 camelCase 또는 kebab-case를 사용합니다.
    - 디렉터리는 역할별로 구분합니다 (`src/core/`, `src/components/`, `src/entries/`).

## 4. 데이터 및 단위 정합성 (Data Integrity)
- **단위 규칙 (필수)**:
    - **UI 및 표시**: **만원** 단위 (1억 원 이상은 `X 억 Y 만원` 형태로 표기).
    - **계산 및 저장**: **원** 단위로 영속화합니다.
    - 단위 변환 시 `IsfUtils.toWon`, `IsfUtils.toMan` 등 표준 헬퍼를 반드시 사용합니다.
- **금융 정책**:
    - 이자/배당 소득 경고 기준: 연간 1,900만 원 초과 시 `warn`, 3,400만 원 초과 시 `crit`.

## 5. 버전 관리 및 Git 워크플로우 (Version & Git Workflow)
- **버전 Bump 필수**: 코드 변경이 수반되는 모든 작업 완료 시, `package.json`의 패치 버전을 반드시 **+1** 합니다.
- **SSOT (Single Source of Truth)**: `package.json`의 `version` 필드가 모든 버전 정보의 유일한 원천입니다.
- **브랜치 전략**: `main` 브랜치를 기본으로 하며, 신규 기능은 `feat/feature-name` 브랜치에서 작업합니다.
- **자동화**: Vite 빌드 프로세스를 통해 버전 정보가 UI(앱 헤더 등) 및 PWA 매니페스트에 자동 주입됩니다.

## 6. 문서화 (Documentation)
- **위키 갱신**: 새로운 패턴, 아키텍처 결정 사항, 기술적 발견은 즉시 `.gemini/knowledge/wiki/`에 반영합니다.
- **변경 로그**: 주요 마일스톤 및 변경 사항은 `log.md`에 기록하여 프로젝트 히스토리를 유지합니다.
