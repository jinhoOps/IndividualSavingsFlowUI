# 커뮤니티 답글·멘션·알림함 구현 계획

**상태:** 2026-09-28 사용자 구현 승인·진행 중. 앱 내 알림함·댓글 모달 밀도·동일 자산군의 종목 경계선을 포함한다.

**실행:** 이 세션의 native 방식으로 순차 진행한다. 각 단계의 계약·실제 DB 검증·UI 검증을 마친 뒤 다음 단계로 간다.

**목표:** 얕은 답글 구조와 정확한 멘션, 중복 없는 앱 내 알림을 밀도 높은 댓글 화면에서 제공한다.

**구조:** 기존 댓글 테이블을 확장하고 버전이 다른 RPC를 추가한다. 프로필에 공개 식별자를 추가하며 알림은 별도 수신자 전용 테이블에 저장한다. 기존 `ResponsiveDialog` 안에서 댓글/알림 단계를 전환한다.

**기술:** 기존 React/TypeScript, Supabase PostgreSQL/RLS, Anime.js, Vitest/Playwright. 새 npm 패키지 없음.

**설계:** [대화·탐색 확장 설계](../specs/2026-09-28-community-conversation-discovery-design.md) §3~5, §7~8. 별도 [탐색 계획](2026-09-28-community-discovery.md)과 독립 출시 가능하다.

## 공통 제약

- 로그인 사용자 전용. `커뮤니티 (Lounge)`/짧은 `커뮤니티` 표기 유지.
- 원댓글 20개, 답글 10개, 들여쓰기 한 단계, 명시적 멘션 최대 3명.
- 댓글 본문 500자/2,000바이트, 멘션 JSON 1KiB. 댓글 10초 간격·24시간당 40개, 게시물 총 500행·전체 20,000행에 삭제 자리 포함.
- 알림 20개씩, 최대 30일·수신자당 100개·전체 20,000개. 자기 알림 없음, 댓글별 수신자 중복 없음.
- 400MiB DB 신규 저장 차단 유지. workspace schema v5/protocol 5, 금융 값, 백업, 이미지 정책 변경 없음.
- 모바일 88dvh/웹 중앙 모달, 기존 400~500ms Anime.js. 44px 조작, 본문 14px 이상, 입력 16px, 실제 미전송 본문만 이탈 보호.

## 집중 검토할 다섯 가지

1. 닉네임 `a@b`, 이름 변경/재사용, emoji 앞의 멘션 범위: 다른 사용자에게 알리면 안 됨 — Task 1/2/4.
2. 답글 등록과 부모 삭제/탈퇴 경쟁: 본문은 제거하고 다른 사람 대화는 유지 — Task 2.
3. 응답 유실 재시도와 모두 읽음 도중 새 알림: 댓글/알림 중복·새 알림 소실 방지 — Task 2/3/5.
4. 한글 조합·모바일 키보드·짧은 화면: 입력·후보·등록 버튼이 시트 밖으로 나가지 않음 — Task 4/6.
5. 오래된 링크/구버전 탭/계정 전환: 접근 불가 설명, strict 응답 호환, 이전 계정 응답 폐기 — Task 3/5/6.

## Task 1. 대화·멘션·알림 계약

선행 UI 변경: `src/lounge/ui/AllocationSummary.tsx`의 자산군 합산 막대를 자산군별 종목 구간으로 구성하고 `lounge.css`에 1px 낮은 대비 inset 경계를 둔다. 색상·범례·합계·막대 길이·작은 비율을 보존하고 카드/상세/게시/가져오기 390·768·1280 화면에서 확인한다. 단순 CSS와 되돌릴 수 있는 표시 변경에 구현을 복제하는 별도 테스트는 추가하지 않는다.

**파일:** 새 `src/lounge/domain/conversation.ts`, `src/lounge/domain/notifications.ts`, `tests/unit/lounge/conversation.test.ts`, `tests/unit/lounge/notifications.test.ts`. 기존 `community.ts` v1 parser는 보존한다.

**공통 인터페이스:** 다음 타입과 strict parser를 정의하고 이후 작업이 그대로 사용한다.

