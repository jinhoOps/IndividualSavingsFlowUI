# Anime.js 공통 모션 시스템 설계

**상태:** 대화 승인, 문서 검토 대기
**작성일:** 2026-08-12
**대상:** Main, Simulation, Portfolio, Account Map 준비 화면과 공통 앱 런처

**기준 문서:** [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md)

## 1. 목적

ISF의 flat editorial·summary-first 시각 언어를 유지하면서, 사용자가 입력한 값과 화면의 결과가 어떻게 연결되는지 더 쉽게 이해하도록 작은 모션을 제품 전반에 적용한다. 모션은 장식이나 체류 시간 증가가 아니라 다음 두 사용자 경험을 개선한다.

1. 새 사용자가 첫 화면과 최초 설정 흐름을 자연스럽게 이해한다.
2. 금액·비율 변경이 막대, 도넛, 그래프와 목록 결과에 어떻게 반영되는지 연속적으로 인식한다.

대부분의 화면에는 짧고 작은 변화를 사용한다. Main의 최초 월 자금 조립 장면만 제품의 핵심 개념을 설명하는 예외적인 큰 연출로 허용한다.

## 2. 제품 경계

- Main은 기존 다섯 월간 금액만 직접 소유한다.
- Simulation과 Portfolio는 Main을 읽기 전용으로 사용하며 각자 소유한 workspace slice만 갱신한다.
- Account Map은 Phase B 전까지 준비 화면이며 제품 데이터를 읽거나 쓰지 않는다.
- 모션 계층은 React 렌더 결과를 시각적으로 보간할 뿐 도메인 계산, 저장 순서, navigation 또는 workspace ownership을 소유하지 않는다.
- 이 작업은 새로운 금융 기능, route, 계산, 저장 schema 또는 write-back을 추가하지 않는다.

## 3. 경험 원칙

### 3.1 넓고 얇은 적용

공통 모션 언어는 Main, Simulation, Portfolio, Account Map 준비 화면과 앱 런처에 모두 적용한다. 각 화면에서 움직임은 기존 정보 위계를 보조하는 수준으로 제한한다.

### 3.2 데이터 연속성

숫자와 시각화가 바뀔 때 이전 상태에서 새 상태로 짧게 이어져야 한다. 단순히 새 DOM을 fade-in하는 대신 같은 의미의 값·조각·행이 어디로 이동했는지 보여준다.

### 3.3 즉시 사용 가능

focus, 클릭, 저장과 탐색은 애니메이션 완료를 기다리지 않는다. 모션이 실행되지 않거나 중단되어도 React가 렌더한 최종 UI는 온전해야 한다.

### 3.4 절제된 반복

최초 진입에 의미가 있는 연출은 매 방문마다 반복하지 않는다. 수정은 전체 조립을 재생하지 않고 변경된 값과 시각 요소만 짧게 보간한다. 반복·장식용 loop 모션은 사용하지 않는다.

## 4. 공통 모션 언어

### 4.1 토큰

공통 토큰은 다음 범위에서 정의한다.

| 토큰 | 기본값 | 용도 |
| --- | ---: | --- |
| 빠름 | 120ms | pressed, 선택선과 작은 상태 전환 |
| 보통 | 180ms | disclosure, 짧은 값·크기 변경 |
| 강조 | 260ms | 결과 카드와 데이터 시각화 전환 |
| 이동 거리 | 4~8px | reveal과 panel 진입 |

easing은 빠르게 반응하고 부드럽게 정착하는 공통 곡선을 사용한다. spring이나 bounce는 금융 정보의 정밀한 인상을 해치므로 기본 토큰으로 제공하지 않는다.

### 4.2 공통 구성 요소

`src/components/motion/`에 다음의 작은 공통 계층을 둔다.

- `motionTokens`: duration, easing과 이동 거리
- `useAnimeScope`: 컴포넌트 root에 Anime.js scope를 제한하고 unmount 시 모든 instance를 정리한다.
- `animateNumberChange`: 이전 금액·비율에서 새 값으로 표시를 보간한다.
- `animateAllocationChange`: 막대, 도넛, 그래프와 비례 목록의 크기·위치를 보간한다.
- `animateReveal`: 최초 진입과 disclosure의 짧은 등장에 사용한다.

Anime.js는 필요한 하위 모듈만 import한다. 일반 hover, focus, pressed와 단순 색상 전환은 CSS가 계속 담당한다. 공통 계층은 앱의 상태 모델이나 저장 결과 타입을 감싸지 않는다.

## 5. 화면별 동작

### 5.1 공통 앱 런처와 overlay

- 현재 앱 표시선과 overflow 메뉴는 120~160ms로 전환한다.
- 앱 간 페이지 이동을 모션 때문에 지연하지 않는다.
- modal, bottom sheet, side panel, disclosure와 toast는 160~220ms 범위의 공통 reveal을 사용한다.
- overlay가 닫히면 애니메이션과 무관하게 기존 계약대로 focus를 trigger에 돌려준다.

