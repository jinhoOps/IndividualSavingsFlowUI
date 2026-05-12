# Phase 10: 백테스트 관련 기능 제거 및 이관 - Plan

**Status:** Ready for execution

<objective>
현재 프로젝트(`IndividualSavingsFlowUI`) 내에 포함되어 있는 백테스트 시뮬레이터 기능을 `stock-snowball` 프로젝트로 이관하고, 현재 레포지토리에서는 완전히 제거한다.
</objective>

<verification_strategy>
- [x] `D:\jhkSandBox\CODE\stock-snowball\.planning\migrated-from-ISF` (또는 지정 경로) 디렉토리에 기존 코드 및 기획 문서들이 온전히 복사되었는지 확인한다.
- [x] `IndividualSavingsFlowUI` 내에서 `src/components/backtest/` 및 `src/core/backtest/` 디렉토리가 더 이상 존재하지 않는지 확인한다.
- [x] 메인 앱(`src/App.tsx`, `index.html` 등) 실행 시 백테스트 라우트/메뉴가 남아있지 않으며 앱이 정상 빌드/실행되는지 확인한다.
</verification_strategy>

<tasks>

### 1. 📁 백테스트 에셋 이관 (Copy to stock-snowball)
**Files modified:** 
- `D:\jhkSandBox\CODE\stock-snowball\.planning\migrated-from-ISF\` (new)
**Type:** feature
**Description:**
`IndividualSavingsFlowUI` 에 존재하는 백테스트 관련 소스 코드 및 기획 문서를 `stock-snowball` 프로젝트로 복사합니다.
1. `D:\jhkSandBox\CODE\stock-snowball\.planning\migrated-from-ISF\` 디렉토리를 생성합니다. (필요 시 부모 디렉토리 포함)
2. `src/components/backtest/*` 파일들을 `.../migrated-from-ISF/components/` 로 복사합니다.
3. `src/core/backtest/*` 파일들을 `.../migrated-from-ISF/core/` 로 복사합니다.
4. `.planning/phases/07-backtest-simulator/*` 내의 기획 문서들을 `.../migrated-from-ISF/docs/` 로 복사합니다.
**Verification:** 대상 폴더에 복사본 파일들이 온전히 저장되었는지 확인.

### 2. 🗑️ 로컬 UI 컴포넌트 및 로직 제거
**Files modified:** 
- `src/components/backtest/*` (deleted)
- `src/core/backtest/*` (deleted)
**Type:** refactor
**Description:**
안전하게 백업이 완료된 것을 확인한 후, 기존 레포지토리 내의 파일들을 삭제합니다.
1. `src/components/backtest/` 디렉토리와 하위 파일 삭제.
2. `src/core/backtest/` 디렉토리와 하위 파일 삭제.
**Verification:** 해당 디렉토리들이 로컬에서 사라졌음을 확인.

### 3. 🧹 라우팅 및 의존성 정리
**Files modified:** 
- `src/App.tsx` 또는 최상위 라우트/네비게이션 파일 (예: `src/App.js`, `src/index.tsx` 등)
- `.planning/phases/07-backtest-simulator` (deleted)
**Type:** refactor
**Description:**
1. 진입점 파일(`App.tsx` 등)에서 백테스트 대시보드를 호출하는 라우트(`BacktestDashboard` 관련)나 네비게이션 버튼을 제거합니다.
2. 관련된 불필요한 import 구문을 제거합니다.
3. 필요가 없어진 `07-backtest-simulator` 기획 문서 폴더를 삭제하거나 아카이브 처리합니다.
**Verification:** 앱(빌드 또는 린트)에 에러가 나지 않고 정상 동작하는지 확인.
</tasks>
