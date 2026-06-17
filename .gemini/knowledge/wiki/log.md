---
title: "Project Evolution Log"
description: "Individual Savings Flow UI 프로젝트의 최신 연대기적 작업 로그"
---

# 🗺️ Project Evolution Log (최신 작업 로그)

이 문서는 프로젝트의 최근 지식 습득 및 결정의 **감사 추적(Audit Trail)**을 보관합니다.
이전의 오래된 작업 로그는 [[archive/log_archive_20260613]] 문서에서 확인할 수 있습니다.

## 📊 최신 마일스톤 개발 요약

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#2d333b', 'edgeLabelBackground':'#161b22', 'tertiaryColor': '#161b22'}}}%%
flowchart TD
    classDef default fill:#2d333b,stroke:#6d5dfc,color:#e6edf3;
    
    M1["v1.6: 코드 리팩터링 & 안정성<br>(2026-06-10)"] --> M2["v1.7: 다중 계좌 매핑 & 이체 시각화<br>(2026-06-12)"]
    M2 --> M3["v1.8: 적립식 포트폴리오 관리 UI/UX<br>(2026-06-16)"]
    
    style M1 fill:#2d333b,stroke:#6d5dfc,color:#e6edf3
    style M2 fill:#2d333b,stroke:#6d5dfc,color:#e6edf3
    style M3 fill:#2d333b,stroke:#6d5dfc,color:#e6edf3
```

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#2d333b'}}}%%
sequenceDiagram
    autonumber
    actor U as 사용자
    participant S1 as Step 1 (가계흐름)
    participant S2 as Step 2 (배당시뮬)
    participant S3 as Step 3 (포트폴리오)
    
    U->>S1: 수입/지출 입력 & 통장 쪼개기 매핑
    S1->>S2: 월 투자 여력 데이터 연동
    S2->>S3: 포트폴리오 구성 비율 & 세그먼트 적립 주기 설정
    S3->>U: 실시간 비중 검증 & 1년 누적 투자 추이 그래프
```

## 🔍 핵심 변경사항 개요

최근 이틀간의 작업은 **Step 3 적립식 포트폴리오 관리 고도화**와 **데이터 단위 원(KRW) 일원화**에 집중되었습니다.

| 핵심 피처 | 적용 파일 | 요약 |
|---|---|---|
| 1원 단위 일원화 | [utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/utils.js) | 모든 표시/계산 단위를 원 단위로 통일하고 한글 금액 힌트 표시 |
| 포트폴리오 에디터 | [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js) | 실시간 비중 계산, 1,000원 단위 입력 검증 및 올림/내림 보정 |
| 플로팅 펜딩 바 | [dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js) | 변경 사항 발생 시 무작위 3종 애니메이션으로 플로팅 저장 바 노출 |

---

## [2026-06-17] fix | 월 지출/저축/투자 요약 인풋 타입 변경 (number -> text)
- **목적**: 요약 지표 영역의 인풋 값 대입 시 천단위 콤마 포맷팅 문자열이 유입될 때 브라우저 파싱 에러로 인해 값이 공란(0원)으로 손실되는 현상을 막고 가독성을 개선합니다.
- **주요 변경사항**:
  - **인풋 속성 변경 (`apps/main/index.html`)**: `monthlyExpense`, `monthlySavings`, `monthlyInvest`, `monthlyDebtPayment` 요소의 `type` 속성을 `"number"`에서 `"text"`로 수정하고 `data-money-input="won"` 추가.
- **결과**: 쉼표 포맷 문자열이 유입되어도 런타임 오류가 발생하지 않으며, 정상적으로 데이터 바인딩 및 파싱이 이루어져 가용현금 0원 데이터 오염 문제가 해결됨.

## [2026-06-17] fix | 루트 index.html 내 Main 링크 경로 수정
- **목적**: 자동 이동되지 않을 때 사용자가 클릭하는 Main 링크의 경로를 실제 호스팅 주소인 GitHub Pages URL로 수정합니다.
- **주요 변경사항**:
  - **Main 링크 수정 (`index.html`)**: `a` 태그의 `href` 값을 `./apps/main/`에서 `https://jinhoops.github.io/IndividualSavingsFlowUI/`로 변경.
- **결과**: 사용자가 리다이렉트 실패 시 올바른 호스팅 경로로 이동할 수 있도록 수정 완료.

