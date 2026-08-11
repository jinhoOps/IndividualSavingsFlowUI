# Portfolio Focused Mobile UX Design

**Date:** 2026-08-11

**Status:** Approved

**Scope:** Portfolio 최초 설정, 결과, 배분 수정과 투자 위치 관리의 화면 분리

## 배경

현재 Portfolio 모바일 화면은 배분 결과 또는 편집기와 투자 위치 목록·생성 폼을 한 페이지에 이어서 표시한다. 개별 control의 반응형 containment와 접근성은 안정적이지만, 사용자는 배분과 투자 위치 관리 중 어떤 일을 먼저 해야 하는지 스스로 판단해야 한다. 특히 최초 설정과 수정에서 투자 위치 관리가 함께 노출되어 주 작업의 집중도가 낮다.

Main의 현재 UX처럼 최초 설정, 결과 확인과 수정의 시각적·상호작용 상태를 분리한다. Portfolio의 기존 데이터 소유권, 계산, draft/apply 계약과 shared investment location command 경계는 변경하지 않는다.

## 목표

- 최초 사용자에게 한 번에 하나의 배분 과업만 제시한다.
- 결과 화면과 수정 화면을 명확히 구분한다.
- 모바일 수정은 결과 맥락을 유지하면서도 편집에 집중할 수 있게 한다.
- 투자 위치 관리를 배분 설정·수정과 동시에 노출하지 않는다.
- 기존 Portfolio 저장·복구·접근성·반응형 계약을 보존한다.

## 비목표

- 위치별 Portfolio 배분 편집
- Portfolio plan, draft 또는 workspace schema 변경
- Main 투자금 수정 또는 Main write-back
- Account Map 상세 기능
- 시세, 수익률, 계좌 번호 또는 매수 실행
- 투자 위치 생성 흐름의 별도 다단계 wizard화

## 상태 모델

Portfolio는 사용자에게 다음 세 가지 제품 상태를 명확히 보여준다.

### 최초 설정

적용된 aggregate plan이 없고 Main 투자금이 양수일 때 진입한다.

- 전체 화면의 단계형 설정 surface를 사용한다.
- 투자 위치 목록·생성·변경·보관 UI를 렌더링하지 않는다.
- 첫 화면은 `매달 {투자금}을 어디에 투자할까요?`라는 목적 문장과 짧은 설명을 제공한다.
- 첫 투자 대상을 추가하는 단일 primary action을 우선하되 투자 대상 추가를 강제하지 않는다. 사용자는 현금 100% 계획도 명시적으로 적용할 수 있다.
- 입력 방식 기본값은 현재 계약대로 `금액`이다. `비율` 전환은 같은 편집 surface 안의 보조 control로 유지한다.
- 현금은 남은 투자금 자동 배분 상태로 설명하며 별도 투자 대상처럼 먼저 설정하도록 요구하지 않는다.
- `배분` 단계는 월 투자금과 성장·안정 비율의 라이브 요약을 입력보다 먼저 보여준다. 투자 대상은 이름·분류·금액을 한 카드로 묶고, 현금은 낮은 강조의 자동 배분 영역으로 구분한다.
- 마지막 검토는 성장·안정 비율 문장을 결론으로 먼저 보여주고, 총 투자금·투자 대상 수와 함께 각 대상 및 현금의 금액·비율을 확인한다. `이대로 시작`으로 즉시 적용하며 별도 적용 확인 dialog를 다시 열지 않는다.
- 최초 설정 draft는 현재 Portfolio draft 저장 계약을 그대로 사용한다. 저장된 draft가 있으면 새로고침 후 입력값을 보존한 `배분` 단계로 재개하며, 별도 setup-step을 저장하거나 `검토` 단계를 복원하지 않는다.

단계는 다음 세 개로 제한한다.

1. `시작`: 목적과 Main에서 읽은 월 투자금을 설명한다.
2. `배분`: 라이브 성장·안정 구성을 확인하며 투자 대상과 금액 또는 비율을 편집한다.
3. `검토`: 성장·안정 합계와 대상별 금액·비율을 확인한다.

### 결과

적용된 aggregate plan이 있으면 결과 화면으로 진입한다.

- 정보 순서는 저장 상태, 투자금 요약, 도넛, 표, `배분 수정`, 접힌 투자 위치 순서다.
- `배분 수정`은 결과 화면의 명확한 primary action이다.
- 투자 위치는 기본적으로 접힌 disclosure로 표시한다. 요약은 `투자 위치 {n}곳`과 준비 상태를 제공한다.
- disclosure를 펼친 뒤에만 위치 목록, 생성 폼, 이름 변경과 보관을 제공한다.
- `아직 배분하지 않음`은 disabled button이 아니라 비상호작용 status badge 또는 상태 text로 표현한다.
- 위치별 배분 action은 추가하지 않는다.

