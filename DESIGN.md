# UI/UX Design Guidelines

이 문서는 `IndividualSavingsFlowUI` 프로젝트의 설계 원칙과 공통 UI 가이드라인을 정의합니다.

## 1. Design Philosophy

### Mobile-First & Hybrid Desktop
- 모든 인터페이스는 **세로형 모바일 화면(Portrait)**에서 완벽하게 동작하는 것을 기본으로 합니다.
- **데스크톱 확장성**: 화면 너비가 넓어질 경우(`760px` 이상), 단순 확장이 아닌 그리드 재배치 및 풍부한 정보 노출을 지향합니다.
  - 모바일: 단일 컬럼, 하단 플로팅 바 활용.
  - 데스크톱: 다중 컬럼(Dashboard), 사이드 영역 활용 가능.

### No-Build Efficiency
- 외부 라이브러리 의존성을 최소화하고 브라우저 네이티브 기능을 활용합니다.
- CSS Variables를 통한 테마 관리와 `backdrop-filter` 등을 활용한 현대적인 글래스모피즘(Glassmorphism) 스타일을 추구합니다.

## 2. Brand Identity

프로젝트의 아이덴티티를 나타내는 색상 체계입니다. 모든 색상은 `shared/styles/step-theme.css`의 변수와 연동됩니다.

| Name | Variable | Hex | Description |
|---|---|---|---|
| **ISF Sunset** | `--tone-primary` | `#ea5b2a` | 메인 강조색, 브랜드 아이덴티티 |
| **ISF Deep Sea** | `--tone-accent` | `#1e8b7c` | 보조 강조색, 긍정/확인 액션 |
| **ISF Ink** | `--ink` | `#102220` | 기본 텍스트 및 제목 색상 |
| **ISF Pearl** | `--bg` | `#f3f4ef` | 메인 배경색 (Paper-like) |
| **ISF Glass** | `--panel` | `rgba(255, 255, 255, 0.9)` | 패널 배경 (Semi-transparent) |

## 3. Responsive Strategy

브레이크포인트 설정 및 레이아웃 정책입니다.

- **Mobile (< 760px)**: 
  - 기본 가로 패딩 `14px`.
  - 하단 버튼은 `pending-bar` 형태의 플로팅 UI 권장.
  - 메뉴나 탭은 가로 스크롤 또는 아코디언 형태로 배치.
- **Desktop (>= 760px)**:
  - 컨텐츠 최대 너비 `1120px`.
  - 중앙 정렬 레이아웃.
  - 버튼 및 입력 필드의 크기는 유지하되, 배치 간격을 조정하여 여유 공간 확보.

## 4. Components & UX Rules

### Typography
- **Display**: `Black Han Sans` (숫자 및 제목 강조용)
- **Body**: `Gowun Dodum` (가독성 중심의 본문용)
- **금액 단위**: Step 1은 **만원**, Step 2는 **원** 단위를 엄격히 구분하여 사용자 혼선을 방지합니다.

### Buttons & Inputs
- 모바일 터치 타겟을 고려하여 최소 클릭 영역 `44x44px` 수준의 여백을 확보합니다.
- 중요한 액션은 `btn-primary` (Gradient 적용)를 사용합니다.

### Dark Mode (Future Support)
- 현재는 Light 모드(`color-scheme: light`)를 기본으로 하지만, 모든 색상은 CSS 변수로 관리됩니다. 
- 향후 미디어 쿼리(`prefers-color-scheme: dark`) 대응을 통해 다크 모드 확장이 용이하도록 설계되어야 합니다.

## 5. Visual Elements
- **Sankey Diagram**: 금액과 비율의 전환이 용이해야 하며, 모바일에서도 노드 간의 흐름이 끊기지 않아야 합니다.
- **Donut Chart**: 1% 이하의 작은 비중은 '기타'로 그룹화하거나 라벨 처리하여 가독성을 유지합니다.
