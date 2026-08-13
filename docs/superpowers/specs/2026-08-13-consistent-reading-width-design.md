# Main·Simulation 일관된 본문 읽기 폭 설계

## 배경

Portfolio는 일반 본문을 `48rem` 안에 중앙 정렬하고 모바일에서는 viewport 좌우에 최소 `1rem`을 남긴다. 이 구조는 넓은 화면에서도 콘텐츠가 과도하게 퍼지지 않아 정돈되어 보이고, 모바일과 desktop 사이의 화면 인식 차이도 작다.

Main과 Simulation은 상태별·앱별 최대 폭이 달라 앱을 전환할 때 본문 좌우선과 밀도가 크게 달라진다. 이번 변경은 Portfolio의 읽기 폭을 기준으로 Main과 Simulation의 일반 본문 경험을 통일한다. 모바일의 좌우 여백은 장식적인 공백이 아니라 터치, focus ring, 카드 경계와 tooltip을 viewport 끝에서 보호하는 가드레일이다.

## 목표

- Main, Simulation과 Portfolio의 일반 본문을 같은 `48rem` 읽기 폭으로 인식하게 한다.
- 390px급 화면에서 본문 좌우에 최소 `1rem` 터치 가드레일을 보장한다.
- 넓은 화면에서도 일반 본문을 불필요하게 펼치지 않아 모바일과 desktop의 정보 구조 차이를 줄인다.
- 넓이가 정보 전달에 직접 필요한 Main 최초 조립 장면과 `처음부터 다시` 조립 장면만 명시적인 wide 예외로 유지한다.
- 상단 앱 탐색의 현재 폭, 여백, 동작과 표시 정책에는 영향을 주지 않는다.

## 비목표

- 상단 앱 탐색을 본문과 같은 `48rem` 폭으로 줄이지 않는다.
- 모든 앱의 overlay, sheet, dialog, toast 또는 fixed apply bar를 본문 폭에 종속시키지 않는다.
- Portfolio의 현재 본문 구조를 재설계하지 않는다.
- 데이터 소유권, 저장 schema, route, motion timing 또는 앱 경계를 변경하지 않는다.
- Main의 실제 비율 deficit overflow와 viewport 절단 계약을 변경하지 않는다.

## 레이아웃 계약

### 일반 본문

Main과 Simulation의 일반 본문 최상위 컨테이너는 Portfolio와 같은 규칙을 사용한다.

```css
width: min(calc(100% - 2rem), 48rem);
margin-inline: auto;
```

이 규칙은 다음 의미를 갖는다.

- viewport가 좁으면 좌우에 각각 최소 `1rem`을 남긴다.
- viewport가 넓어도 본문은 `48rem`보다 커지지 않는다.
- 제목, 요약, 카드, 입력, 설정과 일반 결과 화면은 같은 중앙 정렬 축을 사용한다.
- 상태가 바뀌어도 본문의 좌우선이 눈에 띄게 흔들리지 않는다.

### 앱별 적용 범위

Main:

- loading, recovery와 일반 dashboard 본문을 `48rem` 읽기 폭에 맞춘다.
- setup의 입력 단계와 review 안의 일반 텍스트·control도 기본 읽기 폭을 따른다.
- 최초 setup과 `처음부터 다시`의 조립 시각화는 아래 wide 예외를 사용한다.
- dashboard 편집 화면은 일반 본문 폭을 유지한다.

Simulation:

- Main-required recovery, onboarding, stale state와 result 본문을 `48rem`에 맞춘다.
- 그래프, 축, 비교값과 toolbar도 기본적으로 이 본문 안에서 반응형으로 동작한다.
- desktop이라는 이유만으로 그래프 컨테이너만 기존 `70rem`까지 확장하지 않는다.

Portfolio:

- 현재 `width: min(100% - 2rem, 48rem)` 기준을 유지한다.
- 이번 작업 때문에 Portfolio 구조나 폭을 바꾸지 않는다.

### Main 조립 wide 예외

Main 최초 조립 장면과 `처음부터 다시` 조립 장면은 같은 wide 예외를 사용한다. 두 진입은 사용자에게 동일한 조립 경험이어야 한다.

- wide 예외는 조립 시각화가 포함된 명시적인 컨테이너에만 적용한다.
- 입력, 일반 설명 또는 dashboard 전체를 넓히는 근거로 사용하지 않는다.
- viewport 좌우 `1rem` 가드레일은 유지한다.
- deficit 막대는 실제 비율만큼 100% UI 밖으로 연장되고 viewport를 벗어날 때만 시각·상호작용 영역이 절단되는 기존 계약을 유지한다.
- wide 컨테이너가 body 가로 overflow를 만들거나 상단 앱 메뉴의 stacking·popover containment에 영향을 주어서는 안 된다.

## 상단 앱 메뉴 격리 계약

현재 DOM 경계는 다음과 같다.

```text
AppShell
├─ app-shell__launcher-frame
└─ 앱별 main 본문
```

본문 폭 변경은 두 번째 경계에만 적용한다.

변경하지 않는 대상:

- `AppShell`
- `.app-shell__launcher-frame`
- `.journey-launcher`
- 상단 메뉴의 `1200px` 최대 폭
- 모바일 `20px`, 640px 이상 `32px` launcher 좌우 여백
- 44×44px 앱 링크·관리 버튼 touch target
- overflow 메뉴, 관리 popover의 viewport 기준 위치와 focus 동작
- Main 최초 setup과 `처음부터 다시`에서 launcher를 숨기는 현재 표시 정책

