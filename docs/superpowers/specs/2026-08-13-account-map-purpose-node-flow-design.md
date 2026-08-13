# Account Map Purpose-Node Flow Design

**Date:** 2026-08-13

**Status:** Approved, review gaps resolved

**Scope:** Phase B Account Map 계좌·보관처 관리와 Main 기반 월 자금 연결

## 1. Authority and Product Boundary

이 문서는 Phase B Account Map의 상세 명세다. 다음 기존 계약을 명시적으로 대체한다.

- `2026-08-06-connected-account-map-workspace-design.md`의 4-purpose `MonthlyFlow` 저장 모델
- purpose를 시각 node로 표시하지 않는 계약
- Account Map이 Portfolio slice를 읽는 계약
- location 보관 중 location-scoped Portfolio 삭제 여부를 묻는 계약
- active location의 별칭만으로 중복을 판정하는 계약

기존 명세의 whole-workspace 저장, revision, backup, semantic zoom, 접근성 계약은 이 문서에서 달리 정하지 않는 한 유지한다.

Account Map은 Main의 월간 계획을 실제 계좌·보관처와 연결하고 하나의 노드 지도로 보여준다. Main의 다섯 월간 금액은 읽기 전용이다. Account Map은 Portfolio slice를 읽거나 변경하지 않는다. Portfolio aggregate plan, draft와 location-scoped plan은 Account Map write 전후 byte-equivalent JSON 값을 유지한다.

현재 범위:

- 계좌·보관처 생성, 이름 변경, 보관과 복원
- Main 기준 system purpose 자동 생성
- system purpose의 사용자 하위 목적 생성·편집·보관
- 목적과 계좌의 다대다 연결 및 연결별 월 금액
- 목적 중심·계좌 중심 node map

제외 범위:

- Portfolio 투자 대상 연결
- 계좌번호, 잔액, 인증정보, 거래와 자동이체 실행
- 카드·체크카드 같은 consumer instrument 신규 관리

Portfolio 연결과 consumer instrument 재도입은 별도 승인 명세가 필요하다.

## 2. Phase B Persisted Contract

Phase B는 workspace document를 schema version 2로 올리되 storage key `isf-workspace-v1`은 유지한다. Main, Simulation, Portfolio와 location의 기존 schema는 바꾸지 않는다.

```ts
type SystemPurposeId =
  | 'system:income'
  | 'system:housing'
  | 'system:living'
  | 'system:saving'
  | 'system:investing';

type OutflowPurposeId = Exclude<SystemPurposeId, 'system:income'>;
type PurposeId = SystemPurposeId | `custom:${string}`;

interface CustomPurpose {
  id: `custom:${string}`;
  parentId: OutflowPurposeId;
  name: string;
  targetMonthlyWon: number;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface PurposeLocationLink {
  id: string;
  purposeId: PurposeId;
  locationId: string;
  monthlyAmountWon: number;
  remainder: boolean;
  status: 'active' | 'suspended';
  suspendedReason?: 'location-archived' | 'user';
  createdAt: number;
  updatedAt: number;
}

interface AccountMapAppliedV1 {
  schemaVersion: 1;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  layout: 'purpose' | 'account';
  setupCompletedAt: number;
  updatedAt: number;
}

interface AccountMapDraftV1 {
  schemaVersion: 1;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  step: 'connect' | 'review';
  updatedAt: number;
}

interface LegacyPhaseAAccountMap {
  instruments: ConsumerInstrument[];
  flows: MonthlyFlow[];
}

interface AccountMapSliceV2 {
  applied: AccountMapAppliedV1 | null;
  draft: AccountMapDraftV1 | null;
  legacyPhaseA: LegacyPhaseAAccountMap;
}
```

System purpose는 저장하지 않고 stable ID와 최신 Main에서 결정적으로 파생한다. Custom purpose만 저장한다. Custom purpose는 수입 아래 만들 수 없고 주거·생활비·저축·투자 중 하나의 하위 항목이어야 한다. 동일 parent 안에서 정규화한 이름은 유일하다.

Link key는 `purposeId + locationId` 조합이 유일하다. 한 purpose에는 active remainder link가 최대 하나다. `monthlyAmountWon`은 0 이상의 안전한 정수 원화다. `suspendedReason`은 suspended 상태에서만 존재한다.

