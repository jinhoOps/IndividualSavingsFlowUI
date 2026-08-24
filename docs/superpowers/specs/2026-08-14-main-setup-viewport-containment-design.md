# Main setup 모션 복구와 조용한 인트로 건너뛰기 설계

**상태:** 대화 승인
**작성일:** 2026-08-14
**대상:** Main 웰컴 인트로의 하단 skip control과 기존 Main setup 1/6·6/6 reveal

## 1. 문제와 목표

웰컴 인트로의 `화면을 눌러 건너뛰기`는 실제 44px 접근성 control이어야 하지만, 평상시에는 pill 버튼처럼 보일 필요가 없다. 같은 hit area·safe area·keyboard 동작을 유지하면서 텍스트만 보이는 낮은 시각 우선순위로 바꾼다.

기존 setup의 1/6 welcome content와 6/6 돈 조립 막대는 Anime reveal이 시작되기 전 각각 투명·`scaleX(0)` 상태로 설정된다. 현재는 animation 생성의 동기 실패만 처리하고, 생성 뒤 timeline이 진행되지 않는 경우 final state로 복구하지 않는다. 특히 6/6의 제목·설명·표까지 타임라인에 묶으면 사용자는 조립 막대뿐 아니라 검토 내용을 전부 잃고 상단 초록 progress strip만 보게 된다.

## 2. 범위와 비범위

포함:

- MainWelcomeIntro skip control의 평상시 시각 처리
- Main setup 1/6 welcome reveal과 6/6 review assembly의 stalled-motion final-state fallback
- normal/reduced-motion과 stalled timeline을 구분하는 focused regression coverage

포함하지 않음:

- Main의 다섯 금액·저장·bootstrap/intro entry reason·focus handoff 변경
- Setup 단계 순서 또는 문구 변경
- review의 실제 비율 초과 표현, 큰 조립 시각화의 geometry·timing, 상단 launcher 변경
- Simulation, Portfolio, Account Map 또는 차기 앱 작업

## 3. interaction contract

### Quiet skip control

- `<button>`과 `화면을 눌러 건너뛰기` accessible name, safe-area 위치, 전체 44px 이상 hit area, mount focus, pointer/Enter/Space/Escape completion은 유지한다.
- 기본·hover 상태에서는 border, pill radius, 채움 배경 또는 hover fill 없이 중앙 텍스트만 보인다.
- `:focus-visible`에서만 전체 hit area를 감싸는 얇고 충분한 대비의 outline을 표시한다. 이 outline은 keyboard 사용자가 현재 control을 찾게 하지만 일반 화면의 큰 버튼 인상을 만들지 않는다.

### Setup motion recovery

- normal motion에서 기존 welcome reveal과 review 인포그래픽 assembly timing·순서를 유지하되, setup 진행 action은 reveal 대상에서 제외해 빠른 단계 전환 중에도 항상 시각적으로 보인다.
- 6/6의 heading·설명·표·초과 안내는 애니메이션 대상이 아니며 첫 프레임부터 최종 상태로 보인다. 돈 조립 막대와 segment만 각 animation의 최대 예정 시간 뒤에도 final state에 도달하지 못하면 final styles로 복구한다.
- fallback deadline은 motion scope lifecycle 안에서만 존재하며, normal completion·skip·step change·unmount에서 취소한다. stale timer가 다른 step에 style을 적용해서는 안 된다.
- `prefers-reduced-motion`과 Anime scope/timeline의 동기 생성 실패는 기존처럼 즉시 final state를 사용한다.
- 상단 초록 progress strip, FlowContextSummary의 actual-overflow/edge-clipping, 6/6 `AllocationBar`의 `app-wide-visual` wide exception은 동작·geometry를 바꾸지 않는다.

## 4. 구조

`SetupFlow`의 motion scope는 animation 시작 직후 final-state deadline을 등록한다. normal animation completion은 deadline을 취소하며, deadline이 먼저 오면 현재 scope가 소유한 reveal/assembly infographic elements에 기존 final-style helper를 적용한다. scope cleanup은 deadline을 해제하므로 strict-mode replay·step change·unmount가 stale completion을 만들지 않는다.

`SetupFlow`의 existing final-style helpers와 motion token을 재사용한다. `MainWelcomeIntro`의 event handler, animation lifecycle과 semantic markup은 바꾸지 않는다. skip의 평상시 visual token만 `main.css`에서 바꾼다.

## 5. 검증과 인수 조건

- unit: skip control은 button semantics, 44px hit area, initial focus와 모든 skip input을 유지하고 기본 visual token은 transparent/text-only, focus-visible outline만 제공한다.
- unit: timeline 생성은 성공하지만 completion/animation tick이 오지 않는 fixture에서 welcome action과 review 본문은 즉시 visible state를 유지하고 review track·segments가 deadline 뒤 final styles가 된다. step change와 unmount 뒤 stale deadline은 적용되지 않는다.
- browser: normal real-time 1/6과 filled-data 6/6에서 전환 직후 review 본문이 visible state이고 예정 시간 뒤 action, assembly track, segments가 final state인지 확인한다. 가상 clock만으로 이 계약을 증명하지 않는다.
- regression: existing review `app-wide-visual`, actual-overflow/large-deficit clipping, Main intro fresh/restart/reduced motion, keyboard-only setup, focused SetupFlow tests와 type check가 통과한다.

## 6. 위험과 완화

- deadline이 정상 animation을 앞질러 끊는 위험은 기존 declared duration·stagger/offset을 합친 뒤 작은 여유를 둔 값으로 막고, normal real-time browser test로 종료 시점을 확인한다.
- fallback이 다른 step을 바꾸는 위험은 scope-local timer cleanup과 step change/unmount test로 막는다.
- skip의 평상시 윤곽을 제거해도 semantic button과 focus outline을 유지해 touch/keyboard discoverability를 보존한다.
