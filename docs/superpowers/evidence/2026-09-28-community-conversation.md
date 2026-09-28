# 커뮤니티 대화·알림·밀도 검증

상태: 2026-09-28 구현·전체 검증·운영 DB/job·Pages 출시·PR 병합·작업공간 정리 완료. 현재 `main`.

## 구현과 확인

- 원댓글 20개/한 단계 답글 10개, 직접 댓글 context, 페이지 밖 답글 대상의 공개 ID·현재 닉네임.
- 선택한 사용자 최대 3명, codepoint 범위·IME·편집/붙여넣기, 닉네임 변경/재사용과 사용자 탈퇴 처리.
- 수신자 전용 알림, reply+mention 중복 제거, 본인 제외, 재시도 동일 UUID, 조회 시점 ID+cutoff로 모두 읽음.
- 30일/사용자 100개/전체 20,000개 알림 상한, 400MiB 신규 저장 guard. 금융 schema v5/protocol 5·Storage 이미지 정책 보존.
- v1 댓글/프로필/게시물 응답 유지. 타인 게시물 행 잠금의 UPDATE RLS 문제를 제거하고 동일 advisory lock·FK로 대화 쓰기/삭제를 직렬화했다.

## 검증

- `npm run check:ci`: 146개 파일, 1,317 unit 통과.
- `node scripts/test-workspace-db.mjs`: 전체 계약 통과. 원본 workspace digest, v1 호환·RLS·타인 접근·동시 답글/삭제·알림/재시도·닉네임/탈퇴·실제 용량 한도 fixture 포함.
- rich 댓글 20,000+알림 20,000의 테이블/인덱스 61,505,536B. 댓글 20,000+공감 100,000은 76,488,704B. 각 독립 fixture 측정이며 합산 DB 크기로 오인하지 않는다.
- `npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'Lounge compact conversation|Lounge conversation compact|Lounge notifications open exact'`: 7/7.
- 390×844에서 두 줄 댓글 5개, 768/1280 중앙 모달 확인. 44px 조작 영역과 16px 입력, 본문/입력 분리, 답글 초안 유지·dirty guard·성공 후 해제·알림 왕복 focus 확인.
- 390×520 및 1280×900의 200% zoom 상당 640×450에서 멘션 후보와 등록 버튼 containment 확인. 기존 inline 후보가 footer를 밀어 잘리는 실패를 재현하고 입력 위 제한 높이 후보 목록/짧은 화면 2줄 입력으로 수정, 같은 테스트 통과. drag 닫기·후보 키보드 선택·focus 복귀 확인.
- 실제 iOS/Android 키보드, 실제 스크린리더, 물리 기기 200% browser zoom은 미검증이다. viewport emulation과 접근성 이름/키보드 검증을 실기기 증거로 주장하지 않는다.
- `npx playwright test --trace retain-on-failure`: 319 통과·1 의도된 PWA 프로젝트 skip (13.0분). `npx vite build`: 공개 fixture 연결 설정으로 성공. GitHub 운영 빌드는 기존 배포 설정을 사용한다.

## 운영

2026-09-28 migration 007/008/009를 이력과 함께 한 트랜잭션으로 적용했다. 운영 데이터는 로컬 임시 파일에 비공개 백업했고, 같은 트랜잭션 안에서 기존 열의 전후 digest 일치를 확인했다. workspace 8개·게시물 2개·프로필 2개·댓글 1개·공감 3개의 기존 값이 보존됐다. 사용자 금융 데이터는 이 문서에 기록하지 않는다.

- SQL 원본 MD5: 007 `83f3017bf6bad9cb7e7a49f6a50a53bd`, 008 `67c002d85ec709ce6d3bab38dbaf6cbc`, 009 `4ad4c785fc590cd32b38b347501f1a72`. 운영 migration 이력과 로컬 파일이 일치한다.
- 적용 직전 DB 18,771,091B → migration 후 19,164,307B → 최초 집계/job 후 19,221,651B.
- 알림 정리 즉시 실행 성공, `lounge-notification-cleanup` 매일 03:17 UTC 활성화. 예약 시각의 자동 실행은 아직 관찰 전이다.
- 역할 두 개 모두 NOLOGIN/NOINHERIT/NOBYPASSRLS/비-superuser. notifications RLS 활성, 신규 public RPC 10개는 authenticated 실행 가능·anon 실행 0개. 클라이언트의 알림/집계 테이블 직접 접근 및 private maintenance 실행 권한 0개.
- DB 변경 후 구버전 운영 화면에서 기존 프로필·게시물 v2·댓글 v1 읽기 성공. 운영에 테스트 댓글·공감을 생성하지 않았다.

