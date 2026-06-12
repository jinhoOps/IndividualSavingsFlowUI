# Phase 3: Multi-account Data Model - Context

**Gathered:** 2026-06-12
**Status:** In Progress / UI Spec Planning

<domain>
## Phase Boundary

다중 계좌 데이터 모델 확장 및 Sankey 차트 다중 노드 연동 (요구사항: CORE-01, CORE-02).
- 다중 계좌 데이터 스키마 정교화 및 로컬 스토리지 허브 연동.
- 계좌 간 내부 이체 흐름이 늘어남에 따른 Sankey 차트 정보 과부하 및 선 꼬임 해결.
- 계좌 간의 세부 이체 및 분배 흐름을 표현할 대체 시각화(UI) 도입.
</domain>

<decisions>
## Implementation Decisions

### Sankey Simplification (생키 다이어그램 역할 제한)
- **D-01:** Sankey Diagram은 수입원 ➔ 계좌 ➔ 지출/저축/투자 대분류의 3단 흐름만 렌더링하도록 간소화합니다. 계좌 간의 N:N 내부 이체(transfer) 링크는 생키 렌더링 대상에서 완전히 배제하여, 순환(Loop)으로 인한 레이아웃 깨짐이나 인지 과부하, 그리고 모바일 화면에서의 수직 스크롤 과다 현상을 원천 방지합니다.

### Account Transfer Board (계좌 간 이체 전용 보드 신설)
- **D-02:** 계좌 간의 N:N 이체 흐름을 명확히 추적하기 위해, 생키 하단에 독립된 **'계좌 간 이체 현황 보드(Account Transfer Board)'** 컴포넌트를 신설합니다.
  - 이 보드는 각 계좌별로 `[출발 계좌] ➔ (이체 금액) ➔ [도착 계좌]` 관계를 텍스트 배지와 화살표를 이용한 정갈한 카드리스트 형태로 나타냅니다.
  - 모바일(<= 760px)에서는 수직 피드 스택 형태로 정렬되어 터치 및 스크롤을 간소화하고, PC 화면에서는 다열 이체 그리드로 와이드하게 배치됩니다.

### Multi-account Safety Margin Indicator (금융종합소득 및 안전 한도 경고)
- **D-03:** 각 계좌 간 분배 금액 설정 시, 전체 수입 한도 초과 및 이율 설정 오류 등을 실시간으로 경고하는 인디케이터를 구현합니다.
  - 연간 이자/배당 소득 경고 임계치(1,900만 원 초과 시 `warn`, 3,400만 원 초과 시 `crit`)와 연동하여, 관련 저축/투자 계좌에서 수치가 초과될 경우 경고 표시를 계좌 카드에 붉은 링 및 뱃지로 노출합니다.

### Claude's Discretion (에이전트 재량)
- 이체 보드 카드 내부의 출금/입금 포인트 컬러 대비 명도 조절.
- 계좌 간 화살표 링크의 흐름 애니메이션 트랜지션 디테일.
- 모바일 환경에서의 계좌 카드 터치 드래그 스크롤링 물리 속성 보정.
</decisions>

<specifics>
## Specific Ideas
- "생키는 돈이 수입원으로부터 어느 계좌로 들어가서 최종적으로 어디로 소모되는지 '전체 지출 카테고리 분포'를 파악하는 용도로 한정하고, 계좌 간의 내부 통장 쪼개기(이체) 관계는 아래의 정갈한 이체 카드로 독립시킨다."
- "계좌 간 이체 명세가 화살표 리스트로 명시되면, 수지를 맞추는 디버깅이 쉬워지고 생키 선이 꼬여 차트가 깨지던 불안정성이 해소된다."
</specifics>

<canonical_refs>
## Canonical References
- `DESIGN.md` — 디자인 시스템 가이드.
- [apps/step1/modules/sankey-builder.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-builder.js) — 생키 차트 렌더링 데이터 빌더.
- [D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.gemini/knowledge/wiki/Data_Model_Reference.md](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.gemini/knowledge/wiki/Data_Model_Reference.md) — 다중 계좌 모델 정의.
</canonical_refs>

---
*Phase: 03-multi-account-data-model*
*Context gathered: 2026-06-12*
