# Phase 14: Foundation UX & Branding - Plan

## Goal Description

디자인 시스템 명세인 DESIGN.md 규격을 시스템 전체에 완전히 투영하기 위한 공통 UX 및 브랜딩 뼈대 구축 작업입니다.

이 계획은 다음과 같은 구체적 개선 사항들을 공통 CSS 수준에서 안전하고 외과적으로 정합하는 것을 목표로 합니다:
- Glassmorphism 카드 배경 투명도 상향 조정: globals.css와 step-theme.css에 선언된 카드 및 패널 배경 투명도를 rgba(255, 255, 255, 0.9)로 일관되게 상향 통일하여 글자 가독성을 향상시킵니다.
- globals.css 기반의 스타일 변수 일원화: Tailwind v4 globals.css의 theme 블록을 단일 소스로 삼고 step-theme.css가 이를 온전히 상속받는 유기적 변수 체계를 구현합니다.
- 액티브 스케일 피드백 모션의 전면 확장: 기존 물리 버튼뿐만 아니라 탭 버튼, 헤더 링크, floating-btn, 모달 닫기 버튼 등 클릭 가능한 모든 주요 웹 활성 요소에 active scale(0.96) 물리 모션을 일괄 주입합니다.
- 모바일 반응형 뼈대 레이아웃 선제 반영: 768px 이하 뷰포트에서 공통 패널 패딩을 14px로 축소하고 다단 그리드 레이아웃을 1열 세로 스택 구조로 강제 수렴시키는 공통 뼈대 규칙을 step-theme.css에 기본 바인딩하여 모바일 뷰 파손을 조기에 원천 차단합니다.

## User Review Required

- 변경의 중요도:
  기존 globals.css와 step-theme.css 내의 카드 및 패널 투명도 변수 값이 rgba(255, 255, 255, 0.82)에서 rgba(255, 255, 255, 0.9)로 상향 조정됩니다. 이는 Glassmorphism 효과의 깊이를 세련되게 정제하면서 본문 및 금융 수치 데이터의 시각적 식별성을 선명하게 올리는 이점이 있습니다.

## Open Questions

- 합의 사항 적용 완료:
  이전 단계에서 4대 디자인 Gray Area 의사결정이 추천안 옵션 A로 전부 사전 동의 및 타결되었으므로 현재 열려 있는 미결 질문은 존재하지 않습니다. 합의된 사양에 기반하여 정교하고 정확하게 구현에 착수합니다.

## Proposed Changes

### Styles Component

공통 스타일 및 디자인 토큰 공급 레이어의 파일들을 수정하여 디자인 무결성을 영구 보존합니다.

#### [MODIFY] [globals.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/styles/globals.css)
- --color-panel 값을 rgba(255, 255, 255, 0.82)에서 rgba(255, 255, 255, 0.9)로 변경 조정합니다.
- input, textarea, select 의 focus-visible 스타일 아웃라인 색상을 Tailwind v4 color-primary 변수 또는 accent 변수와 어우러지도록 정리합니다.

#### [MODIFY] [step-theme.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/styles/step-theme.css)
- --panel 값을 rgba(255, 255, 255, 0.9)로 상향 통일합니다.
- 액티브 scale(0.96) 물리 모션 적용 대상을 .tab-btn, .nav-link, .floating-btn, .modal-close 등의 선택자 집합으로 확장하여 transform: scale(0.96) 및 transition: transform 0.15s ease-out;을 공통 매핑합니다.
- 768px 미디어 쿼리 블록에 공통 레이아웃 뼈대 자동 1열 stack 및 패널 패딩 14px 축소 규칙을 주입하여 하위 스텝별 뷰포트 파손을 구조적으로 예방합니다.

## Verification Plan

### Automated Tests
- Vite 개발 서버 구동 및 프로덕션 빌드 유효성 확인:
  `npm run build` 명령을 실행하여 스타일 컴파일 과정에서 구문 에러나 경고 없이 빌드 산출물이 안전하게 추출되는지 확인합니다.

### Manual Verification
- Glassmorphism 투명도 및 가독성 수동 점검:
  브라우저 개발자 도구를 활용하여 각 스텝별 메인 카드 영역(.panel, .card)의 배경색이 rgba(255, 255, 255, 0.9)로 일관되게 적용되었는지 확인하고, 텍스트 가독성이 대폭 향상되었는지 대조 점검합니다.
- 스케일 물리 피드백 모션 작동 확인:
  각 페이지의 상단 네비게이션 링크, 탭 버튼, 모달 창 내의 닫기 버튼 등을 클릭/터치했을 때 0.96 크기로 즉시 수축했다가 복원되는 매끄러운 햅틱 반응이 일어나는지 모션 프레임을 수동 확인합니다.
- 768px 반응형 stack 무결성 검증:
  브라우저 가로 폭을 768px 이하로 인위적으로 좁혔을 때, Step 1 Sankey 뷰, Step 2 시뮬레이터 KPI, Step 3 포트폴리오 에디터 등 다단 그리드로 설계된 영역들이 1열 세로 스택 구조로 깨짐 없이 자연스럽게 흘러내리는지 직접 검증합니다.
