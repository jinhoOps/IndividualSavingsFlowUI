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

## 4. Atomic System & Tokens

일관된 UI를 위해 다음 수치 규격을 엄격히 준수합니다.

### Spacing Scale
- `4px` 단위를 기본으로 하는 배수 시스템을 사용합니다.
- `xs: 4px`, `sm: 8px`, `md: 14px` (Main Gutter), `lg: 24px`, `xl: 32px`.

### Radius & Shadows
- **Radius**: `Small: 8px` (Inputs), `Medium: 14px` (Panels/Cards), `Large: 999px` (Pills/Buttons).
- **Shadow**: 
  - `Floating`: `0 8px 24px rgba(16, 34, 32, 0.08)` (Panel/Bar)
  - `Hover`: `0 12px 32px rgba(16, 34, 32, 0.12)`

## 5. Components & UX Rules

### Typography
- **Display**: `Black Han Sans` (숫자 및 제목 강조용)
- **Body**: `Gowun Dodum` (가독성 중심의 본문용)
- **금액 단위**: Step 1은 **만원**, Step 2는 **원** 단위를 엄격히 구분하여 사용자 혼선을 방지합니다.

### Buttons & Interaction
- **Primary**: Gradient 배경, 클릭 시 `scale(0.96)` 및 `brightness(1.1)` 효과.
- **Ghost/Outline**: 배경 없이 테두리만 존재, 호버 시 연한 배경색 노출.
- **Touch Target**: 모든 클릭 요소는 최소 `44x44px` 영역을 확보합니다.

## 6. PWA & Feedback

### Loading & Transitions
- 페이지 전환 시 `opacity` 페이드 효과(0.3s)를 적용하여 부드러운 연결감을 줍니다.
- 데이터 로딩 중에는 원형 스피너 대신 **Skeleton UI**(연한 회색 배경의 Pulse 효과)를 우선적으로 고려합니다.

### Connectivity & Sync
- **Offline Mode**: 오프라인 상태일 때 상단 또는 하단에 "오프라인 모드: 로컬에만 저장됩니다" 안내를 상시 노출합니다.
- **Success Feedback**: `apply-feedback` (Toast)는 액션 완료 후 `2-3초`간 유지 후 자연스럽게 사라집니다.

## 7. Visual Elements
- **Sankey Diagram**: 금액과 비율의 전환이 용이해야 하며, 모바일에서도 노드 간의 흐름이 끊기지 않아야 합니다.
- **Donut Chart**: 1% 이하의 작은 비중은 '기타'로 그룹화하거나 라벨 처리하여 가독성을 유지합니다.
- **Glassmorphism**: `.panel` 클래스는 `backdrop-filter: blur(10px)`를 적용하여 배경과의 깊이감을 형성합니다.
