# Main setup viewport containment과 조용한 인트로 건너뛰기 설계

**상태:** 대화 승인
**작성일:** 2026-08-14
**대상:** Main 웰컴 인트로의 하단 skip control과 기존 Main setup 1/6~6/6

## 1. 문제와 목표

웰컴 인트로의 `화면을 눌러 건너뛰기`는 실제 44px 접근성 control이어야 하지만, 평상시에는 pill 버튼처럼 보일 필요가 없다. 같은 hit area·safe area·keyboard 동작을 유지하면서 텍스트만 보이는 낮은 시각 우선순위로 바꾼다.

기존 setup은 1/6부터 6/6까지 첫 화면에서 진행 action이 보이고, 일반 막대가 panel 밖으로 새지 않아야 한다. 현재 고정 높이 form과 과거 overflow breakout의 조합은 작은 viewport와 desktop 모두에서 action이 첫 viewport 밖으로 밀리거나 막대가 panel을 벗어날 여지를 만든다.

## 2. 범위와 비범위

포함:

- MainWelcomeIntro skip control의 평상시 시각 처리
- Main setup panel의 viewport-contained body/action layout
- 390×844, 768×900, 1280×900에서 1/6~6/6의 첫 paint regression coverage

포함하지 않음:

- Main의 다섯 금액·저장·bootstrap/intro entry reason·focus handoff 변경
- Setup 단계 순서 또는 문구 변경
- review의 실제 비율 초과 표현, 큰 조립 시각화, 상단 launcher 변경
- Simulation, Portfolio, Account Map 또는 차기 앱 작업

## 3. interaction contract

### Quiet skip control

- `<button>`과 `화면을 눌러 건너뛰기` accessible name, safe-area 위치, 전체 44px 이상 hit area, mount focus, pointer/Enter/Space/Escape completion은 유지한다.
- 기본·hover 상태에서는 border, pill radius, 채움 배경 또는 hover fill 없이 중앙 텍스트만 보인다.
- `:focus-visible`에서만 전체 hit area를 감싸는 얇고 충분한 대비의 outline을 표시한다. 이 outline은 keyboard 사용자가 현재 control을 찾게 하지만 일반 화면의 큰 버튼 인상을 만들지 않는다.

### Setup first viewport

- 1/6~6/6의 initial paint에서 단계 progress와 현재 step의 주요 내용, `다음` 또는 6/6의 `계획 적용` action을 같은 첫 viewport 안에서 사용할 수 있다.
- action은 panel-local footer row에 고정한다. 본문이 제한된 높이를 넘을 때만 본문이 scroll하며 action, focus ring, validation error와 safe area를 가리지 않는다.
- 일반 setup progress strip과 FlowContextSummary의 normal layout은 panel 안에 containment한다. 일반 단계가 horizontal page overflow를 만들지 않는다.
- 6/6의 `AllocationBar`만 기존 `app-wide-visual` wide exception과 actual-overflow/edge-clipping 계약을 유지한다. 이 예외를 일반 단계의 panel overflow 허용 근거로 사용하지 않는다.

## 4. 구조

`SetupFlow`는 header(progress와 단계 label), scroll 가능한 body, panel-local action footer의 세 영역으로 나눈다. body/action을 동일한 고정 최소 높이 안에서 서로 밀어내지 않도록 grid row를 명시하고, viewport가 짧을 때는 body만 scroll 가능하게 한다. overflow containment은 setup panel과 일반 body에 국한하며 review visual stage의 명시적 wide exception은 별도로 유지한다.

스타일은 `main.css`의 setup/intro 범위에 한정한다. `MainWelcomeIntro`의 event handler, animation lifecycle과 semantic markup은 바꾸지 않는다. 필요할 때만 `SetupFlow`의 class/structural wrapper를 추가한다.

## 5. 검증과 인수 조건

- unit: skip control은 button semantics, 44px hit area, initial focus와 모든 skip input을 유지하고 기본 visual token은 transparent/text-only, focus-visible outline만 제공한다.
- browser: persisted setup state를 step별로 직접 시작해 390×844, 768×900, 1280×900에서 action rect가 viewport 안에 있고 `documentElement.scrollWidth <= innerWidth`임을 확인한다.
- browser: top progress strip과 일반 FlowContextSummary는 panel bounds 안에 있으며, review `app-wide-visual` 및 기존 actual-overflow/large-deficit clipping assertions은 그대로 통과한다.
- browser capture: 각 viewport의 welcome, representative input, review first paint를 캡처해 action visibility, panel containment, wide-review exception을 눈으로 검토한다.
- regression: Main intro fresh/restart/reduced motion, keyboard-only setup, focused SetupFlow tests, type check와 affected Playwright suite가 통과한다.

## 6. 위험과 완화

- footer가 본문을 덮을 위험은 scroll body의 bottom padding과 focused element visibility assertion으로 막는다.
- panel overflow를 무조건 clip하면 review의 의도된 visual ratio 표현을 손상할 수 있으므로, test는 일반 setup containment와 review exception을 별도로 검증한다.
- skip의 평상시 윤곽을 제거해도 semantic button과 focus outline을 유지해 touch/keyboard discoverability를 보존한다.
