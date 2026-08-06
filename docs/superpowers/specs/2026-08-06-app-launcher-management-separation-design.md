# 앱 런처와 관리 도구 분리 설계

## 목적

상단 앱 런처에서 앱 이동과 보조·관리 기능의 역할을 시각적·의미적으로 분리한다. 앱 아이콘은 왼쪽 탐색 영역에 유지하고 톱니 관리 메뉴는 오른쪽 끝에 고정해, 사용자가 이동과 관리를 즉시 구분할 수 있게 한다.

## 선행 조건

- 현재 진행 중인 공통 React 컴포넌트 작업이 완료되어 `main`에 병합된 뒤 구현을 시작한다.
- 구현 시작 시 최신 `main`에서 `AppLauncher`, `AppManagementMenu`, 공통 UI primitive와 관련 테스트의 변경을 다시 확인한다.
- 선행 작업이 공통 컴포넌트 API를 바꿨다면 최신 API를 유지하고 이 문서의 사용자 동작 계약을 적용한다.
- 선행 작업과 같은 파일을 동시에 수정하지 않는다.

## 런처 정보 구조

상단 런처는 한 줄 안에서 두 영역으로 나뉜다.

### 앱 탐색 영역

- 왼쪽에 Main, Simulation, Portfolio, Account Map 아이콘을 현재 순서로 표시한다.
- 현재 `ISF 앱` navigation은 네 앱 링크를 포함하며 관리 도구는 포함하지 않는다.
- 현재 위치, 준비 중 상태, hover·focus tooltip과 touch long-press 설명은 유지한다.
- 앱 목록은 `APP_NAV_ITEMS`를 단일 원본으로 사용하며 향후 앱 추가를 허용한다.

### 앱 탐색 overflow

- 앱 아이콘이 가용 폭을 넘을 때만 앱 탐색 영역의 마지막에 44×44px `더보기` 버튼을 표시한다.
- `더보기`는 세로 hairline 왼쪽에 위치하므로 오른쪽 관리 도구 영역에 포함되지 않는다.
- 현재 앱은 항상 직접 표시한다.
- 공간이 부족하면 배열 뒤쪽의 현재 앱이 아닌 항목부터 overflow로 이동한다.
- `더보기` 팝오버에는 숨겨진 앱의 아이콘, `한글명 (English)`과 준비 상태를 표시한다.
- overflow 앱을 선택하면 기존 route로 바로 이동한다.
- 현재 네 앱이 모두 들어가는 폭에서는 `더보기` 버튼이나 빈 popover를 렌더링하지 않는다.
- 고정 최대 앱 개수는 두지 않고 실제 앱 영역의 가용 폭을 기준으로 표시 개수를 계산한다.
- 390px에서 앱 다섯 개가 실제로 들어가면 다섯 개를 모두 직접 표시하며, 개수만으로 overflow를 강제하지 않는다.

### 관리 도구 영역

- 오른쪽 끝에는 44×44px 톱니 `관리 메뉴` 하나만 표시한다.
- 관리 도구 영역은 앱 아이콘 수와 관계없이 런처 한 줄의 오른쪽 끝에 정렬한다.
- 앱 탐색 영역과 관리 도구 영역 사이에는 자동 여백과 세로 hairline을 둔다.
- hairline은 배경 캡슐을 만들지 않고 기존 border token을 사용해 낮은 시각 집중도를 유지한다.
- 런처는 페이지와 함께 스크롤하며 viewport에 sticky 또는 fixed로 고정하지 않는다.

## 도움말 통합

- 별도 `?` 도움말 버튼은 제거한다.
- 톱니 팝오버의 첫 항목은 `앱 아이콘 안내`다.
- 항목을 누르면 같은 시각적 팝오버 안에서 네 앱의 아이콘, `한글명 (English)`, 준비 상태가 펼쳐진다.
- 같은 항목을 다시 누르면 안내가 접힌다.
- 펼침 버튼은 `aria-expanded`와 `aria-controls`를 제공한다.
- 안내 내용은 정적 설명이며 별도 focus target을 만들지 않는다.
- 정적 안내 영역은 `role="menu"`의 자식으로 넣지 않는다. 관리 menu와 안내 region은 같은 popover wrapper 안의 형제 영역으로 구성한다.

## 앱별 관리 메뉴

- `AppManagementMenu` 명칭과 톱니의 접근 가능한 이름 `관리 메뉴`를 유지한다.
- 앱 도움말 다음에 각 앱이 제공한 관리 항목을 표시한다.
- Main은 백업 내보내기, 백업 가져오기와 처음부터 다시를 유지한다.
- Simulation은 시뮬레이션 다시 설정을 유지한다.
- Portfolio는 투자 배분 처음부터 다시를 유지한다.
- Account Map은 앱 도움말을 제공하고 관리 기능 영역에는 `아직 관리할 설정이 없습니다`를 유지한다.
- destructive action의 확인 dialog와 앱별 저장·오류 처리는 변경하지 않는다.

## 컴포넌트 경계

- `AppLauncher`는 앱 navigation, 현재 위치, icon tooltip과 좌우 영역 배치를 담당한다.
- `AppLauncher`는 앱 영역의 가용 폭과 항목 폭을 측정해 직접 표시할 앱과 overflow 앱을 나눈다.
- 측정은 `ResizeObserver`를 사용한다. observer를 지원하지 않거나 최초 측정 전에는 직접 표시 수를 네 개로 제한하고, 현재 앱과 배열 앞쪽의 비현재 앱을 우선 표시하며 나머지는 `더보기`로 보내는 안전한 fallback을 사용한다.
- `AppLauncher`는 기존 management slot을 통해 오른쪽 관리 도구를 받으며 앱별 persistence를 import하지 않는다.
- `AppManagementMenu`는 공통 앱 도움말 펼침과 기존 popover·dialog lifecycle을 담당한다.
- 앱별 entry component는 기존처럼 자신의 관리 항목과 action만 조립한다.
- 앱 navigation data와 icon renderer는 현재 journey 공용 원본을 재사용하며 도움말용 중복 목록을 만들지 않는다.