### 수정

적용된 plan에서 `배분 수정`을 선택하면 집중 편집 surface를 연다.

- 모바일 768px 이하에서는 modal bottom sheet를 사용한다.
- desktop에서는 오른쪽 고정 panel을 사용한다.
- 배경 결과는 시각적 맥락으로 남지만 `inert`와 적절한 `aria-hidden` 처리로 상호작용 대상에서 제외한다.
- 편집 surface에는 투자 대상, 입력 방식, 현금과 적용 controls만 표시한다.
- 투자 위치 UI를 렌더링하지 않는다.
- 단순 진입은 dirty 상태를 만들지 않는다.
- 변경 전에는 닫기 control만 제공한다. 변경 후에는 고정 `취소 / 적용` bar를 표시한다.
- `취소`는 현재 초안을 폐기하고 결과 화면으로 복귀한다.
- `적용`은 확인 dialog를 열고 성공 후 결과 화면으로 복귀한다.
- 변경 전 새로고침 또는 앱 이탈은 저장할 draft가 없으므로 결과 화면으로 돌아간다.
- 첫 변경 후 새로고침 또는 앱 이탈은 기존 계약대로 draft를 보존하며 재진입 시 수정 surface로 복원한다.

## 적용 확인

수정 흐름의 확인 dialog 정보는 짧은 요약 행으로 재구성한다. 최초 설정은 이미 검토 단계를 거치므로 확인 dialog를 사용하지 않는다.

- 제목: `투자 배분을 적용할까요?`
- 투자 대상, 투자금과 현금 비중을 각각 한 행으로 표시한다.
- label과 value를 시각적으로 분리하고 금액·비율을 오른쪽 정렬한다.
- `계속 수정`을 secondary action, `배분 적용`을 primary action으로 사용한다.
- 수정에서는 성공 후 편집 surface를 닫고 갱신된 결과로 복귀한다.

## 반응형 동작

### 390px 모바일

- 최초 설정은 하나의 설정 surface만 표시한다.
- 단계 action은 입력을 가리지 않으며 document flow 안에서 마지막 입력 다음에 표시한다.
- 수정 bottom sheet는 최대 높이 `88dvh` 안에서 내부 스크롤한다.
- 고정 action bar는 safe area를 반영하고 마지막 입력을 가리지 않는다.
- 결과의 도넛과 표는 계속 보이되 투자 위치 상세는 기본적으로 접는다.
- 모든 보이는 주요 controls는 최소 44px touch target을 유지한다.

### 768px 이하

- viewport 너비가 768px 이하이면 수정은 모바일과 같은 bottom sheet 계약을 사용한다.
- 결과 요약은 단일 열을 유지할 수 있지만 투자 위치 disclosure가 과도한 빈 공간 없이 요약 다음에 이어져야 한다.

### Desktop

- viewport 너비가 768px보다 크면 수정은 side panel 계약을 사용한다.
- 결과는 현재 도넛·표 2열 구성을 유지한다.
- 수정 panel은 결과를 덮지 않는 범위에서 오른쪽에 고정하며 최대 너비는 Main 편집 panel과 일관되게 설정한다.
- 투자 위치 상세는 결과 화면에서만 펼칠 수 있다.

## 접근성

- 최초 설정은 진행률과 현재 단계 이름을 text로 함께 알린다.
- 단계 이동 후 현재 단계 heading에 programmatic focus를 둔다.
- bottom sheet와 확인 dialog는 `role="dialog"`, accessible title, focus containment와 trigger focus return을 제공한다.
- 배경 결과는 modal이 열린 동안 keyboard와 assistive technology 탐색에서 제외한다.
- 투자 위치 disclosure는 native `details/summary` 또는 동등한 `aria-expanded` contract를 사용한다.
- status badge는 button role을 갖지 않는다.
- 오류는 해당 field에 연결하고 색상만으로 전달하지 않는다.
- reduced motion에서는 단계·sheet 전환 animation을 제거하거나 즉시 완료한다.

## 데이터와 상태 흐름

