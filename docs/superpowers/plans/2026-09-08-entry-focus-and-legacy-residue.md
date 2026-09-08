# Entry focus and legacy residue cleanup

**Goal:** 진입 시 제목이 선택된 것처럼 보이는 테두리를 없애고, 이미 폐기된 기능의 미사용 자산을 정리한다.

**Architecture:** Main·Simulation·Portfolio의 단계 제목에 대한 접근성 포커스와 Tab 순서를 유지한다. 공통 CSS에서 비대화형 `h1[tabindex="-1"]`의 기본 outline만 제거한다. workspace 읽기·변환·저장 경계에는 변경이 없다.

**Tech Stack:** React, Tailwind CSS, Vitest, Playwright.

**Contract:** [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)의 Legacy transition 및 [DESIGN](../../../DESIGN.md)의 Accessibility·Required Viewports.

## Investigation and disposition

390px Chromium에서 세 앱의 최초 설정 제목에 `outline: auto 1px`이 나타나는 것을 재현했다. DOM text selection은 비어 있으며 각 단계의 `focus()`가 원인이다. Main의 사례는 `/tmp/isf-bug-sweep/main-before.png`에 확인했다.

| 대상 | 기존 동작·계약 | 판정 및 근거 |
| --- | --- | --- |
| `src/styles/globals.css` | 예전 `.panel`·`.btn`와 전역 theme bridge | 폐기. HTML·CSS·TS import가 없으며 현재 네 앱은 `app-foundation.css`를 사용한다. |
| `scripts/migrate_okf.cjs` | 옛 대문자 파일명의 wiki를 `wiki_new`로 변환 | 폐기. 현재 wiki는 이미 `core/`·`phases/`로 정리되어 매핑의 원본 구조와 다르며 package·CI 호출도 없다. wiki 자체와 archive는 보존한다. 현재 제품 원문은 PRD·DESIGN·spec이다. |
| `scripts/generate_market_data.py` | 예전 index JSON을 합성 일별 시세로 변환 | 폐기. `public/data/indices` 입력·소비자가 없고 백테스트는 PRD non-goal이다. |
| `scripts/generate_qqq_data.py` | QQQ·QLD·TQQQ 합성 JSON 생성 | 폐기. 위와 동일한 예전 시세 schema이며 현재 Simulation은 수익률 기반 복리 계산이다. |
| `scripts/generate_kospi_data.py` | KOSPI 합성 JSON 생성 | 폐기. 위와 동일. |
| `scripts/generate_extra_indices.py` | KOSDAQ·SCHD 합성 JSON 생성 | 폐기. 위와 동일. |
| `scripts/checker_out.txt` | 삭제된 `apps/step1`·`apps/step2`의 정적 검사 출력 | 폐기. 실행 코드·테스트 증거가 아닌 오래된 생성물이다. |
| `package.json`의 `main: sw.js` | 존재하지 않는 루트 npm 진입점 | 제거. 브라우저 앱의 진입점은 Vite HTML이며 서비스워커는 Vite PWA build가 생성한다. |
| `playwright.config.ts`의 `step2.spec.ts` 제외 | 이미 사라진 legacy suite를 무시 | 제거. 현재 Account Map은 `account-map.spec.ts`로 검증한다. |
| `tests/motion-system.spec.ts`의 PWA Simulation 제목 | 폐기된 기간 중심 hero 제목을 탐색 | 최신화. 현재 PRD의 목표 도달 예상 제목을 검사한다. 전용 PWA 실행에서 기존 locator 실패를 재현했고 그래프·오프라인 검증은 유지한다. |

standalone foreign keys, v1/v2·v3 read-only conversion, 백업 converter와 구데이터 fixture는 유지한다. 삭제 대상에는 사용자 데이터나 현재 storage schema가 없다. 필요 시 Git 이력에서 파일을 복구할 수 있으나 지원 제품에 재연결하려면 별도 승인 계약이 필요하다.

## Execution