### 5.2 Main 첫 화면과 입력 단계

- 최초 설정의 welcome 제목, 설명과 CTA는 4~8px 이내의 짧은 순차 reveal을 welcome 진입 시 한 번 실행한다.
- 같은 welcome mount 안에서는 reveal을 반복하지 않는다. `처음부터 다시`로 새 initial setup journey를 시작하면 최초 설정과 동일하게 다시 실행하며, 적용된 계획의 수정 화면에서는 실행하지 않는다.
- 입력 단계 전환과 progress bar를 짧게 연결한다.
- 사용자가 숫자를 입력하는 매 keystroke마다 큰 모션을 실행하지 않는다.

### 5.3 Main 최초 조립과 처음부터 다시

최초 설정과 `처음부터 다시`는 모두 적용된 계획이 없는 동일한 initial setup journey다. 따라서 welcome부터 review까지 같은 전체 모션 시퀀스를 사용한다. `처음부터 다시`를 수정 흐름으로 취급하지 않는다.

review의 조립은 하나의 지속적인 시각 모델을 사용한다.

1. 월 수입을 나타내는 막대가 정확한 100% 기준선을 만든다.
2. 소비, 저축, 투자와 여윳돈 조각이 같은 막대 안에서 구성된다.
3. 계획 지출이 수입을 넘으면 초과 조각이 100% 기준선과 panel 경계를 의도적으로 벗어난다.
4. 초과 길이는 `초과액 ÷ 월 수입`의 실제 비율을 사용하며 임의로 압축하지 않는다.
5. 초과 막대가 viewport 안전 여백 16px에 닿기 전까지 실제 길이를 유지한다.
6. 실제 길이가 남은 viewport 공간을 넘을 때만 시각 막대를 절단하고 `+N% 초과` 텍스트를 함께 표시한다.
7. clip layer는 panel 밖 탈출을 허용하되 document의 가로 너비를 늘리지 않는다.

현재 구현처럼 조립용 임시 막대와 최종 막대가 서로 다른 비율 기준이나 DOM geometry를 사용하지 않는다. 한 visual model 안에서 조각과 초과분이 최종 상태까지 이어져야 한다.

### 5.4 Main 수정

- 적용된 계획의 수정은 최초 조립을 다시 실행하지 않는다.
- 사용자가 적용한 뒤 결과 화면에서 금액과 막대·도넛 조각을 이전 상태에서 새 상태로 180~260ms 보간한다.
- deficit 진입·해소도 같은 geometry 변화로 이어지고 별도의 축약 초과 모델을 사용하지 않는다.
- 수정 중 draft와 적용된 결과의 기존 경계는 유지한다. dashboard 시각화는 성공적으로 적용된 값만 반영한다.

### 5.5 Simulation

- 최초 결과에서 그래프 선을 짧게 그린다.
- 기간, 기대수익률이나 표시 기준 변경 시 그래프 선, 비교 금액과 축척이 같은 데이터 전환으로 움직인다.
- pointer·touch·keyboard tooltip 탐색은 모션 완료를 기다리지 않는다.
- tooltip 자체의 정보 갱신에는 불필요한 숫자 counting을 사용하지 않는다.

### 5.6 Portfolio

- 배분 변경 시 비례 막대와 비율 숫자를 이전 값에서 새 값으로 보간한다.
- 비율순·입력순 정렬 변경은 같은 항목이 새 위치로 이동하는 것을 보여준다.
- 결과의 비율 우선 위계와 기본 금액 숨김 계약을 바꾸지 않는다.
- 최초 설정, 편집 sheet와 결과 사이의 focus·dirty·apply 계약을 모션이 소유하지 않는다.

### 5.7 Account Map 준비 화면

- 준비 상태 아이콘과 설명은 최초 mount에서 한 번만 짧게 등장한다.
- 반복·loop 모션, 상세 관계도처럼 보이는 연출 또는 데이터가 연결된 것처럼 오해할 표현은 사용하지 않는다.
- 준비 화면은 계속 workspace data를 읽거나 쓰지 않는다.

## 6. 저장 피드백

정상 상태를 계속 점유하는 `저장됨` 표시는 Main, Simulation과 Portfolio에서 제거한다.

- 사용자가 명시적으로 `적용`한 경우 결과의 실제 변화가 성공 피드백 역할을 한다.
- 자동 저장이 평상시 속도로 성공하면 별도 상시 상태를 표시하지 않는다.
- 저장이 600ms 이상 완료되지 않을 때만 `저장 중`을 표시한다.
- 저장 실패는 해당 편집 맥락에서 오류와 재시도 행동을 제공한다.
- 불완전 write나 충돌 상태는 기존 복구 UI로 명확히 설명한다.
- backup export·import처럼 별도의 결과 확인이 필요한 명시적 작업은 기존 toast·확인 피드백을 유지한다.