## [2026-06-16] style | main 재무 핵심 지표 웹 전체화면 4열 레이아웃 및 4:3 카드 비율 조정 (v0.11.74)
- **목적**: main 화면의 재무 핵심 지표 요약 카드 영역이 PC 전체화면일 때 3열이 아닌 4열로 노출되도록 하고, 각 카드가 가로가 더 긴 4:3 비율을 갖도록 개선하여 컴팩트하고 밀도 높은 레이아웃을 완성합니다.
- **주요 변경사항**:
  - **PC 뷰포트 4열 그리드 이식 (`apps/main/styles.css`)**: `.summary-cards`의 `grid-template-columns` 속성을 `repeat(3, minmax(180px, 1fr))`에서 `repeat(4, minmax(180px, 1fr))`로 변경하여 카드 4개가 한 줄에 정렬되도록 수정.
  - **카드 4:3 비율 및 중앙 정렬 적용 (`apps/main/styles.css`)**: `.summary-cards .card`에 `aspect-ratio: 4/3`, `display: flex`, `flex-direction: column`, `justify-content: center`를 적용하고 padding 및 gap을 축소하여 밀도 높고 컴팩트하게 정렬.
  - **반응형 리셋 구성 (`apps/main/styles.css`)**: 태블릿 및 모바일(1080px 이하) 환경에서는 `aspect-ratio: auto` 및 `display: block`을 다시 활성화하여 레이아웃 파손 방지.
- **결과**: Playwright e2e 테스트(7개 테스트 케이스) 전체 통과 확인 및 번들 빌드 성공.

## [2026-06-16] docs | Phase 5: UI/UX visual audit 및 6-pillar UI-REVIEW.md 작성
- **목적**: Phase 5 (Portfolio Creation & Target Allocation UI) 완료에 따라, abstract 6-pillar standards와 Playwright 스크린샷 캡처를 기반으로 시각적/인터랙션 감사(visual audit)를 수행하고 `05-UI-REVIEW.md`를 작성하여 품질을 검증함.
- **주요 변경사항**:
  - **스크린샷 캡처**: Playwright CLI 도구를 활용하여 step3 포트폴리오 에디터 화면의 데스크톱(1440x900), 모바일(375x812), 태블릿(768x1024) 뷰포트 스크린샷을 `.planning/ui-reviews/05-20260616-1032/` 경로에 성공적으로 캡처 및 저장함.
  - **6개 기둥(6-Pillar) 평가 수행**: Copywriting(3/4), Visuals(2/4), Color(2/4), Typography(3/4), Spacing(2/4), Experience Design(3/4)으로 평가하여 총점 15/24점을 도출함.
  - **핵심 개선 사항(Top 3 Priority Fixes) 정의**: 브라우저 기본 alert/confirm의 Toast/커스텀 모달화, 인라인 스타일 제거 및 공통 디자인 토큰 이관, 하드코딩 색상 변수화 및 다크모드 대응을 우선 해결 과제로 선정함.
  - **UI-REVIEW 문서화**: `.planning/phases/05-portfolio-creation-allocation-ui/05-UI-REVIEW.md` 문서 작성 완료.
  - **지식 위키 갱신**: `INDEX.md`의 Phase 5 Context 상태를 '완료'로 동기화함.
- **결과**: Phase 5 UI 검증 및 지식 위키 현행화가 마무리되었습니다.


## [2026-06-16] docs | parallel gsd-codebase-mapper 에이전트를 통한 코드베이스 분석 및 7대 핵심 문서 업데이트
- **목적**: 코드베이스의 최신 기술 스택, 아키텍처, 디렉토리 구조, 코딩 컨벤션, 테스트 상태, 미결 과제 등을 4개 에이전트의 병렬 처리를 통해 조사하고 관련 문서를 동기화하여 지식 기반을 최신화합니다.
- **주요 변경사항**:
  - **4개 병렬 `gsd-codebase-mapper` 에이전트 구동**:
    - Tech: `STACK.md` (71 lines), `INTEGRATIONS.md` (74 lines)
    - Arch: `ARCHITECTURE.md` (110 lines), `STRUCTURE.md` (73 lines)
    - Quality: `CONVENTIONS.md` (45 lines), `TESTING.md` (39 lines)
    - Concerns: `CONCERNS.md` (103 lines)
  - **문서 동기화 및 커밋**:
    - 수정된 7대 코드베이스 맵 문서를 스테이징하고 커밋 완료 (`docs: update codebase map from parallel analysis`).
- **결과**: `.planning/codebase/` 내부의 모든 핵심 문서가 실제 구현 세부 사항(Vite/TS/Tailwind v4, React 점진적 도입, IndexedDB & BackupService 흐름, 원화 단위 정합성 수호 원칙 등)을 바탕으로 현행화 완료되었습니다.


