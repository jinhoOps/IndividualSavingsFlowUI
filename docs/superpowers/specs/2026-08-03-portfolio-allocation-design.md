# Portfolio 투자 배분 설계

## 목적

Portfolio는 Main에 설정된 한 달 투자금을 사용자가 정한 투자 대상에 배분하는 로컬 우선 계획 도구다. 첫 버전은 현재 적용 계획 하나만 소유하며, 시세·수익률·계좌·매수 실행을 다루지 않는다.

사용자는 자유롭게 투자 대상 이름을 추가하고 전체 입력 방식을 금액 또는 비율로 전환할 수 있다. 결과에서는 입력 방식과 관계없이 각 대상의 금액과 비율을 함께 확인한다. 배분하지 않은 투자금은 투자 목적 대기자금인 `현금`으로 취급한다.

## 제품 경계

### 포함

- 최신 Main의 `monthlyInvestmentWon` 직접 읽기
- 활성 투자 배분 계획 하나
- 최대 10개의 자유 이름 투자 대상과 고정 `현금` 항목
- 금액 또는 비율 방식의 배분 편집
- 자동 현금 배분과 선택적인 현금 직접 배분
- 초안 자동보존, 명시적 적용과 취소
- 도넛과 표를 이용한 결과 우선 요약
- Main 투자금 변경에 대한 비대칭 동기화
- 로컬 저장, 오류 복구와 처음부터 다시

### 제외

- 복수 Portfolio와 계획 이름
- 계좌, ISA·해외직투 구분과 Account Map 연결
- 티커, 종목 검색, 현재가와 평가액
- 수익률, 백테스트, 리밸런싱 제안과 매수 실행
- 매일·매주·매월 매수 주기와 연간 적립 계산
- Portfolio snapshot·history와 레거시 데이터 import
- Main write-back

투자 대상의 안정적인 ID는 향후 계좌 연결에서 참조할 수 있지만, 첫 버전의 schema와 UI에는 계좌 field를 두지 않는다.

## 검토한 접근

### 1. Portfolio가 최신 Main을 직접 읽고 자체 배분만 소유

Portfolio 전용 read adapter가 최신 유효 `MainData`에서 `monthlyInvestmentWon`만 가져온다. Portfolio는 적용 계획, 편집 초안과 마지막 동기화 투자금만 별도 저장한다. Main이 금액을 소유하고 Portfolio가 배분을 소유하는 경계가 명확하며, 진입할 때마다 최신 값을 반영할 수 있다. 이 접근을 채택한다.

### 2. Simulation journey snapshot의 금액을 Portfolio까지 전달

기존 이동 흐름은 유지하기 쉽지만 snapshot이 오래될 수 있다. 현재 `monthlyInvestableAmountWon`은 Main의 투자액 자체가 아니라 소비와 저축을 제외한 금액이므로 Portfolio 계산 원천으로도 부적합하다. journey snapshot은 이동 맥락에만 사용하고 계산 원천으로 사용하지 않는다.

### 3. 레거시 Portfolio state와 storage schema를 변환

레거시는 복수 계획, 이름, 티커, 매수 주기와 snapshot을 전제로 한다. 신규 단일 배분 계약과 의미가 달라 부분 변환도 사용자 의도를 추측하게 된다. 레거시는 기능 판단 자료로만 사용하고 runtime 또는 저장 계약을 이관하지 않는다.

## 아키텍처

신규 상세 앱은 `src/portfolio/` 아래에 현재 Main·Simulation과 같은 경계를 둔다.

- `domain`: 계획·항목·초안 model, 배분 계산, 동기화와 validation
- `application`: bootstrap 결과, draft/apply/cancel/reset 전이
- `infrastructure`: 읽기 전용 Main source와 Portfolio 전용 repository
- `ui`: 결과, 도넛, 표, 편집기, 적용 확인, 오류와 차단 상태

