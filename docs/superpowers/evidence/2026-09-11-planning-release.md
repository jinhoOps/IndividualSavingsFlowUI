# 계획 UI와 로그인 로딩 — main 반영 검증

> 이후 사용자가 재생 조건을 앱 실행·Main 재시작으로 정정했다. 최신 동작과 회귀 검증은 [후속 수정 기록](2026-09-11-brand-entry-fix.md)을 따른다.

2026-09-11 사용자 요청: 누적된 Simulation·Main 도우미·초기화 개선과 로그인 로딩 모션을 main에 푸시한다.

## 변경

- [Simulation 검증](2026-09-11-simulation-goal-settings.md): 기본 5년·기준금리 3%, 목표 직접 입력과 ±1천만/5천만, 기본 목표 복원, 접히는 목표와 가정, 통합 결과 패널·투자 수익률 표기.
- [Main 초기화 검증](2026-09-11-main-reset.md): 표시 없는 2.5초 잠금, 빈 재시작 초안과 도우미 답변 전체 삭제, 기존 적용 계획과 다른 앱 보존. 도우미의 0원 진행과 공용관리비/공과금 설명도 반영한다.
- [로딩 설계](../specs/2026-09-11-account-loading-brand-motion-design.md): 로그인 성공 후 workspace 요청 동안 브랜드 모션. 응답 즉시 진입, 느린 응답은 완성 프레임 유지, reduced motion·기존 세션 이동은 정적 로고. Main 새 시작·재시작·초기화의 별도 인트로 제거.

## 로컬 검증

- `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·source/unit TypeScript 통과, 145개 파일·1,329개 unit test 통과.
- `npx playwright test --output test-results/login-release`: 179개 통과, 기존 대시보드 containment 1개 실패, 별도 PWA 프로젝트용 1개 skip. 실패 당시 같은 Main URL로 navigation이 발생하며 열린 details table을 잃었다. 원인을 제품 코드로 확정하지 않았다. 코드 수정 없이 `npx playwright test tests/main-react.spec.ts --grep 'live dashboard keeps the donut' --repeat-each 2 --trace on --output test-results/login-dashboard-recheck`로 2회 모두 통과했다. 최초 실패는 숨기지 않으며 간헐적 실행 안정성은 후속 QA 관찰 대상이다.
- 로딩 focused E2E 5개 통과: 실제 SDK 이메일 이벤트, OAuth 완료 표시, 애니메이션 시간을 멈춘 상태의 즉시 진입, reduced motion·조회 실패, 390/768/1280px containment와 앱 이동 재생 없음. 외부 인증/DB 응답은 fixture를 사용한다.
- `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build`: 통과. 로컬 제품 버전은 증가시키지 않았다.
- `node scripts/test-account-pwa.mjs`: production service worker의 31개 shell cache·OAuth/data cache 제외·인증된 오프라인 Main 읽기 전용 검증 통과.
- DB migration·RPC·캐시 변경은 같은 날 앞선 `node scripts/test-workspace-db.mjs`의 170개 workspace·12개 expense fixture와 초기화 원자성/권한/CAS 검증을 통과했다. SQL와 해당 검증 코드는 이후 변경하지 않았다. 이번 최종 재실행은 OrbStack Docker 소켓이 응답하지 않아 컨테이너 시작 전 중단했다. 운영 DB 적용 전후 검증은 아래와 같이 별도로 수행했다.
- `git diff --check`와 변경 문서 상대 링크 확인 통과.

[390px](../../reviews/2026-09-11-login-loading/login-loading-390.png) · [768px](../../reviews/2026-09-11-login-loading/login-loading-768.png) · [1280px](../../reviews/2026-09-11-login-loading/login-loading-1280.png)

## 운영 DB 적용

인증된 Orca Supabase SQL Editor에서 프로젝트 `fqongmuyfmxjqmefekbg`의 기존 다섯 migration 원본 SHA-256을 로컬 파일과 대조했다. 제품 테이블·기존 before-image·교체 대상 함수 원본은 저장소 밖 소유자 전용 파일(`~/.local/state/isf-backups/2026-09-11-before-main-reset.json`, mode 600)에 보관했다. 금융 payload는 Git과 인계 로그에 포함하지 않는다.

[202609110001 migration](../../../supabase/migrations/202609110001_main_setup_reset.sql)과 migration 이력을 같은 트랜잭션으로 적용했다. 원본 SHA-256은 `d77cf9145449d21197df5f799a98789e5e91a46a9733b9004ee2f9b4b4433d98`이다. 사전 상태와 다른 경우 중단하는 검증을 넣었으며 기존 workspace 한 행과 receipt 18개의 전체 해시는 적용 전후 동일하다. 함수 변경은 행의 금액·답변·revision·timestamps를 변경하지 않는다.

후속 읽기 전용 확인에서 RPC 소유자 `workspace_rpc_owner`, SECURITY DEFINER, 빈 search_path, authenticated 실행 허용, anon/service_role 실행 거부와 세 저장 테이블의 FORCE RLS를 확인했다. SQL Editor가 후속 조회를 기존 SQL 뒤에 추가해 migration 재실행을 시도했으나 사전 검증의 `Reset already exists`에서 중단했고, 원본을 정확히 교체한 순수 조회로 최종 결과를 재확인했다. 중복 적용이나 데이터 변경은 없다.

실제 사용자 계획을 초기화하는 운영 smoke test는 수행하지 않았다. 로컬 DB의 실제 PostgreSQL 검증, HTTP fixture E2E와 운영 설치·권한·원본 보존 확인을 구분한다. UI 배포는 사용자 승인한 main push로 수행하며 결과는 GitHub Actions의 해당 main commit 실행에서 확인한다.
