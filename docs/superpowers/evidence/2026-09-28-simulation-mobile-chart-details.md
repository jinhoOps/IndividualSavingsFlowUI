# Simulation 모바일 그래프 하단 상세 검증

- 날짜: 2026-09-28
- 범위: [모바일 그래프 하단 상세](../specs/2026-09-28-simulation-mobile-chart-details.md)

## 원인과 변경

변경 전 390px 브라우저에서 모바일 tooltip은 192×112px로 SVG를 덮었고, 해당 위치의 `elementFromPoint`는 SVG 대신 tooltip의 `P`를 반환했다. `pointer-events: auto`인 카드가 재터치를 받아 그래프 탐색이 끊겼다.

- 모바일 그래프에는 선택 기준선·점만 남기고 전체 상세값을 그래프 아래 일반 문서 흐름으로 이동했다.
- 선택 전·해제 후에는 마지막 시점값을 표시한다. 선택 영역은 탐색 중 높이를 유지하고, 기존 최종 기간 비교에는 기준 시점을 붙였다.
- 가로 드래그·재터치와 세로 페이지 스크롤을 구분한다. 768px 이상 상세 tooltip과 그래프 모션은 유지했다.
- 금융 계산·저장 경로·schema·Main 읽기 전용 경계는 변경하지 않았다.

## 검증

- `npm run check`: 통과.
- `npx vitest run tests/unit/simulation --maxWorkers=2`: 23 files, **196/196 통과**.
- `ISF_E2E_PORT=6642 npx playwright test tests/simulation.spec.ts tests/simulation-axis.spec.ts --project=chromium`: 최종 **31/31 통과**, retry 없음 (49.1s).
- 수정 후 집중 재검사: 기존 원금 수정 3개 화면, 큰 원금 그래프 3개 화면, 실제 touch 탐색 320px·390px **8/8 통과**, retry 없음.
- 브라우저 touch 이벤트로 0→6→12→18→24→30년 드래그, release, 기존 tooltip 위치 재터치, cancel, 영역 밖 터치, 세로 swipe를 검증했다. 재터치는 SVG에 도달하며 선택값 탐색 전후 workspace 직렬화 값이 동일했다.
- 320px·390px 상세값 위치·높이, 금액 줄바꿈·가로 overflow; 390px·768px·1280px 큰 원금 표시·tooltip 경계·편집기 focus·touch target; 명목/실질·월별 값과 Anime.js 회귀를 관련 검사에서 확인했다.
- 변경 문서 상대 링크 58개 누락 없음, `git diff --check` 통과.

### 검사 중 발견한 항목

- 새 비교 기준 행을 추가하면서 기존 테스트가 모든 `dd`를 애니메이션 숫자로 세었다. 실제 숫자 요소를 가진 행만 검사하도록 수정했다.
- 320px에서 웹폰트 로딩 중 측정한 좌표가 달라져 `document.fonts.ready` 후 비교하도록 수정했다. 재검사에서 위치·높이가 동일했다.
- 실행 중 문서 편집이 Vite page reload를 일으켜 768px 편집기 검사가 한 번 중단됐다. 해당 재탐색 로그와 dev server의 문서 reload 기록을 확인했고, 파일 편집 없이 다시 실행해 통과했다.

## 직접 확인한 화면

- [변경 전 모바일](2026-09-28-simulation-mobile-chart-details/mobile-before.png)
- [320px 선택값 탐색](2026-09-28-simulation-mobile-chart-details/simulation-touch-320.png)
- [390px 선택값 탐색](2026-09-28-simulation-mobile-chart-details/simulation-touch-390.png)
- [390px 큰 원금·월별 탐색](2026-09-28-simulation-mobile-chart-details/simulation-chart-390.png)
- [768px 기존 tooltip](2026-09-28-simulation-mobile-chart-details/simulation-chart-768.png)
- [1280px 기존 tooltip](2026-09-28-simulation-mobile-chart-details/simulation-chart-1280.png)

## 검증 범위의 한계

브라우저 검증은 Chromium의 모바일 viewport·touch 에뮬레이션이다. 실제 iOS·Android 기기 검증은 수행하지 않았다. 변경 범위가 Simulation 표시·탐색이므로 관련 앱 테스트를 실행했으며, 다른 앱 전체 E2E·운영 계정 데이터 수정은 실행하지 않았다.