- [x] `tests/app-journey.spec.ts`에서 390px·768px·1280px, 세 앱의 실제 제목 포커스·outline·Tab 이후 CTA focus indicator를 검증한다. 수정 전 기본 outline으로 실패해야 한다.
- [x] `src/styles/app-foundation.css`에서 `h1[tabindex="-1"]:focus { outline: none; }`를 적용한다. 버튼·입력·modal 포커스 규칙은 유지한다.
- [x] 표의 미사용 파일과 stale 설정을 제거하고 README에 삭제 근거 기록을 연결한다.
- [x] focused Playwright, `npm run check`, 전체 unit·E2E, `npm run check:harness`, `npx vite build`, route/storage reference scan, 상대 링크 및 `git diff --check`를 실행한다.
- [x] 390px·768px·1280px에서 화면·Tab·touch target·overlay containment·시각화 노출을 확인하고 결과를 아래에 기록한다.

## Verification

2026-09-08, Chromium 기준:

| 검증 명령 | 결과 |
| --- | --- |
| `ISF_E2E_PORT=5741 npx playwright test tests/app-journey.spec.ts --grep 'setup entry keeps heading' --reporter=list` | 수정 전 9개 모두 `outline-style: auto`로 실패, 수정 후 9개 통과. 실제 제목 focus, Tab 이후 CTA focus indicator, 44px touch target과 overflow 확인. |
| `npm run check` | source·unit TypeScript 검사 통과. PWA locator 수정 후 재실행도 통과. |
| `npm run check:harness` | 통과. |
| `npm run test:unit` | 133 files, 1,225 tests 통과. route closure 및 retired workspace·v3 conversion·backup·save-lock 회귀 포함. |
| `ISF_E2E_PORT=5741 npm run test:e2e -- --reporter=list` | 125개 통과, 일반 프로젝트가 service worker를 차단하여 PWA 1개 조건부 제외. 네 앱의 반응형·focus·overlay·시각화·foreign storage 보존 검증 포함. |
| `npx vite build` | 통과, `dist/sw.js`와 32개 precache entry 생성. 버전 변경을 수반하는 `npm run build` 대신 동일 Vite production bundler를 직접 실행. |
| `npx playwright test --config playwright.pwa.config.ts --output /tmp/isf-bug-sweep/pwa-results --reporter=list` | 오래된 Simulation heading locator로 최초 실패, 최신화 후 1개 통과. 네 앱 오프라인 재방문과 시각화 최종 상태 확인. |
| 상대 링크 검사·`git diff --check` | 변경 문서의 상대 링크 15개 유효, whitespace 검사 통과. |

추가로 일반 모션 상태에서 세 앱 × 세 viewport의 screenshot과 DOM을 확인했다. 제목 focus는 유지되며 outline은 `none`, document overflow는 없었다. 기존 Account Map 복원 modal의 초기 focus도 정상이다. 증상·수정 screenshot과 실행 로그는 세션 QA 디렉터리 `/tmp/isf-bug-sweep/`에 저장했다.

참조 감사:

```sh
rg -n 'globals\.css|migrate_okf|checker_out|generate_(market_data|extra_indices|qqq_data|kospi_data)|public/data/indices|step2\.spec' src apps shared scripts tests package.json vite.config.ts playwright.config.ts .github
rg -n 'globals\.css|migrate_okf|checker_out|public/data/indices|apps/main/modules|shared/legacy/sw|CompatibilityBridge|IsfStore|isf-rebuild-v1' dist
rg -n 'isf-workspace-v[13]|legacyPhaseA|isf-(main|simulation-compound|portfolio-allocation|account-map|rebuild)-v[12]' src --glob '*.{ts,tsx}'
```

앞의 두 검색은 0건이다. 마지막 검색은 유지해야 하는 workspace converter·old storage key 상수·구버전 writer lock 경계만 반환했다. 보존한 과거 spec·plan·wiki의 역사적 참조는 현재 실행 경로가 아니다. 저장 구현·구데이터 fixture diff는 없으며 기존 사용자 `package-lock.json`의 `hasInstallScript` 변경은 그대로 보존했다.

독립 코드 리뷰와 PWA locator 추가 리뷰에서 조치 필요 사항은 없었다. 확인 범위의 미해결 오류나 후속 소유자에게 넘길 작업은 없다. 별도 Safari·Firefox 실행은 이 검증 범위에 포함하지 않았다.
