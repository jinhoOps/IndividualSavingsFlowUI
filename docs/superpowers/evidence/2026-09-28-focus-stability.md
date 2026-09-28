# 댓글 작성 복귀와 모바일 앱 바 검증 안정화

기준 커밋: `701dff1b3558f35b793e04fcf8967fa78c52043e`

[공통 컴포넌트 검수](2026-09-28-shared-component-audit.md)에서 남은 최초 E2E 실패 3건을 조사했다. [DESIGN](../../../DESIGN.md)의 입력 보호·알림 복귀·450ms 길게 누르기 계약과 [대화 설계](../specs/2026-09-28-community-conversation-discovery-design.md)를 따른다.

## 댓글 복귀: 재현된 원인과 수정

`PublicationComments`는 댓글 폐기 확인을 보여줄 때 `CommentThread`를 unmount했다. 계속 작성하면 thread가 다시 mount되면서 `CommentThread`의 알림 대상 focus effect도 다시 실행됐다. 같은 시점의 입력창 focus 요청 뒤에 이 요청이 실행되면 초점이 댓글로 이동했다. 기존 E2E에서 본문을 비우려던 순간 다른 요소로 초점이 이동하면 입력은 남고, 뒤로 가기는 다시 폐기 확인을 열게 된다.

같은 재생성 때문에 이전 답글 묶음을 읽던 상태도 알림이 가리킨 최초 묶음으로 되돌아갔다. `PublicationComments.test.tsx`에서 frame callback을 실행해 두 동작을 결정적으로 재현했다. 수정 전 두 검사가 모두 실패했고, 수정 후 모두 통과했다.

폐기 확인 중 댓글 목록을 `hidden`으로 숨겨 상태를 유지한다. 숨긴 목록은 접근성 트리와 키보드 탐색에서 제외되며, 계속 작성할 때 target focus effect를 재실행하지 않는다. 입력창 focus와 읽던 답글 묶음을 보존하고, 빈 입력으로 돌아가면 기존 뒤로 가기 동작을 유지한다. API·저장·권한 변경은 없다.

브라우저 회귀 검사는 390px·768px·1280px에서 이전 답글 묶음을 연 뒤 폐기 확인 → 계속 작성 → 입력 지우기 → 알림함 복귀를 확인한다. 예약된 frame callback 뒤의 입력창 focus도 검증한다.

## 모바일 앱 바: 실제 터치 기반 검사

기존 검사는 DOM `pointerdown`·`pointerup`·`click` 합성이벤트로 길게 누르기를 흉내 냈다. 이를 Chromium의 `Input.dispatchTouchEvent`로 바꿔 브라우저가 실제 touch/pointer/click 순서를 생성하게 했다. 450ms 후 툴팁·강조 위치, 길게 누른 뒤 탐색 억제, 다음 짧은 탭의 정상 이동과 브라우저 뒤로 가기, Main 값 보존을 확인한다.

앱 바 제품 코드의 변경 근거는 찾지 못해 수정하지 않았다. 기존 단위 검사의 449/450ms 경계·click/context menu 일회 억제·다중 touch 취소 계약을 유지한다.

조사 중 일반 반복 12회에서는 최초 앱 바 실패가 재현되지 않았다. CPU 속도 1×·4×·8× 진단에서는 한 번 현재 문서에 합성 pointer 이벤트가 기록되지 않은 경우를 관측했지만, 별도 탐색·Vite 로그를 더한 48회에서는 재현되지 않았다. 따라서 최초 앱 바 실패의 정확한 발생 원인을 확정했다고 주장하지 않는다. 실제 입력을 사용하는 회귀 검사로 검증 경로를 개선했다.

## 검증

| 명령 | 결과 |
| --- | --- |
| 수정 전 `npx vitest run tests/unit/lounge/PublicationComments.test.tsx` | 예상한 실패 2개: 입력창 focus 이탈, 답글 묶음 초기화 |
| 수정 후 같은 명령 | 2개 통과 |
| `npm run check` | 통과 |
| `npm run test:unit` | 147개 파일, 1,332개 통과 |
| 첫 12회 반복 (`/tmp/isf-focus-stability-repeat`) | 47개 통과, 1개 실패. 실패 trace에서 검사 중 추가한 코드 주석의 Vite HMR과 문서 reload를 확인했다. 고정된 소스로 다시 실행한다. |
| `ISF_E2E_PORT=6150 npx playwright test tests/app-journey.spec.ts tests/account-workspace.spec.ts --grep 'mobile dock supports\|Lounge notifications open exact reply' --repeat-each=12 --trace=on --output=/tmp/isf-focus-stability-repeat-final` | 통과: 48개, 1.1분 |
| `npm run test:e2e` | 통과: 338개, 의도된 skip 1개, 13.1분 |
| `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build` | 통과: PWA 생성 포함, 버전 변경 없음 |
| `git diff --check`, 문서 상대 링크 | 통과: 변경 문서 3개, 끊긴 상대 링크 없음 |

임시 진단 코드는 제품과 테스트 suite에서 제거했다. 재시도 횟수·검사 timeout을 늘리거나 기존 assertion을 제거하지 않았다. DB·workspace 계약 변경이 없어 DB 검증은 생략한다. 배포 전 로컬 검증 기록이며 운영 반영은 해당 커밋의 GitHub Pages 실행으로 확인한다.

## 알림함 미읽음 배지

운영 로그인 화면에서 미읽음 수 1은 버튼의 접근성 이름에 들어왔지만, 숫자 배경과 목록 미읽음 점은 보이지 않았다. 두 요소의 CSS가 정의되지 않은 `--accent`를 참조해 배경이 투명해진 것이 원인이었다. 둘 다 앱에서 정의한 `--tone-accent`를 사용하도록 고쳤다. 알림 조회·읽음 상태와 저장 데이터는 바꾸지 않았다.

커밋 `0d1d801ab680e67dfe88370883d51d48243a0448`의 [Pages 배포](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36444786648)와 [CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36444786594)가 모두 성공했다. 배포 artifact와 공개 HTML·JS·CSS 37개가 바이트 단위로 일치한다. 로그인된 운영 화면에서 미읽음 1개 배지의 청록색 배경(`rgb(15, 118, 110)`)과 미읽음 알림 행의 같은 색 점을 확인했다.
