---
type: node
created: 2026-04-16
tags: [ui, feedback, theme, visualization, reference]
---

# UI Standards Reference (UI 표준 참조)

## 레이아웃 패널 순서 (Panel Ordering)

사용자의 인지 흐름(HCD)을 반영하여 패널 순서를 제어합니다.

1. **기본 순서 (New User)**: `요약(Summary) -> 흐름(Sankey) -> 입력(Controls) -> 미래(Projection)`
   - 사용자가 자신의 상태(Summary)를 먼저 보고, 그 근거(Sankey)를 확인한 뒤, 필요한 수정(Controls)을 하도록 유도합니다.
2. **대시보드 모드 (Returning User)**: `흐름(Sankey) -> 요약(Summary) -> 미래(Projection) -> 입력(Controls)`
   - 데이터가 이미 있는 사용자는 시각적 변화(Sankey)를 가장 먼저 확인하고 싶어 하므로 이를 최상단에 배치합니다.

**구현 주의사항**:
- CSS `order` 속성을 사용하여 시각적 순서를 제어하되, 스크린 리더 등 접근성을 고려하여 HTML 마크업 순서와의 괴리가 크지 않게 유지합니다.
- 모바일 미디어 쿼리(`@media (max-width: 760px)`)에서도 위 순서 원칙이 일관되게 적용되어야 합니다.

## CSS 구조 및 무결성 (CSS Structure & Integrity) - 중요!

에이전트는 스타일 수정 시 파일의 물리적 구조를 보존하기 위해 다음 순서를 따릅니다.
1. **변수 선언**: `:root` 블록 (상단)
2. **기본 리셋 및 레이아웃**: `body`, `.page`, `main` 등
3. **컴포넌트 스타일**: 각 섹션별 고유 클래스
4. **반응형 쿼리 (@media)**: 파일의 **최하단**에 위치 (760px, 520px 등)

**수정 규칙**:
- `@media` 섹션을 수정할 때는 반드시 해당 블록 전체를 읽어들인 후 작업하십시오.
- `apps/`별 전용 스타일과 `shared/`의 공통 테마 간의 우선순위를 고려하십시오.

## 테마 시스템

- `shared/styles/step-theme.css`에 정의된 CSS Variables를 사용하여 일관된 색상과 타이포그래피를 유지합니다.
- **v0.3 디자인 토큰:**
  - **Spacing:** `--sp-xs(4px)` ~ `--sp-xl(32px)`
  - **Radius:** `--rd-sm(8px)`, `--rd-md(14px)`, `--rd-lg(999px)`
  - **Shadow:** `--sh-float` (공통 부유 효과)
- 주요 변수: `--tone-primary`, `--tone-accent`, `--ink`, `--bg`, `--panel` 등.
- 상세 Brand Identity 및 색상 체계는 프로젝트 루트의 `DESIGN.md`를 참조하십시오.

## 공통 컴포넌트 및 피드백 표준 (v0.3 통합)

1. **AppHeader (`app-header.js`)**
   - 역할: Step 간 네비게이션 및 브랜드 아이덴티티 제공. 모든 페이지 최상단 고정(Sticky).
2. **Unified Tabs (`tab-list`, `tab-btn`)**
   - 역할: 상세 설정 및 차트 전환용 탭 UI 표준. Underline 애니메이션 포함.
3. **FeedbackManager (`shared/components/feedback-manager.js`)**
   - `showFeedback`: 상단 플로팅 토스트 알림.
   - `markPendingBar`: 하단 상태바(`pending-bar`) 제어. v0.3에서 아이콘(⚠️) 및 버튼 구조 표준화.
   - `notifyAutoSave`: 자동 저장 상태 알림.

## 시각화

### Sankey Diagram (Step1)
- 현금 흐름을 시각화합니다.
- 모바일 환경에서의 가독성을 위해 '화면 맞춤' 및 '배율 리셋' 기능이 필수적입니다.

### Dividend Simulation Chart (Step 2)
- 연도별 배당금 및 자산 추이를 선형/막대 그래프로 시각화합니다.
- 명목 금액과 물가 상승을 반영한 '실질 가치'를 동시에 제공하여 현실적인 미래 가치 체감을 돕습니다.

### Donut Chart (Step 3 예정)
- 포트폴리오의 자산 배분 현황을 시각화합니다.
- 1% 이하의 작은 비중은 '기타'로 그룹화하거나 라벨 처리하여 가독성을 유지합니다.
- 모바일 환경에서 viewBox 및 반응형 CSS가 적용되어야 합니다.

## 타이포그래피

- Display: `Black Han Sans` (숫자 및 제목 강조용)
- Body: `Gowun Dodum` (가독성 중심의 본문용)

---
*연결 노드:* [[Architecture_Reference]], [[Data_Model_Reference]], [[Operating_Principles]]
