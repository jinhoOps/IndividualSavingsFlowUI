# Supabase Workspace v4 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 최신 main의 workspace v4·Account Map을 계정 저장에 통합하고 운영 DB 적용 후 로컬 main에 병합한다.
**Architecture:** 새 SQL migration이 기존 v3 행을 보존하며 v4 protocol로 전환한다. 계정 session은 v4 repository와 별도 세대 캐시를 제공하고 Journey가 Main/Account Map scope를 분리한다.
**Tech Stack:** PostgreSQL 17, Supabase JS, React, TypeScript, Vitest, Playwright.
**Spec:** [v4 통합 설계](../specs/2026-09-08-supabase-workspace-v4-integration-design.md)

## Global Constraints

- 정적 웹, 계정당 workspace 하나, Main/Account Map 소유권을 유지한다.
- 기존 migration 세 개와 브라우저 v3/v1 원본은 변경하지 않는다.
- v4 요청만 쓰기 가능하며 구 RPC signature와 default/overload를 남기지 않는다.
- 기존 서버 payload/revision/timestamps/receipt와 사용자 package-lock 변경을 보존한다.
- 커밋 작성자는 KIM JINHO <okho04@gmail.com>이다. 비밀번호·토큰은 파일에 넣지 않는다.
- root가 merge index와 커밋을 단독 소유한다. worker는 소유 파일만 수정하고 테스트 결과를 보고한다.
- push·Pages 배포·Google 설정은 수행하지 않는다.

### Task 1: 최신 main 통합 기반

**Files:** merge의 9개 충돌 파일, PRD/README/DESIGN, `src/journey/accountMap.tsx`.
**Interfaces:** main v4 도메인·repository·Journey를 유지하며 기존 Auth gate를 연결할 위치를 보존한다.

- [x] `git status`, main/feature SHA와 user lock diff를 기록한다. 필요 시 package-lock 한 파일만 복구 가능한 stash에 보존한다.
- [x] `git merge --no-commit main`으로 현 feature 브랜치에 main을 가져온다. Account Map UI는 최신 main을 기준으로 두고 계정 복구 기능을 Task 4에서 다시 연결한다.
- [x] PRD는 v4 기능+계정 저장을 함께 기술한다. 최신 기능 삭제로 충돌을 해결하지 않는다.
- [x] `npm run check`로 통합 시점 오류를 기록한다. 정상화 전 main branch를 변경하거나 merge commit을 만들지 않는다.

### Task 2: v4 SQL migration과 회귀

**Files:** create `supabase/migrations/202609080002_workspace_v4.sql`; modify `supabase/tests/workspace-fixtures.mjs`, `scripts/test-workspace-db.mjs`.
**Interfaces:** 여섯 RPC 입력에 required `p_schema_version: 4`; 결과는 기존 saved/exists/conflict/invalid와 row metadata를 유지한다. Active validator는 `private.normalize_workspace_v4(jsonb)`다.

- [x] v4 applied3/draft2 fixed/sweep·suspended·cycle·archived·duplicate·zero·safe-integer·NFC fixture를 추가하고 기존 DB의 실패를 확인한다.
- [x] fixture runner가 v3 행·receipt를 먼저 만든 뒤 새 migration을 적용해 payload/revision/timestamp 동일성과 before-image 보존을 검증하게 한다.
- [x] before-image 테이블, v4 정규화, metadata-only 업그레이드, schema 제약/기본값, required-version RPC를 한 추가 migration에 구현한다.
- [x] 아래 계약을 실제 PostgreSQL에서 검증한다.

```js
assert.equal(rpc('save_account_map', v4Payload, revision, mutation, 4).status, 'saved');
assert.equal(rpc('save_main', mainPayload, revision, mutation, 3).status, 'invalid');
assert.throws(() => callOldSignature(), /does not exist/);
assert.deepEqual(after.payload, before.payload);
assert.equal(after.revision, before.revision);
```

- [x] `node scripts/test-workspace-db.mjs` 전체 및 독립 SQL 리뷰를 통과한다. 원격 DB는 root의 Task 6 이전에 수정하지 않는다.

### Task 3: 원격 v4·캐시 세대·이전 호환

