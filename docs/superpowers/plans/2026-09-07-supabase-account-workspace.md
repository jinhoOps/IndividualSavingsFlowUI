# Supabase Account Workspace Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement each task. Record verification before commits.

**Goal:** Google 계정의 workspace를 Supabase에 저장하고 정적 MPA의 네 제품에서 안전하게 사용한다.
**Architecture:** PostgreSQL RLS와 revision RPC가 서버 저장을 소유한다. 프런트엔드는 세션 gate 뒤에 동기식 snapshot read와 소유 slice에 한정한 write adapter를 주입한다.
**Tech Stack:** React, TypeScript, Vite MPA, supabase-js, PostgreSQL, Vitest, Playwright.
**Spec:** [Supabase 계정별 저장](../specs/2026-09-07-supabase-account-workspace-design.md)

**실행 결과:** 로컬 구현·검증 완료. [검증 기록](../evidence/2026-09-07-supabase-account-workspace.md)에 명령, 결과, 리뷰와 미수행 운영 항목을 기록했다. 아래는 실행 당시 task 체크리스트이며 운영 rollout을 완료했다는 의미가 아니다.

## Global Constraints

- 정적 웹 배포, workspace schema v3, backup format v2를 유지한다.
- Main만 다섯 월 금액을 쓴다. Account Map만 locations와 accountMap을 함께 쓴다.
- 로그인 후 편집·저장, 계정당 workspace 하나, 서버 저장 확정 후 성공 표시.
- 기존 로컬 원본과 foreign record를 읽기 전용 이전 후보로 보존한다.
- 운영 데이터, OAuth provider 설정, 배포는 로컬 구현·검증과 구분해 보고한다.
- 커밋 작성자는 KIM JINHO <okho04@gmail.com>이다.
- 기존 package-lock의 hasInstallScript 변경은 보존한다.

## Wire contract

DB row: `{user_id, schema_version, revision, payload, created_at, updated_at}`.
payload: `{main, simulation, portfolio, locations, accountMap}`; metadata 제외.
RPC: `initialize_workspace(p_payload, p_mutation_id)`, 나머지 함수는 `(p_expected_revision, p_payload, p_mutation_id)`.
`save_main`, `save_simulation`, `save_portfolio`의 p_payload에는 해당 key 하나만 들어간다. `save_account_map`에는 locations/accountMap만, `restore_workspace`에는 전체 payload를 넣는다.
RPC JSON 결과: `{status: 'saved'|'exists'|'conflict'|'invalid', workspace?: row, committed_revision?: number}`. receipt 재시도에는 현재 row와 원래 committed_revision을 반환한다. 미인증 호출은 권한 오류다.

### Task 1: PostgreSQL persistence and validation

**Files:** `supabase/migrations/202609070001_workspace_validation.sql`, `supabase/migrations/202609070002_account_workspaces.sql`, `supabase/tests/`, `scripts/test-workspace-db.mjs`.
**Interfaces:** 위 Wire contract를 구현한다. TS 소비자는 SQL role이나 receipt에 직접 접근하지 않는다.

- [x] PostgreSQL integration test로 anon, A/B 격리, 직접 DML 차단, revision 충돌, 같은 mutation ID 중복, 초기화 경쟁, invalid reference rollback을 작성하고 미구현 실패를 확인한다.
- [x] private validators와 current TS 도메인과 동일한 fixture를 사용한다. numeric 범위·exact keys·초안·참조·Main 감소 후 초과 허용을 검사한다.
- [x] RLS SELECT, 전용 NOLOGIN 함수 역할, 제한된 grants, 빈 search_path, auth.uid() 검사를 구현한다.
- [x] RPC는 row lock, receipt hash 검사, revision 비교, 전체 검증, update와 receipt 기록을 한 transaction으로 실행한다.
- [x] 실제 PostgreSQL에서 `node scripts/test-workspace-db.mjs`로 검증하고 migration과 시험 결과를 검토한다.

### Task 2: Remote workspace session and typed write scopes

**Files:** `src/workspace/infrastructure/{workspaceRemote,accountWorkspaceSession,accountWorkspaceCache}.ts`, `tests/unit/workspace/accountWorkspaceSession.test.ts`.
**Interfaces:** `WorkspaceRemote.read(): Promise<unknown|null>`, `write(operation, expectedRevision, payload, mutationId): Promise<RemoteCommit>`; `AccountWorkspaceSession.scope('main'|'simulation'|'portfolio'|'account-map'|'restore'): WorkspaceRepository`.

