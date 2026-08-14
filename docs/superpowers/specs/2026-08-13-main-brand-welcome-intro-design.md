# Main 브랜드 웰컴 인트로 설계

**상태:** 대화 승인, 2차 제품 경험 검토 반영
**작성일:** 2026-08-13
**대상:** Main의 `fresh` 새 시작 상태와 `처음부터 다시`

**기준 문서:** [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [Anime.js 공통 모션 시스템 설계](2026-08-12-animejs-motion-system-design.md)

## 1. 목적

Main을 처음 여는 순간 제품의 성격을 설명하고 ISF 브랜드를 기억할 수 있도록, 기존 setup welcome 앞에 독립적인 Anime.js 브랜드 인트로를 둔다. 인트로는 타이포그래피나 실제 사용자 데이터가 아니라 브랜드 아이콘에서 확장한 금융 인포그래픽을 중심으로 한다.

기존 review의 월 자금 조립 연출은 사용자가 입력한 실제 금액과 비율을 설명하는 장면으로 그대로 유지한다. 이번 인트로는 그 연출을 이동하거나 대체하지 않는다.

## 2. 범위와 의미

- 세 개의 상승 막대는 현재 돈의 규모와 구조를 나타낸다.
- 막대 중심 사이의 가상 꺾임점은 현실의 변동과 선택을 나타낸다.
- 마지막 최고점은 수익 보장이 아니라 통제 가능한 개선, 전진과 희망을 나타낸다.
- 인트로는 실제 금액, 실제 비율, 적자 또는 투자 수익을 표현하지 않는다.
- 차기 `돈그릇` 앱은 사용자가 감당 가능한 리스크를 MDD 수치만이 아니라 실제 금액과 설정 비율로 알아보고 기록하는 방향의 후속 기획이다. 이번 작업은 해당 앱, route, 데이터 또는 저장 계약을 추가하지 않으며 브랜드의 확장 배경으로만 고려한다.

## 3. 브랜드 아이콘

기존 주황–청록 그라데이션 배경, 기준선과 세 개의 흰색 상승 막대를 브랜드 기반으로 유지한다. 정적 앱 아이콘에 다음 꺾은선을 추가해 인트로의 완성 프레임과 정적 브랜드를 일치시킨다.

- 꺾은선은 막대와 구분되는 짙은 잉크 계열 색상으로 그린다.
- 경로는 다섯 꼭짓점을 사용한다.
  1. 첫 번째 막대의 가로 중심축에 대응하는 시작점
  2. 첫째와 둘째 막대 중심 사이의 가상 하락점
  3. 두 번째 막대의 가로 중심축에 대응하는 회복점
  4. 둘째와 셋째 막대 중심 사이의 완만한 변동점
  5. 세 번째 막대의 가로 중심축에 대응하는 가장 높은 마지막점
- 세 기준점은 막대와 x축 위치만 공유한다. 꺾은선의 y축 값은 막대 높이에 종속되지 않으며 다섯 점 전체가 독립적인 변동 경로를 만든다.
- 선은 주식 차트처럼 꺾인 형태를 유지하되 stroke cap과 join은 둥글게 처리한다.
- 마지막은 화살촉 대신 작고 선명한 원형 점으로 마감한다.
- 모든 핵심 도형은 maskable 아이콘의 중앙 안전 영역 안에 둔다. 운영체제가 바깥 영역을 원·둥근 사각형 등으로 잘라도 기준선, 세 막대, 다섯 점 경로와 마지막 점의 의미가 남아야 한다.
- 192px와 512px 정적 아이콘에서 선, 가상 꺾임점과 마지막 점이 뭉개지지 않아야 한다.
- SVG를 단일 원본으로 사용하고 같은 원본에서 PNG 192px와 512px를 생성한다. 네 manifest asset이 같은 도형과 색을 사용해야 한다.

## 4. 인트로 장면

인트로는 기존 `SetupFlow` 내부가 아니라 Main 진입 계층이 소유하는 독립 장면이다. 전체 viewport를 사용하되 safe area를 존중하고 body 가로 overflow를 만들지 않는다.

bootstrap이 끝나기 전에는 Main의 현재 loading 문구만 neutral canvas 위에 표시하고 launcher나 setup surface를 먼저 노출하지 않는다. bootstrap 결과가 `fresh`이면 이 loading 상태에서 인트로로 직접 전환해 launcher 또는 setup welcome이 한 프레임 나타났다 사라지는 현상을 막는다. `resume`, dashboard와 recovery는 bootstrap 완료 후 각자의 기존 화면으로 이동한다.

Anime.js 시퀀스는 다음 순서를 사용한다.

1. 주황–청록 그라데이션 아이콘 바탕이 부드럽게 나타난다.
2. 기준선과 세 막대가 왼쪽부터 차례로 상승한다.
3. 다섯 꼭짓점의 꺾은선이 첫 점부터 마지막 최고점까지 그려진다.
4. 마지막 원형 점을 한 번만 잔잔하게 강조한다. 반복 pulse나 loop는 사용하지 않는다.
5. 완성된 정적 브랜드 아이콘 프레임을 잠시 유지한다.
6. 기존 setup welcome으로 자동 전환한다.

타이포그래피는 장면의 중심이 아니다. 완성된 아이콘 아래에는 앱 이름 `나의 가계 흐름`만 작은 보조 라벨로 표시한다.

전체 시퀀스는 자동 전환까지 2.2초를 넘기지 않는다. 구간별 duration은 구현 과정의 시각 검증으로 조정할 수 있지만, 사용자가 기다려야만 제품을 사용할 수 있는 구조로 만들지 않는다.

## 5. 노출 조건과 상태

인트로를 표시하는 경우:

- 저장된 Main 계획과 setup 진행 기록이 없는 최초 방문
- whole-workspace backup 복원 결과 Main plan과 setup progress가 모두 없는 새 시작 상태
- Main 관리 메뉴에서 `처음부터 다시`를 확정한 직후

인트로를 표시하지 않는 경우:

- 저장된 setup 진행 기록을 재개할 때
- 적용된 계획의 값을 일반 수정할 때
- dashboard나 다른 앱에서 Main을 평범하게 다시 열 때
- 인트로를 이미 완료한 동일한 최초 setup journey에서 React가 다시 렌더될 때

인트로 노출 여부를 위한 새 workspace 필드, localStorage key 또는 제품 schema는 추가하지 않는다. 현재 `MainState`만으로는 빈 workspace에서 새로 시작한 `welcome`과 저장된 `welcome` 진행 기록을 구분할 수 있으므로 UI는 저장하지 않는 `MainIntroEntryReason = 'fresh' | 'resume' | 'restart' | 'none'`을 소유한다. bootstrap 반환 계약은 `MainState`와 `fresh | resume | none` 진입 원인을 함께 전달하고, 현재 UI 세션의 `처음부터 다시` action만 이를 `restart`로 바꾼다.

- `fresh`: 최초 bootstrap 또는 whole-workspace backup 복원 결과 Main plan과 setup progress가 모두 없는 새 시작 상태. 인트로를 표시한다.
- `resume`: `initial` 또는 `restart` setup progress를 불러온 상태. progress 단계가 `welcome`이어도 인트로를 표시하지 않는다.
- `restart`: 현재 UI 세션에서 사용자가 `처음부터 다시`를 확정한 상태. 인트로를 표시한다.
- `none`: dashboard, 일반 수정 또는 recovery 등 인트로 대상이 아닌 상태.

이 값은 workspace에 저장하지 않는 UI 진입 메타데이터이며 `MainState`의 도메인·저장 의미를 바꾸지 않는다. `처음부터 다시`는 현재 적용 계획을 유지한 채 draft를 복사해 setup을 시작한다. 최초 설정과 동일한 것은 인트로와 setup 모션 경험이며, 적용 데이터의 존재 여부가 아니다.

`fresh` 진입 원인을 확정하면 인트로 렌더 여부와 관계없이 기존 `setupProgress` 계약으로 `initial / welcome` 진행 기록 저장을 즉시 요청한다. 인트로 완료를 저장 완료까지 막지는 않으며, 저장 성공 후 새로고침은 `resume`으로 판별되어 인트로를 반복하지 않는다. 저장이 실패하면 기존 setup 진행 경고를 보여주고 사용자는 계속 진행할 수 있다. 이 경우 저장되지 않은 빈 workspace를 새로고침하면 인트로가 다시 보일 수 있으며, 별도 저장 키로 이를 숨기지 않는다. `처음부터 다시`도 기존 `restart / welcome` 진행 기록을 사용한다.

backup 복원으로 `fresh`가 된 경우에도 같은 인트로를 허용한다. 인트로가 끝난 뒤 기존 setup welcome에서 backup 복원 성공 안내를 유지하며, 인트로가 해당 성공 상태나 workspace 결과를 소비하지 않는다.

인트로 완료 후의 목적지는 항상 기존 setup welcome이다. 최초 방문·빈 Main backup 복원의 `fresh` 상태와 `처음부터 다시`는 같은 인트로를 사용하며, 이후 setup과 review는 현재 계약을 따른다.

자동 종료나 skip이 시작되면 완료 경로는 먼저 현재 진입 원인을 `none`으로 소비한 뒤 인트로를 unmount하고 setup welcome을 렌더한다. 따라서 저장 응답, React 재렌더 또는 Strict Mode effect 재실행이 같은 UI 세션에서 인트로를 다시 열 수 없다.

## 6. 건너뛰기와 접근성

- 인트로의 비대화형 인포그래픽 SVG는 `aria-hidden="true"`로 보조 기술의 탐색 대상에서 제외한다.
- 인트로 배경의 pointer 또는 touch 입력은 어디서 시작해도 즉시 완료하며 하단 버튼과 같은 완료 함수를 호출한다. 전체 컨테이너에 `role="button"`을 부여하지 않는다.
- 하단 safe area 위에는 실제 `button`으로 `화면을 눌러 건너뛰기`를 표시한다. 낮은 시각 우선순위는 낮은 가독성을 뜻하지 않으며 텍스트 대비와 최소 44px hit area를 지킨다.
- reduced motion이 아닌 `fresh` 또는 `restart` 인트로가 mount되면 하단 skip 버튼에 focus를 두어 최초 방문·빈 Main backup 복원과 restart 확인 dialog 이후 모두 현재 화면과 조작 방법을 알 수 있게 한다.
- 인트로가 mount된 동안에만 `Enter`, `Space`, `Escape`를 처리한다. 입력·버튼 등 별도 대화형 자식은 두지 않아 전역 shortcut과 충돌하지 않게 한다.
- 인트로는 `<section>`과 시각적으로 숨긴 제목 `나의 가계 흐름 시작 화면`, 설명 `잠시 후 설정 화면으로 이동합니다. 화면을 누르거나 건너뛰기 버튼을 선택할 수 있습니다.`를 `aria-labelledby`와 `aria-describedby`로 연결한다.
- 자동 종료, pointer/touch와 키보드 skip은 하나의 idempotent 완료 경로를 사용한다.
- 완료나 unmount 시 실행 중인 Anime.js instance, keyboard listener와 timer를 정리하고 setup welcome으로 한 번만 전환한다.
- 전환 후에는 기존 계약대로 setup welcome heading으로 focus를 이동한다.
- 인트로 모션은 focus, pointer 또는 keyboard 입력을 막지 않는다.

## 7. Reduced motion과 실패 복구

`prefers-reduced-motion: reduce`에서는 interactive 인트로를 mount하지 않고 진입 원인을 즉시 `none`으로 소비한 뒤 기존 setup welcome을 렌더한다. 따라서 skip 버튼 focus와 welcome heading focus가 짧은 간격으로 연속 이동하지 않는다. `fresh` setup progress 저장 요청과 backup 복원 성공 안내는 일반 모션 경로와 동일하게 유지한다.

Anime.js scope, timeline 또는 animation 생성에 실패하면 완성 프레임을 동기적으로 적용하고 setup welcome으로 전환한다. 모션 실패가 Main error boundary나 복구 화면을 유발해서는 안 된다.

## 8. 구현 경계

- Main 진입 계층은 인트로 표시 여부와 완료 전환만 소유한다.
- 독립 `MainWelcomeIntro` 컴포넌트는 인포그래픽 markup, Anime.js lifecycle, skip 입력과 완료 callback만 소유한다.
- 정적 브랜드 아이콘과 인트로는 동일한 geometry source 또는 명시적으로 검증되는 동일 좌표 계약을 사용해 형태가 어긋나지 않게 한다.
- `SetupFlow`, review의 `initial-assembly`, 실제 현금흐름 geometry와 초과분 표현은 변경하지 않는다.
- 상단 앱 메뉴와 launcher는 인트로에 렌더하지 않으며 기존 setup focus 화면 계약을 유지한다.
- animation state는 도메인 계산, navigation, 저장 순서 또는 workspace ownership을 소유하지 않는다.

## 9. 기존 명세와의 관계

[Anime.js 공통 모션 시스템 설계](2026-08-12-animejs-motion-system-design.md) 5.2의 작은 welcome 제목·설명·CTA reveal은 이번 독립 인트로가 앞에 추가되더라도 유지할 수 있다. 다만 브랜드의 예외적인 큰 시작 연출은 이 문서가 소유한다.

동 문서 5.3의 review 조립, 실제 비율, 초과 geometry, `처음부터 다시`와 일반 수정의 구분은 그대로 유지한다. 최초 설정에는 적용 계획이 없고, `처음부터 다시`는 현재 적용 계획을 유지한 채 복사한 draft로 setup을 진행한다. 두 경로는 브랜드 인트로 이후 기존 setup welcome부터 동일한 모션 sequence를 사용한다.

정적 아이콘 변경은 PWA asset 변경이다. SVG 원본에서 PNG를 재생성한 뒤 manifest 참조 네 개를 검증하고, 앱 버전과 service-worker cache version이 통상 release 절차로 함께 갱신되는지 확인한다. 이전 cache가 새 아이콘을 계속 제공하지 않아야 한다.

## 10. 검증과 인수 조건

- [ ] Main plan과 setup progress가 모두 없는 최초 빈 workspace에서 인트로가 표시되고 `initial / welcome` 진행 기록 저장을 즉시 요청한다.
- [ ] 진행 기록 저장 성공 후 welcome에서 새로고침하면 `resume`으로 복구되어 인트로가 반복되지 않는다.
- [ ] 진행 기록 저장 실패는 setup 진행 경고로 알리고 인트로 완료와 입력을 막지 않는다. 이 상태의 새로고침에서는 재노출될 수 있다.
- [ ] `처음부터 다시` 확정 후 동일한 인트로가 표시된다.
- [ ] Main plan과 setup progress가 모두 없는 정상 backup 복원 후에도 인트로가 표시되고, 완료 후 setup welcome에 복원 성공 안내가 유지된다.
- [ ] setup 재개, 일반 수정과 dashboard 재방문에는 표시되지 않는다.
- [ ] 자동 종료와 모든 skip 입력이 기존 setup welcome으로 한 번만 연결된다.
- [ ] 완료 경로가 진입 원인을 `none`으로 소비해 같은 UI 세션의 재렌더와 Strict Mode effect 재실행에서 인트로가 반복되지 않는다.
- [ ] 실행 중 skip과 unmount가 Anime.js instance와 timer를 정리한다.
- [ ] reduced motion에서는 interactive 인트로와 skip 버튼을 mount하지 않고 setup welcome으로 바로 이동하며 focus가 중간 대상에 머물지 않는다.
- [ ] Anime.js 실패에서 사용자가 인트로에 갇히지 않는다.
- [ ] 390px, 768px와 desktop에서 아이콘, 안내문과 safe area가 잘리지 않고 가로 overflow가 없다.
- [ ] pointer, touch, `Enter`, `Space`, `Escape`로 건너뛸 수 있다.
- [ ] SVG는 접근성 트리에서 제외되고 실제 하단 skip 버튼은 44px hit area, 접근 가능한 이름과 충분한 대비를 가진다.
- [ ] setup welcome 전환 후 기존 heading이 focus를 받으며 인트로 listener가 남지 않는다.
- [ ] bootstrap loading에서 최초 인트로로 전환할 때 launcher나 setup welcome이 먼저 나타나지 않는다.
- [ ] reduced motion이 아닌 모든 `fresh`와 restart 인트로는 mount 직후 실제 skip 버튼이 focus를 받는다.
- [ ] 192px와 512px의 SVG·PNG 정적 아이콘이 같은 새 브랜드 geometry를 보여주고 maskable crop에서도 핵심 도형이 보존된다.
- [ ] 일반 모션에서 390px, 768px와 desktop별로 막대 상승 중간, 꺾은선이 가상점을 통과하는 drawing 중간, 마지막 최고점이 완성된 최종 프레임을 timed capture한다.
- [ ] 꺾은선은 정확히 다섯 꼭짓점을 사용하고 두 가상점의 x좌표가 각각 인접한 막대 중심 사이에 있으며 마지막 점이 시각적으로 가장 높은 y좌표를 가진다.
- [ ] 인트로 최종 프레임과 정적 SVG가 같은 geometry 좌표 계약을 사용하며 192px 아이콘과 원형 mask에서도 꺾은선과 마지막 점을 구분할 수 있다.
- [ ] manifest asset, 앱 버전과 service-worker cache 갱신 후 설치·업데이트 환경에서 새 아이콘을 제공한다.
- [ ] 기존 review 조립, 실제 비율·초과 표현과 상단 앱 메뉴 동작에 회귀가 없다.