구현 제약:

- `AppShell` 자식 전체, 공통 `main` 태그 또는 전역 shell에 `48rem`을 적용하지 않는다.
- Main·Simulation의 앱별 본문 클래스나 명시적인 본문 wrapper만 수정한다.
- 본문 wrapper에 launcher popover를 자를 수 있는 `overflow`, launcher 좌표계를 바꾸는 `transform`, 불필요한 stacking context를 추가하지 않는다.
- 상단 메뉴와 본문 좌우선을 억지로 일치시키지 않는다. 메뉴는 넓은 탐색 폭, 본문은 좁은 읽기 폭이라는 독립된 목적을 유지한다.

## 반응형 동작

### 390px급 모바일

- 일반 본문은 좌우 `1rem` 가드레일을 유지한다.
- body에 예기치 않은 가로 overflow가 없어야 한다.
- focus ring, 카드 border, 그래프 tooltip과 44px touch target이 viewport 끝에서 잘리지 않아야 한다.
- 콘텐츠 순서와 주요 의미는 desktop과 동일하게 유지한다.

### 768px

- Main, Simulation과 Portfolio의 일반 본문 좌우선과 밀도가 같은 제품군으로 인식되어야 한다.
- 다중 열 control은 기존 DESIGN 계약대로 읽을 수 있는 compact layout이나 단일 열로 전환한다.
- Simulation 그래프·축·비교값이 모두 보여야 한다.

### Desktop

- 일반 본문은 중앙 정렬된 `48rem`을 넘지 않는다.
- Main 조립 wide 예외 외에는 여유 공간을 채우기 위해 카드나 그래프를 늘리지 않는다.
- 상단 앱 메뉴는 현재 넓은 탐색 폭을 유지한다.

## Overlay와 motion

- sheet, side panel, dialog, toast와 fixed apply bar는 계속 viewport를 기준으로 contain한다.
- 본문 폭 변경으로 overlay의 fixed containing block이 바뀌어서는 안 된다.
- 기존 Anime.js motion 대상, 방향, 거리, duration과 reduced-motion 최종 상태를 변경하지 않는다.
- Main 조립 motion의 최초 진입과 재시작 동일성, 편집 시 subtle motion 계약을 유지한다.

## 접근성

- 폭 변경 전후 heading 구조, accessible name, `aria-current`, focus 순서와 focus return은 동일하다.
- 상단 앱 메뉴와 관리 popover는 본문 폭과 독립적으로 키보드 접근 가능해야 한다.
- Simulation 그래프의 accessible name과 텍스트 대안은 레이아웃 변화와 무관하게 즉시 제공된다.
- 폭 축소 때문에 control의 44px 최소 touch target을 줄이지 않는다.

## 검증

### 구조·회귀

- `AppShell`, launcher frame과 journey launcher의 CSS diff가 없는지 확인한다.
- loading, recovery, setup/onboarding, result/dashboard 등 각 앱의 모든 일반 상태가 같은 폭 계약을 사용하는지 확인한다.
- 저장, route, schema와 데이터 소유권 관련 diff가 없는지 확인한다.

### 브라우저

390×844, 768×900과 일반 desktop에서 다음을 검증한다.

- Main·Simulation 일반 본문 좌우 가드레일과 `48rem` 최대 폭
- Portfolio 기준선과 비교한 앱 전환 전후 본문 좌우선
- body horizontal overflow 부재
- Main 최초/재시작 조립의 동일한 wide 예외와 deficit viewport clipping
- Simulation 그래프, 축, 비교값과 tooltip 가시성
- focus ring과 44px touch target containment
- sheet, dialog, toast와 fixed apply bar containment

상단 앱 메뉴에는 별도의 비회귀 검증을 둔다.

- launcher bounding box, 좌우 padding과 최대 폭이 변경 전과 동일하다.
- 현재 앱의 `aria-current`, overflow 열기·닫기, Escape와 focus return이 유지된다.
- 관리 popover가 viewport 안에 있고 본문 wrapper에 의해 잘리지 않는다.
- Main setup·재시작에서 launcher 표시 정책이 유지된다.

### 시각 증거

- Main, Simulation과 Portfolio의 일반 결과 화면을 세 viewport에서 같은 시점으로 캡처한다.
- Main 조립 wide 예외는 최초와 재시작에서 별도 캡처해 같은 폭·가드레일인지 비교한다.
- 상단 앱 메뉴가 기존 위치와 크기를 유지하는지 캡처에 함께 포함한다.

## 인수 조건

- Main과 Simulation의 일반 본문은 `48rem`보다 넓지 않고 viewport 좌우에 최소 `1rem`을 남긴다.
- Portfolio와 앱을 전환할 때 일반 본문의 폭과 밀도가 같은 제품군으로 느껴진다.
- Main 최초 조립과 재시작 조립만 동일한 wide 예외를 사용한다.
- Simulation은 `48rem` 안에서도 그래프·축·비교값·tooltip의 의미와 가시성을 유지한다.
- 상단 앱 메뉴의 DOM, CSS 폭, padding, 표시 정책, focus와 popover 동작은 변경되지 않는다.
- 390px, 768px과 desktop에서 body overflow, overlay clipping 또는 touch-target 회귀가 없다.
