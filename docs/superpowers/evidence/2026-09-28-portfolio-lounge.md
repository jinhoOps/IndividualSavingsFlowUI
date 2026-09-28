# Portfolio Lounge 검증·운영 기록

## 변경

- [설계](../specs/2026-09-28-portfolio-lounge-design.md), [계획](../plans/2026-09-28-portfolio-lounge.md).
- `src/lounge/`, `apps/lounge/`: 로그인 사용자끼리 비율 카드·상세·게시·갱신·삭제·페이지 탐색. 별명은 직접 정하며 계정 이메일/실명을 자동 공유하지 않는다.
- Portfolio는 게시물 ID로 최신 공개 데이터를 조회하고, 내 투자금 환산 미리보기와 명시적 초안 교체를 제공한다. 기존 적용 계획과 다른 workspace slice는 보존한다.
- 공통 런처·인증 복귀 경로·정적 빌드/PWA 경로에 네 번째 앱을 연결한다. Lounge만 빈 workspace를 초기화하지 않고 열람할 수 있다.
- 공통 ResponsiveDialog/Layout을 그대로 사용한다. 모바일 하단 sheet와 웹 중앙 modal, focus 복귀, 편집 시에만 종료 확인, 게시 실패 입력 보존을 확인했다.
- 신규 `portfolio_publications` + 최소 권한 RPC 4개. 이미지 없음, 계정당 1행, allocation 4KB/10개 대상, 전체 5,000행 상한. schema v5·protocol 5·기존 이미지 저장 예산은 유지한다.

## 최종 로컬 검증

| 명령 | 결과 |
| --- | --- |
| `npm run check` | source/unit TypeScript 통과 |
| `npx vitest run --maxWorkers=2` | 133개 파일, 1,206개 통과 |
| `npx vitest run tests/unit/journey/supportedRouteClosure.test.ts --maxWorkers=2` | Lounge 경로 추가 후 6개 통과 |
| `ISF_E2E_PORT=6652 npx playwright test --output=/tmp/isf-lounge-final-e2e` | **271개 통과, 기존 PWA offline 검사 1개 skip**, 재시도 없음, 10.9분 |
| `node scripts/test-workspace-db.mjs` | PostgreSQL 17, 기존 TS/SQL 170개 fixture·v5·대출 39개 계산 비교·Lounge 권한/페이지/충돌/삭제/상한 통과 |
| `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build` | 정적 build와 서비스워커 생성 성공; 검증용 공개 설정 사용 |
| `node scripts/test-account-pwa.mjs` | production 서비스워커의 shell 캐시 40개, Auth/Data/OAuth code 캐시 제외와 오프라인 Main 읽기 전용 통과 |
| `npm run check:harness` | 통과 |
| 문서 상대 링크 / `git diff --check` | 확인 후 커밋 |

Lounge 통합 검사는 390/768/1280에서 로그인 요구, 새 계정 무초기화 열람, 비율 상세, 초점 복귀, 월 투자금 환산, 명시적 초안 교체, 다른 slice 보존, 게시·갱신·삭제, 실패 입력 보존, 변경 없는 종료, pagination을 검증한다. 로그인과 Supabase HTTP 경계는 fixture이며 production 엔트리와 SDK를 사용한다. 물리 모바일 기기와 실제 두 사람의 OAuth 왕복·게시 실험은 수행하지 않았다. 일반 E2E의 PWA 1개 제외는 서비스워커를 차단하는 기존 프로젝트 설정이며, 별도 production PWA 스크립트를 통과했다.

중간 실패는 PostgreSQL 예약어 인자 수정, SQL null 응답 테스트 파싱 수정, 네 번째 런처의 개수/Tab 순서 기대값 수정, 비동기 게시 편집기 열림을 기다린 뒤 Escape를 보내는 테스트 동기화로 해결했다. 기존 모달 focus/스크롤 검사의 일시 실패는 focused 재실행과 최종 전체 실행에서 통과했다. 로컬 Docker API가 잠시 무응답이어서 한 번의 DB 시작을 중단했으며, 정상화 후 최종 전체 DB 실행을 통과하고 작업용 컨테이너가 남지 않은 것을 확인했다.

## 운영 Supabase

2026-09-28, 기존 인증된 Supabase SQL Editor에서 프로젝트 `fqongmuyfmxjqmefekbg`에 적용했다.

- 사전 DB 크기: **18,042,003B**. 기존 workspace: **5개**.
- 적용 전/후 전체 workspace 행 checksum: 모두 `c90586395bf345ac138d5b00326df332`.
- migration `202609280002_portfolio_lounge.sql`과 `supabase_migrations.schema_migrations` 이력을 같은 트랜잭션에 기록.
- 로컬 파일과 운영 이력의 SQL 원문 digest: 모두 `84e18b0d28ff41ad8f2d63b9085287dd`.
- 강제 RLS 활성, 안전한 search_path·전용 역할의 RPC **4개** 확인.
- authenticated 직접 테이블 조회/쓰기, anon RPC 실행, lounge 역할의 workspace 조회 모두 차단 확인.
- 로그인용 RPC 실행 권한 허용, 전용 역할의 login/inherit/bypassrls 비활성 확인.
- 적용 후 공유 게시물 **0개**. 실제 사용자 계획을 검증 목적으로 게시하지 않았다.

## PR·배포·정리

- [PR #25](https://github.com/jinhoOps/IndividualSavingsFlowUI/pull/25)를 main에 병합했다. 병합 커밋 `354815c4`, 작성자 `KIM JINHO <okho04@gmail.com>`.
- [PR CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36371913385), [main CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36372031956), [Pages 배포](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36372031989) 모두 성공.
- [배포된 라운지](https://jinhoops.github.io/IndividualSavingsFlowUI/apps/lounge/)를 실제 HTTP로 열어 390/1280에서 200 응답, 로그인 화면, 가로 overflow 없음, JavaScript 오류 없음을 확인했다. 첫 관찰은 공통 인트로가 끝나기 전이어서 인트로를 건너뛴 뒤 로그인 화면을 기다려 검증했다.
- `jinhoOps/portfolio-lounge` 로컬/원격 브랜치를 삭제하고 main을 원격과 맞췄다. Orca 하위 작업공간이 없음을 확인하고 현재 작업공간을 완료 처리했다.

운영 DB 적용·권한 검증, 실제 배포의 비로그인 진입 검사, fixture를 쓰는 로그인 후 E2E의 범위는 서로 구분한다. 실제 사용자 포트폴리오는 게시하지 않았다.

## 화면 증거

- [390px 목록](2026-09-28-portfolio-lounge/lounge-list-390.png)
- [1280px 목록](2026-09-28-portfolio-lounge/lounge-list-1280.png)
- [390px 상세 sheet](2026-09-28-portfolio-lounge/lounge-detail-390.png)
- [768px 상세 modal](2026-09-28-portfolio-lounge/lounge-detail-768.png)
- [390px 내 투자금 미리보기](2026-09-28-portfolio-lounge/lounge-import-390.png)
- [1280px 게시 미리보기](2026-09-28-portfolio-lounge/lounge-publish-1280.png)