## [2026-06-16] feat | 전역 패널 헤더 투명 디자인 통일 및 Step 3 포트폴리오 에디터 접기/펼치기 UX 고도화 (v0.11.55)
- **목적**: Step 2의 page-intro 헤더 디자인 규격(배경 및 테두리 투명화)을 Step 1과 Step 3에 전역 적용하여 시각적 통일성을 부여하고, 항상 노출되어 화면을 비대하게 차지하던 Step 3 포트폴리오 만들기 화면을 기본적으로 숨기고 추가/취소 버튼 액션으로 동적 제어하도록 UX를 고도화합니다.
- **주요 변경사항**:
  - **패널 헤더 디자인 통일 (`styles.css`)**:
    - `step1/styles.css` 내 `.page-intro` 클래스의 `background: transparent !important`, `border: none !important`, `box-shadow: none !important` 강제 적용.
    - `step3/styles.css`에 `.page-intro`, `.page-intro h1`, `.page-intro .lead` 스타일을 신설하여 Step 2 디자인 사양으로 정비.
  - **Step 3 에디터 동적 토글 마크업 (`step3/index.html`)**:
    - 포트폴리오 목록 헤더에 `+ 포트폴리오 추가` 버튼(`showCreatorBtn`) 탑재.
    - 포트폴리오 생성기 폼 영역(`portfolioCreator`)의 디폴트 숨김(`style="display: none;"`) 설정.
    - 생성기 폼 하단 액션 버튼 그룹에 `취소` 버튼(`cancelCreatorBtn`) 신설.
  - **이벤트 컨트롤러 및 헬퍼 구현 (`step3/modules/dom.js`, `step3/app.js`)**:
    - `dom.js`에 새로 신설한 버튼 DOM 선택자 맵핑 및 폼의 표시 상태를 제어하는 `showPortfolioCreator()`, `hidePortfolioCreator()` 헬퍼 함수 구현.
    - `app.js` 내에 만들기/취소 버튼 클릭 이벤트를 구독하고, 생성 성공 콜백 완료 시 자동으로 크리에이터 폼을 닫고 목록을 재렌더링하도록 3계층 이벤트 제어 로직 보완.
- **결과**: `npm run build` 및 `npm run check` 번들링/타입 검증 경고 없이 최종 통과.


## [2026-06-16] feat | Step 1 가계 흐름(Sankey) 그룹화 다중화 및 사용자 커스텀 수준 제어 구현 (v0.11.54)
- **목적**: Step 1 월 가계 흐름(Sankey Diagram)에서 지출, 저축, 투자 카테고리의 묶음 단위를 기본값으로 크게 '고정비(고정지출)', '저축', '투자'로 묶어 보여주어 가독성을 확보하고, 사용자가 직접 드롭다운(통합, 그룹별, 개별 항목)을 통해 각 분류별 그룹화 깊이를 자유롭게 실시간 커스터마이징할 수 있는 UX를 제공합니다.
- **주요 변경사항**:
  - **상태 관리 확장 (`state.js`)**: 각 카테고리별 그룹화 방식을 선택 저장하는 `sankeyGrouping` 상태(`expense`, `savings`, `invest` 각각 `total` | `group` | `detail`)를 추가하고 기본값은 모두 `total`로 지정.
  - **Sankey 빌더 고도화 (`sankey-builder.js`)**: `buildSankeyData` 함수에 `sankeyGrouping`을 추가 수용하고, 카테고리별로 그룹화 방식에 맞춰 노드 및 링크를 동적으로 병합 및 합산하는 `resolveCategoryNodesAndLinks` 알고리즘 이식. 병합된 대분류 노드(`total-expense` 등)를 생성할 때 범례(Legend) 및 마우스 오버 툴팁과 연동되도록 `splitGroups` 배열 구조를 정밀하게 구성하여 반환.
  - **UI 마크업 통합 (`index.html`)**: 생키 다이어그램 도구막대(`sankey-head-tools`) 내부의 `sankey-view-toggle` 바로 아래에 Glassmorphism 디자인 원칙에 맞춘 지출/저축/투자 그룹화 설정 셀렉트 박스 3개 신설.
  - **DOM 매핑 및 이벤트 연동 (`dom.js`, `ui-controller.js`, `app.js`)**: `dom.js`에 새로 추가된 엘리먼트 맵핑을 이식하고, `ui-controller.js`에 `syncSankeyGroupingUi()` 동기화 헬퍼 신설. `app.js`에서 각 드롭다운의 `change` 이벤트를 구독하여 `setSankeyGrouping` 함수를 통해 상태 갱신 및 다이어그램 리렌더링 처리.
  - **반응형 스타일 보완 (`styles.css`)**: 760px 이하 모바일 디바이스 뷰포트에서도 레이아웃이 찌그러지거나 잘리지 않도록 모바일 미디어 쿼리 블록에 `.sankey-grouping-controls` 및 내부 셀렉트 박스의 너비를 적절히 좁히는 반응형 스타일 추가.