## 최종 리뷰에서 수정한 회귀

전체 브랜치 독립 리뷰에서 Critical 0·Important 2건을 발견해 모두 재현 후 수정했다.

1. UUID 대소문자 차이로 탈퇴 시 멘션 본문이 남던 문제: UUID 값으로 중복/삭제 대상을 비교한다. 대문자·혼합 표기 삭제와 semantic duplicate 거부 SQL 검증 통과.
2. 알림 첫 페이지만 갱신하여 이전 페이지에 삭제된 내용이 남던 문제: 알림함이 보일 때 최대 100개/5페이지를 대조한다. 삭제/원격 읽음/재진입을 반영하고 새 행을 자동 삽입하지 않는다. 25개 알림의 첫·마지막 페이지 삭제, 초점·스크롤 유지 unit/E2E 통과.

## 실행 결정

- Orca 하위 workspace에서 구현하고 원래 계획 브랜치를 통합까지 유지했다.
- 반복 개발에는 disposable focused DB를 사용하고 출시에는 전체 workspace DB 검증을 실행했다.
- 공통 오류 타입을 `loungeErrors.ts`로 옮겨 통신 모듈 순환 의존을 제거하고 기존 re-export를 유지했다.
- 댓글 메타 행 24px·조작 영역 44px, 인접 비상호작용 여백과 context/footer 8px를 사용한다. 390px에서 두 줄 댓글 5개를 잘림 없이 확인했다.
- 운영 적용 전에 최종 리뷰를 실행하여 보안·호환성 문제를 먼저 수정했다. 대화와 탐색은 DB를 먼저 적용한 뒤 한 프런트 출시로 통합한다.

## 전체 E2E 재검증

최초 전체 실행은 316 통과·1 skip·3 실패였다. 실패는 Main 버튼 hover 색 대비 한 건과 닉네임 저장 후 초점 복귀/설정 재진입 두 건이다. 동일 코드로 trace 재현 4/4 및 초점·색상 진단을 넣은 3회 반복 12/12가 통과해 제품 코드를 임의 변경하지 않았다. 임시 진단을 제거한 뒤 모든 파일 변경을 멈춘 전체 재실행에서 319 통과·1 skip을 확인했다. 제품 코드 수정 없이 전체 gate가 통과했으며 간헐 실패의 단일 원인을 확정하지는 않았다. skip은 일반 프로젝트에서 service worker를 차단하므로 별도 PWA 프로젝트가 담당하는 offline revisit 한 건이다.

운영 read-only 트랜잭션에서 실제 로그인 계정의 request claim과 authenticated 역할로 기존 profile v1·publication v2·comment v1, 새 threads v2·notifications·세 정렬을 조회했다. 게시물 2개·기존 댓글 1개, 모든 feed status `ok`를 확인했다. 이는 SQL 역할 검증이며 아래 실제 브라우저 확인과 구분한다.

## 출시·정리 완료

- [PR #33](https://github.com/jinhoOps/IndividualSavingsFlowUI/pull/33) 병합: `9da8259c4a18376454aa8f6022b545e613afc099`.
- [PR CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36400040496), [main CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36401416563), [Pages 운영 배포](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36401416485) 모두 성공했다.
- 배포 후 실제 로그인 브라우저에서 `SCHD` 검색·댓글순 정렬·기존 댓글 조회·답글/멘션 입력 UI·빈 알림함·관리 메뉴 내부 닉네임 변경 진입을 읽기만으로 확인했다. 해당 검색/대화/알림 RPC는 HTTP 200이었다. 운영 게시물·댓글·공감·읽음 상태를 시험용으로 변경하지 않았다.
- 기존 PWA의 자동 업데이트 후 일반 새로고침으로 새 UI가 반영됐다. 인증/저장 데이터를 초기화하지 않았다.
- 같은 주식색 두 종목의 실제 폭 66.6667%/33.3333%, 뒤 구간의 흰색 35%·1px inset 경계를 운영 DOM에서도 확인했다.
- 로컬 main을 원격 병합 결과로 fast-forward하고, 완료된 계획/구현 브랜치와 Orca 하위 workspace를 정리했다. 실행 ledger는 메인 workspace에 보존했다. 이 문서의 후속 변경은 출시 증거만 보완하며 제품 코드 변경은 없다.
