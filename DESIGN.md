# ISF Design Contract

## Overview

Individual Savings Flow는 복잡한 금융 계산을 접근 가능한 계획 경험으로 바꾸는 로컬 우선 도구입니다. 시각적 기반은 종이 같은 **ISF Pearl** 캔버스와 단색 테두리의 **flat editorial panel**입니다. 전통적인 스프레드시트의 긴장감은 줄이되 숫자의 정밀성과 신뢰감은 유지합니다.

이 문서의 현재 UI 계약은 Main, Simulation, aggregate-first Portfolio와 purpose-first Account Map 출시 후보에 적용됩니다. Account Map 상세는 [Account Map Purpose-Node Flow Design](docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md)을 따르며 review closure gate 통과 전에는 현재 지원 제품으로 승격하지 않습니다. 과거 레거시 화면의 모양이나 상호작용은 새 UI의 기준이 아닙니다.

현재 delivery boundary는 명확히 나눕니다. Phase A의 단일 workspace, whole-workspace backup과 aggregate-first Portfolio가 현재이고 Phase B Account Map은 출시 후보입니다. Main 연결 결과 카드는 Phase C, 나머지 legacy extinction은 Phase D입니다. Portfolio의 `투자 위치` UI와 shared location command 진입점은 제거 대상이며 보존 데이터만 호환성 계약으로 남습니다.

## Experience Principles

1. **Discoverability**: 앱 런처와 명확한 섹션 제목으로 현재 위치와 다음 행동을 보여줍니다.
2. **Summary First**: 기본 화면은 세부 입력보다 현재 상태와 핵심 결과를 먼저 보여줍니다.
3. **One Small Data Contract**: Main은 월 실수령액, 주거비, 생활비, 저축과 투자만 직접 편집합니다.
4. **Explicit Feedback**: draft 변경, 적용, 취소, 오류와 저장 결과를 해당 편집 맥락에서 즉시 알립니다.
5. **Consistent Model**: 요약과 월 자금 구성은 동일한 정규화 데이터에서 만들어집니다.
6. **Safe Constraints**: 유효하지 않은 금액, 초과 배분과 저장 실패는 조용히 무시하지 않습니다.
7. **Progressive Disclosure**: 개요는 관계와 결과를 보여주고 민감하거나 복잡한 세부정보는 선택 후 공개합니다.
8. **Local-first Trust**: 한 workspace의 저장 위치, whole-workspace import/export와 앱별 소유 slice를 사용자가 이해할 수 있어야 합니다.

## Product-Specific Interaction Contracts

### Main

- 기본 화면은 월 수입, 생활비, 저축, 투자와 순현금흐름을 우선 보여줍니다.
- Main은 다섯 월간 금액만 직접 소유하며 항목·계좌·카테고리 편집을 제공하지 않습니다.
- dashboard 편집기를 열거나 탐색하는 것만으로 dirty 상태를 만들지 않습니다.
- 실제 draft 변경이 있을 때 Apply Bar가 나타납니다.
- `취소`와 `적용`은 현재 draft와 적용된 계획의 차이를 명확히 처리합니다.
- 요약과 월 자금 구성은 적용된 데이터만 반영합니다.
- 월 자금 구성 도넛의 네 항목은 `소비`, `저축`, `투자`, `여윳돈`으로 표시합니다. 모바일 범례는 44px 터치 영역 안에 색상·명칭·비율만 두 열로 표시하고 desktop에서는 금액도 함께 표시합니다.
- 도넛 조각의 pointer·touch 선택은 중앙을 해당 명칭과 비율로 바꾸고 선택 조각을 확장합니다. keyboard 범례도 같은 상세 정보와 금액 tooltip을 제공합니다.

### Current Journey

- 앱 런처는 `자금 흐름 (Main)`, `미래 성장 (Simulation)`, `투자 배분 (Portfolio)`, `계좌 연결 (Account Map)`을 각각 집, 상승 그래프, 분할 도넛, 펼친 통장 아이콘으로 표시합니다.
- 현재 위치는 아이콘 아래 선과 `aria-current`로 표시합니다.
- 앱 런처와 CTA는 URL 탐색만 수행하며 데이터를 전달하거나 저장하지 않습니다.
- Simulation은 진입 시 `isf-workspace-v1`의 최신 Main 월 저축·투자를, Portfolio는 최신 Main 투자금을 각자의 읽기 전용 adapter로 읽고 write-back하지 않습니다.
- Simulation과 Portfolio의 Main read는 읽기 전용입니다. Closure 전 Portfolio 위치 disclosure의 registry write는 제거 예정인 임시 예외입니다. Closure 이후 Portfolio는 자기 slice만, Account Map은 자기 slice와 공유 금융 위치 registry만 갱신합니다. 성공한 write마다 monotonic revision을 증가시킵니다.