```ts
export interface MentionRange {start:number; end:number; publicId:string; label:string}
export interface MentionCandidate {publicId:string; nickname:string}
export interface ResolvedMention extends MentionRange {currentNickname:string}
export interface CommentWrite {
  id:string; postId:string; rootId:string|null; replyToId:string|null;
  body:string; mentions:MentionRange[];
}
export interface ConversationComment {
  id:string; rootId:string|null; replyToId:string|null;
  author:MentionCandidate|null; body:string; mentions:ResolvedMention[];
  createdAt:string; deleted:boolean; isMine:boolean; replyCount:number;
}
export interface ConversationCursor {id:string; createdAt:string}
export interface ConversationPage {
  comments:ConversationComment[]; nextCursor:ConversationCursor|null;
}
export interface CommentContext {
  postId:string; root:ConversationComment; page:ConversationPage; targetId:string;
  previousCursor:ConversationCursor|null;
}
export interface LoungeNotification {
  id:string; postId:string; commentId:string; kind:'reply'|'mention';
  actor:MentionCandidate; preview:string; createdAt:string; read:boolean;
}
export interface NotificationPage {
  items:LoungeNotification[]; nextCursor:ConversationCursor|null;
  unreadCount:number; readCutoff:string; readIds:string[];
}
export function parseCommentWrite(value:unknown):CommentWrite|null;
export function parseConversationPage(value:unknown):ConversationPage|null;
export function parseNotificationPage(value:unknown):NotificationPage|null;
```

- [ ] 문자·바이트 상한, 잘못된 UUID, 추가 필드, 범위 겹침, 같은 사용자 중복, 빈 본문을 거부하는 테스트를 먼저 추가한다.

```ts
const postId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const publicId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const write={id,postId,rootId:null,replyToId:null,body:'😀 @a@b 안녕',
  mentions:[{start:2,end:6,publicId,label:'a@b'}]};
expect(parseCommentWrite(write)).not.toBeNull();
expect(parseCommentWrite({...write,mentions:[{...write.mentions[0],start:3}]})).toBeNull();
expect(parseCommentWrite({...write,ownerId:postId})).toBeNull();
```

- [ ] `npx vitest run tests/unit/lounge/conversation.test.ts tests/unit/lounge/notifications.test.ts`로 새 계약 부재에 따른 실패를 확인한다.
- [ ] 본문 정규화 후 code point 범위를 검증한다. 삭제 댓글은 `body:''`, `author:null`, `mentions:[]`만 허용한다. 알림 preview는 읽을 때 만든 최대 80자 텍스트이며 body/UID를 중복 저장하지 않는다.
- [ ] readIds는 본인 미읽음 최대 100개의 조회 snapshot이며 중복을 거부한다. 같은 명령과 `npm run check`를 통과시키고 계약 변경을 커밋한다. 커밋 전 `git var GIT_AUTHOR_IDENT`는 `KIM JINHO <okho04@gmail.com>`이어야 한다.

## Task 2. 실제 DB에서 관계·삭제·알림 원자성 보장

**파일:** 새 `supabase/migrations/202609280007_lounge_conversation.sql`, `supabase/operations/lounge-notification-cleanup.sql`, `scripts/verify-lounge-conversation-db.mjs`. 수정 `scripts/test-workspace-db.mjs`. 구현 시작 시 migration 번호 충돌을 확인한다.

**인터페이스:** 기존 RPC는 유지하고 아래 RPC를 추가한다. 인자는 타입/길이 allowlist이며 클라이언트가 수신자나 작성자를 지정하지 않는다.

```text
list_lounge_threads_v2(p_post_id, p_cursor) -> ConversationPage
list_lounge_replies_v2(p_post_id, p_root_id, p_cursor, p_direction) -> ConversationPage
get_lounge_comment_context(p_post_id, p_comment_id) -> CommentContext | null
add_lounge_comment_v2(p_input) -> {status, comment, summary, context}
delete_lounge_comment_v2(p_post_id, p_id) -> {status, summary}
find_lounge_mention_targets(p_post_id, p_query) -> MentionCandidate[]
list_lounge_notifications(p_unread_only, p_cursor) -> NotificationPage
get_lounge_unread_count() -> {unreadCount, readCutoff}
read_lounge_notifications(p_ids, p_cutoff) -> {unreadCount, readCutoff}
```

- [ ] harness의 `verifyLoungeCommunity` 다음에 새 검증 함수를 연결한다. 기존 `{sql, asUser, userA, userC, parallelSql, vite}`를 사용해 이관 전후 기존 컬럼 값과 새 RPC를 검증한다.
- [ ] 아래 schema 제약을 migration으로 만든다. public ID UNIQUE와 서버 생성·불변 trigger를 둔다. 원댓글/답글/대상 관계는 같은 게시물인지 트랜잭션 안에서 검증하고 부모 행 잠금과 삭제의 잠금 순서를 통일한다.