신규 runtime은 `apps/portfolio/app.js`, `apps/portfolio/modules/**`, 레거시 stylesheet, `IsfStorageHub`, `isf-rebuild-v1`, 레거시 Portfolio 저장 key를 import하거나 읽지 않는다. `apps/portfolio/index.html`은 현재 URL을 보존하는 최소 Vite shell로 유지하고 `src/journey/portfolio.tsx`의 준비 화면 entry는 신규 Portfolio entry로 교체한다. URL과 PWA route는 바꾸지 않는다.

Portfolio의 Main source adapter는 최신 유효 Main 적용 계획만 읽는다. Main이 없거나 읽을 수 없는 경우, 저장된 Portfolio를 수정하거나 제거하지 않고 명시적인 상태를 반환한다. Portfolio는 Main 저장소에 쓰지 않는다.

## 데이터 모델

구체적인 field 이름과 schema version은 구현 계획에서 현재 repository 관례에 맞춰 확정하되 다음 의미를 보존한다.

### 적용 계획

- schema version
- 안정적인 계획 ID 또는 단일 aggregate 식별자
- 투자 대상 배열
  - 안정적인 항목 ID
  - 사용자 이름
  - 정규화된 배분 비율
  - 사용자 추가 순서
- 현금 배분 비율
- 현금 모드: `automatic` 또는 `manual`
- 마지막 동기화 투자금
- 적용·갱신 timestamp

### 편집 초안

- 적용 계획과 독립된 항목·비율
- 전체 입력 방식: `amount` 또는 `percentage`
- 현금 모드
- 합계가 불완전한 중간 입력
- 초안 갱신 timestamp

금액은 Main 투자금과 배분에서 파생한다. `마지막 동기화 투자금`은 Main 변화 방향을 판정하기 위한 source metadata이며 사용자가 Portfolio에서 편집하는 독립 투자금이 아니다.

비율 저장 정밀도는 화면 표시 정밀도와 분리한다. 구현은 안전 정수 기반 단위 또는 동등한 결정론적 표현을 사용해 부동소수 누적 오차 없이 정확한 합계와 원 단위 금액을 계산해야 한다.

## Main 동기화

Portfolio 진입 때마다 최신 Main 투자금과 마지막 동기화 투자금을 비교한다.

### 최초 진입

- 투자금이 양수면 현금 100% 초안으로 시작한다.
- 투자금이 0원이면 배분을 시작하지 않고 Main 투자금 설정 CTA를 표시한다.
- 유효한 Main 계획을 읽지 못하면 오류 또는 Main 설정 안내를 표시한다.

### 투자금 증가

- 기존 비현금 투자 대상의 계산 금액을 유지한다.
- 증가분 전액을 현금에 더한다.
- 증가 반영 후의 금액을 기준으로 유효한 새 비율을 계산한다.
- 수동 현금 계획도 source 증가분을 현금에 더해 기존 투자 대상 금액을 임의 변경하지 않는다.

### 투자금 감소

- 감소 전 전체 구성의 비율을 유지한다.
- 투자 대상과 현금을 새 투자금에 비례 축소한다.
- 원 단위 보정 차이는 현금에 적용한다.

### 투자금 0원

- 적용 계획과 초안을 삭제하지 않는다.
- 본문을 목적이 분명한 그라데이션 블러 overlay로 가린다.
- `Main에서 투자금 설정` CTA를 전면에 표시한다.
- CTA는 Main Financial Detail Modal을 열고 투자금 입력에 초점을 주는 일회성 navigation intent를 전달한다.

## 배분 계산과 validation

### 투자 대상

- 사용자가 이름을 자유 입력한다.
- 앞뒤 공백 제거, 연속 공백 축약과 locale-aware lowercase를 적용한 비교 key로 중복을 막는다. 사용자에게 보이는 원래 표기는 보존한다.
- 최대 10개다. 현금은 이 제한에 포함하지 않는다.
- 같은 이름 대신 안정적인 ID가 항목 identity를 결정한다.
- 빈 이름은 적용할 수 없다.

### 금액 입력

