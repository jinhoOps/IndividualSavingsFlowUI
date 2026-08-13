# Account Map Purpose-Node Flow Design

**Date:** 2026-08-13

**Status:** Approved

**Scope:** Phase B Account Map 계좌·보관처 관리와 Main 기반 월 자금 연결

## 1. Product Boundary

Account Map은 Main의 월간 계획을 실제 계좌·보관처와 연결하고 하나의 노드 지도로 보여준다. Main의 다섯 월간 금액은 읽기 전용이며 Account Map에서 수정하지 않는다. Portfolio의 aggregate plan, draft와 보존된 location-scoped plan도 읽거나 변경하지 않는다.

현재 범위는 다음을 포함한다.

- 계좌·보관처 생성, 이름 변경, 보관과 복원
- Main 기준 목적의 최초 자동 생성
- 목적과 계좌의 다대다 연결 및 연결별 월 금액
- 목적 중심·계좌 중심 노드 지도
- 초기 설정 이후 목적·계좌·연결 추가 편집

현재 범위는 Portfolio 투자 대상 연결, 계좌번호, 잔액, 인증정보, 거래, 자동이체 실행을 포함하지 않는다. Portfolio 연결은 별도 승인 명세가 필요하다.

## 2. First-Run Flow

Account Map은 Main에서 다음 목적과 금액을 자동 생성한다.

- `수입`: `monthlyNetIncomeWon`
- `주거`: `monthlyHousingWon`
- `생활비`: `monthlyLivingWon`
- `저축`: `monthlySavingWon`
- `투자`: `monthlyInvestmentWon`

카드는 `수입`, `주거`, `생활비`, `저축`, `투자`처럼 짧은 제목을 사용한다. 문맥이 이미 계좌 연결임을 전제로 제목과 안내에서 `계좌`를 반복하지 않는다.

- 미연결 action: `연결`
- 한 곳 이상 연결된 action: `다른 계좌 연결`
- 안내: `어디로 들어오나요?`, `어디에서 나가나요?`, `어디에서 쓰나요?`, `어디에 모으나요?`, `어디에 두나요?`

`수입`은 최소 한 곳 연결해야 최초 설정을 완료할 수 있다. 다른 목적은 건너뛸 수 있으며 완료 지도에서 `연결 필요`로 표시한다. 설정 완료 후 목적, 계좌와 연결을 추가하거나 편집할 수 있다.

## 3. Account Identity

계좌·보관처는 stable identity 하나를 가지며 여러 목적에 동시에 연결될 수 있다. 같은 계좌를 목적마다 복제하지 않는다.

저장 정보는 기관과 사용자가 정한 별칭뿐이다. 계좌번호, 잔액, 인증정보는 저장하지 않는다. 같은 기관의 복수 계좌를 허용하되 정규화된 기관·별칭 조합의 중복 생성은 차단하고 기존 항목을 안내한다.

빠른 기관 선택은 다음 9개와 `직접 입력`을 제공한다.

- KB국민은행
- 신한은행
- 하나은행
- 우리은행
- NH농협은행
- IBK기업은행
- KDB산업은행
- 토스뱅크
- 카카오뱅크

## 4. Many-to-Many Allocation

데이터 모델은 목적과 계좌의 다대다 연결을 허용한다. UI는 `source`, `destination`, `출발`, `도착`을 사용자 용어로 노출하지 않고 목적 중심 질문으로 관계를 만든다.

한 목적에 첫 계좌를 연결하면 Main의 해당 목적 금액 전체를 대표 연결에 배정한다. `다른 계좌 연결`에서는 새 계좌와 그 계좌가 관리할 금액만 입력한다. 기존 대표 연결은 목적 총액에서 나머지를 자동 계산한다.

예: 생활비 1,000,000원에 토스뱅크 300,000원을 추가하면 기존 국민 연결은 700,000원이 된다.

목적별 배정 합계가 Main 금액을 초과하면 저장을 차단하고 첫 오류 입력으로 focus를 이동한다. 미배정은 저장 가능하며 지도에 상태로 표시한다. Main 값이 바뀌어도 기존 연결 금액을 자동 재분배하지 않는다.

## 5. Map Presentation

완료 화면은 목록이 아닌 계좌·목적 노드와 연결선으로 구성한다. 데이터와 연결선은 유지하고 정렬 기준만 바꾼다.

- 기본: `목적 중심`
- 보조: `계좌 중심`
- 사용자 선택은 저장해 재방문 시 복원

목적 중심은 목적 노드를 주된 시각 구조로 두고 관련 계좌를 배치한다. 계좌 중심은 계좌 노드를 기준으로 연결 목적을 재배치한다. 목적·계좌 노드에는 이름과 월 금액을 표시한다. 집중 상태에서만 연결선의 금액 라벨을 표시해 평상시 시각 피로를 줄인다.

남는 돈은 `미배정 +금액` 노드로 표시한다. 적자는 별도 적자 노드를 만들지 않고 상단 요약과 지도 상태에 `-금액 · 부족함`으로 표시한다. 색상만으로 상태를 전달하지 않는다.

## 6. Node Interaction and Motion

모든 입력 수단은 같은 `focusedNodeId` 상태를 사용한다.

- pointer hover와 keyboard focus: 임시 집중
- click 또는 tap: 집중 고정
- 집중된 같은 노드 재클릭·재탭: 상세 modal 열기
- 다른 노드 선택: 집중 대상 교체
- 빈 지도 선택 또는 `Escape`: 집중 해제