- Main source adapter는 최신 `monthlyInvestmentWon`을 읽기 전용으로 제공한다.
- 최초 설정과 수정은 기존 aggregate Portfolio draft를 사용한다.
- 적용 성공은 기존 aggregate plan 저장과 draft 정리를 사용한다.
- 투자 위치 disclosure의 열림 여부는 view-only 상태이며 workspace에 저장하지 않는다.
- 결과 화면에 새로 진입하거나 페이지를 다시 불러오면 투자 위치 disclosure는 닫힌 상태로 시작한다. 같은 결과 화면에서 위치를 생성·변경·보관하는 동안에는 열린 상태를 유지한다.
- 투자 위치 command는 결과 화면의 펼친 위치 관리 영역에서만 실행한다.
- workspace schema, revision protocol과 location identity는 변경하지 않는다.

## 오류와 복구

- Main 계획 없음, 투자금 0원과 stale Main 처리는 현재 계약을 유지한다.
- draft 저장 실패는 현재 편집 surface 안에 표시하고 적용 계획을 유지한다.
- 적용 실패 시 dialog 또는 편집 surface를 닫지 않는다.
- 외부 위치 변경은 결과 화면의 펼친 투자 위치 영역에서 현재 reconciliation과 focus 복구 계약을 유지한다.
- 저장된 draft 복원이 실패하면 적용 결과를 보존하고 명시적 복구 상태를 보여준다.

## 구현 경계

- Portfolio bootstrap과 reducer에 최초 설정·결과·수정 presentation state를 명시한다.
- 기존 `AllocationEditor`는 단계형 최초 설정과 집중 수정에서 재사용 가능한 편집 content로 유지한다.
- 모바일 sheet와 desktop panel은 공통 편집 content와 action contract를 사용한다.
- `InvestmentLocations`는 결과 화면의 disclosure 안에서만 mount한다.
- Main의 setup progress를 Portfolio로 복사하지 않는다. Portfolio draft가 재개 가능한 상태의 단일 저장 원천이다.

## 검증

### 사용자 흐름

- 최초 진입은 투자 위치 없이 `시작 → 배분 → 검토 → 결과`를 완료한다.
- 최초 설정 새로고침은 기존 draft 입력값을 보존한 `배분` 단계로 복원한다.
- 결과 진입은 투자 위치를 접은 상태로 시작한다.
- 모바일 수정은 bottom sheet, desktop 수정은 side panel에서 동작한다.
- 수정 진입만으로 dirty가 되지 않고 변경 후에만 action bar가 나타난다.
- 변경 전 수정 surface에서 새로고침하면 결과로 돌아가고, 첫 변경 후 새로고침하면 draft와 수정 surface를 복원한다.
- 취소, 적용 성공, 적용 실패와 draft 재개가 마지막 적용 계획을 안전하게 보존한다.
- 투자 위치 관리가 최초 설정·수정 surface에 나타나지 않는다.

### 반응형·접근성

- 390px, 768px와 desktop에서 가로 overflow가 없다.
- modal/panel/action bar가 입력과 주요 action을 가리지 않는다.
- 모든 주요 controls가 44px 이상이다.
- keyboard-only로 최초 설정, 수정, 적용, 취소와 위치 disclosure를 수행한다.
- focus 진입·containment·return과 Escape 동작을 검증한다.
- 도넛과 표의 pointer·touch·keyboard 동등성은 유지한다.
- console error가 없다.

## 인수 조건

- 최초 설정 DOM에는 투자 위치와 결과 controls가 없고 단계형 설정 controls만 있다.
- 결과 DOM에는 배분 editor가 없고 요약·도넛·표와 닫힌 투자 위치 disclosure가 있다.
- 수정 dialog 또는 panel이 열리면 결과 controls는 `inert`이며 keyboard와 assistive technology 탐색에서 제외된다.
- 최초 설정과 수정 중 투자 위치 UI가 보이지 않는다.
- 결과 화면의 투자 위치는 기본적으로 접혀 있고 사용자가 명시적으로 펼친다.
- `아직 배분하지 않음`은 비상호작용 상태로 읽힌다.
- 모바일 수정은 결과와 분리된 focus-contained bottom sheet다.
- desktop 수정은 결과와 분리된 side panel이다.
- 768px 이하에서는 bottom sheet, 768px보다 큰 viewport에서는 side panel을 사용한다.
- 최초 설정 검토의 `이대로 시작`은 별도 확인 dialog 없이 적용하며, 수정 적용만 확인 dialog를 사용한다.
- 최초 설정은 투자 대상 0개·현금 100% 계획을 유효한 사용자 선택으로 허용한다.
- 기존 Portfolio 계산, draft/apply, Main read-only와 shared location command 계약이 유지된다.
- 현재 Portfolio E2E와 새 상태 분리 E2E가 모두 통과한다.
