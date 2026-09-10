# Main 지출 계산 도우미

작성일: 2026-09-10. 상태: 사용자 요청에 따라 UI·workspace v5·SQL migration 구현. 로컬 검증 후 운영 DB 적용·Pages 배포·실제 계정 검증까지 완료했다.

기준: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [기존 Supabase v4 통합 설계](2026-09-08-supabase-workspace-v4-integration-design.md).

## 사용자 결정과 진입점

처음에는 다섯 월 금액을 대략 입력한다. 결과의 **지출 금액**을 누르면 지팡이 아이콘의 도우미가 열린다. 금액 아래 `항목별로 계산`을 표시하고, 명칭·비율 영역과 도넛은 항목 탐색을 유지한다. 화면 문구는 `지출`로 통일하며 내부 consumption 계산 키는 유지한다.

다섯 값 전체 수정은 단일 `월 금액 편집`으로 연다. 767px 이하는 화면 아래 고정된 접힌 바에서 기존 bottom sheet를 열고, 768px 이상은 요약 카드 하단 버튼에서 우측 편집 패널을 연다. 바는 항상 보이며 탭·키보드로 작동한다. 드래그 제스처는 구현하지 않는다. 결과 행마다 같은 편집기를 여는 연필은 반복하지 않는다. 직접 편집 중이거나 미반영 Main 초안이 있으면 도우미를 중첩해서 열지 않는다.

## 질문과 완료

- 한 화면에서 한 항목을 묻고 고정비 → 변동비 순으로 진행한다. 질문 번호와 월평균 소계를 표시한다.
- 빈 답변(null)과 명시적인 0원(`없어요`)을 구분한다. 월 금액 또는 연간 총액으로 답하며 원금액과 기간을 기억한다. 기간만 고르는 행동은 0원 답변이 아니다.
- `다음`, `이전`, 변경 후 닫기에서 답변과 현재 단계를 저장한다. 단순 방문은 서버 write를 만들지 않는다. 계정 세션의 미전송 입력 복구는 다음/이전 전에 입력한 값도 보관한다.
- 마지막에는 13개 내역과 주거·생활·월 지출 합계를 표시한다. 각 내역에서 해당 질문으로 바로 돌아가고 수정 후 내역으로 복귀할 수 있다. 미완료 재방문은 저장한 질문에서, 완료 재방문은 내역에서 시작한다.
- **`이 금액으로 반영`은 직접 입력했던 주거비와 생활비를 항목 합계로 덮어쓴다.** 기존 금액에 더하거나 유지/대체 선택을 추가하지 않는다. “직접 입력한 주거비와 생활비를 이 합계로 바꿔요”라고 설명한다.
- 직접 금액을 다시 바꿔도 답변을 지우지 않는다. 다음 도우미 완료 역시 새 합계로 덮어쓴다. 수입·저축·투자는 유지한다.
- 정상 완료와 닫기는 진입 금액으로 focus를 복원한다. 도우미는 767px 이하 bottom sheet, 768px 이상 우측 modal panel이며 배경을 비활성화하고 focus를 가둔다. 오류는 입력을 보존하며 결과 불명·revision 충돌은 패널 내부에서 기존 계정 재시도/명시 재적용 흐름으로 해결한다. 재시도 성공은 계정의 확정 snapshot으로 화면을 다시 연다.

## 고정된 질문 ID와 합산 대상

고정비/변동비는 기억을 돕는 질문 그룹이다. Main의 기존 주거비/생활비 필드 의미를 바꾸지 않는다.

| ID | 질문 항목 | 그룹 | 합산 대상 |
| --- | --- | --- | --- |
| rent | 월세 | 고정비 | 주거 |
| housingInterest | 주거 대출 이자 | 고정비 | 주거 |
| maintenance | 관리비 | 고정비 | 주거 |
| insurance | 보험료 | 고정비 | 생활 |
| telecom | 통신비 | 고정비 | 생활 |
| subscriptions | 정기 구독 | 고정비 | 생활 |
| utilities | 공과금 | 변동비 | 주거 |
| food | 식비 | 변동비 | 생활 |
| transport | 교통비 | 변동비 | 생활 |
| occasions | 경조사비 | 변동비 | 생활 |
| leisure | 여가비 | 변동비 | 생활 |
| otherHousing | 그 밖의 주거비 | 변동비 | 주거 |
| otherLiving | 그 밖의 생활비 | 변동비 | 생활 |

