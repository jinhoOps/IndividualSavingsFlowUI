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
- `ISF 앱` navigation은 네 앱 링크만 포함한다.
- 현재 위치, 준비 중 상태, hover·focus tooltip과 touch long-press 설명은 유지한다.

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
- `AppLauncher`는 기존 management slot을 통해 오른쪽 관리 도구를 받으며 앱별 persistence를 import하지 않는다.
- `AppManagementMenu`는 공통 앱 도움말 펼침과 기존 popover·dialog lifecycle을 담당한다.
- 앱별 entry component는 기존처럼 자신의 관리 항목과 action만 조립한다.
- 앱 navigation data와 icon renderer는 현재 journey 공용 원본을 재사용하며 도움말용 중복 목록을 만들지 않는다.

## 상호작용과 포커스

- 기본 Tab 순서는 네 앱 링크 다음 톱니 버튼이다.
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
- popover와 펼친 앱 안내는 viewport 좌우 16px 안에 머물며 가로 overflow를 만들지 않는다.

## 접근성

- `ISF 앱` navigation에는 실제 앱 링크 네 개만 노출한다.
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
- `앱 아이콘 안내` 펼침·접힘, `aria-expanded`, 네 앱 설명과 준비 상태
- Escape·바깥 pointer 종료와 톱니 focus 복귀
- 기존 앱별 항목, confirmation dialog와 오류 동작 회귀

### Playwright

- 네 앱 route 각각에서 390px, 768px와 desktop 좌우 분리와 한 줄 배치
- 앱 아이콘 44×44px, 톱니 44×44px와 세로 hairline 가시성
- 톱니가 런처 오른쪽 끝에 있고 앱 아이콘과 겹치지 않음
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
