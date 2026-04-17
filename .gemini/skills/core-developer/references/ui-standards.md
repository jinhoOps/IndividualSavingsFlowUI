# UI & Feedback Standards

## 레이아웃 패널 순서 (Panel Ordering)

사용자의 인지 흐름(HCD)을 반영하여 패널 순서를 제어합니다.

1. **기본 순서 (New User)**: `요약(Summary) -> 흐름(Sankey) -> 입력(Controls) -> 미래(Projection)`
2. **대시보드 모드 (Returning User)**: `흐름(Sankey) -> 요약(Summary) -> 미래(Projection) -> 입력(Controls)`

**구현 주의사항**:
- CSS `order` 속성을 사용하여 시각적 순서를 제어하되, HTML 마크업 순서와의 괴리가 크지 않게 유지합니다.
- 모바일 미디어 쿼리(`@media (max-width: 760px)`)에서도 위 순서 원칙이 일관되게 적용되어야 합니다.

## CSS 구조 및 무결성 (CSS Structure & Integrity) - 중요!

에이전트는 스타일 수정 시 파일의 물리적 구조를 보존하기 위해 다음 순서를 따릅니다.
1. **변수 선언**: `:root` 블록 (상단)
2. **기본 리셋 및 레이아웃**: `body`, `.page`, `main` 등
3. **컴포넌트 스타일**: 각 섹션별 고유 클래스
4. **반응형 쿼리 (@media)**: 파일의 **최하단**에 위치 (760px, 520px 등)

## 테마 시스템

- `shared/styles/step-theme.css`에 정의된 CSS Variables를 사용하여 일관된 색상과 타이포그래피를 유지합니다.
- **v0.3 디자인 토큰:**
  - **Spacing:** `--sp-xs(4px)` ~ `--sp-xl(32px)`
  - **Radius:** `--rd-sm(8px)`, `--rd-md(14px)`, `--rd-lg(999px)`
  - **Shadow:** `--sh-float` (공통 부유 효과)
- 주요 변수: `--tone-primary`, `--tone-accent`, `--ink`, `--bg`, `--panel` 등.

## 공통 컴포넌트 및 피드백 표준

1. **AppHeader (`app-header.js`)**: 모든 페이지 최상단 고정(Sticky) 네비게이션.
2. **FeedbackManager (`shared/components/feedback-manager.js`)**
   - `showFeedback`: 상단 플로팅 토스트 알림.
   - `markPendingBar`: 하단 상태바(`pending-bar`) 제어.
   - `notifyAutoSave`: 자동 저장 상태 알림.

## 시각화

### Sankey Diagram (Step1)
- 모바일 환경에서의 가독성을 위해 '화면 맞춤' 및 '배율 리셋' 기능이 필수적입니다.

### Donut Chart (Step2)
- 1% 이하의 작은 비중은 '기타'로 그룹화하여 가독성을 유지합니다.
- 모바일 환경에서 viewBox 및 반응형 CSS가 적용되어야 합니다.

## 타이포그래피

- Display: `Black Han Sans` (숫자 및 제목 강조용)
- Body: `Gowun Dodum` (가독성 중심의 본문용)
