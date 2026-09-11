# Simulation 목표 편집·설정 패널 검증

- 날짜: 2026-09-11
- 기준: local main `4eb1a3a` 위 변경. 커밋·푸시·배포 전 로컬 검증이다.
- 승인 범위: [목표 도달 요약 설계의 2026-09-11 확장](../specs/2026-08-21-simulation-goal-milestone-design.md), [DESIGN](../../../DESIGN.md).

## 변경

- `TargetAmountControl.tsx`: 기존 기본 목표를 유지하는 직접 목표 입력, ±1천만·5천만 원, 설정 출처 옆 초기화 아이콘으로 기본 목표 복원, 유효성 검사, 예상 기간 피드백.
- `AdvancedSettings.tsx`·Simulation CSS: `목표와 가정`을 기본으로 접고 목표·시작 자산 요약을 표시한다. 한 번 펼치면 목표·시작 자산·금리·물가를 함께 조정한다. 명목·실질은 해설과 함께 그래프 제목 옆에 항상 보인다. 금액 컨트롤 높이와 모바일 한 열·큰 화면 두 열 정렬.
- `SimulationApp.tsx`: 변경한 메뉴명에 맞춘 계산 실패 안내.
- 관련 PRD·DESIGN·목표 spec 및 unit/browser 테스트를 갱신했다.
- 목표는 기존 `targetAmountWon` 필드에 저장한다. Simulation v3/workspace v5, Supabase RPC, 기본 목표 함수, 월별 복리 계산, Main 소유권은 변경하지 않았다. 기존 임의 원 단위 목표는 읽기·blur로 반올림하지 않는다.
- 별도 자동/직접 모드는 저장하지 않는다. 기존처럼 목표가 현재 기본값과 같으면 시작 자산 변경 시 새 기본값을 따르고, 다른 목표는 시작 자산보다 큰 동안 유지한다.

- 후속 사용자 요청: 새 초안 기본 기준금리를 3.0%로 변경했다. -0.25%p 물가 차이는 유지하므로 기본 물가는 2.75%다. 기존 저장된 2.75% 등 사용자 금리는 parser에서 그대로 유지됨을 검증했다.

## 실행 결과

| 검증 | 결과 |
| --- | --- |
| `npm run check` | source·unit TypeScript 통과 |
| `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/unit/simulation` | 23 파일, 190 테스트 통과 |
| `npx playwright test tests/simulation.spec.ts` | 17 테스트 통과 |
| `npx playwright test tests/account-workspace.spec.ts --grep 'simulation target edits' --output test-results/simulation-target-cloud` | 1 테스트 통과 |
| 테스트용 Supabase URL·publishable key로 `npx vite build` | production bundle·PWA 생성 통과, 버전 증가 없음 |
| 변경 canonical 문서 상대 링크·`git diff --check` | 변경 문서 링크 유효, whitespace 오류 없음 |

기본 접힘·키보드 열기/닫기·재방문 시 접힘·기본값·직접 수정·Enter/blur·증감·기본 복원·오류·Escape·안전 정수 한계·시작 자산 이하 거부·기존 원 단위 목표를 검증했다. 브라우저에서는 목표에 따른 상단/하단 예상 기간의 일치, 그래프 geometry·선택 기간 보존, 새로고침 후 목표 유지, Main·다른 앱 slice 보존을 확인했다. 계정 fixture는 `save_simulation`만 호출하고 저장·reload 후 목표를 유지했다.

## 화면 증거

Orca에서 기존 실제 로컬 화면을 확인하고, Playwright fixture에서 390·768·1280px를 재현했다. 각 크기의 키보드 Tab/Enter/Escape, disclosure, 명목·실질 해설, 열림/닫힘 상태의 input·button·summary 44px 이상, 가로 overflow·그래프 가시성을 확인했다. 최종 캡처에서는 CSS transition을 완료한 상태로 기록했다.