Location role은 연결 가능 capability다. `system:income`은 `income`, 주거·생활비와 그 하위 목적은 `spending`, 저축 하위는 `saving`, 투자 하위는 `investing` role을 요구한다. 새 연결이 필요 role을 추가할 수 있지만 연결 제거·중지는 role을 자동 제거하지 않는다. Phase B role은 add-only이며 제거 UI를 제공하지 않는다. 향후 role 제거는 의존 link 처리 명세 전까지 지원하지 않는다. Role 추가는 Portfolio slice를 읽거나 변경하지 않는다.

Parser와 backup validator는 다음 불변식을 모두 검사한다.

- 모든 배열 entry ID는 비어 있지 않고 배열 안에서 유일하다.
- Custom purpose ID는 `custom:` 뒤에 stable opaque ID가 있으며 system ID와 충돌하지 않는다.
- Custom purpose name은 정규화 후 1~24자다.
- `targetMonthlyWon`, link 금액과 timestamp는 0 이상의 안전한 정수다.
- Custom parent는 네 outflow system purpose 중 하나고 active child target 합은 parent reference 이하이다.
- 모든 link는 존재하는 system/custom purpose와 location을 참조한다.
- archived custom purpose 또는 archived location에는 active link가 없다.
- active link location은 purpose가 요구하는 role을 가진다.
- active link는 `suspendedReason`이 없고 suspended link는 reason이 있으며 `remainder: false`다.
- purpose마다 active remainder는 최대 하나고 `purposeId + locationId` 조합은 유일하다.
- purpose별 active location과 custom child는 각각 최대 10개다.
- layout, step, status와 reason은 선언된 enum 값만 허용한다.

하나라도 실패하면 workspace parse 또는 backup restore 전체를 거부하고 현재 raw 값을 유지한다.

## 3. Workspace v1 to v2 Migration

Migration은 workspace 전체를 먼저 검증한 뒤 atomic replacement 한 번으로 수행한다.

- Main, Simulation, Portfolio와 locations는 값 변경 없이 복사한다.
- Phase A `accountMap.instruments`와 `flows`는 변환하거나 삭제하지 않고 `legacyPhaseA`에 보존한다.
- 새 `applied`와 `draft`는 `null`로 시작한다.
- non-empty `legacyPhaseA`가 있으면 자동 연결로 해석하지 않고 관리 화면에 호환 데이터 보존 상태를 알린다.
- migration 실패 시 기존 raw workspace를 변경하지 않는다.
- workspace v2 backup은 `applied`, `draft`, `legacyPhaseA`를 round-trip한다.
- v1 backup import는 같은 migration을 거치며 invalid reference나 금액이면 아무것도 쓰지 않는다.

Phase B parser는 v1과 v2만 허용한다. 알 수 없는 미래 version은 거부한다.

## 4. Purpose References and Reconciliation

System purpose reference는 최신 Main과 정확히 매핑한다.

```text
system:income    = monthlyNetIncomeWon
system:housing   = monthlyHousingWon
system:living    = monthlyLivingWon
system:saving    = monthlySavingWon
system:investing = monthlyInvestmentWon
```

Custom purpose의 `targetMonthlyWon`은 parent reference를 늘리지 않는다. 같은 parent의 active custom target 합은 parent reference 이하여야 한다. System purpose 자체의 direct target은 다음과 같다.

```text
directTarget(systemPurpose)
  = reference(systemPurpose) - sum(active child custom target)
```

각 purpose의 상태는 독립 계산한다.

```text
activeAllocated = sum(active link monthlyAmountWon)
unassigned = max(target - activeAllocated, 0)
excess = max(activeAllocated - target, 0)
```

`target`은 custom purpose에서는 `targetMonthlyWon`, system purpose에서는 `directTarget`이다. suspended link는 어느 합계에도 포함하지 않는다.

Main 전체 상태는 purpose gap과 섞지 않는다.

```text
plannedOutflowWon
  = monthlyHousingWon + monthlyLivingWon
  + monthlySavingWon + monthlyInvestmentWon
remainingWon = monthlyNetIncomeWon - plannedOutflowWon
```

- `remainingWon > 0`: 별도 `미배정 +금액` 상태 node
- `remainingWon < 0`: 상단과 지도 상태에 `-금액 · 부족함`
- purpose `unassigned`: 해당 purpose node의 `연결 필요`
- purpose `excess`: 해당 purpose node의 `초과 연결`

Main 변경은 기존 link와 custom target을 자동 변경하지 않는다. 기존 applied state가 excess여도 열람과 correction 진입을 허용한다. 저장은 기존 excess를 늘리지 않는 변경만 허용하며 새 적용은 모든 excess가 0이어야 한다.

