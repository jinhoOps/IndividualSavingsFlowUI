# ISF 연결형 개인 재무 계획 워크스페이스 PRD

## 1. Product

ISF는 지금의 월간 돈 흐름을 정리하고, 그 결과를 장기 전략과 실행 계획으로 점차 연결하는 로컬 우선 개인 재무 계획 도구다.

현재 지원 제품은 **Main, Simulation, Portfolio와 Account Map**이다. Main은 월 자금 흐름을, Simulation은 장기 복리를, Portfolio는 최신 Main 투자금의 전체 기준 배분을 보여준다. Account Map은 Main 기반 목적과 계좌·보관처의 월 연결을 제공한다. 네 앱은 단일 `isf-workspace-v1` 기록을 사용한다.

## 2. Epic

**Epic:** 현재 Main 기준선 확립과 안전한 신규 앱 확장

- [Design Contract](../../../../../DESIGN.md)
- [Connected Account Map Workspace Design](../../../../superpowers/specs/2026-08-06-connected-account-map-workspace-design.md)
- [Account Map Purpose-Node Flow Design](../../../../superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md)
- [Shared Workspace Foundation Plan](../../../../superpowers/plans/2026-08-06-shared-workspace-foundation.md)
- [Journey Snapshot 폐기 설계](../../../../superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md)
- [Portfolio 투자 배분 설계](../../../../superpowers/specs/2026-08-03-portfolio-allocation-design.md)

## 3. Problem

개인 재무 정보는 항목과 계좌가 늘어날수록 입력이 복잡해지고, 사용자는 정작 “지금 한 달에 얼마가 남는가”를 파악하기 어렵다. ISF는 첫 단계에서 입력 부담을 줄이고 월간 배분을 바로 이해하도록 해야 한다.

동시에 저장소에는 Account Map 참고 구현과 현재 범위 밖의 다양한 재무 기능이 남아 있다. 이 코드는 향후 기능 및 데이터 계약을 조사할 임시자산이지만 현재 제품으로 오해되거나 새 구현의 기반으로 재사용되면 제품 경계가 다시 흐려진다.

## 4. Goal

1. 사용자가 짧은 설정으로 현재 월간 현금흐름을 이해한다.
2. Main을 안정적인 현재 제품 기준선으로 유지한다.
3. 향후 앱으로 이어지는 목적과 최소 연결 상태를 보여준다.
4. 레거시에서 유효한 기능과 데이터 계약을 증거에 따라 이관한다.
5. 제품 문서가 현재 기능, 전환 작업, 미래 비전을 명확히 구분한다.

## 5. Non-goals

현재 범위는 다음을 제공하지 않는다.

- 백테스트, 변동성·MDD, 세금 또는 수수료 계산
- Portfolio 위치별 배분·계좌·보관처 편집, 복수 독립 계획, 시세·수익률·매수 실행
- 금융기관 실연동, 계좌번호·잔액·거래·실시간 시세 조회, 자동이체 실행과 금융 자문
- 지출 카테고리·실제 사용액·가구 예산 관리
- 레거시 Sankey 또는 계좌별 장기 자산 projection
- Phase C의 Main 연결 결과 카드와 별도 후속 작업인 hidden trophy room
- 구 앱 저장 키나 Main 전용 백업을 새 workspace로 가져오는 migration

위 기능은 레거시에 존재하더라도 현재 지원 기능이 아니다.

## 6. Users

### 개인 재무 계획 사용자

월 실수령액이 주거비, 생활비, 저축과 투자로 어떻게 나뉘는지 빠르게 이해하려는 사용자다.

### 모바일 사용자

390px급 화면에서도 입력, 검토, 적용, 백업과 앱 연결을 완료하려는 사용자다.

### Workspace 백업 보유 사용자

현재 whole-workspace 형식으로 내보낸 백업을 전체 검증한 뒤 한 번에 복원하려는 사용자다.

### 프로젝트 유지관리자

현재 동작을 보존하면서 레거시 기능과 데이터 계약을 판정하고 신규 앱으로 이관한 뒤 제거하려는 개발자다.

## 7. Current User Experience

### Main quick setup

사용자는 다음 다섯 값을 입력한다.

