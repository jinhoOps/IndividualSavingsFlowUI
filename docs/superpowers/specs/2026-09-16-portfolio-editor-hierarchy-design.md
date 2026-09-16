# Portfolio Editor Hierarchy Design

**Date:** 2026-09-16

**Status:** Approved implementation contract

**Scope:** Portfolio 최초 설정의 `배분` 단계와 적용 계획의 `배분 수정` 집중 편집 surface. 결과 대시보드, 계산·draft/applied·서버 저장 계약은 바꾸지 않는다.

**Binding context:** [Product PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [implementation plan](../plans/2026-09-16-portfolio-editor-hierarchy.md). 이 문서는 [Focused Mobile UX](2026-08-11-portfolio-focused-mobile-ux-design.md)의 대상 편집 표현·행동과 반응형 편집 surface 범위를 대체한다. 결과의 summary-first 계약은 [Summary-First UX](2026-08-10-portfolio-summary-first-ux-design.md)를 유지한다.

## Product boundary

- Portfolio는 최신 Main `monthlyInvestmentWon`을 읽기 전용으로 사용하고 aggregate Portfolio plan·draft만 쓴다.
- 최대 10개 자유 이름 대상, 원화 금액 입력, 계산 비율, 성장/안정 분류와 자동/사용자 지정 분류 출처를 유지한다. 현금은 항상 안정이다.
- 결과의 금액 기본 숨김, 명시적 적용, Main 투자금 0원 안내, schema v5·protocol 5·revision·backup·retained `locations`와 `accountMap` 계약을 바꾸지 않는다.
- 최초 설정·결과·재편집 어디에도 계좌·기관·보관처·공유 금융 위치 관리 UI를 만들지 않는다.

## Before evidence and problem

이 설계는 [390px](../evidence/2026-09-16-portfolio-editor/before-390-edit.png), [768px](../evidence/2026-09-16-portfolio-editor/before-768-edit.png), [1280px](../evidence/2026-09-16-portfolio-editor/before-1280-edit.png) 편집 캡처를 before evidence로 사용한다. 기존 재편집은 전체 맥락을 먼저 보여주지 않고, 모든 대상의 폼을 동시에 펼쳐 390px에서는 약 1,805px의 내용이 약 743px sheet에 놓이고 1280px에서도 두 번째 대상을 한 화면에 비교하기 어렵다.

구현은 글꼴·여백만 조정해서 끝내지 않는다. 최초 설정과 재편집 모두 `배분 요약 + 대상 목록 + 선택한 대상 편집`을 사용한다. 한 대상의 수정에는 한 번의 진입이 더 필요하지만, 전체 배분을 읽고 바꿀 대상 하나에 집중할 수 있다.

## Information hierarchy and visual language

| Priority | Content | Required treatment |
| --- | --- | --- |
| 1 | `투자 배분 수정`, `월 투자금 80만 원` | 제목 22–24px/700, 기준 금액 28–32px/700. 금액 옆 `Main 기준`은 보조 텍스트다. |
| 2 | 성장·안정 비율과 현금 상태 | 얇은 비례 막대와 텍스트를 함께 보인다. 초안 기준임을 알리고 변경 결과도 같은 위치에서 갱신한다. |
| 3 | 투자 대상 목록 | 이름·금액은 한 행, 분류·비율은 보조 행이다. 행 전체는 편집 button이고 작은 연필 아이콘은 행동을 설명한다. |
| 4 | 현금 자동/직접 배분과 추가 | 목록 다음에 현금 한 행과 `+ 투자 대상 추가`를 둔다. 현금은 `남은 금액 자동 배분` 상태를 명시한다. |
| 5 | 현재 변경 상태와 적용 | 최상위 편집 footer 한 곳에 상태 문구와 `취소 / 적용`을 둔다. primary action은 이 surface에만 둔다. |

- 제목 뒤 요약은 16px, 큰 섹션 사이는 24px, 행 내부는 4–8px을 출발점으로 한다. 공통 4px spacing 단위와 `Flat Panel`·hairline을 사용한다.
- 입력 label과 본문은 14–16px, 도움말은 13–14px이다. 10개 대상을 넣기 위해 글자를 더 작게 하지 않는다.
- 항목마다 카드를 중첩하지 않는다. 하나의 목록과 얇은 구분선으로 비교 단위를 만든다.
- 숫자는 오른쪽 정렬과 `tabular-nums`를 사용한다. 긴 이름은 줄바꿈하고, 핵심 금액·비율은 말줄임으로 숨기지 않는다.
- Gowun Batang은 제목·기준 금액, Gowun Dodum은 label·본문·입력·button에 사용한다. 브랜드 강조색은 현재 선택과 primary action에만 집중한다. 오류는 field 옆 문장으로 설명하며 색상만으로 전달하지 않는다.
- 삭제는 대상 편집 안의 낮은 강조 아이콘 action으로 둔다. 목록의 각 행에 삭제 button을 반복하지 않는다.

## Editor composition and actions

전체 배분 편집은 header, summary, scroll body, footer로 분리한다. header에는 제목과 44px 닫기 control을 둔다. summary는 기준 투자금 → 성장/안정 → `편집 중인 배분` 안내 순서다. body는 입력 순서를 보존하는 대상 요약 목록 → 현금 행 → `+ 투자 대상 추가` 순서이고 body만 스크롤한다. 변경 전에는 적용 action을 숨기며, 첫 변경 뒤 footer에 `아직 적용하지 않은 변경이 있어요`, `취소`, `적용`을 표시한다.

대상 행이나 추가 action은 같은 `PortfolioItemSheet`를 연다. 이 surface는 이름, 금액 `원`, 계산 비율, 성장/안정 선택과 분류 출처, footer 순서다. 성장/안정은 이름 오른쪽의 단일 toggle이 아니라 두 선택지가 동시에 보이는 `SegmentedControl`이다. 사용자가 선택하면 분류 출처는 사용자 지정이 되고, 기존 `자동 추천 사용` 경로는 유지한다. 신규 추가에서만 `S&P 500`, `나스닥`, `코스피`, `미국 국채`, `금 현물` 빠른 이름 선택을 제공한다. 선택은 이름을 채운 뒤 금액 field로 focus를 옮기고, 자동 분류 상태일 때만 선택한 이름으로 추천을 갱신하며 사용자 지정 분류는 보존한다. `-50만 / -10만 / +10만 / +50만` 금액 빠른 조정은 추가·수정 모두에서 제공한다.

`완료`는 유효한 local 입력을 한 번의 draft-item commit으로 초안에만 반영하며 안내 문구는 `배분 초안에 반영돼요`다. 합계 초과·중복 이름·최소 금액 오류에서는 입력과 surface를 유지하고 해당 field 가까이에 이유를 표시한다. backdrop·Escape·`취소`는 local 변경이 없으면 닫고, 변경이 있으면 폐기 확인을 연다. 적용은 기존 확인 dialog에서 `계속 수정 / 배분 적용`을 제공하며 저장 중 중복 조작을 막는다. 실패·충돌·오프라인 잠금은 편집 맥락에 남기고 입력을 지우거나 성공처럼 닫지 않는다.

현금은 기본으로 금액·비율·`남은 금액 자동 배분` 한 행이다. 선택하면 직접 입력을 펼치고 현재 모드를 명시한다. 수동 현금에서 미배분 금액이 남으면 `아직 배분하지 않은 금액`과 적용 가능 조건을 보이며 합계를 임의로 100% 정규화하지 않는다.

## Responsive state contract

| Viewport | Clean, 3 targets | Dirty, 3 targets | Error, 3 targets | Clean/dirty/error, 10 targets |
| --- | --- | --- | --- | --- |
| 390px | 88dvh 이하 bottom sheet에 header·summary·세 대상·현금·추가 진입점을 첫 화면에서 읽는다. | body만 스크롤하고 footer 공간을 미리 확보해 마지막 행을 가리지 않는다. | 오류 field와 설명까지 body에서 도달 가능하며 footer가 덮지 않는다. | 가로 overflow 없이 세로 scroll을 허용한다. summary와 현재 작업을 잃지 않고, 200% 확대에서도 금액·비율·action을 숨기지 않는다. 이 전체 배분 가독성이 첫 구현 통과 기준이다. |
| 768px 이하 | 390px과 같은 bottom sheet 계약을 사용한다. | 같은 footer·body 분리와 적용 조건을 사용한다. | sheet 내부 scroll로 오류와 action을 함께 접근한다. | 목록은 단일 열을 유지하며 긴 이름·금액·비율이 panel 밖으로 나가지 않는다. |
| 1280px | 769px 이상이므로 우측 panel을 사용한다. 결과는 보이되 inert다. | panel footer에만 `취소 / 적용`을 표시한다. | 오류를 해당 panel field 가까이에 표시한다. | 두 번째 대상부터 비교할 수 없는 전체 inline form을 만들지 않는다. 동일한 요약 행 목록을 scroll body에 두고 선택한 항목만 편집한다. |

모바일과 tablet의 최상위 편집은 88dvh 한도 bottom sheet, desktop의 최상위 편집은 우측 panel이다. 대상 편집도 같은 breakpoint를 따른다. parent editor는 열려 있으나 대상 sheet·폐기 확인 중에는 `inert`이며 최상위 dialog만 focus를 소유한다. 결과 영역도 편집 중 `inert`와 `aria-hidden`이다.

## Focus return contract

| Event | Focus destination |
| --- | --- |
| `배분 수정`을 연 뒤 닫기 또는 clean 취소 | `배분 수정` trigger |
| 기존 대상 수정 완료 또는 취소 | 선택했던 대상 행 |
| 신규 대상 추가 완료 | 새로 생성된 대상 행 |
| 신규 대상 추가 취소 또는 삭제 | `+ 투자 대상 추가` button |
| 현금 상세 접기 | 현금 행 trigger |
| 폐기 확인에서 계속 입력 | 대상 sheet 안의 이전 action 또는 오류 field |
| 폐기 확인에서 버리기 | 닫히는 대상 sheet의 원래 return target |
| 전체 적용 성공 또는 전체 취소 | 결과의 `배분 수정` trigger |
| 저장 실패·충돌·validation failure | 첫 관련 field; 오류 설명을 field와 연결 |

모든 dialog는 accessible title, focus containment, Escape 처리와 close 뒤 위 표의 focus return을 가진다. 44px 이상 control, keyboard-only 선택·완료·취소·적용, visible focus와 accessible name을 보장한다.

## Motion and final state

| Event | Motion | Required final-state behavior |
| --- | --- | --- |
| 모바일 sheet 열기 | 실제 열린 카드 높이만큼 `bottom`을 260ms 보간 | fixed footer 기준을 바꾸는 transform을 dialog에 추가하지 않는다. |
| desktop panel 열기 | `right` 기반 8px·180ms | 입력과 focus는 즉시 사용 가능하다. |
| 현금 상세 열기 | 4–8px·180ms reveal | 접힐 때 내부 focus는 현금 trigger로 돌아간다. |
| 대상 완료 뒤 요약 갱신 | 비례 막대만 260ms | 텍스트·accessible 값은 즉시 최종값이며 입력 숫자를 보간하지 않는다. |
| dirty footer 첫 표시 | 4px·180ms | footer 공간을 미리 확보해 마지막 행과 CTA가 튀지 않는다. |
| 닫기·저장·탐색 | 즉시 상태 전환 | animation callback이 저장 또는 focus return의 조건이 아니다. |

`prefers-reduced-motion`, animation/scope 초기화 실패, unmount와 연속 값 변경에서는 즉시 최종 상태와 cleanup을 보장한다. 반복 bounce, 모든 행 stagger, 매 keystroke 재등장, 전체 목록 자동 재정렬은 사용하지 않는다.

## Acceptance and implementation review

- 390×844의 3개 대상 clean editor 첫 화면에서 제목, 기준 투자금, 성장/안정 요약, 세 대상, 현금, 추가 진입점을 읽을 수 있다. dirty에서도 footer가 마지막 행을 가리지 않는다.
- 10개 대상·긴 이름·200% 확대에서는 세로 scroll을 허용하되 body의 가로 overflow가 없고 전체 배분 요약과 현재 action을 이해할 수 있다.
- 대상 선택 전에는 모든 행에 이름 textbox·분류 control을 펼치지 않는다. 입력 field 옆에는 `원`, 아래에는 계산 비율을 보이며 입력값을 아래에 반복하지 않는다.
- 390px, 768px, 1280px에서 clean·dirty·오류 상태를 확인한다. 390px 전체 배분 가독성을 다른 visual polish보다 먼저 통과시킨다.
- Portfolio의 aggregate-only ownership, 결과의 비율 우선·기본 금액 숨김, Main read-only 경계와 location data 보존은 그대로다.
