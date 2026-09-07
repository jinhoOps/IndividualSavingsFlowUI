# Supabase 계정 저장 구현 검증

날짜: 2026-09-07. 범위: [승인 설계](../specs/2026-09-07-supabase-account-workspace-design.md)의 로컬 구현과 커밋. 운영 DB/provider/배포는 미수행이다.

## 변경 범위

- `supabase/migrations/`: JSONB workspace, RLS, 전용 함수 역할, 여섯 narrow RPC, CAS revision과 mutation receipt, 전체 validator.
- `src/workspace/infrastructure/`: 계정 세션·서버 snapshot·scoped repository·탭별 복구 캐시. 이전 계정의 요청 토큰 고정, 역순 결과/종료 세션 폐기, Account Map Main-null 예외.
- `src/auth/`, `apps/auth/callback/`, 네 제품 entry: Google PKCE, hydration gate, 명시적 브라우저 이전, 백업/전체 교체, 재시도·오프라인·로그아웃. 실제 제품 진입 전에 인증과 데이터 검증을 완료한다.
- Main·Simulation·Portfolio·Account Map UI: 미전송 폼 입력과 설정 단계 복구. 복구 mount만으로 서버에 쓰지 않으며 StrictMode에서 원문 입력도 유지한다. Main 설정·Simulation·Portfolio의 cloud 자동 저장은 500ms 동안 최신 입력으로 병합하고, 명시적 적용/초기화 전에 순서대로 flush하며 실제 unmount에서는 대기 요청을 취소한다.
- Vite/Pages workflow: 공개 환경변수만 build에 주입하고 누락 시 실패, static callback entry 추가. 기존 앱 소유권·schema v3·backup v2 유지.
- PRD/README/DESIGN 및 [운영 안내](../../supabase-account-setup.md): 브랜치 구현과 운영 rollout 구분.

## 최종 실행 결과

| 명령 | 결과 |
| --- | --- |
| `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci` | 하네스·source/unit TypeScript 통과, 128개 파일의 단위 테스트 1,238개 통과 |
| `npm run test:e2e -- --reporter=list` | 최종 전체 재실행: 149 통과, 기존 PWA 전용 1개 skip, 실패 0 |
| `node scripts/test-workspace-db.mjs` | 실제 PostgreSQL 17: TS/SQL 동일 123 fixture, RLS·RPC 권한·동시 생성/쓰기/재시도·rollback 통과 |
| 공개 fixture URL/key를 지정한 `npx vite build` | 정적 production build와 callback HTML·서비스워커 생성 통과 |
| 환경변수 없는 `npx vite build` | 의도한 설정 오류로 실패; 로컬 writable 모드 fallback 없음 |
| `node scripts/test-account-pwa.mjs` | 실제 production SW의 shell cache 28개 확인. Auth/Data/code URL cache 없음, 로그인 문맥의 오프라인 Main은 읽기 전용 |
| 문서 상대 링크 검사 / `git diff --check` | 통과 |

현재 로컬 Node는 v26.5.0이다. 실험적 Node Web Storage와 jsdom 충돌을 피하기 위해 단위 테스트에서 위 `NODE_OPTIONS`를 사용했다. CI는 Node 22를 유지한다. `npm run build`는 기존 버전 bump 동작 때문에 실행하지 않았으며 같은 Vite production build를 버전 변경 없이 검증했다.

일반 E2E는 서비스워커를 차단하므로 기존 `pwa-chromium` 전용 시나리오 하나가 의도적으로 skip된다. 별도 PWA 스크립트는 production 산출물을 실제 service worker 허용 브라우저로 검증한다. 이 스크립트가 네 앱 전체의 오프라인 모션 검증이나 실제 Google provider 테스트를 대신하지는 않는다.

## 브라우저 증거와 회귀

