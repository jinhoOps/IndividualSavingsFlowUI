# 신규 Simulation 복리 성장 시각화 설계

## 목적

Simulation은 백테스트나 금융상품 비교 도구가 아니다. Main에서 이미 정한 월 저축·투자 금액이 장기간 누적될 때 시간과 복리가 만드는 차이를 금액 중심으로 보여주는 교육형 시뮬레이션이다.

사용자는 많은 지표를 분석하는 대신 다음 질문에 답할 수 있어야 한다.

- 지금 정한 월 저축·투자는 N년 뒤 얼마가 되는가?
- 같은 금액을 전부 저축했을 때와 현재 계획은 얼마나 달라지는가?
- 최종금액은 누적 납입원금의 총 몇 퍼센트인가?

## 제품 경계

- Simulation은 React, TypeScript, Tailwind CSS와 Vite PWA 기준으로 새로 개발한다.
- 기존 `apps/simulation/**` JavaScript 구현은 기능·데이터 계약을 확인하기 위한 임시 레거시 자료이며 신규 구현 기반이 아니다.
- Main은 월 저축액, 월 투자액과 source revision만 제공한다.
- Simulation의 수정값과 자동 저장 상태는 Main을 변경하지 않는다.
- 종목, 과거 시세, 백테스트, 분배금 현금 수령, 수수료, 세금과 환율은 1차 범위에서 제외한다.
- 모든 수익은 재투자된다고 가정한다.
- 세금 계산과 MDD 기반 하락 구간 시각화는 후속 독립 확장으로 남긴다.

## 사용자 흐름

### 진입

1. 사용자가 Main에서 명시적으로 Simulation으로 이동한다.
2. Simulation은 현재 `isf-main-v2`에서 월 저축액, 월 투자액과 갱신 정보를 읽는다.
3. 월 저축액과 투자액의 합계가 0원이면 계산 화면을 만들지 않는다.
4. `Main에서 월 저축·투자 금액을 먼저 정해주세요.`와 Main 편집 경로를 표시한다.
5. 유효한 합계가 있으면 최초 진입 질문을 표시한다.

최초 질문:

> 지금 모아둔 투자금이 있나요?

- `있어요`: 시작 원금을 입력한다.
- `없어요`: 시작 원금 0원으로 시작한다.

시작 원금은 투자 잔액으로 취급한다. 별도 기존 저축 잔액은 1차에서 입력하지 않는다.

### 자동 유지와 재시작

- Simulation은 현재 화면 하나의 draft만 브라우저에 자동 저장한다.
- 새로고침과 재진입은 같은 Simulation draft를 유지한다.
- 여러 시뮬레이션의 이름, 목록, 조회와 삭제는 제공하지 않는다.
- Main revision이 바뀌어도 진행 중인 draft를 자동으로 덮어쓰지 않는다.
- Main 값이 달라졌음을 알리고 사용자가 최신 Main 기준으로 다시 시작할 수 있게 한다.
- `처음부터 다시`는 기존 Simulation draft를 폐기하고 최신 Main 월 저축·투자 값을 가져온 뒤 시작 원금을 다시 묻는다.

## 계산 모델

### 입력

- `monthlySavingsWon`: Main 월 저축액
- `monthlyInvestmentWon`: Main 월 투자액
- `initialInvestmentWon`: 사용자가 선택 입력한 시작 투자 원금
- `years`: 계산 기간
- `expectedAnnualReturnPercent`: 투자 연 기대수익률
- `baseRatePercent`: 저축 기준금리
- `inflationOffsetPercentPoints`: 물가상승률을 기준금리에서 조정할 차이

기본값:

- 기간: 20년
- 투자 연 기대수익률: 9%
- 기준금리: 2.75%
- 물가상승률 차이: -0.25%p
- 물가상승률: 2.50%
- 금액 표시: 명목금액

### 월 복리

연이율 `r`은 다음 식으로 월 복리율로 변환한다.