```sql
-- 전체 migration이 구현해야 할 핵심 관계
alter table public.lounge_profiles add column public_id uuid default gen_random_uuid();
create unique index lounge_profile_public_id on public.lounge_profiles(public_id);
-- NOT NULL/불변 trigger를 적용하고 기존 nickname/version/changed_at은 보존한다.
-- lounge_comments: root_id, reply_to_id, deleted_at, mentions jsonb를 추가한다.
-- root_id null이면 원댓글, 아니면 같은 post의 원댓글만 참조한다.
-- notifications UNIQUE(recipient_id, comment_id); recipient는 서버가 계산한다.
```

- [ ] 기존 프로필 freeze trigger의 허용 컬럼을 검토한다. 댓글 soft delete·탈퇴 처리에 필요한 update RLS와 server-only helper만 연다. 알림 insert는 저장한 댓글의 작성자 claim과 실제 답글/멘션 관계를 검증하며 알림 수신자의 직접 쓰기는 허용하지 않는다.
- [ ] 등록은 같은 UUID+전체 요청(본문·관계·멘션)의 성공 재시도를 먼저 판별한다. 그 후 한도 검사 → 댓글 insert → 본인 제외/중복 제거 수신자 최대 4명 → 알림 insert를 같은 transaction으로 처리한다. 같은 UUID의 다른 본문/대상/계정은 conflict다.
- [ ] 알림 정리는 시간·수신자/전역 상한을 잠금 안에서 집행한다. 정책상 오래된 알림을 제거한 뒤 insert하며 cron 실패 시 삽입 시점에도 상한이 유지되어야 한다. cron helper는 클라이언트 execute 권한 없이 별도 최소 권한으로 실행한다.
- [ ] 모두 읽음도 전달된 p_ids 최대 100개 중 본인 소유·cutoff 이전인 행만 갱신한다. 빈 ID 배열을 전체 변경으로 해석하지 않는다. 조회 시점 뒤에 commit된 알림은 ID 집합에 없으므로 유지된다.
- [ ] 탈퇴한 대상의 멘션을 `@탈퇴`로 치환하고 해당 연결을 제거한다. code point 범위의 뒤쪽부터 처리한 뒤 남은 범위를 조정해 다른 멘션을 손상시키지 않는다. root/target 삭제 자리 처리, 기존 v1 delete RPC 연동, 게시물 cascade를 검증한다.
- [ ] `get_lounge_comment_context`는 root와 대상이 포함된 답글 최대 10개 구간을 반환한다. `previousCursor`와 page의 `nextCursor`로 양쪽 탐색을 제공하고 `p_direction`은 `older|newer`만 허용한다. 반환 화면 순서는 언제나 오래된 순이다. 삭제된 대상을 직접 열면 null을 반환한다.

실제 DB assertions에는 다음 결과를 포함한다.

```text
A 원댓글 ← B 답글(+A 멘션) => A 알림 1개, kind=mention
B 같은 UUID 재시도 => 댓글 수/알림 수 동일
C가 A의 read_lounge_notifications 호출 => A 알림 변경 0
A 모두 읽음 cutoff 뒤 B 새 답글 => 새 알림 unread=true
A 원댓글 삭제 => 본문/author 없음, B 답글 유지, live commentCount=1
다른 post root·depth 2 root·순환·겹친 mention·임의 publicId => invalid
profile nickname 변경/옛 이름 재사용 => 기존 mention publicId 동일
계정 삭제 => 본문/명시적 mention label scrub, 타인 답글 유지
```

- [ ] `node scripts/test-workspace-db.mjs`에서 실제 PostgreSQL 권한·동시 작성/삭제·탈퇴·레이스·행 상한·400MiB 분기·이관 보존을 통과시킨다. 시나리오 추가 시 fake fixture만 통과시키지 않는다.
- [ ] migration007 적용 후 v1 조회/작성/삭제 및 기존 strict parser를 다시 검증한다. 이전 migration 파일을 재적용하지 않고 upgraded DB에서 별도 호환 assertions를 실행한다.
- [ ] 최대 길이 20,000 댓글·멘션·20,000 알림의 DB/인덱스 증가량을 기록한다. 실제 상한이 400MiB 여유를 침범하면 한도를 줄여 설계에 반영한 뒤 커밋한다.

## Task 3. 통신과 댓글 직접 링크

**파일:** 수정 `src/lounge/infrastructure/loungeRepository.ts`, `src/auth/auth.ts`, `src/auth/externalBrowser.ts`, `src/lounge/domain/publication.ts`, `tests/unit/lounge/loungeRepository.test.ts`, `tests/unit/auth/auth.test.ts`, `tests/unit/auth/externalBrowser.test.ts`. 새 `src/lounge/infrastructure/conversationRepository.ts`는 대화 메서드만 소유한다.