관리비에 포함된 공과금은 다시 입력하지 않도록 안내한다. 월세와 대출 이자는 각각 답할 수 있다. 목적별로 모든 연간 환산 금액을 더한 뒤 12로 나누어 원 단위 반올림을 한 번만 한다. TypeScript BigInt와 SQL numeric을 사용하며 음수·소수 원금액·안전 정수 초과·합계 범위 초과는 거부한다.

## 저장 계약과 원자적 적용

별도 항목 테이블 대신 계정당 하나의 `public.user_workspaces` JSONB를 **workspace v5**로 확장한다. Main은 기존 applied의 다섯 값에 더해 보조 입력 내역을 소유한다. 다른 앱은 계속 Main applied만 읽는다.

```text
main.applied                 기존 MainData v2 다섯 금액
main.setupProgress           기존 초기 설정 진행
main.expenseAssistant        null 또는 아래 객체
  schemaVersion: 1
  draft
    answers                  정확히 13개 ID: null 또는 {amountWon, period: month|year}
    step                     항목 ID 또는 review
    updatedAt                초안 시각
  lastApplied                null 또는 {answers, appliedAt}
```

`save_expense_draft`는 답변/진행만 저장한다. `apply_expense`는 서버에서 합산하여 주거비·생활비·lastApplied를 한 번의 revision 안에서 원자적으로 저장한다. 요청에 들어 있는 다른 Main 금액을 신뢰하지 않고 최신 서버 Main을 기준으로 반영한다. 초안 저장은 Main applied.updatedAt을 바꾸지 않고, 완료도 두 금액이 실제 바뀐 경우에만 이를 증가시킨다. 다른 앱이나 slice에는 write-back하지 않는다.

모든 RPC는 protocol 5를 요구한다. 기존 `save_main`은 도우미 내역을 임의 변경·삭제할 수 없다. CAS와 mutation receipt는 이전 계약을 유지하며 같은 완료 요청 재시도는 중복 합산·중복 revision을 만들지 않는다. 원격 완료 응답이 유실되면 성공/실패를 단정하지 않고 같은 mutation 결과를 다시 확인한다. 다른 기기의 변경은 사용자가 최신 상태에서 명시적으로 재적용하며 최신 수입·저축·투자를 보존한다.

## 호환성

- [신규 migration](../../../supabase/migrations/202609100001_workspace_v5_expense_assistant.sql)은 v4 before-image를 private backup 테이블에 남긴 뒤 기존 금액·revision·시각·다른 slice를 보존하고 `expenseAssistant: null`을 추가한다. 기존 migration 파일은 수정하지 않는다.
- 브라우저 현재 키는 `isf-workspace-v5`다. 없을 때만 v4 → v3 → retired v1/v2 순으로 읽기 전용 변환한다. 존재하는 최신 원본이 invalid면 이전 버전으로 fallback하지 않는다. 원본을 삭제·변경하지 않고 명시 저장 시 source/destination lock 안에서 v5를 만든다.
- 현재 계정 캐시는 `isf-account-workspace-v3`/cache version 3이다. 구 v2(v4)·v1(v3) snapshot을 변환하되 미전송 요청은 자동 재생하지 않고 복구 원문으로 격리한다.
- 현재 백업은 format 4/workspace v5이며 답변을 포함한다. format 3/v4, format 2/v3, format 1/retired input은 역사적 strict parser를 거쳐 변환한다. 모든 slice·참조 검증 후 전체를 원자적으로 교체한다.

## 검증과 운영 적용

관련 검증: `npm run check`, unit suite, `tests/account-workspace.spec.ts`의 expense group, 전체 Playwright, `node scripts/test-workspace-db.mjs`, `node scripts/test-account-pwa.mjs`. Node 26 환경의 Vitest는 `NODE_OPTIONS=--no-experimental-webstorage`를 사용한다.

운영 적용 전에는 이 문서와 [SQL migration](../../../supabase/migrations/202609100001_workspace_v5_expense_assistant.sql)을 검토하고 계정 저장 운영 담당자가 DB migration과 v5 frontend 배포를 같은 변경 창에서 진행한다. v4 클라이언트 쓰기는 의도적으로 차단되므로 열린 이전 앱은 새로고침이 필요하다. 2026-09-10 운영 적용과 실제 저장·두 브라우저 동기화를 완료했다. [운영 기록](../evidence/2026-09-10-expense-assistant-production-rollout.md)은 로컬 DB/모의 인증 테스트와 구분한다.