- [변경 전 Orca](../../reviews/2026-09-11-simulation-goals/before-orca.png)
- [390px 설정](../../reviews/2026-09-11-simulation-goals/simulation-settings-390.png) · [펼침](../../reviews/2026-09-11-simulation-goals/simulation-settings-expanded-390.png) · [전체](../../reviews/2026-09-11-simulation-goals/simulation-full-390.png)
- [768px 설정](../../reviews/2026-09-11-simulation-goals/simulation-settings-768.png) · [펼침](../../reviews/2026-09-11-simulation-goals/simulation-settings-expanded-768.png) · [전체](../../reviews/2026-09-11-simulation-goals/simulation-full-768.png)
- [1280px 설정](../../reviews/2026-09-11-simulation-goals/simulation-settings-1280.png) · [펼침](../../reviews/2026-09-11-simulation-goals/simulation-settings-expanded-1280.png) · [전체](../../reviews/2026-09-11-simulation-goals/simulation-full-1280.png)

## 한계

- 계정 저장은 실제 클라이언트와 가짜 Supabase 서버 fixture로 검증했다. 운영 계정 데이터는 수정하지 않았다.
- 변경은 Simulation UI에 한정되어 전체 앱 E2E 대신 Simulation 전체와 계정 저장 focused 경로를 실행했다. 미해결 테스트 실패는 없다.
- 후속 검토자는 위 spec 확장과 캡처를 시작점으로 사용한다. 사용자 요청 시 별도 커밋/PR로 통합한다.

## 목표 버튼 후속 정리

- 현재 모아둔 돈과 같은 `−5천만 / −1천만 / +1천만 / +5천만` 네 버튼을 목표에도 적용했다. 초기화 아이콘은 `직접 설정`/`기본 목표` 텍스트 옆이며 접근 가능한 이름은 `기본 목표로`, title은 `기본 목표로 초기화`다. 기본값일 때 비활성, 자동 목표가 없는 시작 자산 2억 이상에서는 기존대로 숨긴다.
- `npm run check` 및 Simulation unit 190개 통과. `npx playwright test tests/simulation.spec.ts --grep '목표 금액을 직접|목표와 가정에서' --output test-results/simulation-target-actions`로 390·768·1280px UI 6개 통과. ±5천만 실제 증감·기본 복원·키보드 순서·44px·가로 배치를 확인했다.
- [390px 직접 설정](../../reviews/2026-09-11-simulation-goals/simulation-settings-custom-390.png) · [768px](../../reviews/2026-09-11-simulation-goals/simulation-settings-custom-768.png) · [1280px](../../reviews/2026-09-11-simulation-goals/simulation-settings-custom-1280.png)

## 최종 화면 구성 — 기본 5년

- 사용자 권장안 승인에 따라 새 초안 기본 기간을 5년으로 변경했다. 기존 저장된 20년 등 선택값은 보존하고 목표 도달 탐색은 최대 30년을 유지한다.
- `SimulationApp.tsx`에서 자산 변화 제목·명목/실질·GrowthChart·기간/수익률·SimulationComparison을 하나의 Surface로 묶었다. 그래프·조작의 중첩 카드 외곽선을 제거했다. `목표와 가정`은 별도로 접힌 상태다.
- 제목은 `N년 동안의 자산 변화`, 0년은 `현재 자산`이다. 비교 배율은 `넣은 돈 대비 N배`이며, `연 기대수익률` 옆의 작은 `(투자)`는 적용 대상을 설명한다. 모바일 그래프 최소 높이를 줄이고 축 글자·touch·keyboard tooltip 회귀를 확인했다.
- 최종 `npm run check`, Simulation unit 190개, Simulation 전체 E2E 17개, 계정 저장 focused E2E 1개, 테스트용 Supabase 설정의 `npx vite build` 통과.
- 최종 캡처는 `npx playwright test tests/simulation.spec.ts --grep '목표 금액을 직접' --output test-results/simulation-layout-final`의 3개 테스트로 갱신했다. 비교값의 시각적 숫자 보간이 semantic 값과 같아진 뒤 캡처했다.
- 기존 기본 20년·각각 독립 카드 표현을 기대하던 테스트는 승인한 기본 5년·통합 패널 계약으로 갱신했다. 20년 chart 동작 전용 unit fixture는 명시적 20년을 유지한다. 선택 기간을 바꿔도 목표 도달 문장이 그대로인지, 같은 패널에서 기간·수익률·금액 기준을 찾을 수 있는지 확인했다.
