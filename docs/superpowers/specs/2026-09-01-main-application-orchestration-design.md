# Main Application Orchestration Refactor Design

**Date:** 2026-09-01

**Status:** Approved for implementation

**Scope:** Repository-wide refactor Phase 2의 첫 단위로 Main의 bootstrap, setup command, workspace backup, view-model과 UI effect 경계를 분리한다.

## 1. Goal

Main의 관찰 가능한 동작과 데이터 계약을 유지하면서 `MainApp`에 모여 있는 repository 조정, setup 진행 저장, backup/import/restore, 화면 상태 파생과 브라우저 effect를 책임별 모듈로 나눈다.

이번 작업은 줄 수를 줄이는 것이 목적이 아니다. 각 모듈이 명시적인 입력과 typed result로 통신하고, Main이 다섯 월간 금액을 소유하는 현재 제품 경계와 setup/review 순서를 그대로 유지하는 것이 완료 기준이다.

기준 문서:

- [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [Repository-wide Refactor Design](2026-08-24-repository-wide-refactor-design.md)
- [Shared Foundation Plan](../plans/2026-08-24-repository-refactor-shared-foundation.md)
- [DESIGN](../../../DESIGN.md)

## 2. Current Baseline

현재 `src/main/ui/MainApp.tsx`는 다음 책임을 함께 수행한다.

- repository별 최초 bootstrap Promise와 welcome intro entry 관리
- fresh welcome progress 저장과 reduced-motion intro 완료
- draft 변경, setup 단계 변경과 setup-progress write 직렬화
- 적용, 취소, 처음부터 다시, recovery retry/discard/return command
- whole-workspace export, import candidate 검증과 atomic restore
- restore 성공 뒤 focus 이동
- loading, intro, recovery, setup, dashboard와 관리 메뉴 props 조립
- FileReader, Blob URL과 download anchor 같은 브라우저 작업

기존 application 계층의 `bootstrap.ts`와 `mainReducer.ts`는 bootstrap, apply validation/save와 핵심 상태 전이를 이미 담당한다. 이번 설계는 이 기반을 보존하고 UI 컴포넌트에 남은 application 조정 책임만 단계적으로 이동한다.

현재 `MainApp` 외부 동작은 `tests/unit/main/MainApp.test.tsx`, `tests/unit/main/bootstrap.test.ts`, `tests/unit/main/mainReducer.test.ts`와 Main Playwright 흐름을 기준선으로 삼는다.

## 3. Product Boundaries

다음 계약은 변경하지 않는다.

- Main은 `monthlyNetIncomeWon`, `monthlyHousingWon`, `monthlyLivingWon`, `monthlySavingWon`, `monthlyInvestmentWon`의 유일한 편집 소유자다.
- Main applied와 setup progress는 기존 workspace Main slice와 revision/conflict 규칙만 사용한다.
- setup은 `welcome → income → housing → living → saving-investment → review` 순서를 유지한다.
- fresh·resume·restart intro 의미와 최초 방문·처음부터 다시 조건을 유지한다.
- draft 입력은 즉시 화면에 반영하고 setup-progress 저장 실패가 입력을 막지 않는다.
- apply와 cancel은 먼저 시작한 setup-progress write가 끝날 때까지 기다린다.
- whole-workspace restore는 모든 slice를 검증한 뒤 하나의 revision-aware replace로 적용한다.
- Simulation 이동은 URL navigation만 수행하며 별도 전달 데이터를 저장하지 않는다.
- 문구, DOM 구조, accessible name, focus 순서, Anime.js choreography와 반응형 layout은 변경하지 않는다.

## 4. Non-goals

- Main UI 재설계, 신규 기능 또는 사용자 문구 변경
- MainData, workspace schema, storage key, backup envelope 또는 URL 변경
- Account Map, Simulation, Portfolio orchestration 분리
- Main cashflow bar와 donut geometry 분리; 이는 Phase 3 범위다.
- legacy import, route, selector 또는 storage 제거; 이는 Phase 4 범위다.
- 모든 앱을 감싸는 generic controller, BaseApp 또는 새 전역 상태 도입
- `MainApp` 줄 수를 인위적으로 맞추기 위한 표현 전용 컴포넌트 분할

## 5. Architecture

```text
MainApp
├─ shared operation gate
├─ useMainPlanController
│  ├─ bootstrap / intro lifecycle
│  ├─ MainState / validation / progress warning
│  └─ setup·dashboard·recovery event orchestration
├─ useMainBackupController
│  ├─ import candidate / backup status
│  ├─ export / atomic restore orchestration
│  └─ restore success focus effect
└─ buildMainViewModel
   └─ screen kind / management flags / visible status derivation

application
├─ bootstrapMain
├─ mainSetupCommands
├─ setupProgressQueue
├─ mainBackupCommands
└─ mainViewModel

infrastructure
├─ MainRepository
└─ WorkspaceRepository
```

`MainApp`은 두 controller와 순수 view-model을 조합하고 최종 화면을 선택한다. 다섯 월간 값과 Main 상태는 Main 모듈 밖으로 이동하지 않는다. controller는 markup을 만들지 않으며 application command는 React, DOM과 사용자 문구를 알지 못한다.

### 5.1 Application modules

#### `mainSetupCommands.ts`

- 유효성 검사 뒤 Main draft를 저장하고 `saved | validation-failed | storage-failed` result를 반환한다.
- invalid workspace reset을 수행하고 기존 repository 계약을 넓히지 않은 채 `reset | failed` result를 반환한다.
- validation path를 setup step으로 변환하는 순수 selector를 소유한다.
- 현재 `bootstrap.ts`의 `applyDraft`와 `MainApp.tsx`의 `setupStepForIssue`를 이 경계로 옮긴다.

#### `setupProgressQueue.ts`

- setup-progress save와 clear를 하나의 직렬 queue로 실행한다.
- 실패한 write도 queue tail을 해제해 이후 작업을 계속 실행한다.
- `waitForIdle()`로 apply와 상태 전환이 최신 write 이후 실행되도록 한다.
- repository error를 삼키지 않고 `saved | failed` result로 바꾼다. 사용자 경고 문구는 포함하지 않는다.

#### `mainBackupCommands.ts`

- 문자열 backup을 whole-workspace candidate로 검증한다.
- export 가능한 workspace 또는 load failure code를 반환한다.
- current revision load, candidate replace, Main bootstrap을 하나의 restore command 순서로 실행한다.
- restore는 `restored | conflict | current-invalid | candidate-invalid | unavailable | failed` result를 반환한다. `candidate-invalid`는 기존 오류 문구를 보존할 수 있도록 `json | format | reference | schema` reason을 포함한다.
- File, FileReader, Blob, anchor, focus selector를 import하지 않는다.

#### `mainViewModel.ts`

- `MainState | null`, intro 상태, reduced-motion, validation count, progress-warning 존재 여부와 pending-import/restore-pending 같은 backup code·boolean을 입력받는다.
- 사용자에게 표시할 한국어 progress/backup message 자체는 입력받지 않는다. controller가 code를 문구로 변환하고 view-model은 화면 종류와 capability만 계산한다.
- `loading | intro | recovery | setup | dashboard` screen kind와 management capability를 계산한다.
- callback, repository, React element와 DOM node를 포함하지 않는다.
- cashflow 금액이나 시각화 geometry를 새로 계산하지 않는다.

### 5.2 UI controller and browser adapter

#### `useMainPlanController.ts`

- `MainState`, validation issues, validation attempt, progress warning과 intro entry를 소유한다.
- repository별 최초 bootstrap Promise를 Strict Mode replay에서도 한 번만 생성한다.
- fresh welcome 저장, reduced-motion 완료, apply, cancel, restart와 recovery event를 application command와 reducer action으로 조정한다.
- setup-progress queue 실패 code를 기존 경고 문구로 변환한다.
- MainRepository 인터페이스만 알고 workspace storage나 DOM을 직접 다루지 않는다.

#### `useMainBackupController.ts`

- pending import candidate, backup status와 restore-pending 상태를 소유한다.
- browser adapter가 읽은 문자열을 application command로 전달한다.
- File 선택마다 단조 증가하는 selection generation을 발급한다. 현재 generation의 read 완료만 pending candidate와 status를 변경할 수 있고, 이전 File의 늦은 성공·실패는 더 새로운 candidate 확인이나 restore 성공 뒤에도 무시한다.
- 성공한 restore 결과를 plan controller의 `acceptBootstrapResult` callback으로 전달한다.
- restore 성공 뒤 fresh intro가 있으면 완료를 기다린 다음 기존 우선순위의 focus target을 찾는 UI effect를 소유한다.
- 실패 code를 현재 한국어 오류 문구로 변환하고 candidate와 기존 workspace 보존 여부를 유지한다.

#### `mainBrowserFiles.ts`

- FileReader를 사용해 File을 문자열로 읽는다.
- JSON 문자열을 Blob URL과 임시 anchor로 다운로드한다.
- anchor 제거와 비동기 URL revoke를 항상 수행한다.
- download 성공 여부만 반환하며 product state를 소유하지 않는다.

### 5.3 Shared operation gate

setup apply, cancel, recovery terminal action과 backup restore는 하나의 operation gate를 공유한다. recovery terminal action은 retry apply, invalid-workspace start-empty reset, discard와 current-plan return을 뜻한다. 두 controller가 독립적인 busy flag를 만들지 않는다. 현재 `savingRef`와 동일하게 먼저 시작한 terminal async operation만 gate를 획득하고 완료 시 `finally`에서 해제한다.

draft 변경, setup step 변경과 restart는 busy 여부만 확인하고 progress write를 queue에 추가한다. 이 동작들은 gate를 획득하거나 write 완료까지 gate를 보유하지 않는다. apply/cancel/recovery terminal action과 restore가 queue 또는 repository 작업을 기다리는 동안만 gate가 유지된다.

렌더링용 상태는 기존 `saveStatus`와 `restorePending`을 사용한다. operation gate 자체는 사용자에게 표시되는 새로운 상태가 아니다.

## 6. Data Flow

### 6.1 Bootstrap and intro

```text
mount or repository change
→ repository별 bootstrap Promise 생성 또는 재사용
→ bootstrapMain
→ acceptBootstrapResult
→ MainState + introEntry 갱신
→ view-model이 loading/intro/setup/dashboard/recovery 선택
```

fresh welcome progress는 intro entry ID별 한 번만 queue에 추가한다. reduced motion에서는 intro markup을 mount하지 않고 같은 entry를 완료 상태로 전환한다. restart intro는 현재 applied를 draft로 사용하고 `kind: restart` progress를 저장한다.

restore 결과가 Main 없음이면 fresh intro를 보여 준다. atomic replace가 workspace revision을 한 번 올린 뒤 fresh welcome progress 저장이 정상 흐름으로 별도 실행되어 revision을 한 번 더 올릴 수 있다. restore된 initial/restart progress는 저장된 단계에서 재개하며 intro를 다시 보여 주지 않는다. recovery의 start-empty와 discard는 fresh/restart intro를 합성하지 않고 setup welcome으로 직접 전환한다.

### 6.2 Draft and setup progress

```text
draft 또는 step event
→ 현재 saving gate 확인
→ progress queue에 save 요청
→ validation issue 초기화
→ reducer가 화면 상태 즉시 갱신
```

progress 실패는 draft와 현재 applied를 바꾸지 않는다. 경고를 표시하되 이후 입력과 retry를 허용한다. 성공한 다음 write는 이전 경고를 제거한다.

### 6.3 Apply, cancel and recovery

apply는 operation gate 획득 → progress queue idle 대기 → validation/save command → reducer result 적용 순서다. validation 실패는 첫 issue를 적절한 setup 단계로 보내고 해당 progress를 저장한다. storage 실패는 draft와 applied를 유지하고 `saveStatus: error`만 표시한다.

cancel, recovery discard와 current-plan return은 progress clear가 성공해야 상태를 전환한다. invalid workspace에서 빈 setup을 시작할 때는 exact raw reset이 성공한 뒤에만 recovery를 종료한다.

### 6.4 Backup and restore

```text
File 선택
→ browser adapter 문자열 읽기
→ candidate 전체 검증
→ 사용자 확인 전 pending candidate만 보관
→ operation gate 획득
→ current workspace와 revision load
→ atomic replace
→ Main bootstrap
→ Main 상태 교체 + success status
→ fresh intro가 있으면 완료 대기
→ focus 복원
```

parse 실패, old format, reference/schema invalid, conflict와 storage unavailable은 replace를 실행하지 않거나 성공으로 취급하지 않는다. conflict 후 자동 재시도하지 않으며 기존 workspace를 보존한다. 비동기 File read는 selection generation으로 순서를 판정해 이전 선택의 늦은 성공·실패가 최신 candidate나 더 새로운 restore success status를 덮어쓰지 못하게 한다.

## 7. Error Handling

- application command는 안정적인 result code와 필요한 payload만 반환한다.
- 예상 가능한 validation, conflict, invalid와 unavailable은 exception을 UI까지 던지지 않는다.
- 예상하지 못한 exception은 `failed`로 정규화하고 기존 일반 오류 문구를 사용한다.
- controller가 result code를 기존 사용자 문구, reducer action, warning과 focus 요청에 대응시킨다.
- 실패한 setup-progress 저장은 정상 적용 성공처럼 표시하지 않는다.
- restore 성공 전에는 pending candidate, Main state, 다른 앱 slice를 변경하지 않는다.
- gate를 획득한 terminal async operation과 restore-pending 상태는 `finally`에서 해제한다. draft, step과 restart는 gate를 획득하지 않는다.

## 8. Testing Strategy

새 production module은 테스트를 먼저 작성하고 실패를 확인한 뒤 최소 구현한다.

### 8.1 Focused unit

- `setupProgressQueue`: write 순서, 실패 뒤 queue 지속, clear와 `waitForIdle()` 순서
- `mainSetupCommands`: save 성공, validation issue, repository failure, invalid reset 성공/실패
- `mainBackupCommands`: whole-workspace 검증, current invalid/unavailable, revision conflict, atomic replace, 성공 후 bootstrap
- `mainViewModel`: 다섯 screen kind, intro/reduced-motion 조건, management capability와 saving 상태
- `bootstrap`: fresh/resume/restart/recovery 의미 유지
- `mainReducer`: draft/applied 분리와 save/cancel/restart 상태 전이 유지

### 8.2 Component integration

기존 `MainApp.test.tsx`의 다음 외부 계약을 유지한다.

- Strict Mode bootstrap과 fresh welcome 저장 1회
- reduced-motion intro 생략과 focus
- setup progress 저장 실패 중 입력 가능
- 최신 progress write 이후 apply
- validation 단계 이동과 retry
- recovery retry/discard/current-plan return
- whole-workspace export/import/atomic restore
- File A와 B의 read 완료 순서가 뒤집혀도 최신 선택 B의 candidate/status만 유지
- restore conflict와 기존 raw 보존
- Main 없는 workspace restore의 fresh intro, 별도 welcome progress revision 증가와 intro 완료 뒤 focus
- initial/restart progress restore의 intro 생략과 저장 단계 재개
- recovery start-empty/discard의 intro 없는 setup welcome 직접 전환
- restart가 progress write만 queue에 추가하는 동안 apply/cancel/recovery/restore terminal operation만 shared gate를 획득
- Simulation URL navigation과 edit intent 1회 소비

내부 hook 호출 횟수나 private 상태 구조는 assertion하지 않는다. 실제 MainApp 렌더링과 repository boundary 결과를 검증한다.

### 8.3 Repository and browser verification

각 논리 커밋에서 실행한다.

```text
npm run check
focused application/controller unit
tests/unit/main/MainApp.test.tsx
git diff --check
```

Main 단위 완료 시 실행한다.

```text
npm run test:unit
npm run test:e2e
```

390×844, 768×1024와 1280×900에서 fresh setup, review, dashboard와 recovery의 overflow, focus, touch target과 시각화 visibility를 확인한다. DOM과 CSS를 의도적으로 바꾸지 않지만 controller 추출이 조건부 화면이나 focus timing을 바꿀 수 있으므로 browser 검증을 생략하지 않는다.

## 9. Delivery and Rollback

다음 네 논리 커밋을 각각 green 상태로 유지한다.

1. setup command와 progress queue 추출
2. backup command, browser adapter와 backup controller 추출
3. 순수 view-model과 화면 선택 분리
4. `MainApp`을 최종 coordinator로 정리하고 전체 회귀 검증

각 단계는 기존 external behavior를 유지하며 다음 단계의 전제만 제공한다. 실패 시 마지막 추출 커밋만 revert할 수 있어야 하고, 아직 검증되지 않은 후속 모듈을 함께 되돌릴 필요가 없어야 한다.

storage schema, key, route와 backup format 변경이 감지되면 이 설계 범위를 벗어난 것으로 보고 작업을 중단한다. Main 단위가 완료되어도 Account Map, Simulation, Portfolio Phase 2와 Phase 3–4는 별도 spec과 rollback point를 갖는다.

## 10. Acceptance Criteria

- `MainApp`이 repository write, backup parsing, FileReader와 download 구현을 직접 포함하지 않는다.
- application module이 React, DOM, 사용자 문구를 import하지 않는다.
- controller가 markup이나 앱 외부 write ownership을 소유하지 않는다.
- Main의 다섯 값, setup 순서, intro 조건, draft/applied 구분과 revision/conflict 의미가 동일하다.
- setup-progress write 순서와 apply/cancel 대기 계약이 focused test로 고정된다.
- backup restore가 모든 slice 검증, current revision과 atomic replace 뒤에만 성공한다.
- 이전 File read의 늦은 성공·실패가 최신 import candidate나 더 새로운 restore 성공 상태를 덮어쓰지 않는다.
- Main 없는 workspace restore는 fresh intro와 별도 welcome progress revision을 거친 뒤 focus하며, recovery start-empty/discard는 intro 없이 setup welcome으로 전환한다.
- draft, step과 restart는 shared gate를 획득하지 않고, apply/cancel/recovery terminal action과 restore만 gate를 획득한다.
- 기존 Main unit과 전체 unit/E2E가 통과한다.
- 390px, 768px와 desktop에서 overflow, focus, touch target과 visualization visibility가 유지된다.
- Account Map, Simulation, Portfolio, Phase 3 visualization과 Phase 4 legacy 코드는 변경하지 않는다.
