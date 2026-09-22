# 결과 이미지 저장 예산·운영 적용 기록

**상태:** 2026-09-22 코드와 운영 DB·함수·Cron을 적용하고 공유를 활성화했다. 정기 Cron 두 차례 자동 실행을 확인했다. 코드 통합·웹 배포 이력은 [PR #20](https://github.com/jinhoOps/IndividualSavingsFlowUI/pull/20)에서 추적한다. 실제 48시간 경과 관찰은 아직 수행하지 않았다.

## 적용 내용

- private `result-card-shares`: 신규 파일 최대 1,000,000B, 전체 예약 최대 400,000,000B, 기본 48시간. 사용자 요청한 500MB 예산에서 100MB 여유를 둔다.
- 계정당 최근 24시간 예약 20회. 정책 행 잠금과 동일 요청 식별로 중복 업로드·동시 예약 초과를 막는다.
- 만료·삭제 실패·불명확한 업로드는 계속 용량에 포함한다. 확인된 Storage API 삭제 후에만 반환한다. 계정 삭제 시에도 객체 추적 행을 남긴다.
- 정리 5분, inventory 하루 1회 및 23시간 경과 시 보조 실행, 관련 작업 로그 7일 정리. 정리 15분/대조 24시간 이상 지연되면 신규 생성을 중지한다.
- 생성 실패 시 기기 저장을 제공하고 24/48시간 모두 정확한 만료 시각을 표시한다. 수신 화면은 표시 중 만료와 foreground 복귀를 검사한다.

## 운영 검증

대상 프로젝트는 `fqongmuyfmxjqmefekbg`다. 인증된 Orca 관리 세션으로 작업했으며 secret은 Edge/Vault와 임시 보호 파일에서만 다뤘다.

| 항목 | 증거 |
| --- | --- |
| 적용 전 | Storage 객체 0개/0B, 공유 테이블·Edge Function 없음, DB 약 11.95MB |
| migration | `202609210001_result_card_shares`, `202609220001_result_card_storage_budget` 적용·이력 기록 |
| 함수 | `result-card-share`, `cleanup-result-card-shares` ACTIVE v1, gateway JWT false + 내부 인증 |
| 데이터 보존 | 기존 workspace 5행, 전체 행 hash `cfaf77604258362be4ec4eaa042358a9` 적용 전후 일치 |
| 백업 | 로컬 비공개 `~/.local/state/isf-share-rollout/20260922-workspaces-before.json`, 디렉터리 0700/파일 0600. Git에 포함하지 않음 |
| 실제 공유 시험 | 합성 1080×1440 PNG 33,911B; 임시 시험 계정 생성·인증·공유·동일 요청 재시도 |
| 접근·제한 | 익명 링크 GET 200/no-store, 허용 origin CORS, 직접 public Storage와 anon 테이블 접근 거부, 1MB 초과 413 |
| 만료·삭제 | 시험 행만 과거 만료 시각으로 바꿔 GET 410 확인 → 실제 cleanup → Storage info 404 |
| 정리 후 | 시험 계정 삭제, 이미지 객체 0개/0B, 생성 활성화·inventory 정상 |
| Cron | `isf-result-card-cleanup` 5분, `isf-result-card-inventory` 매일 03:17 UTC, `isf-result-card-log-retention` 매일 03:27 UTC |

08:30 UTC 첫 스케줄은 함수/Vault 설정 완료 전이라 실패했다. 이 실패를 숨기거나 정상 주기로 세지 않았다. 설정 완료 후 수동 cleanup 4회와 08:35·08:40 UTC 두 차례 자동 Cron의 HTTP 200·timeout false·성공 이력을 확인했다. 작업 발송 성공과 실제 HTTP 성공을 구분했다.

운영 시험에서 전체 capacity를 임시로 낮추거나 다른 사용자의 만료를 변경하지 않았다. 용량 경합, 신규 24시간 전환, 기존 1.5MB 파일 보존은 별도의 로컬 실제 Storage에서 검증했다.

## 검증 명령과 결과

| 명령 | 결과 |
| --- | --- |
| `npm run check:ci` | harness·TypeScript 통과, 128개 파일 / 1,116개 unit tests 통과 |
| `node scripts/test-result-card-storage-db.mjs` | 실제 PostgreSQL 동시 예약·quota·멱등성·만료·owner 삭제·권한·inventory 통과 |
| `npx --yes deno test --allow-env supabase/functions` | 13 tests 통과 |
| 두 함수 `npx --yes deno check` | 통과 |
| `node scripts/test-result-card-storage-live.mjs` | 실제 로컬 Supabase: upload/read/private/413/cap/48h/24h/삭제/계정 삭제/기존 1.5MB backfill·보존 통과 |
| `npm run test:e2e` | 첫 실행 229 통과·3 시간 초과·1 PWA 제외. 전체 성공으로 보고하지 않음 |
| `npx playwright test --last-failed` | 실패했던 3개 모두 통과(16.5초) |
| 이미지 공유 focused E2E | 390/768/1280px, 48시간과 실패·24시간·표시 중 만료 6개 통과 |
| `npm run build` | GitHub Pages 환경의 공개 연결 설정으로 production build 통과 |

첫 전체 실행의 시간 초과는 Main 390px 저축/투자 편집, tablet motion boundary, Main reset response-lost recovery였다. 관련 없는 앱 코드를 바꾸지 않았고 재실행 결과를 별도로 남겼다.

## 화면 확인

[390px](2026-09-22-result-card-storage-budget/storage-budget-390.png), [768px](2026-09-22-result-card-storage-budget/storage-budget-768.png), [1280px](2026-09-22-result-card-storage-budget/storage-budget-1280.png).

세 폭의 PNG를 직접 확인했다. 도표·숫자, overlay containment와 기기 저장 버튼이 유지된다. 모바일 본문은 내부 스크롤이며 footer 버튼은 고정된다. 테스트에서 overflow·44px 터치 높이·workspace 불변·잘못된 이탈 경고 없음·만료 후 이미지 제거를 확인했다.

## 리뷰와 구현 판단

- 별도 최종 리뷰의 P2: 느린 요청이 45초 작업 예산을 넘겨 cursor 저장 전 worker가 종료될 수 있었다. 실패 재현 테스트 후 전체 AbortController deadline과 별도 checkpoint client를 적용했다. 다음 실행이 뒤쪽 파일을 처리하는 테스트 통과. 미처리 리뷰 지적 없음.
- inventory는 페이지별 API 목록 대신 Storage 메타데이터 읽기 전용 RPC를 사용한다. 동일 DB snapshot으로 일관성을 확보하며 실제 삭제는 Storage API로만 수행한다. 외부 SQL로 메타데이터만 지운 숨은 blob까지 감지한다고 주장하지 않는다.
- 실제 Edge Runtime에서 미소비 POST 오류 응답이 지연되어 본문을 1MB 한도로 읽은 뒤 인증한다. 상한 초과 때 스트림을 취소한다. 최대 저장 바이트 제한과 JWT 요구는 유지된다.
- cleanup cursor는 변경 가능한 만료 시각 대신 UUID 순서다. 도구는 npx Deno/Supabase CLI를 사용하며 제품 의존성은 추가하지 않았다. footer는 실제 기존 파일 `PortfolioSummary.tsx`에서 수정했다.

## 남은 확인

- 서버가 반환한 48시간 기한과 시간 이동에 따른 만료·삭제는 검증했다. **실제로 48시간을 기다린 관찰은 미완료**다. 현재 생성한 사용자 링크의 이후 정리 기록으로 확인할 수 있다.
- 다른 bucket이나 외부 writer가 늘면 프로젝트 전체 예산을 다시 확인해야 한다. DB와 egress는 파일 Storage와 별도 지표다.
- 다음 운영자는 [운영 안내](../../supabase-account-setup.md)의 정책 변경·장애 대응과 [설계](../specs/2026-09-22-result-card-storage-budget-design.md)를 시작점으로 사용한다.
