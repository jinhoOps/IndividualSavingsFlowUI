# 관리비 설명과 남는 돈 분배 검증

2026-09-10. [설계](../../superpowers/specs/2026-09-10-main-remaining-allocation-design.md).

## 변경 범위

- `src/main/domain/expenseAssistant.ts`: 관리비를 공용관리비(일반관리비)·수도세·전기세·가스비로 설명하고 따로 납부하는 공과금과 중복 입력을 피한다.
- `remainingAllocation.ts`, `RemainingAllocationDialog.tsx`: 현재 남는 돈 범위의 저축·투자 추가분, 전부/반씩/직접 입력, 반영 전후·잔액, 취소·실패·0원/적자 안내.
- `CashflowSummary.tsx`, `CashflowDonutSummary.tsx`, `SummaryDashboard.tsx`, `main.css`: 금액 진입점, 기존 Main 저장 연결, 반응형 modal·focus·밀도.
- PRD·DESIGN·관련 spec·README에 현재 동작을 반영했다. package/lock/manifest는 0.11.95이며 기존 Pages workflow가 빌드에서 0.11.96으로 증가시킨다.
- workspace schema 5, protocol 5와 기존 `save_main` 경로를 사용한다. SQL·백업·저장 키를 변경하지 않는다.

## 검증 증거

- `npm run check`: source/unit TypeScript 통과. `/tmp/isf-remaining-check-final.log`.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/unit/main`: 40 files, 360 tests 통과. `/tmp/isf-remaining-unit-final.log`.
- 실제 공개 Supabase URL/publishable key 환경의 `npx vite build`: 통과. `/tmp/isf-remaining-build-final.log`. 키는 출력하거나 커밋하지 않았다.
- `npx playwright test --max-failures=3`: 175 passed, 1 skipped. `/tmp/isf-remaining-full-final.log`. 마지막 잘못된 첫 입력의 취소 추적 보완 직전 전체 회귀다. 해당 보완 후 Main unit·타입·build와 전체 cloud group을 다시 검증했다.
- 최종 `npx playwright test --project=cloud --max-failures=2`: 46 passed. 잘못된 첫 입력의 취소 추적 보완과 추가 회귀를 포함한다. `/tmp/isf-remaining-cloud-verified.log`.
- 1 skip은 일반 E2E가 service worker를 차단하므로 제외되는 `motion-system.spec.ts`의 PWA 전용 offline revisit gate다. 이번 변경에서 별도 PWA runner·설치된 사용자 PWA 업그레이드·실제 운영 계정 write는 새로 실행하지 않았다.
- Orca 로컬 브라우저에서 금액 진입점과 도우미의 접근 가능한 화면 구조를 확인했다. 스크린샷은 Playwright 계정 HTTP fixture로 캡처했다.

계정 fixture 검증은 실제 Supabase 계정 write 검증이 아니다. 새 분배 기능은 이미 배포된 Main 저장 RPC를 사용하며 운영 DB migration은 필요 없다.

## 검증한 사용자 동작

- 아무 입력 없이 열기/닫기는 write를 만들지 않는다.
- 전부 저축 → 전부 투자 → 반씩 변경이 추가분을 누적하지 않는다.
- 90만 원 중 저축 10만·투자 20만만 추가하면 각각 월 40만 원, 남는 돈 60만 원으로 저장한다. 저장 전 원본은 유지하며 새로고침 후 같은 결과를 읽는다.
- 재방문에서 남은 60만 원을 저축에 전부 넣으면 월 저축 100만 원이 되고 남는 돈은 0원이다.
- 소수·음수·안전 정수 초과·초과 합산, 홀수 1원과 큰 금액의 정확한 경계를 확인했다.
- 취소 거절은 입력 유지, 확인은 원본 유지 및 focus 복원이다. 처음부터 초과/잘못된 입력이어도 취소 뒤 계정의 미저장 상태를 정리하여 다른 기기의 새 계획을 정상 조회한다.
- 응답 유실 재확인은 같은 mutation 결과를 읽으며 추가분을 두 번 더하지 않는다.
- revision 충돌은 최신 수입·저축을 덮어쓰지 않는다. 최신 계획 채택 후 새 남는 돈으로 다시 분배한다.
- 수입·주거·생활비, 기억한 지출 답변, Simulation·Portfolio·Account Map·locations를 보존한다.
- 390/768/1280px에서 viewport containment, 가로 overflow, 44px controls, focus trap/복원, 입력 아래 반영 후 금액과 footer의 비중첩을 확인했다. 오프라인에서는 진입점이 잠긴다.

## 화면

- [390px](remaining-allocation-390.png)
- [768px](remaining-allocation-768.png)
- [1280px](remaining-allocation-1280.png)

## 회귀 실행 중 관찰

- 첫 전체 실행에서는 기존 `reading-width.spec.ts`의 1280px restart review 터치 폭 측정이 한 번 실패했다. 해당 테스트/제품 코드를 변경하지 않았으며 별도 3회와 이후 전체 실행에서 통과했다.
- 후속 cloud 실행에서는 기존 Account Map의 390px Main overlay 닫힘 검사가 한 번 실패했다. 분배 dialog는 해당 Account Map 경로에서 mount되지 않는다. 별도 3회 재검사와 최종 cloud 전체 46건에서 통과했다.
- 두 초기 실패 로그는 각각 `/tmp/isf-remaining-full-e2e.log`, `/tmp/isf-remaining-cloud-final.log`에 남겼다. 통과처럼 합산하지 않으며 원인을 확정하지 않은 간헐 관찰로 기록한다. 새 기능 실패는 없었다.
