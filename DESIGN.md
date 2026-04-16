# ISF UI/UX Design Guidelines (v0.4)

이 문서는 Individual Savings Flow (ISF) 프로젝트의 설계 철학과 공통 UI 가이드라인을 정의합니다. 특히 Donald Norman의 **인간 중심 디자인(HCD) 6대 원칙**을 기반으로 사용자 경험을 설계합니다.

## 🏛️ 1. Core Design Philosophy: HCD 6 Principles

### 1.1 발견가능성 (Discoverability)
사용자가 "여기서 무엇을 할 수 있는가?"를 즉시 알 수 있게 합니다.
- **공통 네비게이션**: `AppHeader`를 통해 서비스의 전체 구조(Step1, Step2)를 상시 노출합니다.
- **계층적 정보 노출**: 복잡한 설정(수익률 등)은 기본적으로 숨기되, 탭이나 아코디언을 통해 필요할 때 발견할 수 있게 합니다.

### 1.2 피드백 (Feedback)
사용자의 모든 동작에 대해 시스템의 상태 변화를 즉시 알립니다.
- **Pending Bar**: 데이터 수정 시 하단에 '적용/취소' 바를 즉각 노출하여 미저장 상태임을 알립니다.
- **Toast Message**: 저장 성공, 오류 발생 시 `FeedbackManager`를 통해 시각적 피드백을 제공합니다.
- **Interactive States**: 버튼 클릭 시 `scale(0.96)` 효과를 주어 물리적 조작감을 제공합니다.

### 1.3 개념모델 (Conceptual Model)
사용자가 시스템의 작동 방식을 직관적으로 이해할 수 있는 일관된 모델을 제시합니다.
- **단위 통일 (만원)**: 모든 앱(Step1, Step2)의 기본 화폐 단위를 **만원**으로 통일하여, 자산 흐름의 규모감을 일관되게 유지합니다.
- **흐름의 연속성**: [수입/지출(Step1)] -> [투자 여력 도출] -> [포트폴리오 구성(Step2)]으로 이어지는 논리적 단계를 레이아웃에 반영합니다.

### 1.4 매핑 (Mapping)
조작 장치와 결과 사이의 관계를 명확히 합니다.
- **실시간 시각화**: 입력창의 수치를 변경하면 차트(Sankey, Donut)가 즉시 반응하여, "이 입력이 저 결과를 만든다"는 인과관계를 강화합니다.
- **위치 기반 매핑**: 편집기 근처에 해당 항목의 요약 정보를 배치하여 시각적 연동성을 높입니다.

### 1.5 제약 (Constraints)
사용자가 실수하지 않도록 가이드라인과 한계를 설정합니다.
- **입력 제한**: 모든 금액 입력은 양수만 가능하며, 비정상적으로 큰 값 입력 시 피드백 바를 통해 경고합니다.
- **비중 합계 제약**: 포트폴리오 비중 합계가 100%를 초과할 경우 시각적 경고(빨간색)를 통해 수정을 유도합니다.

### 1.6 기표 (Signifiers)
어떤 요소가 조작 가능한지 시각적으로 암시합니다.
- **통합 버튼/탭 스타일**: `step-theme.css`에 정의된 둥근 모서리와 그림자 효과를 통해 "클릭 가능함"을 나타냅니다.
- **별표(★) 기표**: 중요 종목에 별표를 표시하여 우선순위를 직관적으로 인지하게 합니다.

## 🎨 2. Brand Identity (Design Tokens)

| Name | Variable | Hex / Value | Description |
|---|---|---|---|
| **ISF Sunset** | `--tone-primary` | `#ea5b2a` | 브랜드 아이덴티티, 핵심 액션 |
| **ISF Deep Sea** | `--tone-accent` | `#1e8b7c` | 보조 강조색, 긍정/수입 |
| **ISF Pearl** | `--bg` | `#f3f4ef` | 메인 배경색 (종이 질감) |
| **Glass Panel** | `--panel` | `rgba(255...0.9)` | 글래스모피즘 패널 |

## 📐 3. Atomic System

### Spacing & Radius
- **Spacing**: `4px` 배수 시스템 (`4, 8, 14(md), 24, 32`).
- **Radius**: `Small(8px)` - 입력창, `Medium(14px)` - 카드/패널, `Large(999px)` - 버튼/알약.

### Typography
- **제목 (Display)**: `Black Han Sans` (수치 및 대제목)
- **본문 (Body)**: `Gowun Dodum` (설명 및 데이터)

## 🛠️ 4. Implementation Rules
- **No-Build**: 빌드 도구 없이 브라우저에서 즉시 실행되는 ES6 모듈 구조 유지.
- **Shared First**: 새로운 기능을 만들기 전 `shared/` 디렉토리의 컴포넌트(Header, Feedback 등) 재사용 여부 우선 검토.
- **PWA Ready**: 오프라인 환경에서도 핵심 로직과 저장 기능이 동작하도록 보수적으로 설계.
