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
- **디자인 토큰 (v0.8 고도화):**
  - **Typography (DESIGN.md 규격):** 
    - `--text-display(32px)`: 섹션 헤더, 주요 요약 숫자 (Black Han Sans)
    - `--text-title-lg(24px)`: 카드 제목, 주요 데이터 포인트 (Black Han Sans)
    - `--text-title-md(18px)`: 서브 섹션 제목 (Gowun Dodum)
    - `--text-body-md(16px)`: 본문 및 일반 입력 (Gowun Dodum)
    - `--text-caption(14px)`: 도움말, 단위(만원), 작은 라벨 (Gowun Dodum)
  - **Spacing:** `--sp-xs(4px)` ~ `--sp-xl(32px)`
  - **Radius:** `--rd-sm(8px)`, `--rd-md(14px)`, `--rd-lg(999px)`
    - **곡률 통일화 규칙 (v1.7):** 모든 일반 버튼, 탭, 입력 폼, 배지, 정렬 콤보박스는 `var(--rd-sm)` (8px) 로 곡률을 통일하여 미니멀 평면(Flat) 디자인을 구현합니다. 완전한 원형 알약 형태인 `var(--rd-lg)` (999px) 는 주요 CTA 버튼(`.btn-primary`)에만 전용으로 엄격히 제한합니다.
  - **Shadow:** `--sh-float` (공통 부유 효과)
- **Interaction:**
  - 버튼(`.btn`) 클릭 시 `transform: scale(0.96)` 피드백이 반드시 포함되어야 함.
- 주요 변수: `--tone-primary`, `--tone-accent`, `--ink`, `--bg`, `--panel` 등.
- 상세 Brand Identity 및 색상 체계는 프로젝트 루트의 `DESIGN.md`를 참조하십시오.

## 공통 컴포넌트 및 피드백 표준 (v0.3 통합)

1. **AppHeader (`app-header.js`)**
   - 역할: Step 간 네비게이션 및 브랜드 아이덴티티 제공. 모든 페이지 최상단 고정(Sticky).
2. **DataHubModal (`data-hub-modal.js`)**
   - 역할: 데이터 백업, 복원, JSON 내보내기/가져오기, ISF CODE 공유를 통합 관리하는 중앙 허브. (v0.9 개편)
   - 구성: '공유 및 연동', '시뮬레이션 목록', '백업 이력' 탭으로 분리하여 관리.
3. **Unified Tabs (`tab-list`, `tab-btn`)**
   - 역할: 상세 설정 및 차트 전환용 탭 UI 표준. Underline 애니메이션 포함.
4. **FeedbackManager (`shared/components/feedback-manager.js`)**
   - `showFeedback`: 상단 플로팅 토스트 알림.
   - `markPendingBar`: 하단 상태바(`pending-bar`) 제어. v0.3에서 아이콘(⚠️) 및 버튼 구조 표준화.
   - `notifyAutoSave`: 자동 저장 상태 알림.
5. **Taxation Warnings (정책 기반 경고)**
   - [[Financial_Taxation_Reference]]에 정의된 안전 마진(1,900만/3,400만) 기준에 따라 `warn`/`crit` 레벨의 피드백을 제공합니다.

6. **Onboarding Guide (IsfOnboardingManager)**
   - 역할: 신규 사용자를 위한 첫 단계 가이드(Spotlight).
   - 스킵: 툴팁 우측 상단에 명시적인 X(닫기) 버튼을 제공하여 언제든지 즉시 스킵할 수 있어야 합니다. 닫기 클릭 시 완료 상태가 로컬 스토리지에 저장되어 다음 진입 시 노출되지 않습니다.
   - 다시보기: Step 1 진입 후 헤더의 앱 런처 메뉴 하단에 '💡 튜토리얼 다시보기' 버튼을 제공하여, 사용자가 언제든 튜토리얼을 초기화하고 다시 볼 수 있도록 지원합니다.

## 데이터 공유 및 연동 표준 (v0.9 신설)

1. **ISF CODE 시스템**
   - **발급**: 현재 상태를 압축된 문자열(Base64/LZ)로 변환하여 'ISF CODE'를 생성합니다. 생성 시 클립보드에 자동 복사되며 사용자에게 피드백을 제공합니다.
   - **입력**: 전달받은 코드를 수동으로 입력하여 즉시 상태를 반영합니다. URL 리다이렉트 없이도 데이터를 전송할 수 있는 가장 안정적인 방법입니다.
   - **표준 UX**: 긴 URL 공유 방식보다 수동 코드 입력 방식을 우선적으로 노출하여 PWA 환경에서의 리다이렉트 버그를 원천 방지합니다.
2. **백업 및 복원 (Backup & Restore)**
   - 12시간마다 자동으로 수행되는 '자동 백업'과 사용자가 명시적으로 수행하는 '수동 백업'을 지원합니다.
   - 복원 시 현재 상태가 유실되지 않도록 직전에 자동 백업을 수행하는 안전장치를 포함해야 합니다.

## 시각화

### Sankey Diagram (Step1)
- 현금 흐름을 시각화합니다.
- **계좌 기반 4단계 레이어 구조**: 기존 대분류 대신 사용자가 정의한 커스텀 계좌 노드를 중간 레이어로 도입하여 `[수입원] ➔ [계좌들] ➔ [세부 항목들]` 구조를 유지합니다.
- **계좌 간 자동 이체 연산**: 각 계좌의 Inflow와 Outflow 차액을 계산하여, 자금이 남는 공급처(Inflow > Outflow)에서 자금이 부족한 수요처(Inflow < Outflow)로의 내부 이체선(tone: "transfer")을 수학적으로 자동 도출/시각화합니다.
  - **잉여현금 자동 이체 배너**: 요약 카드 하단에 Glassmorphism 스타일의 문장형 UI 배너(`💡 이번 달 남는 잉여현금 [X만 원]은 [주식계좌 ▾]로 자동 이체합니다.`)를 제공하여 자금 흐름을 직관적으로 제어할 수 있게 합니다.
  - **비신축형 줌 및 높이 고정 (v1.7):** 세로 높이는 최대 440px(모바일 360px)로 엄격히 캡핑(Clamping)하며, 줌을 확장할 때 세로가 팽창하지 않고 가로 좌표계 및 CSS 너비(px)만 확대되어 세로 스크롤을 유발하지 않는 가로형 줌을 구현합니다. 또한 모바일 가독성을 위해 최소 렌더링 폭을 680px로 보장합니다.
  - **안전한 PNG 내보내기 (v1.7):** 브라우저 보안 샌드박스로 인한 렌더링 누락을 막기 위해 base64 직렬화를 거치며, 캔버스 렌더링에 최종 실패할 경우 원본 SVG를 바로 다운로드하도록 지원하는 2중 안전 폴백(triggerDownload)을 탑재합니다.
  - **계좌이체망 모바일 가독성 (v1.7):** 모바일 뷰포트에서 계좌망 SVG의 최소 가로폭을 680px로 보장하고 픽셀 단위 크기로 고정하여 CSS 팽창에 따른 찌그러짐을 제거합니다.
  - **소멸식 스크롤 힌트 배너 (v1.7):** 가로 스크롤이 존재함을 안내하되 차트 화면을 가리는 부하를 예방하기 위해, 닫기(×) 버튼 제공 및 가로 스크롤 시도 감지 시 서서히 fade-out되어 사라지도록 자바스크립트 인터랙션을 연동합니다.

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
