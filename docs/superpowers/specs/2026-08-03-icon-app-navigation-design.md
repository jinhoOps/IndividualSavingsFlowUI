# 아이콘 앱 내비게이션 설계

## 목적

현재 AppLauncher의 큰 테두리·상태 문구·반복 텍스트를 제거하고, 모든 초기 흐름을 마친 사용자가 네 앱을 빠르게 전환하는 얇은 아이콘 내비게이션으로 교체한다. 제품의 연결 순서는 유지하되 단계 진행 UI처럼 보이지 않아야 한다.

## 제품 성격

- 앱 메뉴는 온보딩 진행 표시가 아니라 완성된 사용자의 전환 도구다.
- Main, Simulation과 Portfolio는 동등한 현재 제품이다.
- Account Map은 같은 위치에 노출하되 `준비 중` 상태다.
- `ISF`, `사용 중`, `현재 위치` 같은 설명성 표기를 기본 화면에서 제거한다.
- 브랜드는 이름을 반복하기보다 아이콘 체계, 간격, 색상과 상호작용의 일관성으로 표현한다.

## 정보 구조와 명칭

화면에는 아이콘만 보이며 접근성 이름과 tooltip/help에는 다음 표기를 그대로 사용한다.

| 앱 | 사용자 명칭 | 아이콘 의미 |
| --- | --- | --- |
| Main | `자금 흐름 (Main)` | 집 |
| Simulation | `미래 성장 (Simulation)` | 우상향 꺾은선 그래프와 화살표 |
| Portfolio | `투자 배분 (Portfolio)` | 분할된 도넛 |
| Account Map | `계좌 연결 (Account Map)` | 펼친 통장 |

영문 이름을 `Cash Flow`, `Compound Growth`처럼 다시 번역하지 않는다.

## 기본 내비게이션

- 네 앱 아이콘과 도움말 아이콘을 한 줄로 표시한다.
- 컨테이너 카드, 외곽 테두리, 큰 배경과 그림자를 사용하지 않는다.
- 얇은 하단 기준선 또는 충분한 여백으로 본문과 구분한다.
- 앱 아이콘 버튼은 각각 44×44px이다.
- 현재 앱은 아이콘 색상·선 굵기와 아이콘 아래 22×2px 강조선으로 표시한다.
- 현재 상태 때문에 버튼 크기나 배치가 움직이지 않는다.
- Account Map 아이콘에는 작은 중립색 점을 표시한다. `준비 중` 텍스트는 도움말에서만 보인다.
- 앱 순서는 `Main → Simulation → Portfolio → Account Map`으로 고정한다.

아이콘은 새 dependency 없이 작은 inline SVG React 컴포넌트로 구현한다. 공통 24×24 viewBox와 동일한 stroke 성격을 사용하며 Tailwind 또는 기존 design token으로 크기·색상·상태를 제어한다. 집 아이콘은 자금 흐름을 생활의 기준점으로 표현하는 의도적 예외다.

## 버튼 크기 규격

### 일반 아이콘 버튼

- 시각 버튼과 선택영역: 44×44px
- 앱 이동, 저장, 편집 등 주요 행동에 사용

### Narrow 아이콘 버튼

- 시각 버튼: 30×30px
- 선택영역: 32×44px
- 도움말·정보 표시처럼 중요도가 낮은 보조 행동에만 사용
- 주요 이동·저장·삭제 행동에는 사용하지 않는다.
- 접근 가능한 이름과 focus 표시를 항상 제공한다.

AppLauncher에서는 네 앱 이동이 일반 규격, `?` 도움말 버튼이 narrow 규격을 사용한다. Narrow는 향후 정보성 아이콘 버튼에 재사용 가능한 명시적 UI 규격이지만 이번 변경에서 다른 버튼을 일괄 변환하지 않는다.

## 도움말과 tooltip

### 데스크톱과 포인터 환경

- 앱 아이콘 hover 또는 keyboard focus 시 해당 명칭을 한 줄 tooltip으로 표시한다.
- Tooltip은 아이콘에 고정된 값만 표시하고 pointer 좌표로 의미를 재계산하지 않는다.
- pointer가 tooltip과 아이콘 사이를 오갈 때 깜빡이지 않도록 짧은 닫힘 여유를 둔다.
- Escape, blur 또는 다른 앱 focus로 닫힌다.

### 모바일과 터치 환경

- 짧게 터치하면 해당 앱으로 이동한다.
- 450ms 길게 누르면 이동하지 않고 해당 아이콘의 개별 tooltip을 표시한다.
- pointer 이동·취소·멀티터치 시 long-press timer를 취소한다.
- 길게 누른 뒤 발생하는 click은 한 번만 억제하여 의도치 않은 이동을 막는다.
- touch long press가 성립한 경우 해당 동작에서 발생하는 브라우저 context menu를 억제한다. 일반 pointer 우클릭 동작은 변경하지 않는다.
- 진동 feedback은 브라우저 편차 때문에 사용하지 않는다.

### Narrow 도움말 패널

