# 라운지 댓글·공감 구현 계획

**목표:** 로그인한 라운지 사용자에게 중복 없는 이모지 공감과 페이지 단위 댓글을 제공한다.

**설계:** [댓글·이모지 공감](../specs/2026-09-28-lounge-community-design.md).

**구조:** 기존 publication 계약은 유지하고 별도 community DTO/RPC를 추가한다. 댓글과 공감은 workspace와 분리한다. 기존 공통 dialog에 댓글 단계를 넣고, 목록과 상세의 공감 요약을 같은 상태로 갱신한다.

**기술:** React/TypeScript, 기존 Anime.js ResponsiveDialog, Supabase PostgreSQL/RLS, Vitest/Playwright, 로컬 PostgreSQL 통합 검증. 새 패키지는 추가하지 않는다.

## 1. 저장 계약과 DB

- [x] `src/lounge/domain/community.ts`: 16개 이모지 allowlist, 8종 제한, 댓글/요약/커서 DTO와 strict parser. UTF-8·문자수·추가 비공개 필드 거부 검증.
- [x] `supabase/migrations/202609280006_lounge_community.sql`: 댓글·공감·서버 활동 행, FORCE RLS, 본인 쓰기, 배치 요약·상태 지정 공감·댓글 페이지/등록/삭제 RPC.
- [x] 전역 트랜잭션 잠금으로 8종/행 상한 경쟁 제어. 유니크 키와 명시적 대상 상태, 댓글 UUID로 재시도 중복 방지. 요청 제한·400MiB 신규 저장 차단·삭제 허용.
- [x] `scripts/verify-lounge-community-db.mjs`, `scripts/test-workspace-db.mjs`: A/B·동시 요청·IDOR·anon·직접 접근·SQLi/XSS 텍스트·재시도·페이지·닉네임·cascade·행/요청 상한·용량을 실제 DB에서 확인. 이전 데이터 digest 보존.

## 2. 통신과 UI

- [x] `src/lounge/infrastructure/loungeRepository.ts`: 기존 계정 고정 RPC를 재사용해 `getCommunity`, `setReaction`, `listComments`, `addComment`, `removeComment`를 추가. 요청·응답 검증, 무응답과 빈 목록 구분.
- [x] `src/lounge/ui/CommunityBar.tsx`: 이모지 칩, 선택 상태, 최대 8종에서 추가 숨김, 모바일 4개·나머지 펼치기, 인라인 선택기, 오른쪽 댓글 수. 44px·키보드·초점.
- [x] `src/lounge/ui/PublicationComments.tsx`: 20개 최신순 페이지, 작성/삭제/실패/재시도, 입력 유지, same-ID 재시도, dirty/저장 중 닫기 보호, 화면 내 footer.
- [x] `src/lounge/ui/LoungeApp.tsx`, `src/lounge/ui/lounge.css`: 카드/상세 공감 공유 상태, 배치 요약 갱신, 댓글 화면 전환과 원래 버튼 초점 복귀. 늦은 응답이 최신 화면/선택을 덮지 않게 한다.

## 3. 관찰 가능한 검증

- [x] unit: allowlist·bounds·private field 거부·계정 교체·idempotent 인자·status 매핑.
- [x] Playwright: 여러 사용자 공감 수·8종 제한·0명 제거·모바일 펼치기, 댓글 조회 전 요청 없음, 페이지 경계·재시도·서버 실패·삭제·dirty·보존·초점.
- [x] 390/768/1280 스크린샷 직접 검토, 가로 overflow·모달 포함·44px·키보드·댓글 footer·숫자 가독성.
- [x] `npm run check:ci`, 실제 로컬 DB suite, 관련 E2E·production build·문서 링크·`git diff --check`. 기존 publication/가져오기/닉네임 회귀 포함.

## 4. 전달·운영

- [x] PRD·DESIGN·라운지 기존 spec의 범위 갱신, 사용자 README 갱신.
- [ ] 운영 DB 크기와 기존 세 테이블 digest 확인 → 신규 migration 적용 → 권한/RPC·digest 재확인. 운영 테스트 게시물/댓글은 생성하지 않는다.
- [ ] PR·CI·병합·Pages 확인과 실제 배포 화면 smoke. 검증 기록·화면 보관.
- [ ] 원격/로컬 branch·Orca 상태 정리. 카카오 실기기 전환 한계와 DB 전체 예산 관찰 필요를 사실대로 인계.

## 리뷰 초점

- 삭제/계정 전환/페이지 전환 중 늦게 돌아온 응답이 다른 게시물 상태를 오염시키지 않는다.
- 두 사용자가 서로 다른 9번째 이모지를 추가해도 8종을 넘지 않는다.
- 서버가 댓글을 저장했지만 응답이 끊긴 뒤 재시도해도 중복 댓글이 생기지 않는다.
- 줄바꿈·한글 조합·이모지가 포함된 500자 경계와 HTML처럼 보이는 본문을 데이터로 처리한다.
- 8종·많은 카운트·긴 댓글·짧은 모바일 높이에서도 댓글 진입과 등록/닫기가 가려지지 않는다.

## 실행 기록

타입·harness·1,273 unit 통과. 관련 회귀 38개, 응답 순서 보완 후 community 7개 통과. 실제 DB 권한/경쟁/페이지/예산 검증과 production build 통과. 최종 리뷰의 공감·댓글 동시 응답 P2를 재현·수정하고 양쪽 순서 회귀를 추가했다. 재검토 추가 발견 없음. [검증 기록](../evidence/2026-09-28-lounge-community.md).