**Files:** `src/workspace/infrastructure/workspaceRemote.ts`, `accountWorkspaceSession.ts`, `accountWorkspaceCache.ts`, `src/auth/accountTab.ts`, `AccountWorkspaceGate.tsx`; 관련 workspace/auth unit tests와 cloud fixture.
**Interfaces:** `workspaceFromRow`는 schema4만 채택; transport는 required version4; 새 cache prefix와 구 기록 복구는 UID·project·tab 격리 유지.

- [x] v4 row hydration, v3/future row 거절과 전송 `p_schema_version: 4` 테스트를 먼저 작성한다.
- [x] v3 캐시의 pending을 v4로 재전송하지 않고 보존/다운로드하는 테스트, invalid 새 캐시의 구 캐시 fallback 금지, logout의 양쪽 세대 제거를 작성한다.
- [x] decoder/session의 version3 가정을 current v4 계약으로 변경하고 cache namespace를 분리한다. 원격 v3에 자동 initialize/restore하지 않는다.
- [x] 최신 브라우저 v4/v3/v1 이전과 backup v3/v2/v1 roundtrip을 검증한다.
- [x] `npm run check`와 focused workspace/auth 단위 테스트를 통과한다.

### Task 4: 최신 Account Map Journey 계정 연결

**Files:** `src/auth/productRepositories.ts`, `src/journey/accountMap.tsx`, `src/journey/ui/AccountMapJourney.tsx`, `MainPlanEditOverlay.tsx`, `src/account-map/ui/AccountMapSetup.tsx`, `AccountMapModal.tsx`, `AccountMapLocationPicker.tsx`, `AccountTransferEditor.tsx`; 관련 unit/E2E tests와 `tests/support/legacy.vite.config.ts`.
**Interfaces:** Journey에 `mainRepository: new BrowserMainRepository(session.scope('main'))`와 Account Map scope를 별도 주입한다.

- [x] cloud Journey의 Main overlay 저장이 `save_main`만 호출하고 로컬 workspace를 쓰지 않는 테스트를 작성한다.
- [x] transfer/location/setup/overlay의 미전송 입력이 새로고침·만료 후 복구되고 임의 자동 저장되지 않는 테스트를 작성한다.
- [x] 최신 main UI를 유지하며 AccountDraftContext를 연결하고 복구 값의 형태를 검증한다. Account Map Main-null은 replay를 폐기한다.
- [x] focused unit/cloud E2E 및 390px·768px·1280px에서 overlay containment·focus·44px targets를 확인한다.

### Task 5: 통합 검증·리뷰·커밋

**Files:** 관련 docs, evidence, plan 체크리스트; 필요 시 통합 실패에 해당하는 파일만 수정.

- [x] `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`.
- [x] `npm run test:e2e -- --reporter=list`, `node scripts/test-workspace-db.mjs`.
- [x] `npx vite build`, `node scripts/test-account-pwa.mjs`.
- [x] 전체 통합 diff를 독립 리뷰하고 기능·데이터·보안 blocker를 해결한다.
- [x] 상대 링크·`git diff --check`·비밀정보 제외를 확인하고 지정 author로 merge 및 통합 변경을 커밋한다. 사용자 lock diff는 제외·복원한다.

### Task 6: 실제 DB 전환과 main 병합

**Files:** 운영 검증 기록과 runbook. 실제 DB 작업은 root 단독 수행.

- [ ] TLS 검증 연결로 기존 migration hash·사용자 행·schema·검증 가능 여부를 점검한다. payload나 credentials를 로그에 출력하지 않는다.
- [ ] 검증된 202609080002 SQL만 transaction으로 적용하고 history·schema reload·행/receipt/before-image 보존을 확인한다.
- [ ] 새 테스트 계정과 두 브라우저로 v4 transfer 저장/reload·Main overlay·CAS·RLS·old RPC 차단을 검증하고 테스트 데이터만 정리한다.
- [ ] main이 새로 움직였으면 다시 통합·검증한다. 검증된 branch를 clean local main에 fast-forward/명시적 merge하고 결과 tree를 확인한다.
- [ ] 운영·Git 결과와 남은 Google/Pages 범위, 검증 명령·결과를 기록해 인계한다.