## 5. First-Run and Draft Flow

Main applied plan이 없으면 Account Map 데이터를 만들지 않고 설명과 `월 자금 계획 만들기` link만 표시한다.

Main이 있으면 다섯 system purpose를 최신 Main에서 파생한다. 카드 제목은 `수입`, `주거`, `생활비`, `저축`, `투자`다.

- 미연결 action: `연결`
- 연결 후 action: `다른 계좌 연결`
- 안내: `어디로 들어오나요?`, `어디에서 나가나요?`, `어디에서 쓰나요?`, `어디에 모으나요?`, `어디에 두나요?`

수입은 최소 한 곳 연결하고 active 합계가 Main 수입과 같아야 최초 적용할 수 있다. 다른 purpose는 미연결 상태로 적용 가능하다. 첫 계좌는 해당 purpose의 remainder link가 된다. 추가 계좌는 새 금액만 입력하며 remainder link 금액을 target의 나머지로 다시 계산한다.

Draft는 각 유효 입력 후 저장하고 재방문 시 복원한다. Main이 draft 도중 바뀌면 입력값을 보존하고 최신 reference로 unassigned·excess를 다시 계산해 review 전에 알린다.

`검토`에서 변경 요약과 Main·Portfolio 불변 경계를 보여준 뒤 사용자가 명시적으로 `지도 만들기`를 실행해야 applied가 된다. `나가기`는 draft를 보존한다. `설정 취소`는 확인 후 draft만 삭제하며 locations와 모든 타 앱 slice를 보존한다.

## 6. Account Identity and Institution Catalog

FinancialLocation이 계좌·보관처 identity의 단일 원천이다. 저장 필드는 기존 registry의 `id`, `shortName`, `institution`, `kind`, `roles`, `archivedAt`, timestamps를 사용한다. Account Map slice에 location archive 상태를 복제하지 않는다.

빠른 기관은 stable ID와 표시명을 가진다.

```text
kb-kookmin   KB국민은행
shinhan      신한은행
hana         하나은행
woori        우리은행
nh-nonghyup  NH농협은행
ibk          IBK기업은행
kdb          KDB산업은행
toss-bank    토스뱅크
kakao-bank   카카오뱅크
custom       직접 입력
```

`custom`은 저장 ID가 아니다. 직접 입력 기관은 `{ id: "custom:<uuid>", name }`으로 저장한다. UUID가 identity이며 정규화한 기관명은 중복 비교 key다. 정규화는 Unicode NFC, outer trim, internal whitespace collapse와 Latin case-fold를 적용한다.

기관 비교 key는 빠른 선택의 canonical ID, 직접 입력의 `custom-name:<normalizedName>`, 기관 없는 location의 `institution:none` 중 하나다. Cash처럼 기관이 없는 location도 `institution:none + normalizedShortName`으로 안정적으로 비교한다.

Active location 중 `institutionComparisonKey + normalizedShortName` 조합은 유일하다. archived match가 있으면 새로 만들지 않고 복원을 제안한다. 같은 기관의 다른 별칭은 허용한다. 이 규칙은 기존 alias-only 중복 계약을 대체한다.

계좌번호, 잔액과 인증정보는 저장하지 않는다.

## 7. Connection Editing

Node modal의 상세 상태는 모든 active·suspended link를 계좌, purpose와 금액으로 보여준다. 같은 modal에서 `편집`을 누르면 다음 action을 제공한다.

- 기존 link 금액 수정
- 다른 계좌 연결
- remainder link 변경
- link 중지 또는 연결 제거
- suspended link 재개
- custom purpose 이름·target 수정 또는 보관
- `취소`와 `저장`

연결 제거는 Account Map link만 삭제하며 location과 Portfolio data를 건드리지 않는다. 저장 실패 시 modal, 입력과 draft를 유지한다. 오류는 field에 연결하고 첫 오류로 focus를 이동한다.

Custom purpose 보관은 `archivedAt`을 기록하고 관련 link를 `suspended`, `user`로 바꾼다. Parent의 direct target은 즉시 다시 계산되어 해당 금액이 parent의 unassigned로 돌아간다. 복원은 최신 parent reference 안에서 target과 link를 검증하며 excess를 만들면 correction 전까지 적용하지 않는다.

Remainder lifecycle은 원자적으로 처리한다.