- **결과**: `npm run build` 및 `npm run check` 컴파일/타입 체크 에러 없이 무결하게 통과.


## [2026-06-16] release | 포트폴리오 +/- 올림내림 보정 및 3종 랜덤 애니메이션 플로팅 펜딩 바 탑재 (v0.11.65)
- **목적**: 만들기/편집 시 `-`/`+` 가감 버튼 편의성을 올림/내림 보정 규칙으로 고도화하고, 모달 내 저장 버튼을 대체하는 3가지 랜덤 애니메이션 펜딩 바(Pending Bar)를 구축해 프리미엄 조작 인터랙션을 확보함.
- **주요 변경사항**:
    - **1,000원 단위 올림/내림 보정 공식 적용**: 포트폴리오 만들기 테이블 및 상세 보기 모달의 금액 인풋 좌우에 `-` / `+` 버튼을 제공하고, 1,000원 단위가 아닐 때 보정하는 수식(plus 시 `Math.ceil(val/1000)*1000`, minus 시 `Math.floor(val/1000)*1000`)을 적용하여 입력 조작을 개선.
    - **인풋 포커스 트랜지션 확장**: 만들기 화면 내의 금액 인풋에 포커스가 잡힐 때도 tr 행에 `editing` 클래스를 토글하여 종목명과 비중이 부드럽게 축소되도록 CSS 애니메이션 적용 대상을 확장.
    - **모달 내부 저장 버튼 삭제**: 모달 하단의 투박한 "변경사항 저장" 버튼을 제거하여 레이아웃을 간소화.
    - **3종 랜덤 애니메이션 플로팅 펜딩 바(Pending Bar) 개발**: 모달 변경 사항 감지 시 화면 하단에 고정 배치되는 펜딩 바가 노출되도록 처리. 최초 노출 시 `anim-slide-up`, `anim-fade-scale`, `anim-bounce-in` 중 하나를 `Math.random()`으로 무작위 선택 적용.
    - **영속적 변경 사항 상태 보존**: 펜딩 바가 켜진 상태에서 모달이 닫히거나 다시 열려도 편집 중이던 상태(`pendingModalChanges`)를 그대로 보존하며, 최종 저장(Save)과 취소(Cancel)는 펜딩 바가 주도하도록 상태 흐름 정리.
- **결과**: Step 3 포트폴리오 조작성과 상태 관리 무결성을 완성하여 사용자의 인수 기준을 완벽하게 충족함.


## [2026-06-16] release | 플로팅 펜딩 바 취소 시 이어서 편집, 메시지 제거, 모바일 줄바꿈 방지 및 카드 호버 광채 보강 (v0.11.67)
- **목적**: 펜딩 바의 취소 버튼 동작과 메시지 유무에 대한 사용자 피드백을 적용하고, 모바일에서의 만들기 화면 헤더 레이아웃을 개선하며 포트폴리오 카드의 호버 테두리 광채 효과를 보강함.
- **주요 변경사항**:
    - **펜딩 바 취소 동작 수정**: 펜딩 바의 '취소' 클릭 시 모달이 닫히거나 임시 변경 정보가 초기화되지 않고, 펜딩 바만 화면에서 사라지도록(이어서 편집 가능하도록) 핸들러 수정.
    - **펜딩 바 메시지 제거**: 펜딩 바 내부의 텍스트 메시지를 삭제하여 버튼만 있는 극도의 미니멀리즘 플로팅 바로 스타일링하고 가운데 정렬 적용.
    - **모바일 만들기 테이블 헤더 줄바꿈 방지**: `.creator-table th`에 `white-space: nowrap;`을 적용하고 모바일 미디어 쿼리 내에서 패딩과 폰트 크기를 유기적으로 최적화하여 좁은 화면에서도 텍스트 줄바꿈이 일어나지 않도록 수정.
    - **포트폴리오 카드 호버 광채 보강**: 카드 호버 시 기존 일반 쉐도우에서 Sunset Orange 톤이 감도는 광채 효과(`box-shadow`)로 변경하여 UAT 7번 테마 일치 수준을 극대화함.
- **결과**: 피드백 사항을 전면 해결하고 모바일 반응형 무결성을 최종 검증함.


