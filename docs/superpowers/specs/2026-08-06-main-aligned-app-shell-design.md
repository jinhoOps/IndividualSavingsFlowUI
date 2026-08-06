# Main 기준 공통 AppShell 설계

- 작성일: 2026-08-06
- 상태: 승인됨
- 범위: Main·Simulation·Portfolio·Account Map의 launcher 위치와 공통 canvas
- 제품 기준: [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md)

## 1. 문제

네 지원 경로가 같은 `AppLauncher`를 사용하지만 launcher 바깥 shell을 서로 다르게 조립한다. Main은 최대 1200px wrapper와 20px·32px 반응형 좌우 padding을 사용한다. Simulation은 shell 전체에 `clamp(.75rem, 2vw, 1.5rem)` padding을 적용하고 Portfolio는 `calc(100% - 2rem)` 폭을 사용한다. 앱을 이동하면 launcher의 x 좌표, 폭과 상단 위치가 달라진다.

Simulation과 Portfolio shell은 `background: var(--bg)`를 지정해 공통 body의 ISF Pearl radial canvas를 단색으로 덮는다. 기능은 같아도 앱별로 상단 바와 배경이 흔들려 하나의 제품군처럼 보이지 않는다.

## 2. 목표

1. Main의 현재 launcher frame을 네 지원 경로의 공통 기준으로 사용한다.
2. Main·Simulation·Portfolio·Account Map에서 launcher의 x 좌표, 폭과 상단 위치를 동일하게 유지한다.
3. 앱 shell의 단색 배경을 제거하고 공통 ISF Pearl radial canvas를 그대로 보여준다.
4. 각 앱 콘텐츠의 기존 최대 폭, grid, spacing과 시각화 구조는 유지한다.
5. setup·onboarding처럼 launcher를 숨기는 집중 흐름은 기존 동작을 유지한다.

## 3. 범위 밖

- `AppLauncher`의 navigation, overflow, tooltip, management menu 또는 focus 동작 변경
- Main dashboard, Simulation 결과, Portfolio 배분과 Account Map 준비 화면의 정보 구조 변경
- 앱별 콘텐츠 최대 폭 통일
- 데이터, 계산, 저장, route 또는 앱 간 상태 소유권 변경
- Tailwind, Vite 또는 dependency 변경
- 새로운 배경 이미지나 시각 효과 추가

## 4. 선택한 접근

공통 React `AppShell`을 `src/components/common/AppShell.tsx`에 추가한다. `AppShell`은 page canvas와 launcher frame만 소유한다. `AppLauncher`는 현재 navigation 책임만 유지하고 각 앱의 content wrapper는 기존 파일이 계속 소유한다.

CSS class만 공유하는 접근은 각 앱이 wrapper markup을 계속 따로 조립해 재발 가능성이 남는다. `AppLauncher` 자체가 page padding과 background를 소유하는 접근은 navigation과 page layout 책임을 섞으므로 사용하지 않는다.

## 5. AppShell 계약

### Props

```ts
interface AppShellProps {
  currentApp: AppId;
  managementMenu?: ReactNode;
  showLauncher?: boolean;
  children: ReactNode;
}
```

- `currentApp`과 `managementMenu`는 그대로 `AppLauncher`에 전달한다.
- `showLauncher` 기본값은 `true`다.
- `showLauncher={false}`면 launcher frame도 렌더링하지 않는다.
- root는 `<div className="app-shell">`로 렌더링해 자식 앱의 `<main>`과 중첩되지 않는다.

### Launcher frame

Main의 현재 wrapper 값을 그대로 사용한다.

- width: `100%`
- max-width: `1200px`
- margin-inline: `auto`
- mobile padding-inline: `20px`
- 640px 이상 padding-inline: `32px`
- padding-top: `20px`
- 내부 `AppLauncher` 최대 폭은 기존 `72rem` 계약을 유지한다.

Main의 launcher 위치는 바뀌지 않는다. Simulation, Portfolio와 Account Map이 Main 위치로 이동한다.

### Canvas

- `.app-shell`은 `min-height: 100dvh`를 제공한다.
- `.app-shell`과 앱별 root shell은 별도 page background를 지정하지 않는다.
- `app-foundation.css`의 body background와 radial background image를 공통 canvas로 사용한다.
- page-level color는 공통 `var(--ink)`를 사용하고 Portfolio의 hard-coded shell color를 제거한다.

