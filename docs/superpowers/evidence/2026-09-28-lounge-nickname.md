# 라운지 최초 닉네임 검증

- [설계](../specs/2026-09-28-portfolio-lounge-design.md), [계획](../plans/2026-09-28-lounge-nickname.md).
- `src/lounge/domain/profile.ts`: 2~20자 한글·영문·숫자와 `- . @`, NFC 정규화. 공백·이모지·추가 특수문자·기호만 있는 이름 거부.
- `LoungeEntry` / `LoungeOnboarding`: 최초 랜딩·소개·등록 확인, 조회 실패와 미등록 구분, 입력 보존·중복/실패 재시도·기존 링크 복귀. 단순 열람은 이탈 경고 없이 닫히고 실제 미등록 입력이 있을 때만 보호한다.
- `PublicationEditor` / repository: 고정 닉네임 표시, 별명 입력 제거, 별명 인자가 없는 게시 RPC v3.
- `202609280004_lounge_nickname.sql`: immutable profile·대소문자 무시 UNIQUE·FORCE RLS·최소 권한·동시 등록/재시도·5,000행 상한. 구버전 게시도 fixed nickname trigger로 강제한다.
- workspace schema v5/protocol 5·보존 slice·백업·이미지 저장 정책은 변경하지 않는다.

## 검증

| 명령 | 결과 |
| --- | --- |
| `npm run check:ci` | 타입·harness·135 files / **1,255 tests 통과** |
| `node scripts/test-workspace-db.mjs` | 전체 PostgreSQL suite 통과. 기존 170 fixtures, 대출 39개 TS/SQL 비교, Lounge 권한/보존/CAS, 닉네임 validator 동등성·NFC·중복·동시 등록·응답 재시도·이름 변경/위조 거부·cascade·상한 |
| `ISF_E2E_PORT=6654 npx playwright test --project=cloud --grep Lounge --output=/tmp/isf-nickname-focused` | **14개 통과**, 재시도 없음 |
| `ISF_E2E_PORT=6654 npx playwright test --output=/tmp/isf-nickname-full` | **278개 통과, 기존 PWA 1개 제외**, 재시도 없음, 11.0분 |
| fixture 공개 Supabase 설정으로 `npx vite build` | production build·47개 precache 성공 |
| 문서 상대 링크·`git diff --check` | 통과 |

390/768/1280에서 랜딩·입력·변경 불가 확인·재방문을 검증하고 화면을 직접 검토했다. 확인 창은 모바일 sheet / 웹 compact modal이며 기존 Anime.js 모션 완료 후 스크린샷을 기록했다. 가로 overflow, 화면 밖 overlay, focus trap·복귀, 44px CTA, 등록 전 무저장, 등록 후 이탈 보호 해제, workspace 무생성을 확인했다.

초기 focused 실패 1개는 날짜와 함께 표시되는 닉네임을 단독 문자열로 찾은 테스트 selector 오류였다. 해당 selector를 수정하고 전체 focused group을 재실행해 통과했다. build 첫 실행은 필수 Supabase 환경값이 없어 거부됐고 공개 fixture 설정으로 정상 빌드했다.

전체 E2E의 PWA 1개 제외는 서비스워커를 차단하는 기존 설정이다. 이번 변경에는 PWA 경로·캐시 정책 변경이 없다.

로그인 이후 브라우저 검증은 HTTP fixture를 사용하며 DB 권한/경합은 실제 로컬 PostgreSQL 17에서 검증했다. 실제 두 계정 OAuth 왕복·물리 기기 검증은 수행하지 않았다. 변경 불가 닉네임을 실제 사용자 계정에 시험 등록하지 않았다.

## 운영

2026-09-28 프로젝트 `fqongmuyfmxjqmefekbg`에 migration과 이력을 한 트랜잭션으로 적용했다. 임시 검증 테이블은 트랜잭션 종료 시 삭제하며 기존 행이 달라지면 전체 적용을 실패시키는 보존 검사를 포함했다.

- workspace **5개**, 전후 전체 행 checksum `c90586395bf345ac138d5b00326df332` 동일.
- 기존 게시물 **1개**, 전후 전체 행 checksum `b62e3df92f31219f34a73578f495aadd` 동일.
- 프로필 **0개**. 기존 별명은 자동 등록하지 않고 사용자의 최초 확정 시에만 기존 공유에도 적용한다.
- FORCE RLS=true. anon/authenticated/service_role 테이블 직접 권한=false. RPC 역할의 profile UPDATE/DELETE=false.
- 신규 안전한 definer/전용 owner/빈 search_path RPC **3개**, anon 실행 **0개**, authenticated 실행 **3개**. 이름 고정·변경 방지 trigger **2개** 활성화.
- 로컬/운영 SQL digest `bd9066146f455049d1d80ec5bb06ed8e` 일치. DB 표시 크기 **17 MB**.
- 구버전 읽기·삭제는 유지한다. 미등록 구버전 게시/갱신은 차단되므로 최신 앱에서 최초 설정이 필요하다. 현재 v3는 응답 유실 후 같은 이름·게시 결과를 유지하는 재시도를 검증했다.
- 테스트용 DB 컨테이너는 종료되었으며 기존 다른 작업의 Supabase 컨테이너는 보존했다. Supabase 탭은 프로젝트 화면으로 복귀했다.

## 배포

구현·로컬 검증·운영 migration 완료. PR·Pages 배포 확인 후 이 절에 결과를 기록한다.

## 화면 증거

- [390px 랜딩](2026-09-28-lounge-nickname/lounge-nickname-landing-390.png)
- [390px 확인 시트](2026-09-28-lounge-nickname/lounge-nickname-confirm-390.png)
- [768px 랜딩](2026-09-28-lounge-nickname/lounge-nickname-landing-768.png)
- [768px 확인 모달](2026-09-28-lounge-nickname/lounge-nickname-confirm-768.png)
- [1280px 랜딩](2026-09-28-lounge-nickname/lounge-nickname-landing-1280.png)
- [1280px 확인 모달](2026-09-28-lounge-nickname/lounge-nickname-confirm-1280.png)