`cloud`의 19개 시나리오는 실제 production entry·Supabase SDK의 HTTP 경계를 mock한다. 두 브라우저 동기화, 다른 계정 격리, 명시적 이전/초기화 경쟁, 응답 유실 재시도, 충돌 재적용, callback 정리, reload 복구, 오프라인 읽기 전용, 두 탭 로그아웃, 복제 탭 캐시 격리, 닫힌 탭의 미전송 입력 다운로드, quota 실패 후 자동 SIGNED_OUT 복구 파일, Account Map 전용 reapply와 Main-null을 포함한다.

`chromium`은 기존 로컬 repository 호환성을 직접 검증하는 테스트 전용 entry다. production entry에 인증 우회는 없으며 fixture도 기존 StrictMode·error boundary·스타일·서비스워커 등록을 유지한다. 초기 전체 실행의 Account Map timeout은 단독 재현되지 않았으며 진입 fixture를 기존 StrictMode 구성에 맞춘 뒤 최종 전체 실행은 실패 없이 통과했다. 프로젝트별 testIgnore가 상위 설정을 대체하는 Playwright 동작도 반영해 단위 테스트가 브라우저 suite에 잘못 수집되지 않게 했다.

마지막 변경 후 첫 전체 실행에서는 기존 Main review 애니메이션 검사가 `tests/main-react.spec.ts:1319`에서 한 번 실패했다(1,200ms 가상 시계 진행 후 restart scaleX 0, 기대 1). 같은 소스의 단독 `--repeat-each=3`과 최종 전체 재실행은 모두 통과했다. 애니메이션 구현과 해당 테스트는 수정하지 않았으며 일시적 타이밍 실패의 원인은 확정하지 못했다. 최종 통과와 별개로 이 비결정적 회귀 위험은 남겨 둔다.

390px·768px·1280px에서 로그인, 네 앱, 편집/관리 overlay, focus·44px target·overflow·시각화 회귀를 실행했다. `test-results/cloud-*.png`와 각 Playwright output의 반응형 화면을 생성했으며 로그인390, Main390, Account Map768, Portfolio1280 스크린샷을 직접 확인했다. 테스트 산출물은 개인정보 없는 fixture이며 Git에는 포함하지 않는다.

## 독립 리뷰

- SQL 검토: 권한·RLS·security definer owner/search_path·receipt/CAS·validation parity에 차단 이슈 없음.
- Auth/세션 검토: 계정 전환 JWT 경합, 401 오분류, 자동 로그아웃 시 quota 실패 복구 손실, 공용 탭 캐시 덮어쓰기, Simulation raw input/StrictMode 문제를 재현한 뒤 수정하고 집중 회귀를 통과했다. 최종 검토 범위에 남은 Critical/Important 없음.
- 마지막 자동 저장·닫힌 탭 복구 파일 변경도 별도로 검토했으며 4개 파일의 집중 테스트 52개를 독립 실행해 통과했다. 자동 저장 병합, 적용/초기화 순서, 최신 입력의 성공 표시와 unmount 취소를 확인했다.
- 입력 복구는 기존 계산·금액·소유권 계약을 바꾸지 않는다. Browser workspace 원본과 foreign record는 그대로 보존한다.

## 남은 운영 항목

실제 Supabase 프로젝트의 Postgres 버전·ICU·migration 역할 권한, 테이블/RLS 적용, Google Client ID/Secret과 callback allowlist, GitHub 공개 build 변수는 운영자가 확인해야 한다. 실제 Google 왕복, 운영 URL 새로고침, 두 기기 실사용 검증과 배포는 아직 하지 않았다. 비밀번호 후보는 소스·문서·로그에 복사하지 않았다. 실제 비밀번호였다면 사용 전에 교체한다.

다음 소유자: 프로젝트 운영자. 시작 문서: [Supabase 계정 저장 운영 안내](../../supabase-account-setup.md).

작업 전부터 있던 `package-lock.json`의 root `hasInstallScript` 한 줄은 작업 트리에 그대로 보존하고 이번 커밋에서 제외했다. branch/worktree는 유지하며 push·merge는 수행하지 않는다.