## [2026-06-16] release | 포트폴리오 생성 시 미입력/오입력 항목 디테일 알림 제공 (v0.11.70)
- **목적**: 사용자가 입력을 마치기 전에 포트폴리오 생성 버튼을 누를 수 있도록 항시 활성화해 두고, 클릭 시 어떤 정보가 미입력되었거나 잘못 입력되었는지를 콕 집어 피드백하도록 개선함.
- **주요 변경사항**:
    - **생성 버튼 상시 활성화**: `dom.js` 내의 `renderCreatorForm` 및 `updateCreatorFormStats`에서 `savePortfolioBtn`이 항상 클릭 가능하고 활성화된 스타일을 띄도록 수정.
    - **인라인 경고 피드백 핸들러 작성**: `app.js` 내의 생성 버튼 클릭 이벤트에서 순차적으로 데이터를 검증하고, 미입력/오입력 원인(포트폴리오명 누락, 종목 개수 2개 미만, 개별 종목명 누락, 1000원 이상/단위 미준수 등)을 정확하게 콕 집어 에러 `alert`로 노출하고 생성을 차단함.
- **결과**: 사용자가 "왜 생성 버튼이 안 눌리지?" 하고 헤매는 인지적 부하를 해소하고, 미입력 요소를 바로 짚어주는 친절한 가이드 UX를 확보함.


## [2026-06-16] release | 누적 투자금 영업일 기준 환산 및 팩터 조정 (v0.11.71)
- **목적**: 모달 내 1년 누적 투자 추이 예시 차트에서 '매일 적립' 시 365일 배수가 아니라 실제 영업일(월 평균 20일) 기준으로 환산하도록 수식을 조정하여 금융 도메인 현실성을 높이고 동적 힌트 문구를 표출함.
- **주요 변경사항**:
    - **매일 적립 1년 영업일 환산 팩터 패치**: '매일' 주기의 1년 환산 팩터를 `365`에서 월 평균 영업일 20일 기준인 `240` (12달 * 20일)으로 조율하여 대략적인 누적 투입금 수치 산출.
    - **주기별 1년 환산 가이드 문구 동적 표출**: 차트 하단 설명 엘리먼트(`modalChartDesc`)를 바인딩하고, 적립 주기에 맞추어 가이드 텍스트(예: "매일 적립은 월 평균 영업일(20일, 연 240일) 기준의 대략적인 수치입니다.")를 동적으로 갱신 노출.
- **결과**: 금융 도메인의 현실적인 매수 규칙(영업일에만 체결)을 차트 연산에 반영하여 계산 신뢰도를 향상시킴.


## [2026-06-16] fix | 모바일 재무설정 및 가계추이 검증 패널 헤더 줄바꿈 방지 및 정렬 최적화 (v0.11.74)
- 목적: 모바일 화면에서 재무설정 및 가계추이 검증 패널의 헤더가 flex column 정렬을 상속받아 제목과 토글 버튼이 세로로 줄바꿈되어 출력되는 현상을 수정하여 수평 정렬을 유지시킴.
- 주요 변경사항:
    - 모바일 헤더 가로 배치 강제: apps/main/styles.css 내의 760px 이하 미디어 쿼리 블록에 .controls-panel .section-head와 .projection-panel .section-head 셀렉터를 추가하고 flex-direction: row, align-items: center, justify-content: space-between을 정의하여 모바일에서도 한 줄로 깔끔하게 렌더링되도록 스타일을 재조정.
    - 테스트 시나리오 안정화: tests/step1.spec.ts 내의 Phase 07 관련 모바일 요소 검증 시 패널을 명시적으로 펼친 후 탭 전환에 따른 가시성 검사를 순차적으로 진행하도록 수정하고, 슬라이더 외부 요소에 대한 가시성 판정 오작동을 방지하기 위해 가로 탭 요소 검증 방식을 개선.
- 결과: 빌드 번들링 및 타입 체킹 경고 없이 최종 통과.


## [2026-06-16] fix | 빌드 무결성 복구 및 E2E 테스트 100% 통과 (v0.11.82)
- **목적**: 중복 코드 및 런타임 오류로 인해 발생한 빌드 에러를 정상화하고, 계좌망 SVG 갱신 시 ID 소실 및 테스트 코드 내의 부적절한 셀렉터 정의를 개선하여 Playwright E2E 테스트 검증을 100% 만족시킴.
- **주요 변경사항**:
    - **중복 코드 제거**: `bootstrap-controller.js`에서 발생한 꼬인 괄호 및 중복 토글 리스너 조각들을 제거하여 JS Syntax Error를 정상화함.
    - **closest 런타임 방어**: 마우스 진입/퇴출 시 `document` 객체 등 `closest` 함수를 가지고 있지 않은 객체에 접근할 때 브라우저 런타임 오류(`PageError`)가 발생하는 것을 막기 위해 `e.target` 유효성 검사 및 `typeof e.target.closest !== "function"` 예외 처리를 추가함.
    - **네트워크 맵 SVG ID 유지**: `network-map-renderer.js`에서 SVG를 렌더링하고 DOM에 주입할 때 기존에 존재하던 `#accountFlowNetworkMap` ID가 유실되어 테스트 도구가 요소를 찾지 못하던 현상을 방지하고자, 새로 생성하는 SVG에도 해당 ID 속성을 동적 할당함.
    - **E2E 테스트 시나리오 교정**: `step1.spec.ts` 내 모바일 컨트롤 검증 시, 계좌 탭 클릭 후 존재할 수 없는 `.table-wrap`을 조회하도록 되어 있던 오타를 실제 계좌 목록인 `.account-list`를 검증하도록 바르게 교정함.