```text
monthlyRate = (1 + annualRate)^(1 / 12) - 1
```

매월 말 저축액과 투자액을 납입한다.

현재 계획:

```text
savings[m] = savings[m - 1] * (1 + baseMonthlyRate) + monthlySavingsWon
investment[m] = investment[m - 1] * (1 + investmentMonthlyRate) + monthlyInvestmentWon
currentPlan[m] = savings[m] + investment[m]
```

`investment[0]`은 `initialInvestmentWon`, `savings[0]`은 0원이다.

전부 저축 기준선:

```text
allSavings[m] =
  allSavings[m - 1] * (1 + baseMonthlyRate)
  + monthlySavingsWon
  + monthlyInvestmentWon
```

`allSavings[0]`은 비교 조건을 같게 하기 위해 `initialInvestmentWon`이다.

누적 납입원금:

```text
contributedPrincipal[m] =
  initialInvestmentWon
  + (monthlySavingsWon + monthlyInvestmentWon) * m
```

납입원금 대비 총 비율:

```text
principalRatioPercent =
  currentPlan[m] / contributedPrincipal[m] * 100
```

납입원금이 0원이면 비율은 표시하지 않는다.

### 명목·실질금액

- 기본 화면은 명목금액을 표시한다.
- `명목 / 실질` 토글로 같은 계산 결과의 표시 기준만 바꾼다.
- 실질금액은 각 월 시점의 명목금액을 설정된 연 물가상승률로 할인한다.
- 물가상승률 기본값은 `기준금리 + inflationOffsetPercentPoints`다.
- 기본 차이는 `-0.25%p`다.
- 기준금리를 바꾸면 물가상승률도 같은 차이를 유지하며 자동 연동된다.
- 고급 설정에서는 기준금리와 별도로 차이값을 수정할 수 있다.

## 입력과 조작

### 기간

- 슬라이더
- 숫자 직접 입력
- `− / +` 버튼으로 1년 단위 조정
- `10년 / 20년 / 30년` 빠른 선택
- 허용 범위: 1년부터 50년

### 투자 연 기대수익률

제목을 `연 기대수익률`로 명시한다. 퍼센트 버튼만 단독으로 노출하지 않는다.

- `5%`
- `9%`
- `13%`
- `직접 입력`

직접 입력:

- `− / +` 버튼으로 0.25%p 단위 조정
- 소수점 둘째 자리까지만 허용
- 허용 범위: 0.00%부터 30.00%

프리셋은 상품이나 과거 성과를 의미하지 않는다. 단순한 고정 기대수익률 예시다.

### 고급 설정

- 기준금리 기본값 2.75%
- 기준금리는 저축 기준선과 현재 계획의 저축분에 적용
- 기준금리는 숫자로 직접 수정하고 소수점 둘째 자리까지만 허용
- 물가상승률 차이 기본값 -0.25%p
- 물가상승률은 기본 자동 연동되고, 사용자는 고급 설정에서 소수점 둘째 자리까지 차이값만 변경

## 화면 설계

### 정보 위계

문장보다 기간, 금액과 퍼센트를 우선한다.

1. Main에서 가져온 월 저축액과 투자액
2. 기간과 연 기대수익률 조작
3. `N년 뒤 예상금액`
4. 현재 계획 성장 곡선과 전부 저축 기준선
5. `전부 저축보다 +금액`
6. `납입원금 대비 총 N%`
7. 명목·실질 토글과 접힌 고급 설정

저축 결과와 투자 결과를 별도 요약 카드로 반복하지 않는다.

### 그래프

- 현재 계획은 굵은 주곡선과 절제된 면적으로 표시한다.
- 전부 저축은 더 얇고 대비가 낮은 보조선으로 표시한다.
- 두 선은 같은 시간축과 금액축을 사용한다.
- 1차 기본 화면에는 5%, 9%, 13% 곡선을 동시에 표시하지 않는다.
- 그래프 자체에 긴 설명을 넣지 않는다.
- 색상만으로 두 선을 구분하지 않고 선 굵기, 명칭과 패턴을 함께 사용한다.

