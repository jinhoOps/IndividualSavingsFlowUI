# ISF 연결형 개인 재무 계획 워크스페이스 PRD

## 1. Product

ISF는 지금의 월간 돈 흐름을 정리하고, 그 결과를 장기 전략과 실행 계획으로 점차 연결하는 로컬 우선 개인 재무 계획 도구다.

현재 제품은 **Main, Simulation과 Portfolio**다. Main은 월 자금 흐름을, Simulation은 장기 복리를, Portfolio는 최신 Main 투자금의 대상별 배분을 보여준다. **Account Map**은 현재 연결 상태를 설명하는 준비 화면만 제공한다.

## 2. Epic

**Epic:** 현재 Main 기준선 확립과 안전한 신규 앱 확장

- [Active Requirements](../../../../../.planning/REQUIREMENTS.md)
- [Product Roadmap](../../../../../.planning/ROADMAP.md)
- [Current State](../../../../../.planning/STATE.md)
- [Design Contract](../../../../../DESIGN.md)

## 3. Problem

개인 재무 정보는 항목과 계좌가 늘어날수록 입력이 복잡해지고, 사용자는 정작 “지금 한 달에 얼마가 남는가”를 파악하기 어렵다. ISF는 첫 단계에서 입력 부담을 줄이고 월간 배분을 바로 이해하도록 해야 한다.

동시에 저장소에는 과거 Simulation·Portfolio·Account Map 구현과 다양한 재무 기능이 남아 있다. 이 코드는 향후 기능 및 데이터 계약을 조사할 임시자산이지만 현재 제품으로 오해되거나 새 구현의 기반으로 재사용되면 제품 경계가 다시 흐려진다.

## 4. Goal

1. 사용자가 짧은 설정으로 현재 월간 현금흐름을 이해한다.
2. Main을 안정적인 현재 제품 기준선으로 유지한다.
3. 향후 앱으로 이어지는 목적과 최소 연결 상태를 보여준다.
4. 레거시에서 유효한 기능과 데이터 계약을 증거에 따라 이관한다.
5. 제품 문서가 현재 기능, 전환 작업, 미래 비전을 명확히 구분한다.

## 5. Non-goals

현재 범위는 다음을 제공하지 않는다.

- 백테스트, 변동성·MDD, 세금 또는 수수료 계산
- 복수 Portfolio, 계좌별 Portfolio, 시세·수익률·매수 실행
- Account Map 관계 생성·편집·저장
- 항목별 계좌 배분이나 자동이체 관리
- 지출 카테고리·실제 사용액·가구 예산 관리
- 레거시 Sankey 또는 계좌별 장기 자산 projection
- 금융기관 연결, 실시간 시세, 금융 자문

위 기능은 레거시에 존재하더라도 현재 지원 기능이 아니다.

## 6. Users

### 개인 재무 계획 사용자

월 실수령액이 주거비, 생활비, 저축과 투자로 어떻게 나뉘는지 빠르게 이해하려는 사용자다.

### 모바일 사용자

390px급 화면에서도 입력, 검토, 적용, 백업과 앱 연결을 완료하려는 사용자다.

### 기존 데이터 보유 사용자

구버전 저장 데이터나 백업을 현재 Main으로 안전하게 가져오려는 사용자다.

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
- JSON 내보내기와 가져오기
- Simulation으로 이어지는 명시적 행동

### Simulation, Portfolio와 readiness journey

- 런처는 Main, Simulation과 Portfolio를 `사용 중`, Account Map을 `준비 중`으로 표시한다.
- Simulation은 Main의 월 저축·투자를 읽기 전용으로 사용하고 장기 복리 성장과 전부 저축 기준선을 비교한다.
- Portfolio는 최신 Main 투자금을 직접 읽고 하나의 적용 배분과 편집 초안을 소유한다.
- Account Map은 준비 상태만 설명한다.
- 준비 화면은 상세 계산·편집·독립 저장·Main write-back을 수행하지 않는다.

## 8. Functional Requirements

세부 추적 상태는 [Active Requirements](../../../../../.planning/REQUIREMENTS.md)를 따른다.

### Main

- 다섯 월간 값을 하나의 정규화된 v2 데이터로 저장한다.
- 주거비와 생활비를 소비로 합산하고 총 유출과 잔액 또는 적자를 계산한다.
- 유효하지 않은 적용은 차단하되 불완전한 setup draft는 재개할 수 있다.
- 현재 값과 적용 값의 관계를 사용자에게 명확히 보여준다.
- 브라우저 로컬 저장과 IndexedDB 호환 경계에서 최신 유효 데이터를 보존한다.
- JSON import는 schema와 값 검증을 통과해야 한다.

### Journey

- 앱 간 전달은 사용자 행동으로 시작한다.
- 전달 payload는 필요한 최소 데이터만 포함한다.
- 준비 화면이 상세 앱 상태를 소유하는 것처럼 표현하지 않는다.
- Account Map은 Main을 암묵적으로 수정하지 않는다.

### Simulation