Scope repository는 기존 호출자 계약을 유지하되 candidate가 소유 slice 외를 바꾸면 거부한다. `replace`도 scope RPC로 제한한다. 복원 scope만 전체 payload를 전송한다.

```ts
expect(await mainScope.update(0, w => ({...w, simulation: changedSimulation})))
  .toEqual({status: 'invalid'});
```

- [x] hydrate 이전 unavailable, row 변환/검증, scoped write 거부, 성공 전 snapshot 불변, conflict, timeout retry ID 불변 테스트를 먼저 실행한다.
- [x] snapshot은 서버 응답에서만 채택하고 낮은 revision/폐기된 세션 응답은 무시한다.
- [x] 계정별 캐시·미확정 요청 기록·세션 종료 정리를 구현한다. cache 실패는 server commit 성공을 취소하지 않는다.
- [x] `npx vitest run tests/unit/workspace/accountWorkspaceSession.test.ts`와 `npm run check`를 실행한다.

### Task 3: Auth gate, migration and product composition

**Files:** `src/auth/`, `apps/auth/callback/index.html`, 네 제품 entry, `src/components/common/AppShell.tsx`, `src/main/ui/MainApp.tsx`, `vite.config.ts`, `.env.example`, `package.json`.
**Interfaces:** gate가 authenticated session과 scoped repository들을 주입한다. 제품은 auth SDK를 직접 호출하지 않는다.

```tsx
<AccountWorkspaceGate>{session => <MainApp
  repository={new BrowserMainRepository(session.scope('main'))}
  workspaceRepository={session.scope('restore')}
/>}</AccountWorkspaceGate>
```

- [x] callback URL 정리와 경로 allowlist, 로딩 중 child 미노출, 읽기 실패/빈 상태 구분, 명시적 이전 테스트를 먼저 실행한다.
- [x] PKCE와 `detectSessionInUrl: false`, 세션 확인, callback code 단일 교환, 계정 변경 generation 폐기 구현.
- [x] 초기화 이전/새 시작, 계정 메뉴, raw/정상 백업, 로그아웃 pending 처리, 재시도와 복구 UI 구현.
- [x] focus/online/visible 30초 polling과 BroadcastChannel 갱신을 연결한다. 외부 갱신 중 입력은 유지하고 명시적 최신 상태 채택/재적용을 제공한다.
- [x] 저장된 화면 갱신, 초안 복구, 오프라인 조회·편집 차단과 Main-null 예외를 검증한다.
- [x] 초기 Main module-level local repository 생성은 lazy fallback으로 옮긴다. production 네 entry는 모두 scoped remote를 전달한다.
- [x] `npx vitest run tests/unit/auth`와 영향 앱 focused tests를 실행한다.

### Task 4: End-to-end, deployment configuration and handoff

**Files:** `tests/account-workspace.spec.ts`, 테스트용 Supabase fixture, `playwright.config.ts`, `.github/workflows/deploy.yml`, PRD, README, DESIGN.
**Interfaces:** 실제 앱의 HTTP auth/data boundary를 테스트 fixture로 대체한다. production 인증 우회 코드를 추가하지 않는다.

- [x] 두 기기 같은 데이터, 타 계정 격리, 이전 확인, conflict·실패·재시도, callback 새로고침을 브라우저에서 검증한다.
- [x] 390px·768px·1280px의 로그인/이전/복구 화면과 네 앱의 overflow·focus·touch target·시각화 확인.
- [x] 공개 환경변수를 배포 build에 연결하고 missing config는 명시적 오류 처리한다. callback/auth/data의 service-worker runtime cache 제외를 확인한다.
- [x] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=list`, `npx vite build`, DB integration tests, 문서 상대 링크, `git diff --check` 수행.
- [x] 전체 diff의 ownership·호환성·권한을 독립 리뷰하고 결과를 기록한다.
- [x] 지정 author 확인 후 설계·구현·검증을 커밋한다. Google provider 실제 왕복이나 운영 적용이 미수행이면 별도 제한으로 인계한다.