### Simulation

- 최초 설정은 시작 원금과 기간·기대수익률 두 단계로 안내하고, 재방문은 저장된 결과를 먼저 보여줍니다.
- 결과는 핵심 문장 하나, 조건 한 줄, 전체 폭 그래프, 비교값 두 개 순서로 읽힙니다.
- 기간은 0~30년 슬라이더와 숫자 입력을 함께 제공하고 직접 기대수익률은 ±0.25%p 조작을 제공합니다.
- 그래프는 기본 상태를 절제하고 desktop pointer·keyboard 탐색에서는 연도와 현재 계획·전부 저축·납입원금·저축·투자 잔액을 상세 카드로 보여줍니다.
- 767px 이하 touch 탐색은 누른 채 연도를 이동하고 손을 뗀 뒤 선택을 유지합니다. 고정 크기 compact tooltip은 연도·현재 계획 총액·전부 저축 총액만 한 줄로 보여주며 그래프 밖 touch나 scroll에서 닫힙니다.
- 그래프 tooltip은 닫기 버튼을 두지 않으며 `Escape`와 그래프 밖 pointer로 닫힙니다.
- 한국식 정수 금액은 tooltip과 비교 영역에서 임의 글자 단위로 줄바꿈하거나 잘라내지 않습니다.
- 명목·실질은 항상 보이고 기준금리, 물가와 면책은 `계산 기준`에서 점진적으로 공개합니다.
- 저장 성공은 낮은 강조로 상시 표시하고 오류만 강조합니다. 재설정은 앱 런처의 관리 메뉴 안에서 확인합니다.
- 일반 결과·조작 영역은 공통 `Flat Panel`과 버튼 규격을 사용하고, 그래프 선·면·tooltip처럼 정보 해석에 필요한 시각 요소만 Simulation 고유 표현을 유지합니다.

### Portfolio

- 최초 진입은 `시작 → 배분 → 검토`의 세 단계로 한 가지 작업만 보여주며, 검토에서 투자 대상 수·투자금·현금 비중을 확인한 뒤 바로 시작합니다. 현금 100%도 유효한 계획입니다.
- 적용 계획이 있으면 결과로 바로 진입해 자산별 금액과 전체 비중을 함께 보여줍니다.
- `배분 수정`은 결과와 시각적으로 분리된 집중 화면을 엽니다. 768px 이하는 하단 sheet, 769px 이상은 우측 panel이며 결과 영역은 편집 중 비활성화합니다.
- 변경 전에는 적용 action을 숨기고 첫 변경 뒤에만 취소·적용을 제공합니다. 적용 전 확인은 투자 대상 수, 투자금과 현금 비중을 요약합니다.
- 결과는 도넛과 표를 함께 사용하고 pointer·touch·keyboard에 동등한 정보를 제공합니다.
- 투자금 0원은 기존 계획을 보존하고 Main 투자금 편집으로 안내합니다.
- 현재 배분 편집과 결과는 항상 `전체 기준`이 우선입니다.
- Closure 이후 최초 설정, 결과와 배분 수정 어디에서도 계좌·기관·보관처 또는 공유 금융 위치 관리 UI를 표시하지 않습니다. Closure 전 결과의 위치 disclosure는 제거 예정 임시 예외입니다.
- Closure 이후 기존 location-scoped 데이터는 호환성을 위해 보존하지만 Portfolio가 이를 만들거나 편집할 수 있는 것처럼 표현하지 않습니다.

### Account Map