**인터페이스:** `LoungeRepository`가 다음 메서드를 추가로 제공하도록 기존 계정 고정 rpc 함수를 factory에 전달한다. v1 메서드는 남긴다.

```ts
listThreads(postId:string,cursor?:ConversationCursor):Promise<ConversationPage>;
listReplies(postId:string,rootId:string,cursor?:ConversationCursor,direction?:'older'|'newer'):Promise<ConversationPage>;
getCommentContext(postId:string,commentId:string):Promise<CommentContext|null>;
addConversationComment(input:CommentWrite):Promise<{
  comment:ConversationComment; summary:CommunitySummary; context:CommentContext;
}>;
removeConversationComment(postId:string,id:string):Promise<CommunitySummary>;
findMentionTargets(postId:string,query:string):Promise<MentionCandidate[]>;
listNotifications(unreadOnly:boolean,cursor?:ConversationCursor):Promise<NotificationPage>;
getUnreadCount():Promise<{unreadCount:number;readCutoff:string}>;
readNotifications(ids:string[],cutoff:string|null):Promise<{unreadCount:number;readCutoff:string}>;
```

- [ ] RPC 인자·extra field 거부·계정 교체·없는 대상·같은 write ID 재시도를 unit으로 먼저 고정한다. 목록 오류를 빈 목록으로 바꾸지 않는다.
- [ ] `?post=<uuid>&comment=<uuid>`를 댓글 직접 링크로 지원한다. comment는 유효 post가 있을 때만 허용하고 서버가 둘의 소속을 다시 검사한다. OAuth/copy/Kakao 외부 이동에도 두 UUID만 안전하게 넘긴다.

```ts
expect(safeReturnPath('/IndividualSavingsFlowUI/apps/lounge/?post=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&comment=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&access_token=secret', '/IndividualSavingsFlowUI/'))
  .toBe('/IndividualSavingsFlowUI/apps/lounge/?post=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&comment=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
```

- [ ] 잘못된 UUID, 다른 앱의 comment 인자, 외부 URL, fragment/token을 제거하는 계약을 보존한다. 관련 unit과 `npm run check`를 통과시키고 커밋한다.

## Task 4. 밀도 높은 댓글 화면·답글·멘션 입력

**파일:** 수정 `src/lounge/ui/PublicationComments.tsx`, `src/lounge/ui/lounge.css`. 새 `src/lounge/ui/CommentComposer.tsx`, `src/lounge/ui/CommentThread.tsx`, `tests/unit/lounge/CommentComposer.test.tsx`. 기존 `tests/support/loungeCommunityFixture.ts`, `tests/account-workspace.spec.ts` 확장.

**소유권:** PublicationComments는 원댓글 페이지·열린 묶음·이탈 보호, CommentThread는 답글 읽기/펼치기, CommentComposer는 본문·멘션·대상·요청 ID를 소유한다. 새 일반 form 프레임워크는 만들지 않는다.

- [ ] 먼저 `Lounge conversation` 이름의 E2E에 원댓글/답글 진입·답글 후 자기 글 보기·대상 취소/변경·dirty 보존·실패/재시도 시나리오를 작성한다. unit에는 emoji 앞 범위, NFC/IME, 본문 수정·undo·paste와 `a@b` 후보 선택을 추가한다.
- [ ] 설계의 메타/본문 행 구조를 구현한다. 원댓글 padding 10px, 답글 8px/들여쓰기 12px, 메타 gap 4px를 시작값으로 적용한다. 삭제는 본인 더보기 안으로 옮긴다.
- [ ] textarea는 기본 2줄/최대 4줄, 입력 16px, 글자 수·등록은 한 행에 둔다. inline 후보 검색은 300ms, IME 조합 후만 요청하고 오래된 결과를 버린다. 메뉴를 열어도 textarea 내용/범위를 유지한다.
- [ ] 닫기 시 body가 비어 있으면 대상 선택만으로 확인하지 않는다. 등록 성공 시 draft/id를 비우고, 응답 유실 실패에는 동일 요청 ID를 유지한다. 외부 삭제로 reply 대상이 사라지면 입력을 유지한 채 새 대상 선택을 안내한다.