- **결과**: `npm run build`, `npm run check`, `npm run test:e2e`가 모두 정상적이며 무결하게 완료됨.


## [2026-06-16] fix | 앱 헤더 로고 및 메뉴 한글 이름 복원 (v0.11.83)
- **목적**: 앱 네비게이션 드롭다운 메뉴 및 헤더 단계 라벨에 영어(Main, Simulation, Portfolio)로 번역되어 있던 부분을 이 프로젝트의 원래 한글 앱 명칭으로 되돌려 정체성을 일치시킴.
- **주요 변경사항**:
    - **라벨 명칭 한글화**: `shared/components/app-header.js` 내의 `stepLabels` 매핑 및 메뉴 리스트 텍스트를 한글 명칭인 '나의 가계 흐름', '배당 성장 시뮬레이션', '나의 적립식 포트폴리오'로 복원함.
    - **Web Component 구조 정상화**: 중복 병합으로 인해 꼬여있던 `AppHeader` 클래스의 중복 정의와 중첩 메서드 오류를 정리하고 올바른 컴포넌트 템플릿으로 단일화함.
- **결과**: 빌드, 타입 검사 및 E2E 테스트 7개 전원 통과 상태 유지하며 수정 완료.


## [2026-06-15] feat | Phase 5: 적립식 포트폴리오 관리 UI/UX 및 실시간 비중 연산 구현 완료 (v0.11.52)
- **목적**: 마일스톤 v1.8 Phase 5 요구사항(PORT-01, PORT-02)을 반영하여, 나만의 적립식 포트폴리오 만들기 화면 구현 및 실시간 비중 계산, 개별 종목 금액 1,000원 단위/최소 1,000원 검증, 그리고 한글 금액 힌트가 즉시 반영되는 입력 폼과 에디토리얼 요약 카드 및 팝업 모달 연동을 완성함.
- **주요 변경사항**:
  - **마크업 개편 (`index.html`)**: 기존의 리밸런싱 관련 코드를 제거하고, 포트폴리오 요약 카드가 리스팅될 `#portfolioList` 컨테이너 및 폼 입력기 `#portfolioCreator` 신설. 또한 상세 정보를 보여줄 Glassmorphism 디자인의 `#portfolioDetailModal` 모달 추가.
  - **상태 관리자 리팩토링 (`state.js`)**: 포트폴리오 배열 데이터(`portfolios`) 및 크리에이터 상태(`activeCreator`)를 관리하고 로컬 스토리지(`isf-step3-portfolios-v2`)에 영속화하도록 구조 전면 개편.
  - **적립식 계산 엔진 구현 (`calculator.js`)**: 개별 종목 금액의 합을 구해주는 `sumAmounts`, 총액 기준 비중 %를 실시간 반올림 정수로 연산하는 `calculateRatios`, 금액 1,000원 단위 및 최소 1,000원 검증을 수행하는 `validateAssetAmount`, 포트폴리오 유효성을 검사하는 `validatePortfolio` 구현.
  - **UI 제어 및 렌더러 구현 (`dom.js`)**: `IsfDom` 선택자를 갱신하고, 에디토리얼 요약 카드 리스트 렌더링, 크리에이터 입력 폼 렌더링, 유효성 위반 시 저장 버튼 비활성화 제어, 1년 누적 투자 추이 막대 그래프 시뮬레이션을 포함한 디테일 팝업 렌더링 기능 탑재.
  - **이벤트 컨트롤러 및 스타일 통합 (`app.js`, `styles.css`)**: `app.js`에서 3계층 구조를 유지하며 부분 렌더링(`renderCreatorOnly`) 및 팝업 연동 이벤트 바인딩. `styles.css`에 가로 프리미엄 세그먼트 버튼, 에디토리얼 카드 호버 시 Sunset Orange 테두리 광채 및 Y축 -2px 부유 애니메이션 효과, 팝업 모달 블러 스타일 등 추가.
- **결과**: `npm run build` 프로덕션 빌드 성공, TypeScript 타입 검증(`npm run check`) 에러 없이 완료, v0.11.52 배포 및 STATE.md 완료 상태 갱신.