- 계좌·기관·보관처의 생성, 이름 변경과 보관을 Account Map이 소유합니다.
- Portfolio 투자 대상과 계좌·보관처의 연결은 별도 승인된 상세 명세가 있을 때만 제공하며 Account Map은 Main에 write-back하지 않습니다.
- 수입·주거·생활비·저축·투자의 purpose-first 관계도를 완료 화면의 주요 시각 요소로 사용합니다.
- 관계 유형, unresolved·excess와 선택 상태는 색상과 짧은 텍스트를 함께 사용해 색상만으로 구분하지 않습니다.
- system purpose의 Main 기준 금액과 전체 미배정·부족 상태는 overview에 표시하고, 개별 연결 금액은 pointer·touch·keyboard 집중 상태에서 공개합니다.
- Node modal은 금액·상태·나머지를 주요 편집으로 유지합니다. `연결 추가`는 하나의 보조 icon action, custom purpose `보관·복원`은 제목 줄 `더보기`로 압축하되 기능을 숨기거나 별도 페이지로 보내지 않습니다.
- 다른 목적에 쓰는 active location도 선택 목록에 표시하고 필요한 role은 연결 저장과 함께 원자적으로 추가합니다.
- stale 저장은 modal·setup 입력을 유지한 채 최신 상태를 다시 읽고 `최신 상태에서 다시 적용`으로 복구합니다. 자동 overwrite나 입력 초기화는 금지합니다.
- 전체·기본·상세 semantic zoom을 제공하고 임의 node 좌표나 drag edge를 저장하지 않습니다.
- 모바일 요약은 관계도를 첫 viewport 밖으로 밀어내지 않아야 하며 Account Map은 Main에 write-back하지 않습니다.

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
- 1억 원 미만은 백 원 단위까지 반올림해 천 원까지, 1억 원 이상은 천 원 단위까지 반올림해 억·만 원 조합으로 소수점 없이 표시합니다.
- 금액 변환과 표시는 공통 utility를 사용해 화면별 오차를 만들지 않습니다.
- 사용자 편집 금액의 허용 범위와 비정상 값은 저장 전에 검증합니다. 계산 결과인 0원 또는 음수 월 투자 가능액은 정상 journey 상태로 표시할 수 있습니다.

## Components

### App Launcher

- 왼쪽 `ISF 앱` 탐색과 오른쪽 `앱 도구` 그룹을 여백과 세로 hairline으로 구분하며 페이지와 함께 스크롤합니다. 앱 링크와 오른쪽 끝 `관리 메뉴` 톱니는 모두 44×44px 선택 영역을 유지합니다.
- Main, Simulation, Portfolio와 Account Map을 한 줄의 아이콘으로 보여주되, 가용 폭이 부족할 때만 `더보기`에 원래 순서대로 이동합니다. 현재 앱은 항상 직접 표시하고 네 앱이 모두 들어가면 `더보기`를 렌더링하지 않습니다.
- 현재 목적지는 안정적인 아이콘 아래 선과 `aria-current`로 분명히 표시합니다.
- pointer hover와 keyboard focus는 동일한 한글·영문 툴팁을 제공하고, touch는 450ms 길게 누르면 같은 정보를 표시하되 해당 탭의 탐색과 context menu를 한 번 억제합니다.
- 톱니 팝오버의 첫 항목 `앱 아이콘 안내`는 네 아이콘의 한글·영문 의미를 같은 팝오버 안에 펼칩니다. 그 뒤에 앱별 관리 행동을 표시합니다.
- 관리 popover는 viewport 좌우 16px 안에 머물고, Escape 또는 바깥 pointer 입력으로 닫힌 뒤 톱니 버튼으로 focus를 돌려보냅니다. 파괴적 행동은 별도 확인 dialog와 내부 focus 관리를 거칩니다.
- 툴팁, `더보기`, 관리 메뉴는 Escape 또는 바깥 pointer 입력으로 닫히고 소유 trigger로 focus를 돌려보냅니다. 두 popover는 동시에 열리지 않으며 `prefers-reduced-motion`에서는 전환 효과를 제거합니다.
- 런처 링크는 URL 탐색만 수행하며 앱 간 데이터 연결 상태를 소유하거나 표시하지 않습니다.

### Main Cashflow Editor

- 다섯 월간 값을 한 덩어리의 이해 가능한 양식으로 제공합니다.
- desktop에서는 dashboard 옆 편집 영역, mobile에서는 dialog로 같은 계약을 제공합니다.
- 오류가 있으면 해당 필드 가까이에서 수정 방법을 알려줍니다.
- mobile dialog의 focus를 내부에서 관리하고 닫힌 뒤 진입 컨트롤로 돌려보냅니다.

