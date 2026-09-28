# 공통 컴포넌트 적용 검수

날짜: 2026-09-28

## 범위와 기준

Main, Simulation, Portfolio, Lounge, 공유 결과 화면과 공통 UI를 검수했다. 화면의 동작을 유지하면서 기존 공통 컴포넌트의 누락된 적용을 정리한다.

- 제품 경계: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- UI 계약: [DESIGN](../../../DESIGN.md)
- 공통 dialog 계약: [통합 하단 시트 설계](../specs/2026-09-22-unified-bottom-sheet-design.md)
- 기준 커밋: `ce7e64468346803a016ee0dc303b55a2c3924f53`

## 검수 결과와 변경

| 표면 | 판단 | 적용 내용 또는 유지 근거 |
| --- | --- | --- |
| 일반 행동 버튼 | 적용 누락 | Lounge와 공유 결과 화면의 네이티브 버튼 35곳을 기존 `Button`으로 변경했다. |
| 버튼 모양 이동 링크 | 공통화 | `Button.tsx`에 `ButtonLink`를 추가하고 Portfolio·Simulation·Lounge·공유 결과의 링크 12곳에 적용했다. 네이티브 anchor를 유지하고 Button과 클래스 생성을 공유한다. |
| Dialog·편집 footer | 이미 공통화 | `ResponsiveDialog`, `ResponsiveDialogLayout`, `ResponsiveDialogActionRow`를 사용한다. 직접 `dialog`를 만들거나 `showModal()`을 호출하는 구현은 공통 shell에만 있다. |
| 페이지·결과 패널 | 이미 공통화 | `AppShell`, `AppContentFrame`, `Surface`를 사용한다. 복구 화면의 `AppContentFrame`에 `ui-surface`를 합성한 두 곳은 의미 있는 기존 조합이므로 중첩 wrapper를 만들지 않았다. |
| 금액 증감·기준 선택 | 이미 공통화 | Main·Simulation·Portfolio의 `MoneyAdjustments`와 `SegmentedControl` 적용을 확인했다. |
| 금액 직접 입력 | 현재 계약 유지 | Main, 목표 금액, 시작 자산, Portfolio 편집은 빈 값·유효하지 않은 초안·blur/Enter 저장·Escape 복원 방식이 다르다. 공통 숫자 정규화와 증감 UI는 재사용하되 입력 전체를 하나의 컴포넌트로 합치지 않았다. |
| Lounge 목록·알림 필터 탭 | 현재 구성 유지 | 앱 내 공통 `.lounge-tabs` 스타일을 공유한다. 공통 `SegmentedControl`과 크기·선택 표현이 달라 추가 변형 API를 도입하지 않았다. |
| 앱 탐색·공감·카드 행·아이콘·인증 버튼 | 전용 컨트롤 유지 | 각 역할의 모양과 상호작용을 유지한다. 일반 CTA 컴포넌트로 일괄 변환하지 않았다. |
| Main의 Button·Surface 경로 | 기존 호환 경로 유지 | 공통 컴포넌트의 재수출이며 별도 구현이 아니다. 경로 변경만을 위한 수정은 생략했다. |

변경된 호출부는 15개 파일이다. 버튼의 `type`, `form`, `disabled`, 이벤트, ref, 접근성 속성과 링크의 `href`를 그대로 전달한다. 기존 클래스와 CSS는 유지한다. `Button`의 기본 제출 동작도 바꾸지 않는다.

`DESIGN.md`의 Button 절에 일반 행동과 이동 링크의 공통 컴포넌트 기준을 추가했다. 제품 경계·저장 계약·DB·운영 데이터는 변경하지 않았다.

## 검증

| 명령 또는 확인 | 결과 |
| --- | --- |
| `npm run check` | 통과: source 및 unit TypeScript 검사 |
| `npm run test:unit` | 146개 파일, 1,330개 테스트 통과 |
| `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build` | 통과: PWA 생성 포함, 버전 변경 없음 |
| `npm run test:e2e` | 334개 통과, 3개 실패, 1개 건너뜀; 13.2분, 종료 코드 1 |
| `ISF_E2E_PORT=6150 npx playwright test tests/app-journey.spec.ts --grep 'mobile dock supports' --repeat-each=3 --output=/tmp/isf-shared-controls-dock-retry` | 코드 변경 없이 3회 통과 |
| `ISF_E2E_PORT=6150 npx playwright test tests/account-workspace.spec.ts --grep 'Lounge notifications open exact reply' --output=/tmp/isf-shared-controls-notification-retry` | 390px·1280px 두 검사 통과 |
| `ISF_E2E_PORT=6150 npx playwright test tests/account-workspace.spec.ts --grep 'Lounge notifications open exact reply' --repeat-each=3 --trace=on --output=/tmp/isf-shared-controls-notification-repeat` | 각 화면 크기 3회, 총 6개 통과; 소스·테스트 수정 없음 |
| 변경 문서의 상대 링크 확인 | DESIGN과 이 기록의 로컬 링크 17개 확인, 누락 없음 |
| `git diff --check` | 통과 |

기존 브라우저 검사는 390px·768px·1280px에서 가로 overflow, dialog 경계·footer, focus 복귀, 44px 조작 영역과 시각화 노출을 포함한다. 변경된 댓글 등록·페이지 이동, 닉네임 폼, 필터, 게시물 공유·가져오기 및 Main 이동 링크의 동작을 기존 테스트로 확인한다. 스타일·속성 전달만을 복제하는 새 단위 테스트는 추가하지 않았다.

추가로 생성된 Portfolio 관리 메뉴, Lounge 댓글과 닉네임 확인 화면의 390px·768px·1280px 스크린샷 9개를 직접 검토했다. 버튼·입력·dialog의 화면 내 배치와 footer 노출을 확인했다. 결과 이미지는 gitignored `test-results/`의 각 테스트 디렉터리에 있다.

### 최초 실패와 재검증 한계

- `mobile dock supports direct taps and history while preserving Main amounts`: 길게 누르기 tooltip을 찾지 못했다. AppLauncher 구현은 이 변경에 포함되지 않으며, 별도 포트의 동일 검사 3회는 소스나 테스트 수정 없이 통과했다.
- `Lounge notifications open exact reply, preserve return focus and explicitly mark read`의 390px·1280px: 댓글을 비운 뒤 뒤로 가기에서 알림함 대신 댓글 폐기 확인이 남아 focus 기대가 실패했다. 입력·이탈 보호·초점 복귀 로직을 검토했고 변경한 부분은 버튼 컴포넌트 적용뿐이다. 개별 재실행 2개와 3회 반복 6개가 모두 통과했다.
- 최초 세 실패의 원인은 재현되지 않아 확정하지 못했다. 전체 E2E를 모두 통과했다고 주장하지 않는다. 실패를 숨기기 위한 테스트 변경이나 재시도 설정 변경은 없다. 재현 시 후속 조사 시작점은 위 두 spec과 원래 `test-results/*/error-context.md`, `/tmp/isf-shared-components-e2e.log`다.
- 건너뛴 1개는 `PWA offline revisit keeps all app routes and final motion state available`이다. 일반 E2E 프로젝트는 service worker를 차단하므로 기존 `pwa-chromium` 전용 조건에 따라 건너뛴다. 이번 작업에서는 PWA 전용 검사를 별도로 실행하지 않았다.

DB·SQL·저장 프로토콜 변경이 없어 별도 DB 마이그레이션 검증은 실행하지 않는다. 이 기록은 로컬 변경 검증이며 새 운영 배포를 의미하지 않는다.
