# 주거 대출 설정 검증·운영 기록

2026-09-28. [설계](../specs/2026-09-28-housing-loan-cashflow-proposal.md), [구현 계획](../plans/2026-09-28-housing-loan-planner.md).

## 구현

- Main 지출 도우미의 주거 대출에서 전용 공통 표면으로 이동. 저장 후 Main 요약에서 다시 열기.
- 세 상환방식, 새/기존 잔액, 거치·0%·고정/변동 가정·최대 10건. 선택 월 정기 납입액과 만기 원금 분리.
- 세 개념도 + 실제 월별 원금/이자 SVG, Anime.js 450/500ms, 회차 슬라이더, KPI·상환 내역.
- 조건은 초안으로 저장하고 최종 지출 반영만 Main 주거·생활비를 바꿈. 기존 이자 원본은 보존하되 중복 합산에서 제외.
- assistant 내부 v2, workspace v5·RPC protocol 5·기존 backup/cache 외곽 버전 유지. v1 읽기·v2 이후 구 지출 쓰기 거부·원자적 복원 유지.
- 원금/이자 정수 원 계산은 TS BigInt 유리수와 SQL numeric으로 일치시킴.
- 답변/조건이 그대로인 단순 단계 이동은 종료 경고를 만들지 않음. 대출 표면 안에서 저장 결과 불명/충돌 복구 가능.

## 검증 결과

| 명령/범위 | 결과 |
| --- | --- |
| `npm run check` | source/unit TypeScript 모두 통과 |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:unit -- --maxWorkers=2` | **1,186 통과**, 실패·skip 0 |
| `node scripts/test-workspace-db.mjs` | 통과. 기존 170 TS/SQL fixture, 지출 12 fixture, 새 대출 39 일정 비교. 원본 행 무변경·구 버전 호환·권한·RLS·CAS·receipt·실패 원자성 검사 |
| `ISF_E2E_PORT=6630 npx playwright test --retries=1` | **256 passed, 4 flaky(재시도 통과), 1 skipped, 최종 실패 0** / 10.4분 |
| `ISF_E2E_PORT=6632 npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'housing loan\|expense completion recovers'` | 마지막 UI 보완 후 **9/9 통과**, 재시도 없음 |
| `npx vite build --outDir /tmp/isf-housing-loan-dist` | GitHub Pages의 공개 Supabase 환경변수를 사용한 production build 통과, PWA 생성 완료 |
| `git diff --check`, 문서 상대 링크 | 통과 |

전체 E2E 후 보완은 대출 표면에 기존 저장 복구 버튼 재사용, 부모 review 초점 복원, 개념도 색상 겹침/한 회차 그래프 표시였다. 해당 최종 UI와 기존 expense 복구를 9개 focused E2E로 재확인했다. 공유 계산·저장 계약은 전체 E2E 이후 변경하지 않았다.

전체 실행의 flaky 항목은 기존 Main sheet touch 취소·손잡이, Portfolio mobile entry motion, Portfolio 390px 10개 항목 스크롤, 복제 탭 recovery polling이었다. 첫 시도 실패를 숨기지 않는다. skipped 1개는 production PWA preview 전용 offline revisit로, 일반 dev server 실행에서 조건상 제외된다. 이 작업에서 전용 `test-account-pwa.mjs`는 별도 실행하지 않았다.

최종 focused 검사에서 실제 납입액 저장 테스트가 서버 row 반영 직후 클라이언트 저장 응답을 기다리지 않아 한 번 실패했다. 서버 값뿐 아니라 사용자 종료 guard의 해제까지 기다리도록 수정한 뒤 9개 전체를 다시 통과했다. 초기 설정 없는 build는 필수 Supabase 환경변수 검사로 중단되었고, Pages와 같은 공개 설정을 주입한 build는 통과했다.

## 화면 검토

모의 계정의 1억 원/4% 예시이며 실제 사용자 금융 데이터가 아니다. 그래프의 500ms reveal 완료와 본문 스크롤 위치를 확인한 후 캡처했다. 이전 캡처는 애니메이션 중간 상태였으므로 증거에서 제외했다.

| 폭 | 방식 선택 | 실제 계산 결과 |
| --- | --- | --- |
| 390px | [선택](2026-09-28-housing-loans/loan-methods-390.png) | [원금균등](2026-09-28-housing-loans/loan-result-390.png) |
| 768px | [선택](2026-09-28-housing-loans/loan-methods-768.png) | [원리금균등](2026-09-28-housing-loans/loan-result-768.png) |
| 1280px | [선택](2026-09-28-housing-loans/loan-methods-1280.png) | [만기일시 1회차](2026-09-28-housing-loans/loan-result-1280.png) |

가로 overflow 없음, 단일 dialog containment, 숫자·그래프 가독성, 입력/슬라이더/하단 버튼, 부모·Main 진입점 초점 복귀를 확인했다. 모바일 본문은 KPI·상환 내역까지 스크롤되며 헤더/하단 액션은 공통 고정 영역이다.

## 운영 DB

Orca의 기존 로그인 세션으로 IndividualSavingsFlow production SQL Editor에 접속해 **202609280001_housing_loan_planner**를 적용했다. migration history도 같은 transaction에서 기록했다.

- migration 파일 SHA256: `3ece2fa486f40ddcab6d982cfb3a8e6b4c538edaa7752a886800b74b971857cf`.
- 기존 workspace 5개. 적용 전후 전체 행 집계 checksum **동일**. 행·revision·시각을 재작성하지 않았다.
- `normalize_workspace_v5`로 모든 기존 payload 유효 확인.
- 새 계산 함수는 `workspace_rpc_owner` 실행 가능, anon/authenticated/service_role 직접 실행 불가.
- 운영 DB에서 세 방식의 첫/마지막 예상액을 fixture로 조회. 원리금균등 1,012,451→1,012,507원, 원금균등 1,166,666→836,151원, 만기일시 이자 333,333원+마지막 원금 100,000,000원 확인. 마지막 회차는 원 단위 잔액 정산으로 달라진다.
- SQL Editor의 긴 입력 교체 과정에서 후속 조회가 이전 DDL과 함께 실행되어 기존 함수 중복 오류로 거부된 1회가 있었다. 첫 migration 성공은 유지됐으며 editor 전체 내용을 교체한 후 읽기 전용 검증을 정상 완료했다.

프론트엔드는 DB 적용 후에 배포한다. **PR [#23](https://github.com/jinhoOps/IndividualSavingsFlowUI/pull/23) 검증 중이며 Pages 배포는 아직 진행 전**이다. 실제 사용자 계정에 예시 대출을 저장하거나 월 금액을 바꾸는 운영 테스트는 하지 않았다.

## 남은 범위·롤백

최초 Main 설정 안의 대출 진입, 미래 금리 이벤트, 일할·휴일 약정 계산, 실제 납부 추적, 만기 재원과 완납 이후 Simulation 배분은 후속이다. 현재 계산은 월 단위 예상이며 실제 은행 납입액과 차이는 선택 월 보정으로 반영한다.

assistant v2가 저장된 뒤 구 validator/구 프론트엔드로 단순 롤백하면 해당 기록을 읽지 못한다. v2 데이터와 v5 저장 계약을 보존하는 수정 배포를 우선한다. 후속 소유자는 Main/저장 담당이며 시작 문서는 대출 설계와 이 기록이다.