저장 상태의 접근 가능한 발표도 같은 기준을 따른다. 정상 자동 저장을 반복 발표하지 않고 사용자의 행동이 필요한 지연, 실패와 복구 상태를 우선한다.

## 7. 접근성과 reduced motion

- `prefers-reduced-motion: reduce`에서는 duration만 줄이는 것이 아니라 즉시 최종 상태를 표시한다.
- semantic DOM과 accessible name에는 애니메이션 시작 시점부터 최종 금액·비율을 제공한다.
- 화면 낭독기에 보간 중간 숫자를 반복 발표하지 않는다. 필요한 경우 시각 숫자 레이어를 `aria-hidden`으로 분리한다.
- 상태 의미를 색상, 길이 또는 모션만으로 전달하지 않는다.
- 초과 상태는 정확한 금액과 비율 텍스트를 제공한다.
- 44px touch target, keyboard interaction, focus return과 tooltip 계약을 유지한다.

## 8. 실패 처리와 정리

- Anime.js import, scope 또는 animation instance가 실패해도 React가 이미 렌더한 최종 UI가 남아야 한다.
- component unmount, route change와 interrupted render에서 scope를 `revert()`하여 timer와 style을 정리한다.
- 빠른 연속 변경은 오래된 animation을 누적하지 않고 현재 표시 상태에서 최신 값으로 이어진다.
- 모션 실패를 저장 실패나 제품 오류로 표시하지 않는다.
- 저장 오류·복구 상태에는 장식 모션보다 `role="alert"`와 구체적인 다음 행동을 우선한다.

## 9. 검증

### 9.1 Unit과 component

- 초과액 대비 실제 연장 길이 계산
- viewport 여유 공간과 16px 안전 여백에 따른 절단 판단
- 정상, deficit 진입, deficit 해소와 큰 초과 상태
- Anime.js scope cleanup과 interrupted animation
- reduced-motion의 즉시 최종 상태
- 접근 가능한 최종 숫자와 시각 보간 값의 분리
- Simulation 그래프와 Portfolio 배분의 이전 값→새 값 전환

### 9.2 사용자 흐름

- 최초 설정과 `처음부터 다시`가 같은 initial sequence를 사용한다.
- 적용된 계획의 수정에서는 전체 조립 sequence가 실행되지 않는다.
- 저장 성공 표시를 제거해도 지연·실패·복구와 backup 결과가 관찰 가능하다.
- 앱 이동, overlay focus와 pointer·touch·keyboard 동작이 모션 도중에도 가능하다.

### 9.3 Playwright 캡처

390px, 768px와 desktop에서 다음 시점을 캡처하고 geometry를 검증한다.

1. Main 조립 시작
2. 수입 100% 기준선과 항목 조립 중간
3. panel 경계를 실제 비율로 벗어난 초과 상태
4. viewport 경계에서만 절단된 큰 초과 상태
5. 조립 완료 결과
6. Main 수정 전후
7. Simulation 그래프 변경 전후
8. Portfolio 배분·정렬 변경 전후

각 viewport에서 document 가로 overflow, overlay containment, visualization visibility, focus와 touch target을 함께 검사한다. reduced-motion 캡처는 중간 프레임 없이 즉시 최종 상태임을 확인한다.

## 10. 인수 조건

- 공통 모션 토큰과 lifecycle-safe Anime.js scope를 모든 현재 앱이 재사용한다.
- Main 최초 설정과 `처음부터 다시`가 동일한 전체 조립 경험을 제공한다.
- Main 수정은 전체 조립을 반복하지 않고 결과 변화만 짧게 이어준다.
- deficit 초과분은 viewport에 닿기 전까지 실제 비율로 100% 막대와 panel 경계를 벗어난다.
- 큰 deficit만 viewport 안전 경계에서 절단되며 정확한 금액·비율 텍스트가 남는다.
- Main, Simulation, Portfolio, Account Map 준비 화면과 앱 런처에 작은 공통 모션이 적용된다.
- 정상 `저장됨`을 상시 표시하지 않으며 지연·실패·복구 상태는 계속 명시적이다.
- reduced-motion, keyboard, touch와 화면 낭독기 계약을 만족한다.
- 390px, 768px와 desktop에서 가로 overflow 없이 시점별 Playwright 검증을 통과한다.

## 11. 비목표

- 장식용 background animation, parallax, 반복 loop 또는 bounce
- 모든 CSS transition을 Anime.js로 교체
- 앱 간 navigation transition을 위한 route 지연
- 모션이 product state, persistence 또는 calculation을 소유하는 구조
- Account Map 준비 화면에 미래 상세 UI를 미리 구현하는 작업
- 데이터 schema, write ownership 또는 금융 기능 확장