hover, 키보드 focus 또는 touch 시 해당 연말의 다음 정보를 표시한다.

- 현재 계획 총액
- 전부 저축 총액
- 누적 납입원금
- 현재 계획 중 저축 잔액
- 현재 계획 중 투자 잔액

모바일 touch tooltip은 다시 누르거나 그래프 밖을 누를 때 닫히며 viewport 밖으로 넘치지 않는다.

## 상태와 데이터 소유권

Main read adapter는 현재 Main schema에서 다음 projection만 만든다.

```ts
interface SimulationMainSource {
  monthlySavingsWon: number;
  monthlyInvestmentWon: number;
  mainUpdatedAt: number;
}
```

Simulation draft는 다음 책임만 가진다.

```ts
interface CompoundSimulationDraft {
  source: SimulationMainSource;
  initialInvestmentWon: number;
  years: number;
  expectedAnnualReturnPercent: number;
  baseRatePercent: number;
  inflationOffsetPercentPoints: number;
  amountMode: 'nominal' | 'real';
  updatedAt: number;
}
```

- Main adapter는 read-only다.
- Simulation draft는 별도 versioned key에 저장한다.
- 저장 전에 숫자 범위와 schema를 검증한다.
- 기존 v1 Simulation 저장값을 신규 draft로 자동 변환하지 않는다.
- 레거시 저장값은 명시적 제거 승인 전까지 손상하거나 덮어쓰지 않는다.

## 오류와 복구

- Main 데이터 부재·손상: Main 복구 경로 표시
- 월 저축·투자 합계 0원: Main 편집 안내
- Simulation draft 손상: 손상 draft를 적용하지 않고 최신 Main 기준 시작 흐름 제공
- storage read 실패: 저장 없이 현재 세션에서 계산 가능하다고 안내
- storage write 실패: 계산은 유지하고 자동 저장 실패를 알림
- 유효 범위 밖 입력: 가장 가까운 허용값으로 조용히 저장하지 않고 필드 오류를 표시
- 계산 결과가 유한하지 않음: 그래프 렌더링을 중단하고 입력 수정 안내

## 접근성과 반응형

- 모든 slider는 연결된 숫자 입력과 접근 가능한 이름을 가진다.
- `− / +` 버튼의 대상과 조정 단위를 accessible name으로 설명한다.
- 그래프에는 현재 선택 조건과 최종 결과를 담은 텍스트 대체 요약을 제공한다.
- tooltip 정보는 pointer hover만이 아니라 키보드 focus와 touch로 접근 가능하다.
- 390px, 768px와 desktop에서 가로 overflow 없이 금액, 그래프와 조작을 사용할 수 있어야 한다.
- `prefers-reduced-motion`에서는 곡선 전환 animation을 줄이거나 제거한다.

## 레거시 판정과 제거 계획

### 이관

- Main에서 월 납입 데이터를 읽는 connector 의미
- 고정 기대수익률을 월 복리로 계산하는 순수 계산 의미
- 연도별 자산 경로와 tooltip용 시점 결과
- storage 접근 실패 시 저장 없는 세션 계산으로 복구하는 사용자 관찰 동작

이관 기능은 새 TypeScript domain, application과 infrastructure 경계에서 다시 구현한다. 레거시 JavaScript를 import하지 않는다.

### 폐기

- 지수·배당성장·커버드콜 전략 이름과 ETF 예시
- Nasdaq, S&P 500, SCHD, JEPI, QQQI와 DIVO 시장 자료
- 전략별 배당·분배 성장률, capital growth와 benchmark delta
- 여러 Simulation 저장 목록, 이름 생성, 조회와 삭제 UI
- 레거시 DataHub modal과 이전 앱 shell
- v1 Step 1 snapshot을 신규 Simulation의 정상 입력으로 사용하는 경로

