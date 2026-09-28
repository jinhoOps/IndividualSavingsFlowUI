# 커뮤니티 탐색·정렬 검증

상태: 2026-09-28 로컬 구현 완료, 전체 E2E·운영 rollout 진행 중. 브랜치 `jinhoOps/community-expansion`.

## 구현

- 서버 literal 검색·NFC, 공개 조건 필터, 12개 keyset/120개 묶음, 안전한 URL·읽기 위치 복원.
- 이전 검색 timer가 Back 이후 다시 실행되는 회귀를 재현하고 Enter/외부 query/IME에서 취소했다. 복귀 시 120/24개 복원을 5회 반복 통과했다.
- 공감 distinct 사용자·살아 있는 댓글/답글 수로 15분 집계. 두 세대·10,000행, 만료 안내·명시적 재시작, 실패/400MiB guard에서 기존 집계 보존.
- 동일 자산군의 종목별 1px inset 경계. 합계/실제 폭은 그대로이고 최소 폭·gap 없음.

## 로컬 검증

- `npm run check:ci`: 146개 파일, 1,316개 unit 통과.
- `node scripts/test-workspace-db.mjs`: 기존 170 TS/SQL fixture·금융/저장/대화/탐색/집계 모두 통과.
- `npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'Lounge discovery'`: 6/6. 390/768/1280 화면 확인, focus/취소/오류/IME/오래된 응답/커서 만료 포함.
- 전체 E2E와 배포 빌드 결과는 rollout 완료 시 아래에 추가한다. 로컬 빌드는 test fixture 공개 연결 설정을 사용하며 운영 CI는 기존 배포 설정을 사용한다.

## 최대 규모 성능

`node scripts/test-lounge-db.mjs --benchmark`. Docker PostgreSQL 17.11, Linux aarch64, Node 24.21.0, 동일 Mac의 로컬 Docker. 5,000 게시물·20,000 댓글·100,000 반응·10,000 집계 행. 각 쿼리 warm-up 3회 후 서버 SQL 20회, p95는 정렬된 19번째 관측값이다. 운영 네트워크 지연 보장은 아니다.

| 조회 | median ms | p95 ms |
| --- | ---: | ---: |
| recent | 3.56 | 3.88 |
| one-character | 28.79 | 31.58 |
| ticker | 33.58 | 37.83 |
| hidden-band | 2.58 | 2.91 |
| combined | 23.90 | 26.84 |
| late-reactions | 4.22 | 5.14 |
| late-comments | 4.14 | 4.84 |

- 집계 1회: 67.87ms / 5,000행.
- 전체 fixture DB: 61,798,067B (집계 전 58,201,779B).
- 집계 2세대 테이블+인덱스: 3,604,480B, 그중 인덱스 2,891,776B.
- 게시물 인덱스: 770,048B.
- 7개 모두 p95 200ms 이하. pg_trgm/검색 컬럼·외부 검색 서비스는 추가하지 않았다.
- `EXPLAIN (ANALYZE, BUFFERS)`: 한 글자 검색은 기존 함수 scan에서 1,666행, top-N heapsort 26kB, shared hit 529, 실행 28.66ms. RPC별 buffer/실행 계획과 재현 코드는 benchmark script에 포함한다. 기록은 `/tmp/isf-community-discovery-benchmark.log`이며 지속 가능한 수치는 본 문서에 남긴다.

## 결정과 한계

- 한 프런트 출시로 대화·검색·정렬을 통합한다. DB를 먼저 적용하고 구버전 v1/v2 API를 유지한다.
- query fingerprint는 권한 서명이 아닌 canonical 문자열이다. 서버가 다시 검증하고 인증/RLS는 매 요청 집행한다.
- current epoch는 별도 포인터 없이 같은 트랜잭션의 `max(epoch)`로 선택한다. 동시 refresh/세대 교체/실패 rollback을 DB에서 검증했다.
- 이름 추정 자산군 필터·번호 페이지·무한 DOM·팔로우·개인 추천은 추가하지 않았다.

## 운영

미적용. migration 008/009와 최초 집계·15분 cron, 전후 원본 digest·권한·기존 API·배포 확인을 완료한 뒤 기록한다.