### Apply Bar

- Main의 draft/apply 편집 맥락에서 사용합니다.
- 단순 탐색은 Apply Bar를 만들지 않습니다.
- `취소`와 `적용` 같은 결과 중심 문구를 사용합니다.
- 모바일 safe area와 편집 내용을 가리지 않습니다.

### Toast Message

- 저장, 복원, import와 오류 결과를 비차단 방식으로 알립니다.
- 해결을 위한 사용자 행동이 필요하면 구체적인 다음 단계를 포함합니다.

### DataHubModal

- Main 관리 메뉴는 current whole-workspace 백업의 진입점입니다.
- export는 Main·Simulation·Portfolio·공유 위치와 Account Map contract를 하나의 versioned envelope로 내보냅니다.
- import는 모든 slice와 참조를 적용 전에 검증하고 유효하면 확인 dialog 뒤 한 번에 교체합니다. invalid 또는 old-format 입력은 현재 raw workspace를 유지합니다.

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
- 390px에서 Simulation 그래프와 비교값은 보이고 tooltip은 viewport 안에 머물러야 합니다.
- 보이는 주요 버튼과 입력은 최소 44px touch target을 가져야 합니다.
- modal 콘텐츠는 viewport 안에서 스크롤되고 footer 또는 Pending Bar가 가려지지 않아야 합니다.
- 다중 열 control은 768px 이하에서 단일 열 또는 읽을 수 있는 compact layout으로 전환합니다.
- 현재 Main 월 자금 구성, Simulation 그래프와 Phase B Account Map은 의미를 잃도록 과도하게 축소하지 않습니다.
- Portfolio의 설정과 하단 편집 sheet는 390px에서 이름·금액·비율과 action이 패널 밖으로 넘치지 않아야 합니다.
- Phase B Account Map의 compact summary는 모바일 첫 화면에서 관계도를 밀어내지 않아야 합니다.

## Accessibility

- 모든 입력은 label 또는 동등한 accessible name을 가져야 합니다.
- modal은 올바른 role, 제목 연결과 focus 관리가 필요합니다.
- field 오류와 stale 재적용 충돌은 첫 관련 control에 focus를 이동하고 오류 설명을 해당 control과 연결합니다.
- 그래프는 사용자 목적을 설명하는 accessible name과 텍스트 대안을 제공합니다.
- 키보드로 주요 선택, 저장, 취소와 닫기를 수행할 수 있어야 합니다.
- 오류와 상태는 색상 외의 텍스트 또는 아이콘으로도 전달합니다.

## Do

- 공통 header, feedback, storage와 formatting utility를 먼저 확인합니다.
- Main 현재 데이터 소유권, URL-only 탐색과 상세 앱의 명시적인 workspace Main read 경계를 유지합니다.
- Closure 이후 workspace write는 자기 slice만 갱신하고 Portfolio는 공유 금융 위치 registry를 갱신하지 않습니다. Closure 전 Portfolio 위치 disclosure의 임시 registry write도 stale revision을 조용히 덮어쓰면 안 됩니다.
- Main의 다섯 값 계약을 넘어서는 편집 UI를 현재 제품에 추가하지 않습니다.
- 외부 동작과 모바일 화면을 함께 검증합니다.
- CSS 수정 전후 responsive media query와 파일 구조를 확인합니다.

## Do Not

- 레거시 UI를 새 화면의 디자인 기준으로 사용하지 않습니다.
- Main에 두 번째 일반 재무 편집기를 만들지 않습니다.
- Phase C 전에 Main 연결 결과 카드를 현재 계약처럼 표시하지 않습니다.
- Portfolio에 계좌·기관·보관처 관리나 location-scoped 배분 action을 추가하지 않습니다.
- 모든 앱에 하나의 전역 Pending Bar 동작을 강제하지 않습니다.
- Account Map 수정이 Main에 자동 반영되는 것처럼 표현하지 않습니다.
- 카드에 gradient 또는 과도한 translucent effect를 사용하지 않습니다.
- Gowun Batang과 Gowun Dodum의 역할을 임의로 뒤섞지 않습니다.
- 390px와 768px 검증 없이 responsive 작업을 완료로 선언하지 않습니다.