### 제거 gate

1. 신규 React entry가 지원 Simulation route를 소유한다.
2. 신규 Main read adapter와 단일 draft 저장 계약이 focused test를 통과한다.
3. 신규 복리 계산 unit test와 외부 사용자 흐름 E2E가 레거시 내부 테스트를 대체한다.
4. `apps/simulation/**`, `tests/step2.spec.ts`, v1 connector, selector와 storage key 참조를 검색한다.
5. PWA precache, version script, Vite entry와 문서 참조를 새 경계로 교체한다.
6. 구버전 저장값이 손상되거나 덮어써지지 않음을 검증한다.
7. TypeScript check, 현재 Main·journey 회귀, 390px·768px·desktop E2E와 PWA build·offline 검증을 통과한다.
8. 필요한 기능과 공개 계약이 모두 이관 또는 명시적으로 폐기됐다는 증거가 확보된 뒤 레거시 Simulation 구현과 직접 내부 테스트를 삭제한다.

## 후속 확장 경계

### 세금

세금은 `ProjectionResult`를 받은 뒤 표시 금액을 조정하는 별도 정책으로 추가한다. 1차 복리 누적 함수에 세법 조건을 넣지 않는다.

### MDD

MDD는 단일 고정 기대수익률 곡선을 과거 백테스트로 바꾸지 않는다. 후속 기능은 사용자가 별도 가정한 하락률과 회복 조건으로 변동 경로를 시각화하는 독립 projection mode로 설계한다. 1차 저장 schema와 그래프 renderer는 mode 확장을 막지 않되 MDD 필드나 빈 UI를 미리 노출하지 않는다.

## 테스트

### Unit

- 연이율의 월 복리율 변환
- 매월 말 납입 순서
- 저축·투자 분리 성장과 현재 계획 합계
- 시작 원금을 포함한 전부 저축 기준선
- 누적 납입원금과 총 비율
- 명목·실질금액 전환
- 기준금리와 물가상승률 차이 자동 연동
- 입력 경계, 반올림과 유한값 검증

### Integration

- current Main schema projection
- Main revision 변경 감지
- 단일 Simulation draft 저장·복구·초기화
- 손상 draft와 storage 접근 실패
- 기존 v1 저장 key 비변경

### Browser

- Main에서 신규 Simulation 최초 진입
- 시작 원금 있음·없음
- 5%, 9%, 13%와 직접 입력 전환
- 기간 slider, 숫자 입력, 1년 조정과 빠른 선택
- 명목·실질 전환
- hover, focus와 touch tooltip
- Main 합계 0원 복구
- 최신 Main 기준 `처음부터 다시`
- 390px, 768px와 desktop overflow·focus·touch target

## 완료 조건

- 사용자가 Main 월 저축·투자 금액을 다시 입력하지 않고 Simulation을 시작할 수 있다.
- 사용자가 시작 원금 유무를 쉬운 문구로 선택할 수 있다.
- 같은 월 납입 조건에서 현재 계획과 전부 저축 결과를 한 그래프에서 구분할 수 있다.
- 최종 예상금액, 전부 저축 대비 차이와 납입원금 대비 총 퍼센트를 확인할 수 있다.
- 기대수익률, 기간, 기준금리와 물가 차이를 승인된 단위와 범위로 조정할 수 있다.
- Simulation 수정은 Main을 변경하지 않는다.
- 새로고침은 현재 Simulation 하나를 유지하고, 처음부터 다시는 최신 Main 데이터로 시작한다.
- 모바일, 태블릿과 desktop에서 동일한 계산과 그래프 상세를 사용할 수 있다.
- 신규 구현이 레거시 Simulation module을 runtime import하지 않는다.
- 레거시 Simulation의 이관·폐기·참조 제거와 회귀 증거가 확보된 뒤 임시 구현을 삭제할 수 있다.
