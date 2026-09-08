# Supabase workspace v4 통합 검증

상태: 최신 main `e548d5d` 통합, 실제 Supabase v4 적용·검증과 로컬 main 병합 완료. 검증·적용한 코드 커밋은 `6322df2`다. Git push·Pages 배포·Google provider 설정은 수행하지 않았다.

## 기준과 범위

사용자는 최신 main의 v4 기능에 맞추는 구현·실제 Supabase 업그레이드·로컬 main 병합을 승인했다. 최초 기준 main은 `f367a9b`, 작업 중 추가된 main은 `e548d5d`, feature의 기존 완료 지점은 `1695903`, 후속 설계·계획은 `560891b`다. [설계](../specs/2026-09-08-supabase-workspace-v4-integration-design.md)와 [계획](../plans/2026-09-08-supabase-workspace-v4-integration.md)을 따른다. Google 설정·Git push·Pages 배포는 범위 밖이다.

최신 main의 workspace v4, Account Map applied3/draft2 계획 이체와 Journey Main overlay를 유지한다. 기존 SQL 세 개는 수정하지 않고 추가 migration 하나로 DB protocol을 전환한다. 브라우저 v3/v1 원본과 사용자의 package-lock 변경은 보존한다.

## 최종 통합 검증

- `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·source/unit 타입 검사, 140개 파일·1,317개 테스트 통과.
- `npm run test:e2e -- --reporter=list`: 160개 통과, 1개 skip. skip은 일반 E2E가 service worker를 차단하기 때문에 실행하지 않는 기존 PWA 전용 사례이며 성공 수에 포함하지 않았다. cloud 30개는 모두 통과했다.
- `node scripts/test-workspace-db.mjs`: 170 fixture와 전체 PostgreSQL 이전·RLS·RPC·동시성 회귀 재실행 통과.
- `npx vite build`: production build와 callback 산출물 생성 통과. 버전 bump 없음.
- `node scripts/test-account-pwa.mjs`: 별도 실제 production 서비스워커 30 shell cache entry, Auth/Data/code URL 제외, 인증된 오프라인 Main 읽기 전용 통과.
- 최신 main의 직접 계좌 편집·focus 복원·금액 설명·시각 계층과 계정 복구 기능을 함께 보존했다. 최종 cloud overlay 390/768/1280px screenshot을 직접 확인했고, E2E의 overflow·containment·focus·44px target 검증이 통과했다.
- 최종 운영 기록을 포함한 변경 문서 12개의 상대 링크 94개, staged/worktree `git diff --check`, 빌드·최종 문서 credential scan 통과. 원래 사용자 package-lock 전체 JSON이 통합 index와 정확히 일치함을 확인한 뒤 이번 작업의 임시 stash만 정리했다. 기존 사용자 stash 세 개는 보존했다.
- 독립 검토에서 Critical/Important 미해결 없음. Minor 후속 항목은 아래에 기록했다.

## 개발 중 검증 증거

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

## 실제 운영 적용과 로컬 main

TLS 인증서·호스트명 검증을 유지한 session pooler 연결로 기존 migration 3개 source hash 일치, 테이블 소유자 `postgres`, 강제 RLS·기존 schema 제약과 v3 validation을 확인했다. 이 시점 workspace 0개·receipt 0개였다. 실제 적용 직전 transaction 안에서 다시 점검한다. 사용자 금융 데이터를 출력하거나 생성하지 않았다.

독립 리뷰 승인 뒤 커밋 `6322df2`의 네 번째 migration을 실제 프로젝트에 적용했다. 적용 transaction 안에서도 기존 migration 세 개 hash·권한·강제 RLS·v3 validation을 재확인했고, workspace 0개·receipt 0개였다. `202609080002_workspace_v4.sql`의 SHA-256은 `0eca8b4322fb48e88d442ecbf148ee216458e924cad1f61da777c1963ba62101`이며 committed source·운영 history와 일치한다. schema4·before-image 접근 격리·기존 행/receipt fingerprint 보존 검증 후 COMMIT했다. 기존 행이 없어 생성된 before-image도 0개다.

실제 Auth/REST/PostgreSQL와 별도 일회성 계정으로 다음을 검증했다.

- 실제 대상 계정의 비밀번호 인증과 비변경 진입·로그아웃. 작업 전후 workspace fingerprint 동일.
- 운영 DB의 170 shared validator fixture와 여섯 required-v4 RPC. 모든 구 signature와 version3/5/null 요청 거절.
- 기존 workspace initialize 차단, stale revision·동시 쓰기·동일 요청 재시도와 invalid reference rollback.
- 타 계정 행 비노출, 익명 접근과 authenticated 직접 INSERT/UPDATE/DELETE 거절.
- 두 독립 브라우저의 저장·focus 갱신·reload, 네 제품 진입, native fixed/sweep 저장 유지와 Account Map Journey의 `save_main` 전용 overlay 저장. Account Map은 바뀌지 않고 두 번째 브라우저 Main만 동기화됨.
- 테스트 종료 후 정확한 일회성 UID/email의 Auth 계정·workspace·receipt를 제거하고 남은 종속 행이 없음을 확인. 실제 대상 계정은 보존했으며 대신 금융 계획을 생성하지 않음.

마지막 fetch에서 local/origin main 모두 `e548d5d`이고 main checkout이 clean임을 확인한 뒤 `6322df2`로 fast-forward했다. main checkout에서 `npm ci`와 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`를 재실행해 harness·타입·140개 파일/1,317개 테스트가 통과했다. 이 기록을 포함하는 후속 커밋은 문서만 변경하며 같은 local main에 추가 fast-forward한다. 원격 push나 배포는 하지 않는다.

## 비차단 후속 항목

Account Map 충돌 안내를 연 뒤 추가 polling으로 session이 더 새 revision을 알게 된 경우, `최신 값 유지` 직후 화면은 충돌 당시 snapshot을 표시할 수 있다. CAS는 오래된 덮어쓰기를 계속 차단하며 Main overlay 저장·reload·이후 새로 관찰한 더 높은 revision에서 갱신된다. 같은 revision의 일반 polling만으로 갱신된다고 보장하지 않는다. 독립 리뷰의 Minor 후속 사항으로 남긴다. 다음 담당자는 Account Map/계정 session 개발자이며, 충돌 종료 시 이미 알려진 session snapshot으로 UI를 갱신하는 범위를 검토한다.

main의 `npm ci`에서 개발·빌드 의존성 audit 13건(High 8, Moderate 4, Low 1)을 확인했다. `npm audit --omit=dev --json`은 0건으로 통과했다. 잠금 파일 버전은 바꾸지 않았으며 Vite 등을 포함한 개발 도구 업데이트는 별도 의존성 관리 작업으로 남긴다. Google 실제 왕복·운영 세션 만료·Pages 배포 검증은 [운영 안내](../../supabase-account-setup.md)의 미완료 rollout gate를 따른다.
