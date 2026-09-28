# 라운지 댓글·이모지 공감 검증

[설계](../specs/2026-09-28-lounge-community-design.md), [계획](../plans/2026-09-28-lounge-community.md).

## 구현

- 카드·상세의 공감 칩은 종류별 인원과 내 선택만 표시한다. 여러 이모지를 선택할 수 있고 각 종류는 계정당 한 번 집계한다. 서버는 전체 인원을 DISTINCT로 계산하지만 화면에는 표시하지 않는다.
- 게시물당 최대 8종, 0명인 종류는 제거된다. 모바일은 4종과 `… +N`, 새 종류 선택기는 인라인이다. 댓글 개수는 오른쪽에 유지한다.
- 댓글은 공통 modal/sheet의 단계로 열고 최신순 20개씩 이전/다음으로 조회한다. 본문 스크롤·하단 입력·본인 삭제, 오류 복구·실제 미전송 입력만 이탈 보호를 적용한다.
- 별도 테이블·RPC, FORCE RLS, UID/시각 서버 소유, 고정 SQL, strict DTO, 댓글 UUID·공감 대상 상태로 재시도 중복을 막는다. 닉네임은 현재 프로필과 join한다. 기존 publication RPC/금융 workspace/백업·Storage는 변경하지 않는다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npm run check:ci` | 타입·harness·138 files / **1,273 tests 통과** |
| `node scripts/test-workspace-db.mjs` | 실제 PostgreSQL에서 기존 170개 TS/SQL 계약과 새 권한·경쟁·페이지·재시도·cascade·요청/행/용량 상한 검증 |
| cloud `Lounge\|Kakao\|password and Google sign-in\|password login\|password reauthentication` | **38개 통과** |
| 최종 cloud `Lounge community` | 응답 순서 보완 후 **7개 통과**, 재시도 없음 |
| fixture Supabase 설정 `npx vite build` | production build 성공 |
| 390/768/1280 화면 | 카드·댓글 화면 직접 검토, overflow 없음·44px·공통 dialog 포함·초점 복귀 |

초기 화면 테스트는 저장 완료와 재조회 중 상태 두 개를 한 locator로 조회해 4개가 실패했다. 의도한 상태 메시지로 범위를 좁힌 뒤 통과했다. 제품의 접근성 상태는 유지했다.

최종 리뷰에서 댓글과 공감의 동시 요청 응답 순서에 따라 이전 요약이 남는 문제를 재현했다. 두 쓰기가 겹치면 완료 후 최신 요약을 다시 조회하고, 늦은 댓글 응답에도 재조회한다. 진행 중 공감의 잠금은 유지한다. 양쪽 순서의 unit 실패를 확인한 뒤 수정해 hook 5개, UI 7개가 통과했고 독립 재검토에서 추가 발견이 없었다.

## 용량과 보안

- 전체 댓글 20,000개·게시물당 500개·댓글 500자/2,000바이트, 공감 100,000행·게시물당 8종, 활동 메타데이터는 계정당 1행이다.
- 최대 fixture에서 댓글 압축을 끄고 2,000바이트 본문을 채운 결과 세 community 테이블과 인덱스 합계 **76,972,032바이트**였다. 압축된 반복 텍스트 fixture는 21,602,304바이트였으며 보수적인 전자를 예산 근거로 사용한다.
- DB 전체 400MiB(419,430,400바이트) 이상에서 신규 쓰기를 거부한다. 실제 로컬 DB를 해당 크기 이상으로 채워 쓰기 거부·기존 댓글 삭제 허용을 확인했다. 다른 기능의 저장 증가까지 전체 500MB를 보장하는 정책은 아니므로 DB 전체 크기도 관찰해야 한다.
- 댓글 10초 간격·24시간 구간당 40개, 공감 변경 1분 구간당 60회. 무변경 재시도는 한도를 추가 소비하지 않는다. 댓글 삭제는 작성 한도를 되돌리지 않는다.
- 두 계정과 동시 요청, SQL/HTML처럼 보이는 문자, 금지 제어문자·닉네임 갱신·타인 삭제/직접 접근/anon 차단을 검증했다. 운영 사용자 콘텐츠는 테스트로 생성하지 않는다.

## 운영 진행

운영 반영 전 조회: workspace **6개 / bb648f4df4b9f594fad3f90a706e0843**, publication **2개 / 6db7f3b098778958980bebd80bc1d028**, profile **2개 / edb9c11d8d6c37a3075420d6e2cc67d6**. DB **18,394,259바이트**. 새 테이블·006 이력은 없었다. DB migration·프런트 배포 결과는 완료 후 갱신한다.

## 화면

- [390px 카드](2026-09-28-lounge-community/community-card-390.png) · [댓글](2026-09-28-lounge-community/community-comments-390.png)
- [768px 카드](2026-09-28-lounge-community/community-card-768.png) · [댓글](2026-09-28-lounge-community/community-comments-768.png)
- [1280px 카드](2026-09-28-lounge-community/community-card-1280.png) · [댓글](2026-09-28-lounge-community/community-comments-1280.png)

브라우저 흐름은 HTTP fixture이고 실제 SQL 보안·계산은 별도 PostgreSQL에서 검증했다. 실제 모바일 키보드는 공통 dialog의 기존 visual viewport 처리에 의존하며 실기기 테스트를 했다고 주장하지 않는다.
