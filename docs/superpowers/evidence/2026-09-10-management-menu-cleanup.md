# 2026-09-10 톱니 관리 메뉴 정리

사용자 요청: Supabase 계정 저장에 맞춰 톱니 메뉴의 백업 기능과 중복된 앱 아이콘 안내를 제거하고 네 앱의 메뉴를 점검한다. 현재 로컬 작업 결과이며 공개 사이트 배포 기록이 아니다.

## 변경과 유지 범위

| 영역 | 최종 구성 |
| --- | --- |
| Main | 처음부터 다시 — 입력한 값을 유지하며 설정 재확인 |
| Simulation | 시뮬레이션 다시 설정 — 기존 확인 절차 유지 |
| Portfolio | 금액 보기, 비율순·입력순, 투자 배분 처음부터 다시 |
| Account Map | 보관된 목적·계좌 복원, 월 연결 다시 만들기. 지도·초안이 없으면 상태 안내 |
| 공통 계정 | 계정 식별 정보, 마지막 저장, 이 브라우저에서 로그아웃 |
| 조건부 계정 | 이전할 브라우저 계획이 있으면 전체 교체, 미전송·복구 입력이 있으면 복구 파일 |

`AppManagementMenu`의 아이콘 안내 disclosure와 file 항목, Main의 수동 export/import·범위 안내·복원 확인창, 공통 계정의 서버 계획 백업 버튼을 제거했다. 빈 action 구역과 양 끝·중복 구분선을 정리했다. 개별 앱 아이콘의 hover·focus·450ms long-press 툴팁, 앱별 확인 dialog, 오프라인 편집 잠금과 로그아웃은 유지한다.

저장 schema, Supabase RPC, RLS, revision과 기존 데이터는 변경하지 않았다. 초기 브라우저 이전, 유효하지 않은 저장 상태의 명시적 복구, 미전송 입력 복구는 유지한다. Main의 복구 원문 다운로드가 사용하는 backup controller와 하위 parser·command는 호환성 자산으로 남긴다.

변경 구현: [공통 메뉴](../../../src/journey/ui/AppManagementMenu.tsx), [Main 메뉴](../../../src/main/ui/MainManagementMenu.tsx), [Main 연결](../../../src/main/ui/MainApp.tsx), [계정 메뉴](../../../src/auth/AccountWorkspaceGate.tsx), [스타일](../../../src/journey/ui/journey.css). 현재 계약은 [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [README](../../../README.md)에 반영했다.

## 제거된 UI 테스트의 처리

요청으로 사라진 진입점을 테스트에서 억지로 유지하지 않는다. `MainApp.test.tsx`와 `main-react.spec.ts`에서 정상 메뉴의 백업 파일 선택·전체 복원 확인·성공 상태·파일 입력 focus·취소 및 지연된 파일 읽기 경쟁 테스트와 해당 전용 fixture를 제거했다. 이 중 파일 선택과 성공 상태 수명은 폐기된 UI 계약이다. 저장 호환성 자체는 폐기하지 않는다.

| 이전 검증 범위 | 유지하거나 대체한 증거 |
| --- | --- |
| envelope·전체 round-trip·historical schema·invalid 참조 | [workspaceBackup.test.ts](../../../tests/unit/workspace/workspaceBackup.test.ts), [Main backup tests](../../../tests/unit/main/backup.test.ts) |
| 검증 전 write 금지·revision·atomic restore·실패 | [mainBackupCommands.test.ts](../../../tests/unit/main/mainBackupCommands.test.ts), workspace repository/session 단위 테스트 |
| invalid 원문 보존·복구 다운로드 | [MainApp.test.tsx](../../../tests/unit/main/MainApp.test.tsx)의 recovery 테스트와 [main-react.spec.ts](../../../tests/main-react.spec.ts)의 invalid workspace 복구 E2E |
| cloud 전체 복원 응답 유실 | [account-workspace.spec.ts](../../../tests/account-workspace.spec.ts)의 브라우저 계획 이전·idempotent retry로 대체 |
| 오프라인 상태에서 이미 열린 확인창 잠금 | 현재 Main 다시 시작 확인창으로 대체 |
| 아이콘 안내 disclosure | 안내 부재 + 기존 hover·focus·touch 툴팁 검증 |
| 변경 후 메뉴 구성 | 초기·설정 완료 상태의 네 앱에서 390·768·1280px 메뉴 inventory, file input·백업·중복 안내 부재, 44px action, containment, Escape·focus 검증 |

## 검증

- `npm run check`: source·unit TypeScript 통과.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run`: 143개 파일, 1,321개 테스트 통과. Node 26의 기본 WebStorage와 jsdom 충돌을 피하는 실행 옵션이며 제품 코드는 변경하지 않았다.
- fixture 정리 후 Main focused unit: 33개 통과.
- `npm run test:e2e`: 169개 통과, 1개 의도된 PWA offline skip (2.9분). 이 실행은 초기 상태 메뉴 inventory를 포함한다.
- fake Supabase 환경변수를 사용한 `npx vite build`: 통과. 버전 bump와 운영 배포 없이 production bundle 검증.
- 최종 캡처 focused E2E: `npx playwright test tests/account-workspace.spec.ts --project cloud -g "all four authenticated product entries" --output test-results/menu-final` — 초기·설정 완료 2개 테스트 통과(13.8초), 총 24개 메뉴 상태 검증.
- 설정 완료 네 앱의 390·768·1280px 캡처를 직접 검토했다. 메뉴 경계, 글자 가독성, 빈 구역·구분선과 시각화 노출에 새 결함이 없다. 초기 상태를 포함한 24개 캡처를 보관했다.
- 변경 문서의 상대 링크와 `git diff --check`: 통과.

## 시각적 증거와 한계

테스트 계정과 가상 workspace를 사용한다. 메뉴 열림 애니메이션이 끝난 `opacity: 1` 상태를 기다린 뒤 캡처한다. 초기 설정과 설정 완료 상태를 모두 확인한다. [캡처 폴더](../../reviews/2026-09-10-management-menu/)에 390px, 768px, 1280px 증거를 보관한다. 이번 변경은 실제 Google 인증·운영 DB 변경을 요구하지 않으며 라이브 계정 재검증·공개 배포는 실행하지 않았다.
