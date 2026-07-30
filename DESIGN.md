# ISF Design Contract

## Overview

Individual Savings Flow는 복잡한 금융 계산을 접근 가능한 계획 경험으로 바꾸는 로컬 우선 도구입니다. 시각적 기반은 종이 같은 **ISF Pearl** 캔버스와 단색 테두리의 **flat editorial panel**입니다. 전통적인 스프레드시트의 긴장감은 줄이되 숫자의 정밀성과 신뢰감은 유지합니다.

이 문서의 현재 UI 계약은 Main과 Simulation·Portfolio·Account Map 준비 화면에 적용됩니다. 세 상세 앱 섹션은 후속 신규 앱을 위한 미래 설계 제약이며 현재 제공 기능을 뜻하지 않습니다. 과거 레거시 화면의 모양이나 상호작용은 새 UI의 기준이 아닙니다.

## Experience Principles

1. **Discoverability**: 앱 런처와 명확한 섹션 제목으로 현재 위치와 다음 행동을 보여줍니다.
2. **Summary First**: 기본 화면은 세부 입력보다 현재 상태와 핵심 결과를 먼저 보여줍니다.
3. **One Primary Editing Path**: Main의 일반 재무 항목은 Financial Detail Modal에서 편집합니다.
4. **Explicit Feedback**: draft 변경, 적용, 취소, 오류와 저장 결과를 해당 편집 맥락에서 즉시 알립니다.
5. **Consistent Model**: 요약, 시각화와 projection은 동일한 정규화 데이터에서 만들어집니다.
6. **Safe Constraints**: 유효하지 않은 금액, 초과 배분과 저장 실패는 조용히 무시하지 않습니다.
7. **Progressive Disclosure**: 개요는 관계와 결과를 보여주고 민감하거나 복잡한 세부정보는 선택 후 공개합니다.
8. **Local-first Trust**: 저장 위치, import, export와 앱 간 데이터 이동은 사용자가 이해할 수 있어야 합니다.

## Product-Specific Interaction Contracts

### Main

- 기본 화면은 월 수입, 생활비, 저축, 투자와 순현금흐름을 우선 보여줍니다.
- Financial Detail Modal은 일반 재무 항목의 유일한 기본 편집 경로입니다.
- modal을 열거나 탐색하는 것만으로 dirty 상태를 만들지 않습니다.
- 실제 draft 변경이 있을 때 modal 내부 Pending Bar가 나타납니다.
- `취소`와 `적용`은 modal을 자동으로 닫지 않고 현재 맥락을 유지합니다.
- Sankey와 projection은 적용된 데이터만 반영합니다.

### Current Journey Readiness

- 앱 런처는 Main을 `사용 중`, Simulation·Portfolio·Account Map을 `준비 중`으로 고정 표시합니다.
- 현재 위치는 제품 가용 상태와 분리된 보이는 텍스트와 `aria-current`로 표시합니다.
- Simulation과 Portfolio 준비 화면은 연결 상태, 월 투자 가능액과 Main 갱신 시각을 표시합니다.
- 연결된 준비 화면은 `Main에서 최신 정보 가져오기` 행동을 제공하고 오류 상태는 Main 복구 경로를 제공합니다.
- 준비 화면은 계산, 편집, 독립 제품 저장 또는 Main write-back UI를 만들지 않습니다.

### Future Simulation

- Main 데이터 가져오기는 명시적 행동으로 표시합니다.
- 가져온 값과 사용자가 Simulation에서 수정한 값을 구분합니다.
- 총자산과 월 현금흐름을 함께 보여줘 전략의 tradeoff를 숨기지 않습니다.
- 계산 가정과 면책을 결과 가까이에 배치합니다.

### Future Portfolio

- 자산별 금액과 전체 비중을 동시에 확인할 수 있어야 합니다.
- 저장 전 확인 단계에서 종목 수, 총액, 설정일과 주기를 요약합니다.
- 편집 중 변경과 저장 상태를 명확히 구분합니다.

### Future Account Map

- 전체 관계도를 첫 화면의 주요 시각 요소로 사용합니다.
- 관계 유형은 색상과 짧은 텍스트를 함께 사용해 색상만으로 구분하지 않습니다.
- 정확한 월 금액은 개요에서 숨기고 선택 상세에서 공개합니다.
- 모바일 요약은 관계도를 첫 viewport 밖으로 밀어내지 않아야 합니다.
- drag 상태, 저장 결과와 자동정렬 결과를 명확히 피드백합니다.

