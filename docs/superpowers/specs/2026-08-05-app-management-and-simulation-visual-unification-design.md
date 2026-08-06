# 앱 관리 메뉴와 Simulation 시각 통일 설계

## 목적

모든 앱에서 같은 위치와 동작을 갖는 관리 진입점을 제공하고, Simulation의 고유한 정보 구조와 그래프 중심 성격을 유지하면서 Main과 같은 제품군의 시각 문법으로 정돈한다.

## 제품 경계

- 공통 관리 메뉴는 표시, 팝오버, dialog와 접근성 동작만 소유한다.
- 백업, 가져오기, 초기화와 저장 오류 처리는 각 앱이 계속 소유한다.
- 관리 메뉴를 위한 신규 저장소나 공유 데이터 schema를 만들지 않는다.
- Main은 완료된 현재 제품 기준선이며 기존 백업 및 재설정 동작의 의미를 변경하지 않는다.
- Simulation과 Portfolio 초기화는 해당 앱 데이터만 제거한다.
- Account Map은 현재 준비 화면이며 관리 동작이나 독립 저장을 추가하지 않는다.

## 공통 관리 메뉴

### 위치와 외형

- 앱 런처의 narrow 도움말 버튼 오른쪽에 44×44px 톱니 아이콘 버튼을 둔다.
- 앱 런처가 표시되는 모든 지원 앱에서 같은 위치에 톱니 버튼을 표시한다.
- setup 또는 onboarding처럼 앱 런처 자체를 숨기는 집중 흐름에서는 관리 메뉴도 함께 숨긴다.
- 버튼은 아이콘만 표시하되 접근 가능한 이름은 `관리 메뉴`로 제공한다.
- 팝오버는 viewport 좌우 16px 여백 안에 머물고 390px에서도 가로 overflow를 만들지 않는다.

### 공통 동작

- 톱니 버튼을 누르면 작은 비모달 팝오버가 열린다.
- Escape, 바깥 클릭, 메뉴 항목 실행으로 팝오버가 닫힌다.
- 팝오버가 닫히면 톱니 버튼으로 포커스가 돌아간다.
- 팝오버는 본문 전체를 차단하지 않는다. 사용자가 다른 앱 아이콘이나 본문을 누르면 메뉴를 먼저 닫고 해당 동작을 계속할 수 있다.
- 초기화처럼 되돌리기 어려운 항목은 즉시 실행하지 않고 modal confirmation dialog를 연다. PRD의 `Simulation 메뉴`는 이 공통 앱 관리 메뉴를 가리킨다.
- confirmation dialog는 초기 포커스, Tab 순환, Escape 취소, 배경 차단과 종료 후 톱니 버튼 포커스 복귀를 제공한다.

### 앱별 항목

#### Main

1. `백업 내보내기`
2. `백업 가져오기`
3. 구분선
4. 위험 색상의 `처음부터 다시`

백업 가져오기는 메뉴 행 전체가 JSON 파일 선택 동작을 수행한다. 사용자가 파일 선택을 취소하면 상태를 바꾸지 않는다. 성공과 실패 메시지는 메뉴가 닫힌 뒤 기존 Main status 또는 alert 영역에 표시한다.

#### Simulation

- `시뮬레이션 다시 설정`
- 확인 후 Simulation 저장 데이터만 제거하고 onboarding으로 돌아간다.

#### Portfolio

- 기존 독립 메뉴의 초기화 동작을 공통 관리 메뉴의 `투자 배분 처음부터 다시`로 이동한다.
- 확인 후 Portfolio 투자 대상만 제거하고 투자금 전체를 현금으로 되돌린다.

#### Account Map

- 톱니 버튼은 다른 앱과 동일하게 표시한다.
- 팝오버에는 비활성 안내 `아직 관리할 설정이 없습니다`만 표시한다.
- 저장, 초기화 또는 Main write-back 동작을 추가하지 않는다.

## 컴포넌트 경계

- `AppManagementMenu`는 톱니 trigger, 팝오버 배치, 열림 상태, 바깥 클릭, Escape와 포커스 복귀를 담당한다.
- 메뉴 항목은 앱이 label, tone, action 또는 file input adapter 형태로 전달한다.
- 공통 confirmation dialog는 문구와 confirm action을 주입받고 접근성 동작만 소유한다.
- `AppLauncher`는 navigation과 도움말 책임을 유지하고 `?` 다음 위치에 표시할 management slot만 받는다. 관리 메뉴는 같은 목록 안에 배치되지만 `AppLauncher`가 앱별 작업을 직접 import하지 않는다.
- Main, Simulation, Portfolio와 Account Map entry component가 자신의 관리 항목을 조립한다.

## 오류 처리

