# Main 입력과 지출 도우미 초기화

2026-09-11 사용자 후속 요청 반영. 구현과 운영 DB 적용을 완료했다. 후속 로그인 모션과 main 반영 검증은 [통합 기록](2026-09-11-planning-release.md)을 따른다.

## 최종 동작

- `MainManagementMenu`의 왼쪽 `초기화`는 카운트다운 표시 없이 모달을 연 뒤 2.5초 후 활성화한다. 다시 열면 잠금을 다시 시작한다. 취소 초기 focus·Tab 순환·닫은 뒤 톱니 focus 복원은 유지한다.
- `다시 시작`은 입력을 유지한다. `초기화`는 다섯 월 금액이 0인 `restart/welcome` 초안을 저장하면서 `expenseAssistant` 전체를 null로 만든다. 중간 답변·진행·이전 반영 내역(lastApplied)을 모두 지우고 현재 탭의 Main·main-expense 복구 초안도 정리한다.
- Main 적용 계획은 마지막 적용까지 유지한다. 설정 취소로 기존 월 계획으로 돌아갈 수 있지만 삭제한 도우미 내역을 복원하지 않는다. Simulation·Portfolio·계좌 지도는 보존한다.
- 모달 설명은 두 문장으로 줄여 초기화의 삭제 범위와 월 계획의 변경 시점만 안내한다.
- [DESIGN](../../../DESIGN.md), [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [지출 도우미 spec](../specs/2026-09-10-main-expense-assistant-design.md)을 갱신했다.

## 구현과 저장 계약

- `withMainSetupReset`은 로컬 workspace와 계정 adapter가 공유하는 초기화 변환이다. `BrowserMainRepository.resetSetup`은 Main/progress 변경 여부를 확인하고 단일 revision으로 저장한다. controller는 앞선 진행 저장을 기다린 뒤 초기화한다.
- 전용 `reset_main_setup` RPC를 추가했다. 일반 `save_main`은 계속 도우미 답변을 보존한다. 서버는 요청이 정확한 빈 재시작 초안·assistant null인지 확인하고 적용된 Main 금액을 변경하는 요청을 거부한다.
- 답변 삭제·초안 저장·mutation receipt는 한 트랜잭션이다. 응답 유실은 같은 mutation으로 확인한다. revision 충돌 후 명시적 재적용은 최신 Main을 유지한 새 빈 초안을 만든다. Main이 사라졌으면 초기화 후보를 만들지 않는다.
- [추가 migration](../../../supabase/migrations/202609110001_main_setup_reset.sql)은 기존 행·revision·timestamp를 변경하지 않는다. schema v5와 저장 키는 그대로이며 새 RPC를 프론트엔드 배포 전에 적용해야 한다. 2026-09-11 운영 DB에 적용했고 기존 행과 receipt 해시 보존을 확인했다.
- 계정 캐시는 새 pending operation을 보관해 재시작 후 결과를 확인할 수 있다. 구 클라이언트로 돌아가면 알 수 없는 pending을 기존 invalid-pending 복구 경로로 보존하며 자동 재전송하지 않는다.

## 최신 검증

- `npm run check`: 통과.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/unit/main tests/unit/workspace tests/unit/journey`: 63개 파일, 622개 테스트 통과. 로컬 원자적 초기화·stale 거부·복구 초안 제거·캐시 pending 재개와 다른 slice 보존 포함.
- `node scripts/test-workspace-db.mjs`: 격리된 일회용 PostgreSQL에서 통과. 170개 workspace·12개 expense TS/SQL fixture와 reset migration 데이터 보존, applied/다른 slice 변경 거부, 인증·schema·CAS·동일 receipt 재시도, receipt 실패 시 초안/내역 삭제 전체 rollback 포함.
- 더미 Supabase 환경변수를 사용한 `npx vite build`: 통과. 제품 버전 증가 없음.
- `npx playwright test --output test-results/main-reset-assistant-regression`: 180개 통과, 기존 review 1280px의 터치 너비 측정 1개 실패, PWA 전용 1개 skip. 실패 테스트는 코드 변경 없이 단독 재실행(`npx playwright test tests/reading-width.spec.ts --grep 'keeps first and restart Main review frames correct at 1280px' --output test-results/main-reset-reading-recheck`)에서 통과했다. 최초 측정은 0.015625px로 두 animation frame 대기만 하는 기존 측정의 일시 실패 가능성이 남으며, 이번 변경에서 별도 수정하지 않았다. 최종 검증 범위는 181개 통과다. Supabase 응답 fixture와 로컬 workspace를 사용하며 실제 운영 검증과 구분한다.
- 최종 설명을 줄인 뒤 `npx playwright test tests/account-workspace.spec.ts --grep 'Main reset' --output test-results/main-reset-assistant-final`: 6개 통과. `npm run check`도 재통과했다.
- UI 검증 범위: 390/768/1280px 모달 containment·44px 버튼·좌우 배치·focus trap·2499ms 비활성/2500ms 활성·재진입 잠금. 새로고침과 설정 취소 후 도우미가 첫 질문의 빈 답변으로 시작하는지 확인한다.

[390px](../../reviews/2026-09-11-main-reset/main-reset-390.png) · [768px](../../reviews/2026-09-11-main-reset/main-reset-768.png) · [1280px](../../reviews/2026-09-11-main-reset/main-reset-1280.png)

## 계정 메뉴 문의

현재 5180 미리보기는 `tests/support/legacy.vite.config.ts`로 인증 gate를 생략한다. 일반 `AccountWorkspaceGate` 실행은 localhost에서도 계정 이메일·마지막 저장·로그아웃을 톱니 메뉴에 제공한다.
