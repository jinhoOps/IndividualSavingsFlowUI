# 라운지 선택적 자산 규모 검증

- [설계](../specs/2026-09-28-portfolio-lounge-design.md), [계획](../plans/2026-09-28-lounge-asset-band.md).
- `src/lounge/domain/assetBand.ts`: 20개 고정 구간, 천만/억/10억 경계·0원·미설정 구분.
- `src/lounge/`: 기본 숨김 스위치, 시작 자산 구간 제안과 직접 선택, 목록/상세/게시 미리보기 배지, 스크린리더 설명. 공유 요청에는 구간 코드/null만 보내며 초기 자산 원본은 보내지 않는다.
- `202609280003_lounge_asset_band.sql`: nullable 컬럼과 v2 RPC 3개. 기존 RPC 응답과 갱신을 보존한다. 기존 게시물은 숨김이고 v1 갱신은 이미 선택한 구간을 유지한다.
- Portfolio 가져오기는 비율만 사용한다. 원본과 수신인의 Main·Simulation·보존 slice·백업 계약은 변경하지 않는다.

## 검증

| 명령 | 결과 |
| --- | --- |
| `npm run check` | 타입 검사 통과; 마지막 접근성 보완 후 재확인 |
| `npx vitest run --maxWorkers=2` | 134개 파일, **1,223개 통과** |
| `ISF_E2E_PORT=6653 npx playwright test --output=/tmp/isf-asset-band-full` | **273개 통과, 기존 PWA 1개 제외**, 재시도 없음, 10.7분 |
| `ISF_E2E_PORT=6653 npx playwright test tests/account-workspace.spec.ts --grep Lounge --output=/tmp/isf-asset-band-final-focused` | 접근성 설명 보완 후 **9개 통과**, 18.2초 |
| `node scripts/test-workspace-db.mjs` | 전체 PostgreSQL suite 통과: 기존 170 fixture·대출 39개 비교·Lounge 권한/보존·v1/v2·구간·null 제거·CAS/retry·상한 |
| 검증용 공개 Supabase 설정으로 `npx vite build` | 최종 production build, 47개 precache 생성 성공 |
| `npm run check:harness`, 문서 링크, `git diff --check` | 통과 |

390/768/1280에서 숨김 기본값, 자동 제안, 직접 선택, 구간 없는 제출 방지, 공개/숨김 갱신, 원금 미전송, workspace 무변경, 초점 복귀와 overlay containment, 44px 터치 영역을 검증했다. 자산이 없는 0원과 Simulation 미설정을 구분했고, 스위치를 다시 끄면 불필요한 종료 경고가 없어지는 것도 확인했다.

전체 E2E 이후 카드 배지의 `aria-describedby`만 보완하고 타입·focused·빌드를 다시 통과했다. 일반 E2E의 PWA 제외는 서비스워커를 차단하는 기존 설정이며, 이번 변경에는 PWA 경로/캐시 정책 변경이 없다. 로그인 이후 UI는 HTTP fixture를 사용한다. 실제 두 계정 OAuth 왕복과 물리 기기 검증은 하지 않았다.

## 운영

2026-09-28 프로젝트 `fqongmuyfmxjqmefekbg`에 migration과 이력을 한 트랜잭션으로 적용했다.

- workspace 5개, 전후 전체 행 checksum `c90586395bf345ac138d5b00326df332` 동일.
- 기존 게시물 0개, 원래 컬럼의 전후 checksum `d751713988987e9331980363e24189ce` 동일. 검증용 실제 게시물은 만들지 않았다.
- 컬럼은 nullable text, 안전한 전용 역할/search_path/definer의 신규 RPC 3개, 기존 RPC 4개 유지.
- anon 신규 RPC 실행 0개 허용, authenticated 3개 허용. authenticated 테이블 직접 조회/쓰기 거부, FORCE RLS 유지.
- 로컬/운영 migration SQL digest `24c250f8391686389cf7c6bf41b695f4` 일치.
- DB 시험 컨테이너 없음, Supabase 브라우저를 원래 프로젝트 화면으로 복귀.

## 배포 완료

- [PR #26](https://github.com/jinhoOps/IndividualSavingsFlowUI/pull/26), 병합 커밋 `2e838fd5`.
- [PR CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36373435618), [main CI](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36373548772), [Pages 배포](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/36373548788) 모두 성공.
- 실제 [라운지](https://jinhoops.github.io/IndividualSavingsFlowUI/apps/lounge/)와 JS 7개가 HTTP 200이며, 배포 파일에 자산 규모 옵션과 v2 게시 RPC가 포함된 것을 확인했다. 390/1280에서 비로그인 진입은 로그인 화면이고 overflow·JavaScript 오류가 없다.
- 로컬/원격 `jinhoOps/lounge-asset-band` 삭제, main 동기화, Orca 완료 처리.

## 화면 증거

- [390px 공유 편집](2026-09-28-lounge-asset-band/lounge-publish-390.png)
- [768px 공유 편집](2026-09-28-lounge-asset-band/lounge-publish-768.png)
- [1280px 공유 편집](2026-09-28-lounge-asset-band/lounge-publish-1280.png)
- [768px 목록 배지](2026-09-28-lounge-asset-band/lounge-list-768.png)
- [390px 상세 배지](2026-09-28-lounge-asset-band/lounge-detail-390.png)