- 백업 내보내기·가져오기 실패는 Main의 기존 오류 상태로 전달한다.
- 초기화의 주 저장이 실패하면 현재 화면과 적용 데이터를 보존하고 해당 앱의 alert를 표시한다.
- 주 저장은 성공하고 초안 정리만 실패한 부분 성공은 새 적용 상태를 유지하면서 `적용 완료·초안 정리 실패`로 정확히 알린다.
- 팝오버 또는 dialog가 열린 상태에서 오류가 발생해도 오류 메시지가 inert 배경에만 남지 않도록 현재 활성 표면에서 읽을 수 있게 한다.
- Account Map 안내는 status나 alert가 아닌 정적인 설명으로 제공한다.

## Simulation 시각 통일

### 유지할 특성

- 결과 금액과 장기 성장 그래프가 가장 먼저 보이는 summary-first 구조
- 최종 예상 금액의 큰 숫자 위계
- 투자 성장선과 낮은 시각 집중도의 저축 기준선
- tooltip, touch exploration, reduced-motion 동작
- 기존 계산, 저장 schema와 Main read-only 데이터 경계

### 공통화할 표면

- 페이지 배경, 최대 폭과 외곽 여백을 Main 앱 셸의 spacing 단계에 맞춘다.
- 온보딩, 그래프, 비교 결과, 기본 설정과 고급 설정은 공통 `ui-surface`의 radius와 흰색 flat panel, 단색 hairline을 사용한다.
- shadow는 관리 팝오버와 modal 같은 floating 계층에만 사용하고 일반 Simulation Surface에는 사용하지 않는다.
- 버튼은 공통 `ui-button` variant를 사용하고 입력은 공통 control radius, border, focus ring과 disabled 상태를 사용한다.
- 모든 주요 입력과 버튼은 최소 44px touch target을 유지한다.
- 제목, 설명과 보조 정보는 Main typography와 muted color 단계에 맞춘다.
- 고급 설정은 보조 Surface로 시각 집중도를 낮춘다.
- 결과, 그래프, 기본 조절, 고급 설정 순으로 시각 우선순위를 유지한다.

### 제거할 중복

- Simulation 전용 CSS에서 공통 버튼, input, dialog와 surface를 다시 정의하는 규칙을 제거한다.
- 그래프 geometry, tooltip 배치, Simulation 고유 레이아웃과 차트 색상 규칙은 전용 CSS에 남긴다.
- Main 화면을 복제하거나 모든 결과를 카드로 쪼개지 않는다.

## 반응형 및 접근성

- 390px, 768px와 desktop에서 런처·도움말·관리 버튼이 한 줄을 유지한다.
- 팝오버와 dialog는 viewport 안에 머물며 페이지 가로 overflow를 만들지 않는다.
- keyboard 사용자는 톱니 버튼, 모든 메뉴 항목과 dialog를 순서대로 사용할 수 있다.
- touch는 첫 탭으로 메뉴를 열고 두 번째 명시적 탭으로 항목을 실행한다.
- hover에만 의존하는 정보나 동작을 추가하지 않는다.
- `prefers-reduced-motion`에서는 메뉴와 Simulation Surface 전환을 즉시 또는 사실상 즉시 완료한다.

## 검증

### 단위 테스트

- 공통 메뉴의 열기, Escape, 바깥 클릭과 trigger 포커스 복귀
- confirmation dialog의 초기 포커스, Tab 순환, 취소와 확인
- Main file input 연결과 파일 선택 취소
- 앱별 메뉴 항목 구성과 Account Map 안내
- 각 앱 초기화의 주 저장 실패 시 상태 보존과 활성 alert, 초안 정리 실패 시 부분 성공 안내

### Playwright

- Main의 백업 내보내기, 가져오기와 처음부터 다시 흐름
- Simulation과 Portfolio 초기화 confirmation 및 앱별 데이터 격리
- Account Map의 빈 관리 메뉴
- 390px, 768px와 desktop에서 메뉴 containment, 44px trigger와 가로 overflow 부재
- keyboard, Escape, 바깥 클릭, dialog 포커스 복귀
- Simulation 주요 Surface, 입력과 버튼이 공통 UI 계약을 사용하면서 그래프와 tooltip이 계속 표시되는지 확인

### 전체 회귀

- `npm run check`
- `npm run test:unit`
- `npm run test:e2e -- --reporter=list`
- `git diff --check`

## 문서 갱신

- `DESIGN.md`에 공통 관리 메뉴 위치, 44px 규격, 팝오버·dialog와 앱별 항목 계약을 기록한다.
- Simulation의 공통 Surface·control·typography 사용 원칙과 그래프 고유 영역을 기록한다.
- 제품 범위 또는 데이터 소유권은 변경하지 않으므로 PRD의 앱 상태 정의는 유지한다.

## 제외 범위

- Account Map의 실제 설정 또는 저장 기능
- 앱 간 통합 백업 schema
- Portfolio나 Simulation 데이터의 Main write-back
- Simulation 계산식, 세금, MDD 또는 신규 그래프 기능
- Main dashboard 정보 구조 재설계
- 앱 런처 navigation 아이콘 변경
