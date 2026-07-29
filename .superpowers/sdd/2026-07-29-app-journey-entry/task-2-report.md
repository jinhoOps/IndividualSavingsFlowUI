# Task 2 Report: 배포 경로와 공통 앱 런처

## 변경

- `src/journey/routes.ts`: Vite base 경로를 정규화해 네 앱의 배포 경로를 생성하는 `appPath`를 추가했습니다.
- `src/journey/ui/AppLauncher.tsx`: 현재 앱 표시와 준비 상태를 포함한 단일 `<details>` 기반 앱 런처를 추가했습니다.
- `src/journey/ui/journey.css`: 44px 터치 타깃, 모바일 `<details>`, 768px 이상 가로 런처 스타일을 추가했습니다.
- `tests/unit/journey/routes.test.ts`, `tests/unit/journey/AppLauncher.test.tsx`: 경로 정규화와 접근성 상태를 검증합니다.

## TDD 증거

- RED: `npx vitest run tests/unit/journey/routes.test.ts tests/unit/journey/AppLauncher.test.tsx`는 신규 모듈을 찾지 못해 실패했습니다.
- GREEN: 같은 명령은 구현 후 3개 테스트를 통과했습니다.

## 검증

- `npx vitest run tests/unit/journey/routes.test.ts tests/unit/journey/AppLauncher.test.tsx` — 2 files, 3 tests passed
- `npm run check` — source/unit TypeScript 검사 통과
- `git diff --check` — 공백 오류 없음

## 자체 검토

요구한 네 목적지, base 경계 slash 정규화, 단일 DOM 표현, 현재 링크의 `aria-current="page"`, 준비 상태 텍스트, 모바일/데스크톱 CSS 계약을 확인했습니다. 수정이 필요한 발견 사항은 없습니다.

## 위험

런처는 공용 UI지만 아직 개별 앱 진입점에 연결되지 않았습니다. 이후 앱 셸 통합 작업에서 `AppLauncher`를 렌더링해야 합니다.

## Fix round 1

- RED: `npx vitest run tests/unit/journey/AppLauncher.test.tsx` — `details`에 `open` 속성이 남아 있어 기본 접힘 assertion이 실패했습니다.
- GREEN: `npx vitest run tests/unit/journey/AppLauncher.test.tsx tests/unit/journey/routes.test.ts` — 2 files, 3 tests passed
- Type check: `npm run check` — source/unit TypeScript 검사 통과
- Whitespace: `git diff --check` — 공백 오류 없음

`AppLauncher`는 이제 모바일에서 닫힌 `<details>`로 시작합니다. 768px 이상에서는 기존 `.journey-launcher details > ul { display: flex; }` 규칙으로 같은 단일 메뉴를 가로 표시합니다.