## Colors

### Brand and Accent

- **ISF Sunset / Primary** (`var(--tone-primary)`, `#ea5b2a`): 주요 CTA, 선택과 활성 상태
- **ISF Deep Sea / Accent** (`var(--tone-accent)`, `#1e8b7c`): 긍정 상태, 수입과 보조 강조

### Surface and Background

- **ISF Pearl / Canvas** (`var(--bg)`, `#f9f6f0`): 앱 기본 배경
- **Flat Panel** (`var(--panel)`, `#ffffff`): 카드, 입력 그룹과 주요 콘텐츠 표면
- **Line** (`var(--line)`): 패널 경계와 구조 구분

상태 색상은 텍스트, 아이콘 또는 레이블과 함께 사용합니다. 색상만으로 오류·경고·성공을 전달하지 않습니다.

## Typography

### Font Family

- **Gowun Batang**: 화면 제목, 주요 섹션 제목과 핵심 숫자
- **Gowun Dodum**: 본문, 레이블, 입력, 버튼과 데이터 테이블

### Hierarchy

| Token | Size | Weight | Use |
|---|---:|---:|---|
| Display | 32px | Bold | 화면 제목과 큰 요약 수치 |
| Title Large | 24px | Bold | 주요 카드 제목 |
| Title Medium | 18px | Bold | modal 및 하위 섹션 제목 |
| Body | 16px | Regular | 기본 본문과 입력 |
| Caption | 14px | Regular | 보조 설명, 단위와 상태 |

임의의 글꼴 조합을 추가하지 않습니다. 숫자 강조에서도 의미 계층을 유지합니다.

## Money and Units

- 내부 계산과 영속화는 **원 단위**를 사용합니다.
- 사용자가 입력하는 금액 필드는 현재 화면 계약에 맞는 원화 형식을 사용하고 단위를 명시합니다.
- 요약과 읽기 화면에서는 만 원·억 원 단위를 사용해 빠르게 읽을 수 있게 합니다.
- 1억 원 이상은 억·만 원 조합 등 의미가 보존되는 형식으로 표시합니다.
- 금액 변환과 표시는 공통 utility를 사용해 화면별 오차를 만들지 않습니다.
- 사용자 편집 금액의 허용 범위와 비정상 값은 저장 전에 검증합니다. 계산 결과인 0원 또는 음수 월 투자 가능액은 정상 journey 상태로 표시할 수 있습니다.

## Components

### App Launcher

- Main, Simulation, Portfolio와 Account Map의 위치를 보여줍니다.
- 현재 목적지를 `현재 위치` 텍스트와 `aria-current`로 분명히 표시합니다.
- 제품 가용 상태는 현재 위치와 독립적으로 Main `사용 중`, 세 향후 앱 `준비 중`을 유지합니다.
- 데이터 연결 상태는 실제 journey snapshot이 검증된 경우에만 표시합니다.

### Financial Detail Modal

- tab과 compact row를 사용해 정보 밀도를 관리합니다.
- 한 번에 하나의 행을 펼쳐 편집합니다.
- 오류가 있으면 첫 오류 행을 열고 수정 방법을 알려줍니다.
- focus를 modal 안에서 관리하고 닫힌 뒤 진입 컨트롤로 돌려보냅니다.

### Pending Bar

- 저장 모델이 draft/apply를 요구하는 편집 맥락에서만 사용합니다.
- 단순 탐색이나 선택은 Pending Bar를 만들지 않습니다.
- `취소`와 `적용` 같은 결과 중심 문구를 사용합니다.
- 모바일 safe area와 modal footer를 가리지 않습니다.

### Toast Message

- 저장, 복원, import와 오류 결과를 비차단 방식으로 알립니다.
- 해결을 위한 사용자 행동이 필요하면 구체적인 다음 단계를 포함합니다.

### DataHubModal

- 백업, 공유, import와 이력 관리의 일관된 진입점입니다.
- 외부 데이터는 적용 전에 검증하고 실패 시 현재 저장 상태를 유지합니다.

### Button

