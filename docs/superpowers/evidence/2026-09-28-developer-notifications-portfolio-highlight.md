# 개발자 알림 테스트와 Portfolio 강조 수정

상태: 로컬 구현과 전체 브라우저 회귀 완료. 추가 DB 상한 케이스도 Docker 복구 후 통과했다. 운영 DB 010·011과 계정 권한 등록 완료. 프런트 배포·실제 계정 확인 진행 중이다.

## 변경과 근거

- [PortfolioSummary](../../../src/portfolio/ui/PortfolioSummary.tsx), [Portfolio CSS](../../../src/portfolio/ui/portfolio.css): 기존 흐리게 표시하는 CSS의 specificity가 활성 구간 규칙보다 높아 활성 구간까지 흐려졌다. 활성 구간을 흐림 대상에서 제외하고 hover와 키보드 초점을 분리했다. 터치 hover를 저장하지 않으며 편집 진입·포인터 이탈·Escape에서 강조를 해제한다. 편집 종료 초점 복원과 키보드 탐색은 유지한다.
- [migration 011](../../../supabase/migrations/202609280011_lounge_developer_notifications.sql), [계정 등록 SQL](../../../supabase/operations/grant-lounge-developer.sql): 사용자가 확인한 `okho04@gmail.com`의 기존 확인된 Auth ID를 운영자가 private 개발자 목록에 등록한다. 클라이언트는 역할을 추가하거나 수신자를 지정할 수 없다. 개발자 행 한 개에 테스트 이벤트를 교체 저장하며 10초 간격·UUID 재시도·30일 조회를 적용한다.
- [알림 계약](../../../src/lounge/domain/notifications.ts), [repository](../../../src/lounge/infrastructure/conversationRepository.ts), [LoungeApp](../../../src/lounge/ui/LoungeApp.tsx), [NotificationInbox](../../../src/lounge/ui/NotificationInbox.tsx), [알림 상태](../../../src/lounge/ui/useLoungeNotifications.ts): 개발자에게 관리 메뉴의 본인 테스트 전송을 제공한다. v2 조회·배지·읽음에서 테스트를 포함해 최대 100개를 처리한다. 테스트 클릭은 댓글 이동 없이 읽음 처리한다. 전송 결과보다 늦게 도착한 이전 조회/읽음 응답이 새 배지를 덮어쓰지 못한다.
- 공개 테스트 게시물·댓글·발신자 계정을 만들지 않는다. 기존 알림 행·v1 RPC·엄격 DTO와 금융 workspace v5/protocol 5를 유지한다. PRD·DESIGN·대화 spec에 새 계약과 운영 적용 상태를 반영했다.

## 검증

- `npm run check && npm run test:unit`: 타입 검사 통과, 146개 파일·1,330개 단위 테스트 통과.
- `node scripts/test-workspace-db.mjs`: 전체 통과. 170개 공통 TS/SQL fixture, 데이터 보존·RLS·v1 호환성 및 개발자 권한·본인 테스트·재시도·동시 실행·읽음 격리·만료 검증을 포함한다. [개발자 DB 검증](../../../scripts/verify-lounge-developer-db.mjs)을 빠른 DB 실행기와 전체 실행기에 연결했다.
- `node scripts/test-lounge-db.mjs`: Docker 복구 후 재실행 통과. 실제 알림 100개+개발자 테스트 한 건의 통합 상한, 20개 페이지·cursor·읽음 ID 상한을 포함한다. 이전 실행은 Docker 응답 정지로 시작하지 못했으나 이번 실행에서 남은 검증을 완료했다.
- `npx playwright test tests/portfolio.spec.ts tests/account-workspace.spec.ts --grep "allocation highlight|Lounge developer|Lounge hides developer" --reporter=list --trace retain-on-failure`: 7/7 통과. 390/768/1280px, 390px touch emulation, 포인터 해제·편집 후 초점·키보드 탐색, 개발자/일반 계정·응답 유실 재시도를 포함한다.
- `npx playwright test --reporter=dot --trace retain-on-failure`: 337개 통과·1개 건너뜀, 13.2분. 알림 상태 경쟁 조건 수정까지 포함한 전체 회귀 결과다.
- 390/768/1280px의 Portfolio 강조와 개발자 알림함 캡처를 직접 확인했다. 단일 구간 강조, 화면 내 overlay 수용, 알림 내용 가시성과 가로 넘침 없음을 확인했다. 자동화에서도 포인터·터치·키보드 초점과 터치 목표 크기를 검증했다.
- `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build`: 성공. 공개 테스트 연결 설정으로 빌드 가능성을 확인했으며 운영 배포 산출물로 사용하지 않는다. 버전을 올리는 `npm run build`는 사용하지 않았다.
- 수정 문서의 상대 링크, `git diff --check`: 통과.

## 운영 적용

- 사용자가 운영 진행과 Orca 브라우저 사용을 승인했다. 로그인된 SQL Editor의 `fqongmuyfmxjqmefekbg` / `main PRODUCTION` / `postgres` 연결에서 적용했다. 확인된 이메일 계정과 닉네임이 각각 하나 존재함을 확인했고 Auth 계정을 생성하거나 수정하지 않았다.
- 기존 함수 정의·금융 및 커뮤니티 8개 테이블 원본을 저장소 밖 `/tmp/isf-lounge-rollout-20260928/private-backup.json`에 권한 0600으로 보관했다. 원본이나 비밀 값은 Git·정적 빌드에 포함하지 않았다.
- 010 → 011 → 계정 등록을 migration 이력과 함께 한 트랜잭션으로 적용했다. 적용 중 짧은 쓰기 잠금과 전후 전체 행 digest 비교를 수행하고 불일치 시 전체 rollback하도록 했다. workspace 8개, mutation receipt 361개, 게시물 2개, 프로필 2개, 댓글 1개, 공감 3개, 실제 알림 1개, 활동 2개를 보존했다.
- 이력과 로컬 SQL의 MD5: 010 `19992cc6610d7f47fb88c88830f3a532`, 011 `0dde90a23c7f1aaa7394824a1e5dec95`. 재조회에서 정확히 일치했다. workspace의 user_id 정렬 checksum은 적용 전후 `c4ca1027ef9f127e3c69891c2323abaf`로 같다.
- 개발자 행은 대상 이메일에 연결된 한 개다. FORCE RLS, 클라이언트 직접 테이블/비공개 helper 접근 거부, 신규 RPC 5개의 전용 owner·빈 search_path·security definer·authenticated 실행 허용·anon/service_role 실행 거부를 운영에서 확인했다.
- GitHub Pages 운영 공개 변수 두 개와 배포 권한을 확인했다. DB 반영 후 프런트 배포를 진행하며 실제 관리 메뉴 전송·배지·알림함·읽음·새로고침 검증은 다음 기록에 추가한다.

## 제한과 후속

실제 모바일 기기의 키보드/접근성 도구는 확인하지 않았다. Docker 복구 후 추가 상한 검증을 완료했고, 이전 응답 정지 때 생성 시도한 일회용 컨테이너 `isf-lounge-test-e2deeae4-5917-4260-b5df-41ee80ea3d46`는 해당 이름 조회 결과 남아 있지 않았다.