1. 월 실수령액
2. 월 주거 고정비
3. 월 평균 생활비
4. 월 저축액
5. 월 투자액

각 단계는 같은 `MainData` draft를 갱신한다. 사용자는 중간에 이탈한 뒤 이어서 설정할 수 있고, 마지막 검토에서 소비·저축·투자·남는 돈 또는 적자를 확인한 뒤 계획을 적용한다.

### Main dashboard

적용된 계획이 있으면 대시보드는 다음을 제공한다.

- 월간 현금흐름 요약
- 주거비와 생활비를 합친 소비
- 소비·저축·투자·남는 돈의 금액과 비율
- 적자 상태
- 현재 다섯 값 수정
- Main·Simulation·Portfolio·공유 위치를 함께 다루는 whole-workspace JSON 내보내기와 가져오기
- Simulation으로 이어지는 명시적 행동

### Simulation, Portfolio와 Account Map journey

- 런처는 Main, Simulation, Portfolio와 Account Map을 아이콘으로 표시하고 현재 앱을 선택선과 접근성 상태로 구분한다.
- 런처와 CTA는 URL 탐색만 수행하고 별도 전달 데이터를 저장하지 않는다.
- Simulation은 단일 workspace의 최신 Main 월 저축·투자를 읽어 장기 복리 성장과 전부 저축 기준선을 비교하고 자체 Simulation slice만 갱신한다.
- Portfolio는 같은 workspace의 최신 Main 투자금을 읽고 하나의 v2 전체 기준 적용 배분과 편집 초안을 소유한다.
- Portfolio 결과는 비율 우선 요약과 비례 목록으로 시작하며 원화 금액은 기본으로 숨긴다.
- Portfolio의 배분 편집은 투자 대상별 전체 기준 금액과 비율만 다루며 계좌·기관·보관처 관리 UI를 표시하지 않는다. 기존 location과 location-scoped 데이터는 호환성을 위해 보존한다.
- Account Map은 최신 Main의 다섯 월 금액을 읽어 목적 중심 설정과 노드 지도를 제공하고, 자기 slice와 공유 금융 위치 registry만 갱신한다.
- Account Map은 Main·Simulation·Portfolio에 write-back하지 않는다.
- Main의 기존 요약과 월 자금 구성은 유지된다. 앱별 연결 결과 카드는 Phase C 전까지 현재 UI가 아니다.

## 8. Functional Requirements

세부 단계와 검증 gate는 [Shared Workspace Foundation Plan](../../../../superpowers/plans/2026-08-06-shared-workspace-foundation.md)을 따른다.

### Shared workspace와 backup

- Main, Simulation, Portfolio, 공유 금융 위치와 Account Map applied/draft를 하나의 versioned `isf-workspace-v1` 문서에 저장한다.
- write ownership은 각 앱이 소유한 slice로 한정한다. Simulation과 Portfolio는 최신 Main slice를 읽기 전용으로 읽고 Portfolio는 자기 plan과 draft만 갱신한다. 모든 성공한 write는 workspace revision을 한 번 증가시킨다.
- Account Map은 Main을 읽기 전용 기준으로 사용하며 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- 공유 금융 위치 registry의 유일한 관리 진입점은 Account Map이며 Portfolio는 이를 갱신하지 않는다.
- stale revision을 기준으로 시작한 writer는 더 최신 workspace를 덮어쓰지 못한다.
- `isf-main-v2`, `isf-simulation-compound-v1`, `isf-portfolio-allocation-v1`, `isf-account-map-v1`, `isf-rebuild-v1`은 현재 workspace 제품이 읽거나 변경하지 않는다. 기존 raw 값은 Phase D 전까지 그대로 남을 수 있다.
- 백업은 현재 whole-workspace envelope만 지원한다. 모든 slice와 참조를 먼저 검증하고 유효하면 한 번의 workspace replacement로 복원하며, invalid·old-format 입력은 아무것도 바꾸지 않는다.

### Main