## 상호작용과 포커스

- 현재 네 앱의 기본 Tab 순서는 네 앱 링크 다음 톱니 버튼이다.
- overflow가 있으면 기본 Tab 순서는 직접 표시된 앱 링크, `더보기`, 톱니 버튼이다.
- `더보기` 팝오버는 Escape와 바깥 pointer로 닫히고 `더보기` trigger로 focus를 돌린다.
- `더보기`와 관리 메뉴 popover는 동시에 열리지 않는다.
- 톱니를 열면 `앱 아이콘 안내`가 첫 메뉴 항목이며 그 뒤에 앱별 관리 항목이 이어진다.
- 도움말을 펼쳐도 focus는 펼침 버튼에 유지된다.
- Escape와 바깥 pointer는 도움말 상태를 포함해 popover 전체를 닫고 톱니 버튼으로 focus를 돌린다.
- 메뉴 항목을 실행하면 기존과 같이 popover를 닫고 필요한 dialog 또는 앱 action으로 이어진다.
- 앱 링크 focus·pointer tooltip과 톱니 popover는 동시에 열리지 않게 한다.

## 반응형

- 390px, 768px와 desktop에서 네 앱 아이콘과 톱니가 한 줄을 유지한다.
- 앱 아이콘은 축소하지 않고 44×44px target을 유지한다.
- 톱니도 44×44px target을 유지한다.
- 자동 여백이 남은 폭을 흡수하고 hairline과 도구 영역은 오른쪽 끝에 머문다.
- 앱이 추가되어 폭이 부족해져도 관리 도구 영역은 축소되거나 다음 줄로 밀리지 않는다.
- popover와 펼친 앱 안내는 viewport 좌우 16px 안에 머물며 가로 overflow를 만들지 않는다.
- `더보기` popover도 viewport 좌우 16px 안에 머물며 가로 overflow를 만들지 않는다.

## 접근성

- `ISF 앱` navigation에는 실제 앱 링크 네 개만 노출한다.
- 앱이 overflow되면 `ISF 앱` navigation은 직접 표시된 링크와 `더보기`를 포함하고, 숨겨진 앱 링크는 `더보기` popover 안에서 접근 가능하다.
- 관리 도구 wrapper는 navigation 밖에 두고 `앱 도구`라는 접근 가능한 group으로 제공한다.
- 톱니의 접근 가능한 이름은 `관리 메뉴`다.
- 아이콘 의미는 기존 개별 tooltip과 관리 메뉴의 `앱 아이콘 안내` 양쪽에서 확인할 수 있다.
- 준비 중 상태는 시각적 점뿐 아니라 기존 접근 가능한 문구를 유지한다.
- reduced-motion에서는 tooltip, popover와 도움말 펼침 전환을 즉시 또는 사실상 즉시 완료한다.

## 검증

### 단위 테스트

- `ISF 앱` navigation에 앱 링크 네 개만 포함됨
- 별도 `앱 아이콘 도움말` 버튼 부재
- navigation 뒤에 `앱 도구` group과 `관리 메뉴`가 위치함
- 현재 네 앱에서는 `더보기`가 없고 overflow fixture에서만 나타남
- 실제 폭에 따라 직접 표시 항목과 overflow 항목이 나뉘며 현재 앱은 항상 직접 표시됨
- `더보기`의 앱 route, 준비 상태, Escape·바깥 pointer와 focus 복귀
- `앱 아이콘 안내` 펼침·접힘, `aria-expanded`, 네 앱 설명과 준비 상태
- Escape·바깥 pointer 종료와 톱니 focus 복귀
- 기존 앱별 항목, confirmation dialog와 오류 동작 회귀

### Playwright

- 네 앱 route 각각에서 390px, 768px와 desktop 좌우 분리와 한 줄 배치
- 앱 아이콘 44×44px, 톱니 44×44px와 세로 hairline 가시성
- 톱니가 런처 오른쪽 끝에 있고 앱 아이콘과 겹치지 않음
- 다섯 번째 앱이 들어가는 폭에서는 모두 직접 표시하고, 더 좁은 가용 폭 또는 추가 앱 fixture에서는 `더보기` 활성화
- 현재 앱이 배열 뒤쪽에 있어도 직접 표시되고 다른 비현재 앱이 overflow됨
- `더보기`와 관리 메뉴가 상호 배타적으로 열리고 각각 trigger focus를 복구함
- 도움말 펼침 시 popover containment와 가로 overflow 부재
- pointer, touch와 keyboard로 도움말 펼침·접힘
- Escape·바깥 클릭 후 톱니 focus 복귀
- Main, Simulation, Portfolio와 Account Map의 기존 관리 항목·dialog 회귀

## 제외 범위

- 페이지 스크롤 중 sticky 또는 fixed launcher
- 앱 순서나 route 변경
- 아이콘 그래픽 재설계
- 앱별 관리 action이나 저장 schema 변경
- 새로운 설정 기능
- popover를 별도 full-screen mobile sheet로 변경
- 앱 개수만으로 동작하는 고정 overflow 임계값