## [2026-06-15] fix | Step 1 UI 입력 및 표시 단위 원(KRW) 일원화 및 실시간 금액 변환 힌트 정교화 (v0.11.51)
- **목적**: 만원 단위 표기가 잔존하는 문제를 해결하여, Step 1의 모든 금액 입력을 1원 단위로 변경하고 한글 금액 변환 힌트를 상시 표기하도록 고침. 또한 비율(%) 입력 필드가 금액으로 오인되는 혼동을 방지하고 프리셋 데이터 수치 오류를 정비.
- **주요 변경사항**:
  - **입력 필드 금액 단위 원(KRW) 일원화**: `apps/step1/modules/list-renderer.js`에서 금액 인풋의 `IsfUtils.toMan`을 제거하고 원 단위 원본값(`item.amount`, `al.amount`)을 직접 렌더링 및 입력받도록 수정.
  - **CSS 가상 요소 단위 수정**: `apps/step1/styles.css`에서 금액 필드 뒤에 붙던 `"만원"` 접미사 가상 요소를 `"원"`으로 변경하여 화면 표시 오류 해결.
  - **수동 이체 보드 및 출금 예상 잔액 힌트 원화 통일**: 이체 규칙 카드와 출금 잔액 가이드 문구를 만원 단위에서 `toLocaleString() + '원'` 및 `IsfUtils.convertToKoreanWon` 힌트를 제공하도록 수정.
  - **프리셋 모달 및 데이터 수치 오류 정정**: `app.js`에서 연봉 설정 인풋 값을 만원 단위로 체크하고 바인딩하던 로직(`salaryMan > 9900` 등)을 1원 단위 기준(`salaryWon > 99000000`)으로 교체하여 프리셋 생성 오동작을 전면 해결. `apps/step1/modules/presets.js` 내의 `PRESET_SALARIES` 레이블을 `3,000만 원` 등으로 표준 띄어쓰기를 적용하여 정정하였으며, 생성되는 수동 이체(`transfers`) 데이터에 명확한 한글 설명 `label` 속성("비상금 저축", "투자금 이체", "생활비 보조")을 추가하여 가시성을 확보. 또한 기존 프리셋 초기 자산(startCash, startDebt, startSavings, startInvest) 계산식에서 만원-원 변환 흔적으로 인해 **금액이 10,000배로 뻥튀기(4천만 원 연봉 기준 수십조~수백조 원 자산 발생)되던 심각한 계산 수식 버그를 원화 직접 비율 곱(0.2, 0.5, 2.0, 8.0) 방식으로 수정**하여 올바른 수치를 제공하도록 바로잡았습니다.
  - **실시간 금액 힌트 상시 표기**: 탭 전환 및 리스트 에디터 새로고침(DOM 재생성)이 끝나는 시점에 `IsfUtils.updateAllKoreanWonHints`를 명시적으로 실행하여 금액 힌트 텍스트가 항상 즉시 노출되도록 개선.
  - **비율(%) 단위 혼동 방지**: `shared/core/utils.js`의 `isMoneyField` 체크 로직에 `isRateField` 차단 필터를 추가하여, 금리/성장률/수익률 등 비율 필드에 불필요한 원 단위 금액 힌트가 잘못 노출되는 버그를 제거.
- **결과**: `npm run build` 빌드 성공, TypeScript 타입 검증 통과 및 v0.11.51 버전 배포 완료.


## [2026-06-15] release | 1원 단위 입력 전면 통일 및 실시간 금액 변환 힌트 탑재 (v0.11.46)
- **목적**: 1만원 단위의 입력 편의성을 위해 구별해둔 구조가 잦은 산술 오차와 버그(10,000배 복리 중복 계산 등)를 유발하므로, 전체 시스템을 1원 단위로 전면 통일하고, 입력 편의성을 위해 실시간 한글 금액 변환 힌트를 표시해주는 방식으로 긴급 수정함.
- **주요 변경사항**:
    - **단위 변환 함수 1:1 리턴화**: `shared/core/utils.js` 및 `src/core/types/money.ts` 내의 `toWon`과 `toMan` 헬퍼 함수가 단위를 변환하지 않고 1:1로 리턴하도록 수정하여 데이터의 1원 단위 일관성을 영속적으로 보장.
    - **실시간 한글 금액 변환 헬퍼 개발**: `IsfUtils.convertToKoreanWon(value)` 함수를 추가하여 억, 만, 원 단위를 한글 금액 형태(예: `500만 원`, `1억 2,300만 원`)로 변환해주는 헬퍼 탑재.
    - **전역 실시간 힌트 인풋 리스너 등록**: DOM 로딩 완료 시점에 전역 `input` 이벤트를 리스닝하여, 사용자가 금액 관련 입력창(`type="number"`)에 숫자를 칠 때 입력 필드 하단에 실시간으로 한글 금액을 표시해주는 힌트 엘리먼트(`.realtime-won-hint`)를 동적으로 생성 및 표시.
    - **프리셋 생성 연봉 입력 단위 교정**: `presets.js` 내의 `calculateMonthlyIncomeFromAnnualSalary`, `calculateAnnualSalaryFromMonthlyIncome`, `applyPresetBySalary`가 원 단위의 연봉 입출력을 지원하도록 수학 팩터와 상한 범위를 1원 단위 기준으로 패치.
    - **UI 라벨 및 텍스트 원 단위 정렬**: `apps/step1/index.html`, `apps/step1/modules/list-renderer.js`, `apps/step2/index.html` 내의 `(만원)` 단위 텍스트 라벨과 초기값 가이드를 모두 `(원)`으로 교체.