- active remainder를 중지·제거하면 해당 link의 `remainder`를 false로 바꾼다.
- 다른 active link가 있으면 저장 전에 새 remainder를 선택한다.
- active link가 없으면 remainder 없는 unassigned 상태를 허용한다.
- suspended link 재개는 기본적으로 non-remainder다.
- active remainder가 없으면 재개 과정에서 해당 link를 remainder로 선택할 수 있다.
- 이미 active remainder가 있을 때 복원 link를 remainder로 선택하면 기존 flag를 false, 복원 flag를 true로 한 write에서 교체한다.
- 새 remainder 금액 재계산은 사용자가 link 편집을 저장할 때만 수행하며 Main read만으로 저장 금액을 바꾸지 않는다.

## 8. Map Presentation and Scale

완료 화면은 목록이 아닌 account·purpose node와 연결선이다. Purpose node는 파생된 시각 grouping이며 persisted transfer endpoint가 아니다. 같은 node와 link를 유지하고 배치 기준만 바꾼다.

- 기본: `목적 중심`
- 보조: `계좌 중심`
- layout 선택은 applied에 저장
- zoom level과 node 좌표는 저장하지 않음

Node 금액 의미:

- system purpose: 최신 Main reference와 direct unassigned·excess 상태
- custom purpose: custom target과 unassigned·excess 상태
- account: active link 합계이며 잔액이나 실제 거래액이 아님을 accessible label에 명시
- edge: link monthly amount

Semantic zoom:

- `전체`: system purpose, 상태, purpose별 대표 account와 `외 n개`
- `기본`: 모든 active node와 핵심 연결; 최초 진입 기본값
- `상세`: institution, custom purpose, suspended 상태와 모든 연결

Desktop은 결정적 left-to-right, mobile은 top-to-bottom layout을 쓴다. purpose별 active account와 custom purpose는 각각 최대 10개다. Empty-space drag는 pan만 수행한다. `- / +` button을 기본 zoom control로 제공하며 wheel·pinch는 선택 보조다.

정확한 edge 금액은 평상시 숨기고 node 집중 상태에서 표시한다. System purpose reference와 상태 금액은 항상 표시한다.

## 9. Node State and Modal Motion

임시 강조와 고정 선택을 분리한다.

```ts
interface MapInteractionState {
  transientNodeId: string | null;
  pinnedNodeId: string | null;
  modalNodeId: string | null;
}
```

- hover·keyboard focus: `transientNodeId`
- pointer leave·blur: transient만 해제
- 첫 click·tap 또는 `Enter`·`Space`: `pinnedNodeId`
- pinned node 재클릭·재탭 또는 재실행: `modalNodeId`
- 다른 node 실행: pinned 대상 교체
- 빈 지도 실행 또는 `Escape`: transient·pinned 해제

집중 중에는 대상, 직접 연결 node와 edge만 선명하게 표시한다. 중앙 modal은 `anime.js` shared-element 전환으로 선택 node에서 확대되고 닫을 때 현재 node 위치로 축소한다. viewport·layout 변경 후 복귀 좌표를 다시 측정한다. animation 중 중복 입력을 차단한다.

Modal은 focus를 가두고 닫으면 원래 node로 focus를 돌려준다. 편집 결과 node가 지도에서 사라졌다면 map heading으로 돌려준다. `prefers-reduced-motion: reduce`에서는 즉시 전환한다.

## 10. Archive and Restore

`FinancialLocation.archivedAt`이 유일한 location 보관 상태다.

- 연결 없는 location: 확인 후 보관
- 연결 있는 location: 영향 purpose·금액·remainder 상태를 확인 후 보관
- 보관 시 관련 link는 삭제하지 않고 `suspended`, `location-archived`로 변경
- suspended link는 합계에서 제외하고 상세 zoom·관리 목록에서만 표시
- Portfolio plan과 draft는 읽지도 변경하지도 않음

Remainder location을 보관할 때 다른 active link가 있으면 사용자가 새 remainder를 선택해야 저장할 수 있다. 없으면 remainder가 없는 unassigned 상태를 허용한다.

복원 modal은 suspended link와 최신 target을 다시 계산해 보여준다. 사용자가 복구할 link를 선택한다. 복구가 excess를 만들면 기존 link 감소, 복구 금액 감소 또는 복구하지 않기 중 하나를 선택해야 한다. 자동 재분배하지 않는다.

## 11. Reset and Ownership

관리 action은 `월 연결 다시 만들기`다.

삭제:

- Account Map applied와 draft
- custom purposes와 links
- layout preference

보존:

- Main 전체
- Simulation 전체
- Portfolio plans와 draft 전체
- FinancialLocation registry와 `archivedAt`
- `legacyPhaseA`

Account Map의 field-level write set은 `workspace.locations`와 `workspace.accountMap`뿐이다. Registry write는 location 생성, institution·별칭·role 변경, `archivedAt` 변경으로 제한한다. Main, Simulation과 Portfolio slice는 before/after deep equality를 만족해야 한다. 모든 write는 workspace revision과 save lock을 사용하고 stale writer를 거부한다.

## 12. Backup, Error and Recovery

- workspace v2 whole-workspace export/import round-trip 지원
- 모든 ID, link, purpose parent, amount와 remainder uniqueness를 먼저 검증
- invalid·old-unknown format은 아무것도 변경하지 않음
- 저장 실패는 draft와 modal 입력 유지
- stale revision은 최신 상태 안내와 사용자 입력 보존
- 손상 참조는 자동 삭제하지 않고 recovery 상태 표시 및 invalid write 차단
- recovery와 migration 중에도 Main·Portfolio를 부분 write하지 않음

## 13. Accessibility and Linear Alternative

- 390px, 768px와 desktop에서 map·modal이 viewport를 넘지 않음
- 모든 touch target 최소 44px
- pointer, keyboard와 touch가 동일 상태 전이를 제공
- 상태를 색상과 텍스트로 함께 전달
- modal focus trap, `Escape`, focus 복귀와 reduced-motion 지원
- map에 목적을 설명하는 accessible name 제공
- map과 동기화된 screen-reader용 선형 관계 table 제공
- table reading order는 목적 중심에서 purpose·account·amount, 계좌 중심에서 account·purpose·amount
- node accessible name에 종류, 이름, 요약 금액, 연결 수와 상태 포함
- pan·zoom이 page scroll을 가로채지 않고 button 대안 제공

## 14. Acceptance Criteria

- v1 workspace와 backup을 data loss 없이 v2로 atomic migration한다.
- Main이 없으면 Account Map state를 만들지 않는다.
- Main 다섯 system purpose를 파생하고 custom purpose는 outflow parent의 하위 breakdown으로만 생성한다.
- 수입 합계 일치 후 초기 설정을 적용하고 draft를 재개·취소할 수 있다.
- 같은 location이 여러 purpose에 연결되고 한 purpose도 여러 location을 가진다.
- remainder 계산, per-purpose unassigned·excess와 overall remaining·deficit이 분리된다.
- Main 변경 후 기존 link는 자동 재분배되지 않고 excess correction을 제공한다.
- 목적 중심 기본 map과 계좌 중심 layout이 동일 node·link를 표현한다.
- transient·pinned·modal 상태가 pointer·keyboard·touch에서 계약대로 전이한다.
- modal shared-element motion, focus 복귀와 reduced-motion이 동작한다.
- 연결 편집·제거가 location과 Portfolio data를 변경하지 않는다.
- 보관·복원이 link를 중지·선택 복구하며 Portfolio data를 변경하지 않는다.
- reset이 Account Map map data만 지우고 registry와 모든 타 앱 slice를 보존한다.
- Account Map 모든 write 전후 Main·Simulation·Portfolio가 deep-equal이다.
- semantic zoom과 선형 관계 table이 390px, 768px와 desktop에서 사용 가능하다.
- v2 backup round-trip과 invalid atomic rejection이 통과한다.

## 15. Required Verification

- schema parser, v1→v2 migration과 unknown-version rejection unit tests
- purpose target, remainder, unassigned, excess와 overall deficit unit tests
- institution·별칭 normalization, active duplicate와 archived restore unit tests
- archive·suspend·restore·representative reassignment contract tests
- repository field-level allowlist와 stale writer tests
- 생성·편집·보관·복원·reset·migration 전후 Main·Simulation·Portfolio deep-equality integration tests
- Portfolio plans와 draft의 serialized byte-equivalence tests
- whole-workspace v1 import, v2 round-trip와 invalid atomic restore tests
- first-run gate, draft resume, review/apply/cancel Playwright tests
- purpose/account layout, semantic zoom, node state machine, modal motion와 reduced-motion Playwright tests
- keyboard·touch·pointer parity와 screen-reader linear table tests
- 390px, 768px와 desktop overflow·focus·touch·map visibility visual checks
- `npm run check`와 영향 앱 전체 E2E
