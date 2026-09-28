# 라운지 닉네임 변경 검증

- [계획](../plans/2026-09-28-lounge-nickname-change.md), [현재 설계](../specs/2026-09-28-portfolio-lounge-design.md).
- `NicknameChangeDialog` / `LoungeApp`: 닉네임 오른쪽 변경 버튼, 모바일 공통 바텀시트·웹 compact modal, 서버 기준 다음 변경 가능 시각, 실패 시 입력 보존, 실제 미저장 입력만 이탈 보호.
- profile / repository: 기존 2~20자·NFC·허용 문자와 대소문자 무시 중복 검증을 유지하며 정규화 전 입력 길이를 제한한다. 새 RPC는 nickname/version만 받고 사용자 ID·시각을 받지 않는다.
- migration005: 최초 변경은 즉시 가능, 실제 변경부터 서버 시계로 48시간 제한. 동일 이름 재전송은 시간/version을 바꾸지 않고, 대소문자만 바꾸면 실제 변경으로 취급한다. 기존 게시물 이름/version을 원자적으로 갱신한다.
- 고정 SQL·매개변수 RPC, FORCE RLS, 본인 claim, 전용 최소권한 역할, 빈 search_path, DB trigger, UNIQUE·계정 잠금·version 비교를 적용했다. React 텍스트 렌더링을 유지한다.
- workspace v5/protocol 5, Main 데이터 소유권, 보존 slice·백업과 이미지 Storage 정책은 유지한다.

## 검증

| 명령 | 결과 |
| --- | --- |
| `npm run check:ci` | 타입·harness·135 files / **1,259 tests 통과** |
| `node scripts/test-workspace-db.mjs` | 전체 PostgreSQL suite 통과. 변경 전 데이터 보존, 최초 변경·47시간 59분 거부·48시간 허용, 동일 이름 무변경·응답 재시도, case-only 변경, 중복·동일/서로 다른 계정 경합, 기존 게시물 원자 반영·v1 호환 포함 |
| `ISF_E2E_PORT=6655 npx playwright test --project=cloud --grep Lounge --output=/tmp/isf-rename-focused` | **20개 통과**, 재시도 없음 |
| `ISF_E2E_PORT=6655 npx playwright test --output=/tmp/isf-rename-full` | **283개 통과, 기존 PWA 1개 제외, 기존 모션 측정 1개 실패** (11.5분). 아래 원인 수정 후 해당 테스트 5회 연속 통과 |
| fixture 공개 Supabase 설정으로 `npx vite build` | production build·47개 precache 성공 |
| 문서 상대 링크·`git diff --check` | 통과 |

390/768/1280에서 변경·쿨다운 화면을 검증하고 직접 검토했다. 모바일 sheet / 웹 중앙 modal, 기존 Anime.js 모션, 가로 overflow·화면 내 overlay·44px CTA·포커스 복귀를 확인했다. 실패/중복/응답 유실과 재시도, 타 기기 변경, 읽기만 할 때 무경고 닫기, 실제 입력 폐기 확인, 저장 후 이탈 보호 해제, workspace 무변경을 확인했다.

SQLi·HTML/script·제어/zero-width/bidi 문자·과대 입력 거부, SQL/HTML처럼 보이는 게시글의 리터럴 저장/텍스트 렌더링, 익명 실행·직접 테이블 접근·다른 계정 수정·시각/버전 위조 차단을 검증했다. DB 권한/경합은 실제 로컬 PostgreSQL 17, 로그인 후 브라우저는 HTTP fixture를 사용했다. 실제 두 계정 OAuth 왕복·물리 기기·애플리케이션 전체 침투 테스트는 수행하지 않았다. 별도 WAF/요청 빈도 제한이나 DDoS 방어를 추가한 작업은 아니다.

기존 PWA 제외 항목은 서비스워커를 차단하는 E2E 설정에 따른다. 이번 변경은 PWA 경로·캐시 정책을 바꾸지 않는다.

### 전체 회귀에서 발견한 모션 측정 문제

기존 Portfolio 모션 테스트가 프레임 높이 차이 `<1px` 검사에서 `1.00006103515625px`로 실패했다. 반복·프레임 진단에서 폰트 로딩 중 `621.296875 → 622.296875 → 621.296875px` 변화를 확인했다. 테스트의 측정 시작 전에 `document.fonts.ready`를 기다리도록 수정했다. 제품 모션 코드와 검사 임계값은 바꾸지 않았다. 진단 코드 제거 후 `ISF_E2E_PORT=6655 npx playwright test tests/portfolio.spec.ts --project=chromium --grep 'slides the mobile edit card' --repeat-each=5 --output=/tmp/isf-rename-motion-final`가 **5회 모두 통과**했다. 최종 변경은 해당 테스트의 시작 조건뿐이므로 전체 11.5분 suite를 다시 돌리지는 않았다. 전체 첫 실행을 완전 통과로 표시하지 않는다.

## 운영 DB

2026-09-28 프로젝트 `fqongmuyfmxjqmefekbg`에 `202609280005_lounge_nickname_change.sql`과 migration 이력을 한 트랜잭션으로 적용했다. 기존 데이터가 달라지면 전체 적용을 실패시키는 보존 검사를 함께 실행했다.

- workspace **5개**, 전후 checksum `c90586395bf345ac138d5b00326df332` 동일.
- 게시물 **1개**, 전후 checksum `b62e3df92f31219f34a73578f495aadd` 동일.
- profile **0개**, 새 컬럼 제외 전후 checksum `d751713988987e9331980363e24189ce` 동일. 실제 사용자 닉네임을 시험 등록/변경하지 않았다.
- FORCE RLS=true, anon/authenticated/service_role 테이블 직접 권한=false.
- RPC 역할은 nickname UPDATE=true, user_id/created_at/변경시각/version UPDATE 허용 컬럼 수=0.
- 조회 v2·변경·등록 RPC 모두 전용 owner/definer/빈 search_path. anon 실행=0, authenticated 실행=3.
- 변경 검사·게시물 이름 고정 trigger **2개** 활성, 구 immutable trigger **0개**. 기존 profile v1 읽기 RPC 유지.
- 로컬 파일/운영 migration SQL digest `924e0bf399270771cd066135e5e4d44c` 일치. DB 표시 크기 **17 MB**.
- 임시 검증 테이블과 테스트용 DB 컨테이너는 종료 시 제거했다. 기존 다른 작업의 Supabase 컨테이너는 보존했고 대시보드 탭은 프로젝트 화면으로 복귀했다.

## 배포

운영 DB 반영 완료. PR·CI·Pages 배포 진행 중.

## 화면 증거

- [390px 변경 시트](2026-09-28-lounge-nickname-change/nickname-change-390.png)
- [390px 변경 제한](2026-09-28-lounge-nickname-change/nickname-cooldown-390.png)
- [768px 변경 모달](2026-09-28-lounge-nickname-change/nickname-change-768.png)
- [768px 변경 제한](2026-09-28-lounge-nickname-change/nickname-cooldown-768.png)
- [1280px 변경 모달](2026-09-28-lounge-nickname-change/nickname-change-1280.png)
- [1280px 변경 제한](2026-09-28-lounge-nickname-change/nickname-cooldown-1280.png)