- 최초 진입 시 시작 원금 유무를 묻고 이후 초안은 Simulation 전용 저장소에 저장한다.
- 최초 설정은 시작 원금과 기간·기대수익률의 두 단계이며, 저장된 초안이 있으면 결과로 바로 진입한다.
- 진입할 때마다 Main의 최신 월 저축·투자를 자동으로 읽되 Simulation 설정과 Main 원본은 변경하지 않는다.
- 기간, 연 기대수익률, 기준금리, 물가상승률 차이와 명목·실질금액을 조정한다.
- 기간은 현재를 뜻하는 0년부터 30년까지 슬라이더와 숫자 입력으로 조정한다.
- 현재 계획과 같은 월 납입액을 전부 기준금리 저축에 넣은 경우를 낮은 시각 우선순위로 비교한다.
- 결과 금액은 1억 원 미만에서 천 원, 1억 원 이상에서 만 원 단위로 반올림한 한국식 정수 표현을 사용한다.
- 기대수익률은 재투자를 가정한 사용자 입력값이며 백테스트나 금융 자문으로 표현하지 않는다.
- 다시 설정은 Simulation 메뉴 안에서 확인 후 실행하며 Main 원본은 변경하지 않는다.

### Legacy transition

- 신규 앱마다 기능, 계산, schema, 저장 키, import/export, route, selector와 테스트를 목록화한다.
- 각 항목을 `이관`, `재설계`, `보류`, `폐기`로 판정한다.
- 승인된 신규 앱 명세 없이 레거시 구현을 현재 runtime에 다시 연결하지 않는다.
- 호환성·참조 제거·회귀 증거가 갖춰진 뒤 해당 레거시를 삭제한다.

## 9. Data Contract

현재 `MainData`의 제품 필드는 다음과 같다.

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

Simulation과 향후 앱은 이 계약을 무단 확장하지 않고 별도 소유 상태와 명시적 import 계약을 정의한다.

## 10. UX and Design Requirements

- 결과와 현재 상태를 세부 입력보다 먼저 보여준다.
- 수정 중 값과 적용된 값을 구분한다.
- 저장, 복구, import와 연결 결과를 명시적으로 알린다.
- 원화 단위와 음수·적자 의미를 숨기지 않는다.
- 390px, 768px, desktop에서 가로 overflow 없이 사용할 수 있어야 한다.
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
- [x] Simulation은 Main을 변경하지 않고 장기 복리와 전부 저축 기준선을 비교한다.
- [x] Simulation은 최초 두 단계 설정, 재방문 결과 우선 진입과 최신 Main 자동 동기화를 제공한다.
- [x] Simulation은 0~30년, 한국식 정수 금액, pointer·touch·keyboard 그래프 탐색을 제공한다.
- [x] Portfolio는 최신 Main 투자금을 최대 10개 투자 대상과 현금에 배분한다.
- [x] Portfolio는 금액·비율, 결과 우선 도넛·표와 초안·적용 경계를 제공한다.
- [x] Portfolio는 Main을 수정하지 않고 Account Map은 `준비 중`으로 유지된다.

### Transition

- [x] Simulation의 승인된 기능 명세와 레거시 disposition이 있다.
- [x] Portfolio의 승인된 기능 명세와 레거시 disposition이 있다.
- [ ] Account Map의 승인된 기능 명세와 레거시 disposition이 있다.
- [ ] 각 레거시 삭제는 구데이터 호환성과 전체 참조 제거를 입증한다.

## 12. Future Product Direction

제품 비전은 다음 질문을 차례로 연결하는 것이다.

1. 지금 내 돈은 한 달에 어떻게 나뉘는가? — Main
2. 이 투자 여력을 오래 유지하면 어떤 차이가 생기는가? — Simulation
3. 선택한 방향을 매달 무엇에 투자할 것인가? — Portfolio
4. 실제 계좌와 자동이체를 어떻게 단순하게 관리할 것인가? — Future Account Map

지출 capture, 가구 병합, 과거 비교와 주거 구매력은 발견 단계의 후보다. 별도 문제 검증과 PRD 승인 전에는 구현 범위나 완료 요구사항으로 취급하지 않는다.

## 13. Success Signals

- 사용자가 초기 설정을 완료하고 적용된 월간 계획을 다시 확인한다.
- 적자와 남는 돈을 잘못 해석하지 않는다.
- JSON 백업과 복구 실패가 현재 데이터를 훼손하지 않는다.
- Portfolio 배분을 시세·수익률·계좌 관리로 오해하지 않고 Account Map 준비 화면을 완성된 앱으로 오해하지 않는다.
- 신규 앱 작업이 레거시 route를 되살리지 않고 승인된 계약에서 시작한다.
- 문서 검토자가 현재 지원 기능을 런타임 및 테스트와 동일하게 설명한다.

## 14. Verification

- 정적·타입 검사: `npm run check`
- Main 단위 테스트: `npm run test:unit`
- Main 브라우저 흐름: `npx playwright test tests/main-react.spec.ts`
- 앱 연결 흐름: `npx playwright test tests/app-journey.spec.ts`
- 레거시 제거 시: runtime import, route, selector, storage key, compatibility path와 test reference 검색 및 관련 전체 회귀