- **결과**: 만원 단위 변환으로 인한 데이터 왜곡 가능성을 원천적으로 제거하고, 실시간 한글 변환 가이드를 제공하여 인지 편의성과 시스템 안전성을 모두 만족시킴.


## [2026-06-15] release | 모바일 패널 헤더 터치 토글 UX 개선 및 토글 버튼 줄바꿈 방지 (v0.11.48)
- **목적**: 모바일 화면에서 재무설정 및 가계추이 검증 패널의 접기/펼치기 버튼(▾)이 줄바꿈되어 화면이 지저분해지는 현상을 해결하고, 모바일에서의 조작 편의성을 위해 헤더 영역 전체를 클릭/터치했을 때 접고 펴기가 작동하도록 UX를 개선함.
- **주요 변경사항**:
    - **모바일 헤더 클릭 이벤트 연동**: `apps/step1/app.js`에서 모바일 뷰(`window.innerWidth <= 760`)일 때, 패널 헤더(`.section-head`) 전체를 클릭해도 토글이 작동하도록 이벤트 리스너 추가. 프리셋 버튼, 물음표 툴팁 등 개별 조작 요소를 클릭할 때는 오작동을 차단하기 위해 이벤트 버블링 방지(`e.stopPropagation` 및 target 체크) 적용.
    - **패널 토글 함수 모듈화**: 중복된 토글 상태 전환 코드를 `toggleControlsPanel()` 및 `toggleProjectionPanel()` 공통 헬퍼 함수로 분리하여 코드의 가독성과 유지보수성 향상.
    - **모바일 CSS 최적화**: `apps/step1/styles.css` 최하단에 미디어 쿼리를 추가하여 모바일 환경에서만 헤더에 `cursor: pointer` 스타일을 부여하고, `section-head-tools`에 flex 줄바꿈 방지(`flex-wrap: nowrap`) 및 토글 버튼의 신축 방지(`flex-shrink: 0`)를 적용하여 줄바꿈 현상을 근본적으로 해결.
- **결과**: 모바일 기기에서의 터치 토글이 매우 직관적으로 단순화되었으며, 토글 버튼의 비정상적인 줄바꿈 현상이 완벽하게 해결되어 프리미엄 UX 감성을 보강함.


## [2026-06-15] plan | 적립식 포트폴리오 관리 (Step 3 고도화) Phase 5 기획 완료 (v0.11.51)
- **목적**: Milestone v1.8 (적립식 포트폴리오 관리) Phase 5: Portfolio Creation & Target Allocation UI 구현을 위한 상세 기획안(05-01-PLAN.md) 및 사용자 인수 테스트 명세(05-UAT.md)를 작성하고 프로젝트 상태를 PLANNED로 업데이트함.
- **주요 내용**:
    - **05-01-PLAN.md 생성**: 포트폴리오 에디터 폼 개편, 가로 세그먼트 주기 선택기 도입, 실시간 % 비중 계산 및 1,000원 단위/1,000원 이상 금액 유효성 검증, 한글 금액 힌트 표출, 에디토리얼 카드 목록 리스팅, 호버 부유/광채 인터랙션, 상세 모달 연동에 대한 5개 단계별 구현 작업 수립.
    - **05-UAT.md 생성**: 빌드 스모크 테스트, 에디터 조작성, 세그먼트 컨트롤, 실시간 합산 및 비중/한글 힌트 표출, 검증 규칙 작동, 목록 카드 호버 효과, 상세 보기 팝업 연동 등 8가지 핵심 인수 테스트 시나리오 정의.
    - **프로젝트 상태 업데이트**: `.planning/STATE.md` 내의 active phase를 PLANNED로 갱신하고 total_plans 카운트를 1로 증가시켜 구현 착수 준비 완료.
- **결과**: Phase 5 구현을 위한 설계 계약(Contract) 및 완성 기준(DoD) 수립 완료.


