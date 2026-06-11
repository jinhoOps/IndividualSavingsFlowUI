# Phase 16 Validation: Export Feature

- **Target Milestone:** v1.6 (코드 리팩터링, UX 개선 및 안정성 강화)
- **Phase:** 16 (Export Feature)
- **Status:** PLANNING
- **Created:** 2026-06-10
- **Last Updated:** 2026-06-10

---

## 🔬 1. Manual Verification Scenarios (수동 검증 시나리오)

### Scenario 1: 내보내기 진입점 UI/UX 무결성 검증
1. **절차**:
   - 로컬 개발 서버 `npm run dev` 구동 후 브라우저로 `http://localhost:5173/IndividualSavingsFlowUI/apps/step1/` 에 진입합니다.
   - Sankey 차트 상단 툴바를 확인합니다.
2. **확인 기준**:
   - 정렬 옵션 및 줌 레벨 도구 우측에 카메라 또는 다운로드 형상의 "이미지 저장" 버튼이 깨짐 없이 노출되는가?
   - 호버 시 색상이 약간 변하는 등 피드백 효과가 적용되는가?
   - 모바일 해상도(760px 이하)에서 버튼이 툴바 영역 밖으로 넘치거나 레이아웃을 해치지 않는가?

### Scenario 2: 이미지 다운로드 기능 검증
1. **절차**:
   - 가계 흐름 데이터를 입력하여 Sankey 차트가 정상적으로 그려진 상태를 확보합니다.
   - "이미지 저장" 버튼을 클릭합니다.
2. **확인 기준**:
   - 클릭 즉시 브라우저의 다운로드 작업이 발생하고 `isf-sankey-YYYYMMDD.png` 파일이 생성되는가?
   - 저장된 파일의 확장자가 `.png` 이며, 파일 크기가 0바이트가 아닌 정상적인 크기(대략 50KB ~ 300KB)를 가지는가?

### Scenario 3: PNG 이미지 화질 및 폰트 무결성 검증
1. **절차**:
   - 다운로드된 PNG 파일을 이미지 뷰어로 엽니다.
2. **확인 기준**:
   - 차트가 원본 해상도보다 더 선명하게(2배 캔버스 드로잉) 깨짐 없이 렌더링되어 있는가?
   - 노드 및 링크 사이의 Sunset/Deep Sea 그라데이션이 끊기지 않고 자연스럽게 매핑되어 있는가?
   - 차트 라벨 텍스트(예: "급여계좌", "생활비")의 폰트가 깨지지 않고 "Gowun Dodum" 스타일이 정상 유지되는가?

---

## 🤖 2. Automated Regression Tests (자동 회귀 검사)

### 빌드 및 PWA 무결성 검사
1. **절차**:
   - 터미널에서 `npm run build` 명령을 실행합니다.
2. **확인 기준**:
   - Vite 컴파일 및 번들러 작업이 에러 없이 종료되는가?
   - 빌드 후 `dist` 내부에 생성되는 `index.html` 및 `apps/step1/index.html` 내에 수정한 스크립트와 리소스가 누락 없이 배포되는가?
   - 버전 패치 동기화(`npm run sync-version`)가 정상 수행되어 중앙 버전 표기가 유지되는가?