- `?` narrow 버튼을 누르면 네 아이콘 설명을 한 번에 표시한다.
- 패널 폭은 220px, 최대 폭은 `calc(100vw - 32px)`이다.
- padding은 8px이며 정보 행은 조밀하되 읽기 순서를 보존한다.
- 긴 영문 앱명은 한글 아래 작은 글씨로 줄바꿈할 수 있다.
- Account Map 행에만 `준비 중`을 표시한다.
- 앱 메뉴 바로 아래 정렬하고 viewport 밖으로 나가면 좌우 위치만 보정한다.
- `?` 재선택, Escape, 바깥 pointer/touch, focus가 패널 밖으로 이동하면 닫힌다.
- 패널은 modal이 아니며 focus trap을 만들지 않는다.

## 접근성

- 내비게이션 이름 `ISF 앱`을 유지한다.
- 각 링크는 보이는 텍스트가 없어도 정확한 accessible name을 가진다.
- 현재 링크는 `aria-current="page"`와 `자금 흐름 (Main), 현재 위치` 같은 상태 이름을 제공한다.
- Account Map은 `계좌 연결 (Account Map), 준비 중`으로 읽힌다.
- Tooltip과 도움말 내용은 hover뿐 아니라 keyboard focus와 명시적 도움말 버튼으로 접근 가능하다.
- 도움말 버튼은 `aria-expanded`, `aria-controls`를 제공한다.
- focus ring은 배경과 충분히 구분되고 잘리지 않는다.
- 아이콘 색상이나 강조선만으로 현재 위치를 전달하지 않고 `aria-current`를 병행한다.
- `prefers-reduced-motion`에서는 underline·tooltip·패널 전환을 즉시 적용한다.

## 반응형

- 390px, 768px와 desktop에서 동일한 한 줄 구조를 유지한다.
- 네 앱 버튼과 narrow 도움말 버튼이 줄바꿈되지 않아야 한다.
- 내비게이션과 tooltip/help panel이 가로 overflow를 만들지 않아야 한다.
- 좁은 화면에서도 앱 버튼의 44×44px 규격을 줄이지 않는다.
- 기존 `<details>` 기반 desktop/mobile 분기와 `ISF 앱 메뉴` summary는 제거한다.

## 상태와 오류 경계

- 현재 앱은 `currentApp` prop만으로 결정한다.
- Tooltip, long press와 도움말 패널은 AppLauncher 내부의 일시적 UI 상태다.
- 앱 이동과 데이터 저장 계약은 변경하지 않는다.
- Account Map 준비 상태는 정적 제품 metadata이며 독립 저장을 만들지 않는다.
- JavaScript가 활성화된 현재 React runtime을 전제로 하며 별도 저장 복구는 필요 없다.

## 테스트와 검증

### 단위 테스트

- 네 링크의 정확한 href와 accessible name
- 현재 링크의 `aria-current`
- Account Map의 `준비 중` 접근성 상태
- desktop hover/focus tooltip과 Escape/blur 닫기
- `?`의 `aria-expanded`, narrow 도움말 내용과 바깥 클릭 닫기
- 450ms long press가 tooltip을 열고 click navigation을 억제
- 짧은 press, pointer cancel·move가 long press를 열지 않음
- 아이콘 SVG가 장식용으로 중복 낭독되지 않음

### 브라우저 테스트

- Main, Simulation, Portfolio, Account Map에서 동일한 메뉴와 현재 위치 표시
- 390px, 768px, desktop에서 한 줄·overflow·focus ring
- 앱 버튼 44×44px, narrow 도움말 선택영역 32×44px, 시각 버튼 30×30px
- pointer tooltip, keyboard tooltip, 모바일 long press, 전체 도움말 패널
- reduced motion에서 불필요한 전환 제거
- Account Map 링크가 준비 화면 route를 유지

### 필수 명령

- `npm run check`
- 관련 unit test
- `npx playwright test tests/app-journey.spec.ts --reporter=list`
- 메뉴가 여러 앱 공통 runtime이므로 전체 E2E
- 390px, 768px, desktop 시각 점검
- `git diff --check`

## 문서 영향

- `DESIGN.md`에 아이콘 AppLauncher, 일반/narrow 버튼 규격과 tooltip/help 접근성 계약을 기록한다.
- Product PRD의 앱 상태와 데이터 소유권은 변하지 않으므로 제품 범위는 갱신하지 않는다.
- 역사 문서와 이전 AppLauncher 구현 기록은 현재 디자인 근거로 사용하지 않는다.

## 인수 조건

- 기본 메뉴에는 앱 아이콘 네 개와 narrow 도움말 버튼만 보인다.
- 사용자가 각 아이콘 의미, 현재 앱과 Account Map 준비 상태를 pointer·touch·keyboard로 확인할 수 있다.
- 네 앱 이동은 44×44px이며 도움말만 30×30px 시각 크기와 32×44px 선택영역을 사용한다.
- 모바일 짧은 터치는 이동하고 450ms 길게 누르기는 이동 없이 설명을 표시한다.
- 도움말 패널은 220px narrow 규격이며 가로 overflow나 focus trap을 만들지 않는다.
- 390px부터 desktop까지 줄바꿈 없이 유지된다.
- 기존 앱 route, 데이터 read/write와 준비 상태 계약은 변경되지 않는다.