- 비현금 투자 대상의 유효한 양수 입력 최소값은 1,000원이다.
- 편집 조작은 1,000원 단위를 기본으로 한다.
- 내부 계산과 합계는 원 단위 안전 정수다.
- 읽기 화면은 모든 금액을 천 원 단위로 반올림한다.
- 표시 반올림은 저장값이나 합계 계산을 변경하지 않는다.

### 비율 입력

- 정수 비율을 기본으로 한다.
- 입력은 소수점 한 자리까지 허용하되 정수로 표현 가능한 값은 정수로 표시한다.
- 정수 값은 소수점 없이, 필요한 값만 소수점 한 자리로 표시한다.
- 내부 정규화는 표시보다 높은 결정론적 정밀도로 원 단위 합계를 보존할 수 있다.

### 입력 방식 전환

- 편집 전체가 금액 또는 비율 방식 중 하나를 사용한다.
- 방식을 전환해도 현재 배분 비율은 바뀌지 않는다.
- 결과 화면은 항상 금액과 비율을 모두 표시한다.

### 자동 현금

- 기본 모드는 `automatic`이다.
- 비현금 투자 대상의 합을 제외한 나머지를 현금이 채운다.
- 새 입력은 남은 범위를 초과할 수 없도록 제한한다.
- 항목 삭제 금액은 현금으로 이동한다.

### 직접 현금

- 사용자가 현금 값을 수정하는 순간 `manual`로 전환한다.
- UI는 `현금 직접 배분 중` 상태를 표시한다.
- 모든 투자 대상과 현금의 합계가 정확히 100%일 때만 적용할 수 있다.
- `현금 자동 배분 켜기`는 현금을 다시 잔여 금액으로 계산하고 이후 변경에도 자동 반영한다.
- 보조 설명은 `남은 투자금을 현금으로 자동 배분합니다`로 한다.

## 편집·저장 흐름

- 저장된 적용 계획이 있으면 결과 화면으로 진입한다.
- 최초 진입은 현금 100%인 설정 화면으로 진입한다.
- 편집 변경은 Portfolio 전용 초안에 자동보존한다.
- 불완전하거나 유효하지 않은 초안도 재개할 수 있지만 적용 계획을 덮어쓰지 않는다.
- 명시적 `취소`는 초안을 폐기하고 마지막 적용 계획으로 돌아간다.
- 단순 이탈·새로고침·앱 종료는 초안을 보존한다.
- `적용`은 투자 대상 수, 투자금과 현금 비중을 짧게 확인한 뒤 유효한 초안을 적용한다.
- 저장 성공은 낮은 강조로 알리고, 실패는 현재 적용 계획을 유지한 채 복구 행동을 제시한다.
- `처음부터 다시`는 확인 후 투자 대상을 제거하고 현재 투자금의 현금 100% 계획으로 초기화한다.

## 결과 화면

정보 순서는 핵심 숫자, 도넛, 항목 표다.

- 상단 설명: `한 달 투자금을 배분합니다`
- 반복되는 field label은 `투자금`, `배분`, `현금`처럼 짧게 쓴다.
- 도넛 중앙은 투자금 중심의 짧은 숫자 정보를 표시한다.
- 투자 대상은 비중이 큰 순서로 표시하고 현금은 항상 마지막이다.
- 편집 목록은 사용자가 추가한 순서를 유지한다.
- 투자 대상은 파랑·청록·보라 계열 안에서 구분하고 현금은 중립 회색을 쓴다.
- 표는 이름, 천 원 단위 반올림 금액과 비율을 항상 제공한다.

### 도넛 탐색

