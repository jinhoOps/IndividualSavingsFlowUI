# Supabase workspace v4 통합 검증

상태: 최신 main 통합 검증 중. 운영 v4 migration 적용과 로컬 main 병합은 아직 수행하지 않았다.

## 기준과 범위

사용자는 최신 main의 v4 기능에 맞추는 구현·실제 Supabase 업그레이드·로컬 main 병합을 승인했다. 최초 기준 main은 `f367a9b`, 작업 중 추가된 main은 `e548d5d`, feature의 기존 완료 지점은 `1695903`, 후속 설계·계획은 `560891b`다. [설계](../specs/2026-09-08-supabase-workspace-v4-integration-design.md)와 [계획](../plans/2026-09-08-supabase-workspace-v4-integration.md)을 따른다. Google 설정·Git push·Pages 배포는 범위 밖이다.

최신 main의 workspace v4, Account Map applied3/draft2 계획 이체와 Journey Main overlay를 유지한다. 기존 SQL 세 개는 수정하지 않고 추가 migration 하나로 DB protocol을 전환한다. 브라우저 v3/v1 원본과 사용자의 package-lock 변경은 보존한다.

## 현재 검증 증거

- `node scripts/test-workspace-db.mjs`: 170 shared TS/SQL fixture, v3 payload/revision/timestamps/receipt 그대로 보존, before-image 접근 격리, 초기 손상·중간 실패 rollback, v4 required RPC·CAS·동시성·RLS·중복 재시도 통과.
- protocol/cache TDD: 새 테스트 9개 실패 확인 후 정상화. Main-null overlay refresh/conflict 2개와 재인증 첫 조회 1개 실패 확인 후 정상화.
- focused workspace/auth: 14개 파일 215개 통과. 이후 추가된 재인증 guard 포함 session/cache 31개 통과.
- `node scripts/test-account-pwa.mjs`: 실제 production 서비스워커 31 shell cache entry, Auth/Data/code URL 캐시 제외, 인증된 오프라인 Main 읽기 전용 통과.
- 독립 SQL 검토와 scoped client 검토: blocker 없음. 전체 UI 통합 검토는 후속으로 수행한다.
- 최초 통합 기준 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·source/unit 타입 검사, 140개 파일·1,302개 단위 테스트 통과. UI 작업 중 확인한 타입 오류는 해결했다. Node의 실험적 localStorage를 끄지 않은 worker 실행은 12개 환경 오류가 있었으므로 성공 증거로 사용하지 않는다.
- cloud focused: 기존 비-Map 계정 흐름 18개 통과. Map 그룹은 9개 통과 후 구 위치 conflict selector 1개를 현재 `최신 상태에서 다시 검토`→`다시 시도` 흐름으로 수정하고 해당 1개 재실행 통과. 실제로 같은 입력과 최신 Main을 보존하며 두 번의 `save_account_map`만 수행함을 확인했다.
- Main overlay는 390/768/1280px에서 서버/로컬 원본 분리, Main-only 저장, map 보존, focus trap/복원·inert 배경·44px control·overflow/containment를 검증했다. overlay의 새로고침/재인증, 위치 생성·편집, 세부 목적 및 fixed/sweep 이체 입력 복구는 자동 전송 없이 유지됐다.
- 이후 추가된 main UI 변경을 통합한 최종 전체 회귀는 별도 실행한다. 기존 Node `module.register()` deprecation과 NO_COLOR/FORCE_COLOR 경고는 도구 실행 경고이며 제품 실패와 구분한다.
- 리뷰에서 확인한 목적 전환·닫기 애니메이션·상위 dialog 취소의 복구 기록 수명 문제를 수정했다. 실제 cloud 목적 전환/일반 모션 닫기 2개 회귀 테스트가 통과했고 scoped 리뷰가 승인했다.
- 손상된 현재 캐시는 정확한 원문을 복구 envelope에 보존하고 유효하지 않은 snapshot/pending을 채택하지 않는다. 복원 응답 유실은 서버 미변경으로 단정하지 않는다. 관련 단위 58개와 서버 저장 후 응답 유실·동일 요청 재시도 cloud 1개가 통과했으며 독립 리뷰가 승인했다.
- 후속 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: 140개 파일·1,309개 통과. Account Map `최신 값 유지` 후 거절된 pending이 Main 저장을 막는 별도 회귀도 수정했다. 명백히 거절된 Account Map conflict만 폐기하고 결과 불명·다른 앱 요청은 유지한다. 실제 cloud `최신 값 유지`→Main overlay 저장→reload→새 Map 저장 테스트는 실패 재현 후 통과했다.

## 운영 사전 확인

TLS 인증서·호스트명 검증을 유지한 session pooler 연결로 기존 migration 3개 source hash 일치, 테이블 소유자 `postgres`, 강제 RLS·기존 schema 제약과 v3 validation을 확인했다. 이 시점 workspace 0개·receipt 0개였다. 실제 적용 직전 transaction 안에서 다시 점검한다. 사용자 금융 데이터를 출력하거나 생성하지 않았다.

운영 적용과 새 일회성 계정의 실제 Auth/REST/두 브라우저 v4 검증은 아직 미수행이다. 테스트 종료 시 정확한 테스트 UID/email의 계정과 종속 행만 정리하고 실제 대상 계정은 보존한다.