- 주요 CTA와 보조 행동의 위계를 색상, 테두리와 배치로 구분합니다.
- 누름 상태에는 `transform: scale(0.96)` 수준의 물리적 피드백을 사용할 수 있습니다.
- 텍스트 없이 의미를 알기 어려운 아이콘 버튼은 접근 가능한 이름을 제공합니다.

### Input

- 레이블과 단위를 항상 식별할 수 있어야 합니다.
- 오류는 해당 필드 가까이에 표시합니다.
- 숫자 입력은 모바일 키보드와 직접 입력을 모두 고려합니다.

## Layout

### Spacing

- 기본 단위: 4px
- 권장 간격: 4px, 8px, 14px, 24px, 32px
- 주요 카드 내부 여백: 기본 24px, 모바일에서는 정보 밀도에 맞게 축소

### Information Sequence

기본 정보 순서는 다음을 따릅니다.

1. Summary
2. Visualization
3. Controls or Detail Entry
4. Projection or Decision Support

모든 화면이 네 단계를 강제로 포함할 필요는 없지만, 세부 입력이 결과 이해보다 먼저 화면을 압도해서는 안 됩니다.

### Depth

| Level | Treatment | Use |
|---|---|---|
| Canvas | ISF Pearl, shadow 없음 | 앱 바닥 |
| Flat Panel | 흰색 배경, 단색 border | 카드, 입력 그룹, 그래프 영역 |
| Floating | 제한된 shadow와 높은 z-index | modal, contextual Pending Bar, toast |

gradient와 반투명 card를 기본 스타일로 사용하지 않습니다.

## Responsive Behavior

### Required Viewports

- **390px급 모바일**: 주요 모바일 기준
- **768px 이하**: tablet 및 좁은 화면 전환 기준
- **일반 desktop**: 다중 열과 넓은 시각화

### Contracts

- 390px에서 body의 예기치 않은 가로 overflow가 없어야 합니다.
- 390px에서 준비 화면과 Main 여정 CTA는 콘텐츠 너비를 채우고 최소 44px touch target을 가져야 합니다.
- modal 콘텐츠는 viewport 안에서 스크롤되고 footer 또는 Pending Bar가 가려지지 않아야 합니다.
- 다중 열 control은 768px 이하에서 단일 열 또는 읽을 수 있는 compact layout으로 전환합니다.
- 현재 Main Sankey와 향후 Account Map은 의미를 잃도록 과도하게 축소하지 않고 필요한 경우 안내가 있는 내부 스크롤을 사용합니다.
- 향후 Account Map의 compact summary는 모바일 첫 화면에서 관계도를 밀어내지 않아야 합니다.

## Accessibility

- 모든 입력은 label 또는 동등한 accessible name을 가져야 합니다.
- modal은 올바른 role, 제목 연결과 focus 관리가 필요합니다.
- 그래프는 사용자 목적을 설명하는 accessible name과 텍스트 대안을 제공합니다.
- 키보드로 주요 선택, 저장, 취소와 닫기를 수행할 수 있어야 합니다.
- 오류와 상태는 색상 외의 텍스트 또는 아이콘으로도 전달합니다.

## Do

- 공통 header, feedback, storage와 formatting utility를 먼저 확인합니다.
- Main 현재 데이터 소유권, 최소 journey 계약과 향후 앱의 명시적 import 경계를 유지합니다.
- Financial Detail Modal을 Main의 기본 편집기로 사용합니다.
- 외부 동작과 모바일 화면을 함께 검증합니다.
- CSS 수정 전후 responsive media query와 파일 구조를 확인합니다.

## Do Not

- 레거시 UI를 새 화면의 디자인 기준으로 사용하지 않습니다.
- Main에 두 번째 일반 재무 편집기를 만들지 않습니다.
- 모든 앱에 하나의 전역 Pending Bar 동작을 강제하지 않습니다.
- 향후 Account Map 수정이 Main에 자동 반영되는 것처럼 표현하지 않습니다.
- 카드에 gradient 또는 과도한 translucent effect를 사용하지 않습니다.
- Gowun Batang과 Gowun Dodum의 역할을 임의로 뒤섞지 않습니다.
- 390px와 768px 검증 없이 responsive 작업을 완료로 선언하지 않습니다.