- 다섯 월간 값을 workspace의 정규화된 Main v2 slice로 저장한다.
- 주거비와 생활비를 소비로 합산하고 총 유출과 잔액 또는 적자를 계산한다.
- 유효하지 않은 적용은 차단하되 불완전한 setup draft는 재개할 수 있다.
- 현재 값과 적용 값의 관계를 사용자에게 명확히 보여준다.
- 현재 workspace가 없으면 구 저장 키를 fallback으로 읽지 않고 새 설정으로 시작한다.
- whole-workspace JSON import는 envelope, 모든 slice와 참조 검증을 통과해야 한다.

### Journey

- 앱 간 이동은 사용자의 런처 링크 또는 CTA 행동으로 시작한다.
- 앱 이동은 URL 탐색만 수행하고 Simulation과 Portfolio는 workspace의 최신 Main slice를 각자의 읽기 전용 adapter로 직접 읽는다.
- Account Map은 Main을 암묵적으로 수정하지 않는다.

### Simulation

- 최초 진입 시 시작 원금 유무를 묻고 이후 초안은 workspace의 Simulation slice에 저장한다.
- 최초 설정은 시작 원금과 기간·기대수익률의 두 단계이며, 저장된 초안이 있으면 결과로 바로 진입한다.
- 진입할 때마다 Main의 최신 월 저축·투자를 자동으로 읽되 Simulation 설정과 Main 원본은 변경하지 않는다.
- 기간, 연 기대수익률, 기준금리, 물가상승률 차이와 명목·실질금액을 조정한다.
- 기간은 현재를 뜻하는 0년부터 30년까지 슬라이더와 숫자 입력으로 조정한다.
- 현재 계획과 같은 월 납입액을 전부 기준금리 저축에 넣은 경우를 낮은 시각 우선순위로 비교한다.
- 결과 금액은 1억 원 미만에서 천 원, 1억 원 이상에서 만 원 단위로 반올림한 한국식 정수 표현을 사용한다.
- 기대수익률은 재투자를 가정한 사용자 입력값이며 백테스트나 금융 자문으로 표현하지 않는다.
- 다시 설정은 Simulation 메뉴 안에서 확인 후 실행하며 Main 원본은 변경하지 않는다.

### Portfolio와 계좌·보관처 경계

- 진입할 때마다 Main의 최신 월 투자금을 읽되 Main 원본은 변경하지 않는다.
- 최대 10개 자유 이름 투자 대상과 현금에 현재 투자금을 원화 금액으로 배분하고, 각 항목 비율은 전체 투자금 기준으로 자동 계산한다.
- 적용 계획 하나와 편집 초안을 Portfolio slice에 보존하고, 수정 중 값과 적용된 값을 구분한다.
- Main 투자금이 바뀌면 기존 배분 의도를 유지할 수 있는 범위에서 다시 계산하고 사용자가 변화를 확인하도록 한다.
- 결과는 `안정 N%` 핵심 요약과 투자 대상별 이름·비율·비례 막대를 먼저 보여주고, 총액과 항목별 원화 금액은 기본으로 렌더링하지 않는다.
- 사용자는 Portfolio 관리 메뉴에서 전체 금액 표시와 비율순·입력순 정렬을 바꾸며, 이 보기 설정은 배분 schema와 분리된 Portfolio 전용 localStorage record에 저장한다.
- 각 투자 대상은 `성장` 또는 `안정` 분류와 자동 추천·사용자 지정 출처를 소유하고, 현금은 항상 안정으로 계산한다.
- 금·채권 관련 이름의 분류는 자동 추천일 뿐이며 사용자 지정을 덮어쓰지 않는다. `ETF`만으로는 안정을 추천하지 않는다.
- 구 Portfolio v1 plan과 draft 저장값은 현재 workspace v2 배분으로 이관하지 않고, 읽지 않고, 삭제하지 않는다.
- 유효한 aggregate v2 plan·draft가 없으면 최신 Main 투자금을 기준으로 현금 100%인 새 v2 draft를 시작한다.
- 다시 설정은 aggregate Portfolio 데이터만 초기화하며 Main과 다른 앱의 데이터를 변경하지 않는다.
- 현재 UI는 하나의 `aggregate` scope만 만들고 편집한다.
- Portfolio plan과 draft 계약은 구데이터 호환성을 위해 location scope를 표현할 수 있지만 현재 UI는 location scope를 만들거나 편집하지 않는다.
- Portfolio 결과는 투자 대상별 전체 기준 금액과 비율까지만 보여주며 계좌·기관·보관처 관리 UI를 제공하지 않는다.
- 기존 공유 금융 위치와 location-scoped plan은 자동 삭제하거나 aggregate plan으로 변환하지 않고 그대로 보존한다.
- 계좌·기관·보관처의 생성, 이름 변경과 보관은 Account Map만 소유한다.
- Portfolio 투자 대상과 계좌·보관처 연결은 현재 범위가 아니며 별도 승인 명세 전에는 진입점이나 연결 상태를 표시하지 않는다.