```ts
// Playwright fixture: 1~2줄 원댓글 8개, viewport 390×844, 키보드 닫힘
const bodies=page.locator('[data-comment-body]');
const fullyVisible=await bodies.evaluateAll(nodes=>nodes.filter(node=>{
  const r=node.getBoundingClientRect();
  const area=node.closest('[data-surface-body]')!.getBoundingClientRect();
  return r.top>=area.top && r.bottom<=area.bottom;
}).length);
expect(fullyVisible).toBeGreaterThanOrEqual(5);
```

- [ ] `npx vitest run tests/unit/lounge/CommentComposer.test.tsx`와 `npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'Lounge conversation'`를 통과시키고 390/768/1280 화면을 직접 검토한 뒤 커밋한다. 200% 확대·긴 글은 개수 목표를 적용하지 않는다.

## Task 5. 알림함·읽음·조용한 갱신

**파일:** 새 `src/lounge/ui/NotificationInbox.tsx`, `src/lounge/ui/useLoungeNotifications.ts`, `tests/unit/lounge/useLoungeNotifications.test.tsx`. 수정 `LoungeApp.tsx`, `useLoungeRefresh.ts`의 소비 방식, `lounge.css`, community fixture/E2E.

- [ ] 요청 중복·account 전환·늦은 읽음 응답·cutoff 뒤 신규 알림 유지 unit과 `Lounge notifications` E2E를 작성한다. request generation이 이전 값을 덮지 않도록 한다.
- [ ] 오른쪽 종 버튼/미읽음 badge를 추가하고, 30초 타이머는 기존 scheduler를 재사용한다. 목록은 알림함이 열렸을 때만 조회하며 수동 읽음 성공만 badge에 반영한다. 모두 읽음은 최근 목록의 readIds와 readCutoff를 전송한다. 닉네임 변경 action은 톱니에 유지한다.
- [ ] 알림 클릭 → getCommentContext → 같은 dialog의 댓글 단계로 전환한다. root와 대상 주변 답글 구간을 가져와 표시한다. 이전 구간/다음 구간을 탐색할 수 있고 최초 댓글 페이지를 전부 순회하지 않는다.
- [ ] 단일 dialog 상태는 `notifications | allocation | comments`로 관리한다. 입력이 있는 댓글에서 알림으로 넘어가는 경우 현재 이탈 보호를 먼저 적용한다. 뒤로/닫기는 원래 알림 행/종 버튼으로 초점을 돌린다.

```text
알림함 진입만 실행 => read 요청 0
알림 1개 클릭 성공 => 해당 ID만 read
모두 읽음(readCutoff=T) 직후 새 알림(T+1) 수신 => badge 1
조회 전 시작·조회 후 commit된 알림 => readIds에 없으므로 unread 유지
보이지 않는 탭 60초 => 추가 poll 0
댓글 draft 상태 30초 => 본문/대상/scroll 동일
```

- [ ] unit/E2E를 통과시키고 알림 최대 보관·삭제 대상·읽음 실패 재시도·새 수신 알림의 초점 유지까지 검토 후 커밋한다.

## Task 6. 통합 검증·문서·운영

**파일:** PRD, DESIGN, 기존 댓글 spec의 현재 상태, `docs/supabase-account-setup.md`, 새 `docs/superpowers/evidence/2026-09-28-community-conversation.md`.

- [ ] 답글 깊이·계정 삭제 자리 처리·공개 식별자·앱 내 알림·밀도 규격을 현재 제품 문서에 반영한다. 구현 전에는 본 계획의 초안 표시를 완료로 바꾸지 않는다.
- [ ] `npm run check:ci`, `node scripts/test-workspace-db.mjs`, `npx vite build`, `npx playwright test`를 실행한다. v1 댓글/프로필/게시물, 로그인 복귀·Kakao 안전 URL, 가져오기/금융 workspace 보존을 회귀 범위에 넣는다.
- [ ] 390/768/1280, 짧은 모바일 높이, 실제 모바일 키보드, 200% 확대, pointer drag/scroll, 키보드·스크린리더 이름·44px·reduced motion을 기록한다. 실기기 미검증은 별도로 남긴다.
- [ ] migration 전후 기존 데이터의 변경 대상 외 projection/digest·DB 크기·권한·v1/v2 RPC를 확인한다. 삭제/탈퇴 fixture는 로컬 disposable DB에서만 만든다.
- [ ] DB migration과 알림 정리 job → 프런트 PR/CI/Pages → 운영 읽기 확인 순서로 출시한다. 롤백 시 대화 데이터를 삭제하지 않고 이전 프런트로 되돌린다. 원격/로컬·Orca 정리는 이 출시 범위가 모두 끝난 후 한다.