집중 중에는 선택 노드, 직접 연결된 노드와 연결선만 선명하게 표시한다. 나머지는 읽을 수 있는 수준으로 감쇠한다.

상세는 중앙 modal이다. `anime.js` shared-element 전환으로 선택 노드가 modal로 확대되는 인상을 주고, 닫을 때 현재 노드 위치로 축소한다. 열기 전에 노드 좌표를 측정하며 viewport나 정렬 변경 후에는 복귀 좌표를 다시 계산한다. animation 중 중복 입력을 차단한다.

modal 내부 `편집`은 새 surface를 열지 않고 같은 modal에서 필드와 `취소 / 저장` 상태로 전환한다. modal은 focus를 가두고 닫으면 원래 노드로 focus를 돌려준다.

`prefers-reduced-motion: reduce`에서는 이동·확대 animation을 제거하고 동일 상태를 즉시 표시한다.

## 7. Archive and Restore

물리 삭제 대신 보관을 기본으로 한다.

- 연결 없는 계좌: 확인 후 보관
- 연결 있는 계좌: 중지될 목적과 금액을 확인 modal에 표시한 뒤 보관
- 보관 시 Account Map 연결은 삭제하지 않고 중지
- 중지 연결은 지도 합계에서 제외
- 영향받은 목적은 `연결 필요` 또는 미배정 상태 표시
- 보관 계좌는 기본 지도에서 숨기고 관리 목록에서 복원 가능
- 복원 시 기존 중지 연결을 함께 복구할지 확인

보존된 location-scoped Portfolio plan은 Account Map 보관·복원으로 삭제하거나 변경하지 않는다.

## 8. State Ownership and Persistence

Account Map write는 다음으로 제한한다.

- 공유 금융 위치 registry의 Account Map 소유 metadata
- Account Map applied state와 draft
- Account Map 목적·연결·정렬 선호·보관 상태

모든 저장은 workspace revision과 save lock을 사용하고 stale writer를 거부한다. 저장 전후 Main slice와 Portfolio slice는 값과 참조 의미가 보존되어야 한다. Account Map은 Main과 Portfolio에 write-back하지 않는다.

Main 변경은 다음 Account Map read에서 차이를 계산하지만 기존 연결 금액을 자동 변경하지 않는다. 사용자가 명시적으로 Account Map 편집을 저장할 때도 Main·Portfolio는 변경하지 않는다.

## 9. Errors and Recovery

- 수입 미연결: 최초 설정 완료 차단
- 수입 외 미연결: 저장 허용, `연결 필요` 표시
- 배정 초과: 저장 차단, 첫 오류 focus
- 미배정: 저장 허용, 지도 노드 표시
- 저장 실패: modal과 draft 입력 유지, 재시도 제공
- stale revision: 최신 상태 재조회 안내, 기존 입력 보존
- 손상된 참조: 자동 삭제하지 않고 복구 상태 표시, invalid write 차단

## 10. Responsive and Accessibility Contract

- 390px, 768px와 desktop에서 지도·modal이 viewport를 넘지 않는다.
- 지도 pan·zoom은 page scroll을 가로채지 않고 button 대안을 제공한다.
- pointer로 가능한 모든 동작은 keyboard와 touch로 가능하다.
- 주요 touch target은 최소 44px다.
- selected, focused, unassigned, deficit, archived 상태는 색상과 텍스트를 함께 쓴다.
- modal focus trap, `Escape`, trigger focus 복귀와 reduced-motion을 검증한다.

## 11. Acceptance Criteria

- Main의 다섯 목적이 최초 설정에 자동 생성된다.
- 수입 한 곳 연결 후 초기 설정을 완료하고 미연결 목적을 나중에 편집할 수 있다.
- 같은 계좌 identity가 여러 목적에 연결되고 한 목적도 여러 계좌를 가진다.
- 추가 계좌 금액 입력 시 대표 연결의 나머지가 정확히 계산된다.
- 기본 목적 중심 지도와 계좌 중심 재정렬이 동일 노드·연결을 표현한다.
- hover·focus·click·tap 집중과 재선택 modal 진입이 동일한 상태 계약을 따른다.
- modal이 선택 노드에서 확대되고 닫을 때 복귀하며 reduced-motion에서는 즉시 전환된다.
- 보관 시 연결을 중지하고 복원 가능하며 보존된 Portfolio location data를 변경하지 않는다.
- Main 변경 이후에도 기존 Account Map 연결은 자동 재배분되지 않는다.
- Account Map 생성·편집·보관·복원·초기화 전후 Main slice와 Portfolio slice가 변경되지 않는다.
- stale revision과 저장 실패가 Main·Portfolio 또는 최신 workspace를 훼손하지 않는다.
- 390px, 768px와 desktop에서 overflow, focus, touch, 지도 visibility 검증이 통과한다.

## 12. Required Verification

- 목적·계좌 다대다와 나머지 계산 unit tests
- 기관·별칭 정규화와 중복 검증 unit tests
- 보관·중지·복원과 참조 무결성 contract tests
- Account Map repository가 허용된 slice만 변경하는 before/after snapshot tests
- 생성·편집·보관·복원·초기화 각각에서 Main·Portfolio 불변 integration tests
- 최초 설정, 두 정렬, node focus, modal 확대·복귀, reduced-motion Playwright tests
- 390px, 768px와 desktop visual and containment checks
- `npm run check`와 영향 앱 전체 E2E