- 포인터가 도넛 위에 있을 때만 해당 조각의 이름·금액·비율 툴팁을 표시한다.
- 툴팁 위치는 포인터를 부드럽게 따라가지만 값은 조각의 고정 결과만 사용한다.
- 포인터 위치에 따른 금액 보간이나 재계산은 하지 않는다.
- 포인터가 도넛을 벗어나면 툴팁을 닫는다.
- 터치와 키보드는 선택한 조각 기준 위치에 툴팁을 고정하고 다시 선택하거나 초점이 이동할 때 갱신한다.
- 도넛 선택과 표 행 강조는 양방향으로 연결된다.
- 표가 같은 정보를 제공하므로 도넛은 유일한 정보 전달 수단이 아니다.

## 모션과 피드백

- 도넛 조각 hover·touch·focus 시 조각을 바깥쪽으로 소폭 확장한다.
- 선택되지 않은 조각은 약하게 낮추고 대응 표 행을 강조한다.
- 툴팁은 짧은 fade·scale로 표시한다.
- 표 행 hover·focus도 해당 도넛 조각을 강조한다.
- 버튼과 입력은 짧은 눌림·색상 전환을 제공한다.
- 항목 추가·삭제와 현금 값 변화는 레이아웃이 튀지 않는 짧은 전환을 사용한다.
- 과한 회전, 탄성, 지속 애니메이션은 사용하지 않는다.
- `prefers-reduced-motion`에서는 의미 있는 상태 피드백만 즉시 반영한다.

## 반응형과 접근성

- 390px에서는 핵심 숫자, 도넛, 표를 단일 열로 배치한다.
- 390px, 768px와 desktop에서 body 가로 overflow가 없어야 한다.
- 입력과 주요 버튼의 touch target은 최소 44px이다.
- tooltip은 viewport를 벗어나지 않는다.
- 모든 입력에는 보이는 label 또는 동등한 accessible name이 있다.
- 도넛에는 목적을 설명하는 accessible name과 항목 표라는 텍스트 대안이 있다.
- pointer, touch와 keyboard가 동등한 항목 정보를 제공한다.
- 오류, 현금 모드, 저장과 동기화 상태를 색상 외 텍스트로 알린다.
- 편집 dialog 또는 sheet를 사용하면 focus containment와 진입점 focus return을 보장한다.
- 그라데이션 블러는 투자금 0원 차단 상태에만 사용하며 일반 panel 스타일로 확장하지 않는다.

## 오류 처리

- Main 없음 또는 투자금 0원: Main 투자금 설정 CTA
- Main 읽기 실패: 적용 계획 보존, 재시도와 Main 이동 안내
- 손상된 Portfolio 저장값: 자동 적용 금지, 손상 상태 격리와 초기화 행동 제공
- 초안 validation 실패: field 가까이 오류 표시, 적용 차단, 초안 보존
- 저장 실패: 이전 적용 계획 보존, 오류 상태와 재시도 제공
- 중복 이름: 기존 항목을 안내하고 새 중복 항목 적용 차단
- 10개 초과: 추가 control 비활성화와 제한 설명

## 레거시 disposition

| 레거시 기능·계약 | 판정 | 처리 |
| --- | --- | --- |
| 자유 이름 자산과 안정적 ID | 이관 | 제품 의미만 TypeScript domain으로 재구현 |
| 최소 1,000원 금액 validation | 이관 | 현재 안전 정수 validation으로 재구현 |
| 금액·비율 동시 표시 | 이관 | 결정론적 현재 계산과 도넛·표로 재구현 |
| Step 1 투자 가능액 connector | 재설계 | 최신 Main `monthlyInvestmentWon` 전용 read adapter로 대체 |
| 복수 Portfolio | 폐기 | 활성 계획 하나만 지원 |
| Portfolio 이름 | 폐기 | 단일 계획에서 식별 가치 없음 |
| ticker field와 종목별 매수금 | 폐기 | 종목 검색·매수 실행은 범위 밖 |
| 매일·매주·매월 주기 | 폐기 | Main 값은 한 달 기준이며 반복 표현만 줄임 |
| 연간 적립 계산 | 폐기 | Simulation이 장기 성장 역할 소유 |
| Portfolio snapshot·history | 폐기 | 첫 버전은 적용 계획과 초안만 소유 |
| 레거시 DOM·modal·chart renderer | 폐기 | 신규 React UI와 외부 동작 test로 대체 |
| `isf-step3-portfolios-v2` | 호환 제외 | 읽기·변환·덮어쓰기 금지 fixture로 증명 |
| `isf-step3-snapshots-v1` | 호환 제외 | 읽기·변환·덮어쓰기 금지 fixture로 증명 |
| `IsfStorageHub` Portfolio 호출 | 폐기 | Portfolio 전용 typed repository로 대체 |

