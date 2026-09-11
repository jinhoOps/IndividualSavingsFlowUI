# 시작 장면과 로딩 분리 · 전환 깜빡임 수정

2026-09-11 사용자 정정: 애니메이션은 로딩 UI가 아니다. 새로고침·앱 이동 때 잠깐 보이는 문제를 없앤다.

## 원인과 변경

배포된 이전 커밋 5bf4e46을 Orca의 별도 로그인 검증 탭에서 확인했다. 캐시 탭 식별자를 교체하고 새로고침하면 Navigation Timing은 reload인데도 brand-welcome이 표시됐다. 계정 캐시 식별자 변화가 새 실행으로 오인될 수 있었다. 또 장면 종료 후 조회가 남으면 완성 로고를 유지하는 waiting 상태가 남아 있었다.

- AccountWorkspaceGate는 장면 종료를 조회 완료와 분리한다. 타이머·건너뛰기 후 로고를 남기지 않는다. 로고 없는 조회 안내도 400ms 후에만 표시해 빠른 전환의 문구 깜빡임을 줄인다. 인증·workspace 검증 전 금융 화면을 여는 경계는 유지한다.
- loginLoadingIntent는 reload/back_forward와 같은 origin의 기존 history 내부 이동을 우선 제외한다. 캐시 ID가 바뀌거나 재생 표식이 누락되어도 새로고침은 재생하지 않는다. 새 탭 첫 실행과 Main 명시적 재시작은 유지한다.
- AccountLoadingScreen을 BrandVisual로 명명하고 로딩 문구·aria-busy·status 역할을 제거했다. 기존 geometry, 2.2초 재생, click/Escape 종료와 focus 계약은 유지한다.
- [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [설계](../specs/2026-09-11-account-loading-brand-motion-design.md)를 사용자 정정에 맞췄다.

기존 세션 키를 유지하며 workspace schema, RPC, 계정 캐시 격리와 금융 데이터는 변경하지 않는다. Supabase migration은 필요 없다.

## 검증

- 최종 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·TypeScript 및 145개 파일의 1,338개 unit test 통과. 400ms 전후 상태 문구와 빠른 인증 완료의 무노출을 포함한다.

- 집중 Playwright: 새 실행·느린 응답과 장면 독립 종료·실제 네 앱 메뉴 이동·캐시 ID 변경·새로고침·뒤로 가기·OAuth·Main 재시작·reduced motion·복제 탭 등 8개 통과.
- 전체 `npx playwright test`: 183개 통과, 별도 production PWA 검증용 1개 skip (5.3분).
- `node scripts/test-account-pwa.mjs`: 실제 production service worker 31개 shell cache, Auth/Data/code cache 제외, 인증된 offline Main 읽기 전용 통과.
- 390/768/1280px에서 overflow·시각 영역 containment·44px 조작 영역·heading/skip focus 확인. 앱 이동·새로고침·뒤로 가기는 MutationObserver로 로고 DOM의 일시 mount도 검사했다.
- 문서 상대 링크와 `git diff --check` 통과.

실제 Google provider 왕복과 사용자 기기의 설치형 PWA 재실행은 이번 검증 범위가 아니다. OAuth 연속 진입과 offline 계정 경계는 fixture를 사용한다.