### Account Map

- Main의 수입·주거·생활비·저축·투자 월 금액을 system purpose로 결정적으로 파생한다.
- 목적과 계좌·보관처를 다대다 link로 연결하며 최초 연결은 전체 기준 금액을 자동 할당한다.
- 목적 중심과 계좌 중심 정렬, 전체·기본·상세 semantic zoom, hover·focus·첫 선택 집중과 두 번째 선택 상세를 제공한다.
- 계좌·보관처 보관은 영향 연결을 먼저 보여주고 중지하며, 복원은 연결별 선택을 제공한다.
- 적용 지도 modal에서 금액·상태·나머지를 편집하고 보조 `연결 추가` action으로 다른 계좌·보관처를 연결한다.
- 기존 active location은 현재 role과 관계없이 선택할 수 있고 필요한 role 추가와 link 생성을 한 revision write로 저장한다.
- 사용자 하위 목적은 같은 modal의 보조 메뉴에서 보관·복원하며 보관된 link를 자동 재개하지 않는다.
- stale write는 최신 workspace를 다시 읽되 setup·modal 입력을 보존하고 사용자의 명시적 재적용 전에는 쓰지 않는다.
- 지도 다시 만들기는 Account Map applied/draft만 지우고 locations와 Main·Simulation·Portfolio를 보존한다.

### Legacy transition

- 신규 앱마다 기능, 계산, schema, 저장 키, import/export, route, selector와 테스트를 목록화한다.
- 각 항목을 `이관`, `재설계`, `보류`, `폐기`로 판정한다.
- 승인된 신규 앱 명세 없이 레거시 구현을 현재 runtime에 다시 연결하지 않는다.
- 호환성·참조 제거·회귀 증거가 갖춰진 뒤 해당 레거시를 삭제한다.

## 9. Data Contract

현재 제품의 저장 boundary는 `isf-workspace-v1` 하나다. workspace schema v2에는 Main applied/setup progress, Simulation draft, Portfolio plans/draft, 공유 금융 위치와 Account Map applied/draft 및 `legacyPhaseA` 호환 데이터가 들어간다.

`MainData`의 제품 필드는 다음과 같다.

```ts
interface MainData {
  version: 2;
  monthlyNetIncomeWon: number;
  monthlyHousingWon: number;
  monthlyLivingWon: number;
  monthlySavingWon: number;
  monthlyInvestmentWon: number;
  updatedAt: number;
}
```

Main이 계산하는 요약:

- `consumptionWon = monthlyHousingWon + monthlyLivingWon`
- `plannedOutflowWon = consumptionWon + monthlySavingWon + monthlyInvestmentWon`
- `remainingWon = monthlyNetIncomeWon - plannedOutflowWon`

Simulation, Portfolio와 Account Map은 workspace 안의 최신 Main을 읽기 전용으로 사용한다. Portfolio는 workspace의 v2 배분 plan·draft와 별도의 보기 설정 localStorage record만 현재 제품 상태로 취급한다. Simulation과 Portfolio의 write ownership은 자기 slice로 한정하고 Account Map만 자기 slice와 공유 금융 위치 registry를 갱신하며 Main·Simulation·Portfolio를 보존한다.

## 10. UX and Design Requirements