레거시 코드 삭제는 신규 앱 구현과 회귀 검증 뒤 별도 gate로 수행한다. 삭제 전 runtime import, route, selector, storage key, compatibility path와 test reference를 검색하고 다른 앱 소비 여부를 확인한다.

## 문서 변경

구현과 같은 변경 흐름에서 다음 기준 문서를 갱신한다.

- Product PRD: Portfolio를 준비 화면에서 현재 상세 제품으로 승격
- Requirements: Portfolio 인수 조건과 migration disposition 완료 상태
- Roadmap·State: 현재 제품과 다음 Account Map 순서
- DESIGN: Portfolio 결과·편집·도넛·반응형 계약, obsolete 주기 확인 문구 제거
- README: 현재 지원 앱과 실행·검증 안내
- Architecture·Structure: `src/portfolio/`와 데이터 소유권

계좌 연결, 복수 계획과 Account Map write-back 여부는 미래 범위로 남긴다.

## 검증

### 단위·component

- 자동 현금과 직접 현금 100% validation
- 초과 배분 제한과 항목 삭제 금액의 현금 이동
- 금액·비율 전환과 원 단위 보정
- 정수 우선·필요 시 소수점 한 자리 비율 표시
- 천 원 단위 금액 반올림
- 투자금 증가 시 현금 증가, 감소 시 전체 비율 유지
- 중복 이름, 최대 10개와 최소 1,000원 validation
- 초안·적용·취소·초기화와 저장 실패
- 손상된 현재·초안 데이터 격리
- 레거시 storage key 비접촉 fixture

### 브라우저

- Main에서 Simulation을 거쳐 Portfolio 진입 후 최신 Main 직접 동기화
- 저장 계획 재진입 시 결과 우선, 최초 진입 시 설정 우선
- 투자금 0원 blur overlay와 Main Financial Detail 투자금 focus
- 도넛과 표의 pointer·touch·keyboard 상호 강조
- 현금 자동·직접 모드와 적용 validation
- 390px, 768px, desktop overflow·tooltip containment·touch target
- reduced motion과 focus return
- Main·Simulation·Account Map 데이터 비변경

### 전체 gate

- `npm run check`
- `npm run test:unit`
- Portfolio focused Playwright spec
- `npm run test:e2e -- --reporter=list`
- PWA build와 Portfolio route navigation
- 레거시 import·selector·storage reference 검색

## 인수 조건

- Portfolio가 최신 Main 투자금을 직접 읽고 Main을 수정하지 않는다.
- 사용자가 최대 10개 자유 이름 대상을 금액 또는 비율로 배분한다.
- 모든 결과가 금액과 비율을 함께 보여준다.
- 남은 투자금은 자동 현금이며 사용자가 현금을 직접 배분할 수도 있다.
- 증가한 투자금은 현금에 쌓이고 감소한 투자금은 기존 비율대로 축소된다.
- 초안은 자동보존되고 적용·취소·초기화의 결과가 구분된다.
- 결과 화면이 도넛과 표를 summary-first로 제공한다.
- pointer·touch·keyboard와 reduced motion에서 동등한 정보를 제공한다.
- 투자금 0원은 기존 계획을 보존하고 Main 투자금 편집으로 안내한다.
- 신규 runtime과 저장소가 레거시 Portfolio 코드와 key에 의존하지 않는다.
- canonical 문서가 Portfolio의 현재 상세 제품 상태와 Account Map의 미래 상태를 일치되게 설명한다.