## 6. 앱별 적용

### Main

- 기존 `MainAppShell`을 공통 `AppShell`로 교체한다.
- dashboard와 recovery의 launcher는 계속 표시한다.
- quick setup과 restart setup은 `showLauncher={false}`를 유지한다.
- `SummaryDashboard`와 setup content wrapper는 변경하지 않는다.

### Simulation

- `main-required`와 정상 결과 경로 모두 공통 `AppShell`을 사용한다.
- 기존 `.simulation-shell`은 content `<main>`의 overflow와 앱 고유 layout만 담당한다.
- shell 전체 padding을 launcher 위치 계산에 사용하지 않는다.
- `.simulation-content`, recovery, onboarding의 기존 최대 폭과 margin은 유지한다.

### Portfolio

- 정상, recovery, zero-investment와 stale-Main 경로 모두 공통 `AppShell`을 사용한다.
- 별도 `.portfolio-launcher` wrapper를 제거한다.
- `.portfolio-content`, recovery와 gate의 기존 최대 폭을 유지한다.

### Account Map

- readiness 화면을 공통 `AppShell`로 감싼다.
- 준비 상태 copy, CTA, 데이터 read/write 부재와 management menu 안내는 변경하지 않는다.

## 7. 반응형 및 접근성

- 390px에서 네 경로 launcher frame의 좌우 시작점은 20px로 같다.
- 640px 이상에서는 좌우 padding 32px을 사용한다.
- 일반 desktop에서 네 경로의 launcher x 좌표와 렌더 폭이 같다.
- launcher의 44×44px target, 현재 위치, overflow, tooltip, management와 focus 복귀 계약은 유지한다.
- `showLauncher={false}`인 흐름에는 숨겨진 빈 frame이나 불필요한 상단 여백이 없어야 한다.
- 공통 canvas 전환 때문에 body 또는 app shell에 가로 overflow가 생기지 않아야 한다.

## 8. 오류와 상태

- `AppShell`은 앱 오류, 저장 상태나 recovery 상태를 소유하지 않는다.
- 각 앱의 alert, status, dialog와 retry 동작은 기존 컴포넌트가 계속 소유한다.
- management menu 오류는 현재 활성 앱 surface에서 계속 읽을 수 있어야 한다.
- launcher가 없는 setup·onboarding 오류는 기존 content 안에서 표시한다.

## 9. 검증

### 단위 테스트

- `AppShell`이 `currentApp`과 `managementMenu`를 `AppLauncher`에 전달한다.
- 기본 상태에서 launcher frame과 children을 렌더링한다.
- `showLauncher={false}`에서 launcher와 frame을 모두 생략하고 children만 렌더링한다.
- 네 앱 entry가 공통 `AppShell`을 사용하고 중복 launcher wrapper를 남기지 않는다.

### Playwright

- 390px, 768px와 desktop에서 Main·Simulation·Portfolio·Account Map launcher의 x, y와 width가 같다.
- 네 경로의 `.app-shell` background가 transparent이고 body의 공통 radial background가 보인다.
- Main launcher의 변경 전 geometry와 변경 후 geometry가 같다.
- setup·onboarding에서 launcher와 빈 상단 frame이 없다.
- 각 앱 콘텐츠의 기존 최대 폭, graph, donut, table과 readiness panel이 계속 표시된다.
- navigation, overflow menu, management menu, keyboard, touch와 focus 회귀가 없다.

### 필수 명령

- `npm run check`
- 관련 공통 UI와 앱 단위 테스트
- `npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list`
- `npm run test:unit`
- `git diff --check`

## 10. 인수 조건

- Main·Simulation·Portfolio·Account Map에서 launcher 위치가 이동하지 않는다.
- Main의 현재 20px·32px padding, 20px 상단 여백과 1200px wrapper가 공통 기준이다.
- 네 경로가 같은 ISF Pearl radial canvas를 사용한다.
- Simulation과 Portfolio의 단색 shell background가 공통 canvas를 덮지 않는다.
- 각 앱 content width와 정보 구조는 변경되지 않는다.
- setup·onboarding의 launcher 숨김과 앱별 데이터·상태 계약은 변하지 않는다.