- 결과와 현재 상태를 세부 입력보다 먼저 보여준다.
- 수정 중 값과 적용된 값을 구분한다.
- 명시적 적용·백업·복구·import 결과와 저장 지연·실패·복구 필요 상태를 알린다. 정상 자동 저장 성공은 상시 상태로 반복하지 않는다.
- 원화 단위와 음수·적자 의미를 숨기지 않는다.
- 390px, 768px, desktop에서 가로 overflow 없이 사용할 수 있어야 한다.
- 앱을 이동해도 런처의 위치와 공통 화면 틀이 일관되어야 한다.
- Main 도넛과 Simulation·Portfolio 시각화의 핵심 정보는 pointer·touch·keyboard로 탐색할 수 있어야 한다.
- 주요 터치 대상은 최소 44px을 확보한다.
- 키보드, focus, accessible name, 상태 텍스트를 제공한다.
- UI 세부 계약은 [DESIGN](../../../../../DESIGN.md)을 따른다.

## 11. Acceptance Criteria

### Current baseline

- [x] Main은 다섯 월간 값으로 새 계획을 만들고 다시 수정할 수 있다.
- [x] setup draft를 저장하고 재개할 수 있다.
- [x] 소비·저축·투자·남는 돈 또는 적자가 동일한 데이터에서 계산된다.
- [x] 유효한 계획을 로컬에 저장하고 다시 불러올 수 있다.
- [x] 현재 JSON을 내보내고 검증된 JSON을 가져올 수 있다.
- [x] Main에서 Simulation으로 명시적으로 이동할 수 있다.
- [x] Main 월 자금 구성 도넛은 pointer·touch·keyboard로 항목을 탐색하며 모바일에서도 명칭과 상세 금액에 접근할 수 있다.
- [x] 앱 이동은 URL만 사용하고 Main 시작은 폐기된 journey key를 읽거나 변환하지 않고 삭제한다.
- [x] 네 앱 경로는 같은 런처 위치와 공통 화면 틀을 유지한다.
- [x] Simulation은 Main을 변경하지 않고 장기 복리와 전부 저축 기준선을 비교한다.
- [x] Simulation은 최초 두 단계 설정, 재방문 결과 우선 진입과 최신 Main 자동 동기화를 제공한다.
- [x] Simulation은 0~30년, 한국식 정수 금액, pointer·touch·keyboard 그래프 탐색을 제공한다.
- [x] Portfolio는 최신 Main 투자금을 최대 10개 투자 대상과 현금에 배분한다.
- [x] Portfolio는 기본 금액 숨김, `안정 N%` 요약과 이름·비율·비례 막대 목록으로 결과를 먼저 제공한다.
- [x] Portfolio의 성장·안정 자동 추천은 사용자 지정을 덮어쓰지 않고 현금을 항상 안정으로 계산한다.
- [x] Portfolio는 v1 배분 저장값을 이관·읽기·삭제하지 않으며, v2가 없으면 최신 Main 투자금의 현금 100% draft로 시작한다.
- [x] Portfolio 보기 설정은 v2 배분과 분리해 저장하고 저장 실패가 배분 저장 상태를 바꾸지 않는다.
- [x] Portfolio는 Main을 수정하지 않고 Account Map과 독립된 aggregate 배분만 소유한다.
- [x] Main, Simulation과 Portfolio의 write는 소유 slice에 한정되고 Portfolio가 공유 금융 위치 registry를 갱신하지 않는다.
- [x] 구 Main·Simulation·Portfolio·Account Map·rebuild 키는 새 제품에서 fallback, migration, write 또는 delete 대상으로 사용하지 않는다.
- [x] stale workspace writer는 최신 revision을 덮어쓰지 못한다.
- [x] Portfolio는 전체 기준 배분만 제공하고 계좌·기관·보관처 관리 UI를 표시하지 않는다.
- [x] whole-workspace 백업은 유효한 모든 slice를 한 번에 교체하고 invalid 또는 old-format 입력에는 현재 raw workspace를 유지한다.
- [x] Account Map은 목적 중심 설정, 노드 지도와 가역적 계좌·보관처 관리의 승인 계약을 모두 구현하며 Main 연결 결과 카드는 Phase C 전까지 기존 UI를 유지한다.
- [x] Simulation과 Portfolio의 다시 설정은 해당 앱 데이터만 변경하고 Main과 다른 앱의 데이터를 보존한다.

### Phase B review closure gate

