# 지출 도우미 workspace v5 운영 적용

2026-09-10 사용자 후속 진행 요청으로 운영 DB 전환과 공개 앱 배포를 완료했다. [설계](../specs/2026-09-10-main-expense-assistant-design.md)와 [운영 안내](../../supabase-account-setup.md)의 후속 증거다.

## 적용과 원본 보존

- 운영 Supabase 프로젝트 `fqongmuyfmxjqmefekbg`의 인증된 SQL Editor에서 PostgreSQL 17.6, 테이블 소유자와 강제 RLS, 정상 v4 한 행, 기존 네 migration의 원본 SHA-256 일치를 확인했다. 금융 payload는 출력하지 않았다.
- [202609100001 migration](../../../supabase/migrations/202609100001_workspace_v5_expense_assistant.sql)과 적용 이력을 한 트랜잭션으로 기록했다. 원본 SHA-256은 `904c13835ff850682fe11b4d41d51997bc237987a8f0179305f68a9e9ee47bcd`다.
- 정상 v5 한 행과 정확한 v4 before-image 한 행을 확인했다. schema 전환과 `expenseAssistant: null` 추가를 제외한 payload·revision·timestamps는 before-image와 완전히 일치했다. 기존 receipt의 전체 해시도 동일했다.
- 신규 두 RPC는 `workspace_rpc_owner` 소유·SECURITY DEFINER·빈 search_path·authenticated 실행 전용이다. anon 실행 금지와 두 저장 테이블의 FORCE RLS를 확인했다.
- DB 적용 후 앱 commit `94c7f477dfe4cb532f56a09a801d5a565db38b4a`를 main에 push했다. [Pages 실행 34432399412](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/34432399412)과 [CI 실행 34432399400](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/34432399400)이 성공했다. 공개 manifest는 `0.11.95`이며 설치 설명도 ‘지출’로 표시한다. 이 기록 이후의 문서 commit은 앱·SQL을 변경하지 않는다.

공개 주소: [Main](https://jinhoops.github.io/IndividualSavingsFlowUI/apps/main/).

## 실제 계정 검증

Supabase Dashboard에서 이메일 확인이 완료된 일회성 테스트 계정을 만들었다. 초대·확인 이메일은 보내지 않았다. 공개 Pages와 실제 Supabase를 사용하는 두 독립 Chromium 문맥에서 검증했으며 HTTP mock이나 인증 우회는 사용하지 않았다.

- 실제 이메일·비밀번호 로그인과 protocol 5 최초 workspace 저장 통과.
- 첫 답변 저장 후 새로고침 및 다른 브라우저에서 다음 질문 재개 통과. 중간 답변 저장은 기존 Main 금액과 적용 시각을 바꾸지 않았다.
- 13개 월/연 답변 완료 후 주거 90만 원·생활 60만 원으로 대체했다. 수입·저축·투자와 다른 slice는 보존했고 예상 revision 증가와 일치했다.
- 다른 브라우저 focus 갱신과 완료 내역의 연간 답변 재방문 통과.
- 전체 편집에서 생활비를 직접 바꾸어도 기존 답변은 유지됐다. 식비 답변을 수정하고 다시 완료하면 생활비 65만 원·총 지출 155만 원으로 대체되며 새로고침 후에도 동일했다.
- 실제 expense RPC의 동일 mutation 재시도는 revision을 한 번만 증가시켰다. stale revision은 conflict, 구 protocol은 invalid, 직접 테이블 쓰기와 익명 RPC는 거부됐다. 요청에 담긴 오래된 저축 금액은 서버의 최신 Main을 덮어쓰지 않았다.
- Main 390px·768px·1280px의 가로 넘침 없음, Simulation·Portfolio·Account Map 공개 경로 진입과 브라우저 page error 0건을 확인했다.
- 테스트 계정 삭제 후 Auth·workspace·receipt 잔여가 모두 0건이었다. 실제 사용자 workspace와 receipt는 검증 전과 동일했고 v4 원본 백업도 보존됐다. 테스트 비밀번호 임시 파일은 삭제했다.

[390px](../../reviews/2026-09-10-main-refinement/production-result-390.png) · [768px](../../reviews/2026-09-10-main-refinement/production-result-768.png) · [1280px](../../reviews/2026-09-10-main-refinement/production-result-1280.png) · [검증 항목 JSON](../../reviews/2026-09-10-main-refinement/production-verification.json).

최초 운영 검증 스크립트는 직접 편집의 서버 확정 전에 값을 비교했고, 다른 브라우저에서 닫으며 저장한 질문 위치를 놓쳤다. 서버 확정을 기다리고 저장된 질문에서 ‘내역으로’ 돌아오는 실제 흐름에 맞춰 해당 구간을 다시 검증했다. 제품 코드는 수정하지 않았으며 초기 저장·완료·두 브라우저 구간과 최종 직접 편집·재적용 구간을 합쳐 위 결과를 확인했다.

## 로컬 회귀와 남은 범위

배포 전 `npm run check`, `NODE_OPTIONS=--no-experimental-webstorage npx vitest run`(142개 파일·1,330개 테스트), `npx playwright test --max-failures=5`(169 통과·1 skip), `node scripts/test-workspace-db.mjs`, `node scripts/test-account-pwa.mjs`, 운영 공개 설정의 `npx vite build`, `git diff --check`가 통과했다. E2E skip은 별도 PWA 프로젝트용 offline gate이며 production PWA 스크립트를 따로 실행했다. 세부 로컬·시각 검증은 [Design QA](../../../design-qa.md)를 따른다.

기존에 열어둔 protocol 4 앱은 새로고침해야 한다. Google provider 설정·실제 왕복, 사용자 설치 PWA의 업데이트, 별도 실제 세션 만료 시나리오는 이번 검증 범위가 아니다. 다음 운영 담당자는 [운영 안내](../../supabase-account-setup.md)의 남은 항목에서 시작한다. v5 이후 쓰기가 발생했으므로 v4 before-image를 그대로 복원하지 않고 최신 데이터 보존과 차이를 먼저 검토한다.