- [x] PRD, DESIGN과 Account Map 상세 명세가 현재 제품 경계와 같은 ownership을 설명한다.
- [x] 적용 지도에서 다른 계좌 연결과 add-only role 확장을 한 write로 완료한다.
- [x] Custom purpose 보관·복원과 link 비자동복구를 제공한다.
- [x] stale 충돌에서 최신 상태를 다시 읽고 사용자 입력을 보존해 명시적으로 재적용한다.
- [x] 동기화된 v2 backup은 custom target capacity를 검증하고 이후 Main 감소로 생긴 기존 초과는 correction 가능하게 읽는다.
- [x] backup·stale·custom purpose·다대다·touch·keyboard·Portfolio 보존 회귀를 통과한다.
- [x] 최신 `origin/main` 통합 후 PR diff에 승인 범위 밖 역행 변경이나 conflict가 없다.
- [x] 위 gate를 모두 통과한 같은 변경에서 Account Map을 현재 지원 제품으로 승격하고 관련 미완료 항목을 함께 `[x]`로 바꾼다.

### Transition

- [x] Simulation의 승인된 기능 명세와 레거시 disposition이 있다.
- [x] Portfolio의 승인된 기능 명세와 레거시 disposition이 있다.
- [x] Account Map과 shared workspace의 승인된 기능 명세와 단계별 disposition이 있다.
- [x] Portfolio의 기존 `투자 위치` UI와 shared location command 진입점을 제거하고 보존 데이터 회귀를 입증한다.
- [x] Phase B Account Map 상세 명세에서 계좌·보관처 관리와 Portfolio 비연결 경계를 승인한다.
- [ ] 각 레거시 삭제는 구데이터 호환성과 전체 참조 제거를 입증한다.

## 12. Future Product Direction

제품 비전은 다음 질문을 차례로 연결하는 것이다.

1. 지금 내 돈은 한 달에 어떻게 나뉘는가? — Main
2. 이 투자 여력을 오래 유지하면 어떤 차이가 생기는가? — Simulation
3. 선택한 방향을 매달 무엇에 투자할 것인가? — Portfolio
4. 실제 금융 위치와 월 연결을 어떻게 단순하게 관리할 것인가? — Phase B Account Map

Phase C는 현재 Main의 metric 영역을 Main·Simulation·Portfolio·Account Map 연결 결과 카드로 바꾼다. Phase D는 대체 증거와 전체 참조 검색을 거쳐 남아 있는 legacy runtime, storage key와 테스트를 제거한다. hidden trophy room은 금융 workspace와 backup에서 분리된 별도 후속 설계다.

지출 capture, 가구 병합, 과거 비교와 주거 구매력은 발견 단계의 후보다. 별도 문제 검증과 PRD 승인 전에는 구현 범위나 완료 요구사항으로 취급하지 않는다.

## 13. Success Signals

- 사용자가 초기 설정을 완료하고 적용된 월간 계획을 다시 확인한다.
- 적자와 남는 돈을 잘못 해석하지 않는다.
- whole-workspace 백업과 복구 실패가 현재 데이터를 훼손하지 않는다.
- Portfolio 배분과 Account Map의 계좌·보관처 연결 책임을 혼동하지 않는다.
- 신규 앱 작업이 레거시 route를 되살리지 않고 승인된 계약에서 시작한다.
- 문서 검토자가 현재 지원 기능을 런타임 및 테스트와 동일하게 설명한다.

## 14. Verification

- 정적·타입 검사: `npm run check`
- 전체 단위 테스트: `npm run test:unit`
- cross-app 브라우저 흐름: `npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list`
- 전체 브라우저 흐름: `npm run test:e2e -- --reporter=list`
- production build: `npm run build`
- Main 브라우저 흐름: `npx playwright test tests/main-react.spec.ts`
- 앱 연결 흐름: `npx playwright test tests/app-journey.spec.ts`
- Simulation 브라우저 흐름: `npx playwright test tests/simulation.spec.ts`
- Portfolio 브라우저 흐름: `npx playwright test tests/portfolio.spec.ts`
- Account Map 지원 회귀: `npx playwright test tests/account-map.spec.ts`
- 레거시 제거 시: runtime import, route, selector, storage key, compatibility path와 test reference 검색 및 관련 전체 회귀
