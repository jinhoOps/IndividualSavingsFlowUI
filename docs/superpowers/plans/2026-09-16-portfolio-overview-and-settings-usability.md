# Portfolio 전체 배분 막대·설정 조작성·샘플로 시작하기 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 이번 요청은 계획 작성이며 제품 구현은 포함하지 않는다.

**Goal:** Portfolio에서 샘플을 출발점으로 배분을 쉽게 만들고, 전체 비율을 한눈에 읽으며, 설정 항목을 확실하게 선택할 수 있게 한다.

**Architecture:** 기존 PortfolioSummary가 만드는 표시 항목을 전체 100% 막대와 목록의 단일 데이터로 사용한다. 보기 설정의 native input 의미와 저장 경로를 보존하면서 행 전체의 조작·포커스 처리를 개선한다. 샘플과 조합 도우미는 동일한 임시 비율 모델을 만들고, 사용자의 명시적 선택 후 기존 Portfolio draft로 변환한다. 공유 메뉴 수정은 실제 재현으로 필요성이 확인될 때만 수행한다.

**Tech Stack:** React, TypeScript, 기존 CSS 토큰, Anime.js, Vitest, Playwright.

**Spec:** 사용자 요청과 아래 설계. 기준 문서는 [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [Main 가로 배분 설계](../specs/2026-09-11-main-allocation-discovery-design.md), [Portfolio 편집 설계](../specs/2026-09-16-portfolio-editor-hierarchy-design.md)다. 2026-09-16 대화에서 상대 위험도 중심 탐색과 복수 속성 태그 방향을 승인했다. 승인된 설계 방향과 현재 구현된 제품 계약은 구분한다.

**Status:** 결과 대시보드·보기 설정과 샘플/직접 조합의 첫 구현을 진행 중이다. 샘플 탐색은 **상대 위험도 → 투자 방식·구성 속성 → 샘플 비교**로 확정한다. 질문형 탐색의 문항·결정표는 후속 설계 대상이다. 새 입력 경로의 draft 교체 계약은 PRD와 함께 갱신한다.

**Baseline:** 2026-09-16, `ebc43c6a`. 기존 `package-lock.json` 및 미추적 `2026-09-16-portfolio-editor-hierarchy.md`는 보존한다.

## Global Constraints

- Main의 다섯 월 금액 소유권, Portfolio aggregate plan/draft, 계산·적용·복구 계약을 유지한다.
- workspace schema v5, 서버 protocol 5, `workspace.locations`와 `workspace.accountMap`을 유지한다.
- 금액은 기본으로 숨기며 DOM·접근성 이름·tooltip에도 숨긴 금액을 넣지 않는다.
- 금액 보기·정렬은 기존 Portfolio 전용 보기 설정 record에 저장한다. 새 저장 키나 의존성을 추가하지 않는다.
- 최대 10개 대상 + 현금, 동률 정렬, 0원 안내, 편집 sheet/panel 및 적용 이후 결과 갱신을 보존한다.
- 390px·768px·1280px, 최소 44px 조작 영역, 키보드·터치 동등성, reduced-motion과 모션 실패 시 최종 표시를 검증한다.
- 결과 화면·Portfolio 보기 설정과 샘플/조합 도우미 진입을 다룬다. 기존 자유 입력 편집기와 최초 설정의 `시작 → 배분 → 검토` 구조는 유지한다. 비율 입력은 도우미 안에 한정하고 일반 항목 편집은 원화 입력을 유지한다.
- 1·2차의 샘플은 사용자가 고르는 배분 예시다. 질문 기반 샘플 제안은 아래 3차 후속 범위로 분리한다. 기대수익률 산출·자동 매매·자동 리밸런싱은 추가하지 않는다.
- 투자 성향 검사는 **완전한 선택 기능**이다. 최초 설정·샘플 선택·직접 조합·저장·적용의 선행 조건으로 삼지 않는다. Portfolio 결과 최하단에서 더 탐색하는 사용자가 발견하는 보조 진입으로만 제공한다.
- GOLD는 사용자 확인에 따라 **금 자산 전반**이다. 특정 ETF/금광주 티커에 매핑하지 않는다. `SHCD`는 `SCHD`로 정규화한다. BTC는 비트코인 자산을 뜻하며 특정 현물 ETF를 자동 선택하지 않는다.

## 관찰과 확인할 가설

- `PortfolioSummary.tsx`는 안정 비중과 최대 배분 항목 다음에 항목별 독립 막대를 렌더링한다. 전체를 100%로 이어서 보여주는 막대는 없다.
- 항목 색상이 현재 표시 index에 연결되어 있다. 정렬 전환 때 같은 대상의 색상이 바뀔 수 있으므로 전체 막대 도입 시 대상별 색상 일관성을 함께 해결한다.
- `PortfolioManagementMenu.tsx`는 native checkbox에 `role="switch"`를 사용하고 라벨로 감싼다. CSS에 이미 `min-height: 44px`가 있다.
- 테스트 전용 Vite entry와 합성 데이터(50/25/15/10%)를 Orca 브라우저에서 열어 결과·메뉴 스크린샷과 DOM을 확인했다. 961×838 viewport에서 설정 라벨은 246×44px, input은 18×18px였다. 따라서 작은 input 크기만을 원인으로 단정하지 않는다.
- `AppManagementMenu.tsx`는 root의 blur에서 `relatedTarget`이 내부에 없으면 즉시 닫는다. 라벨 텍스트/여백을 누를 때 input으로의 전달 전에 메뉴가 닫히는지는 **재현이 필요한 가설**이다.
- 기존 테스트는 input 직접 선택 위주다. 라벨 여백 클릭·실제 pointer 이벤트 순서·터치 누락의 증거는 부족하다.
- 이번 계획에서 세 가지 목표 viewport의 전체 검증과 실제 모바일 검증은 수행하지 않았다. 아래 구현 완료 기준에 포함한다.

## 제안 설계

### 1. 전체 비율과 목록을 하나의 표면으로

```text
안정 50%                              [배분 수정]
글로벌 인덱스에 50%를 배분해요

[ 글로벌 인덱스 50 | 채권 25 | 금 15 | 현금 10 ]  ← 전체 100% 막대

● 글로벌 인덱스                            50%
● 채권                                     25%
● 금                                       15%
● 현금                                     10%
```

- Main처럼 `핵심 요약 → 가로 막대 → 대응하는 항목 행`을 한 요약 표면에 모은다. 별도 차트 카드나 중복 표는 추가하지 않는다.
- 막대는 32px 높이, 양 끝만 둥글게 처리한다. 작은 구간 내부에는 글자를 욱여넣지 않고 아래 목록에서 이름·비율을 항상 읽게 한다. 위 도식의 막대 내 텍스트는 설명용이다.
- 각 행의 독립 막대는 제거하고 전체 막대 하나로 대체한다. 행은 색상 표시·이름·비율, 금액 표시 시 보조 금액으로 구성한다.
- `안정 N%`를 금액 보기 상태에서도 주 요약으로 유지하고 총 투자금은 보조로 표시한다. 현금은 안정 비중에 포함한다.
- desktop도 막대 위/목록 아래 구조를 기본으로 한다. 모바일·태블릿에서 같은 읽기 순서를 유지하며 별도의 좌우 2열을 강제하지 않는다.
- 막대와 목록은 같은 정렬 결과를 소비한다. 색상은 표시 index 대신 원본 대상의 고정 순서(order, 동률이면 id)로 정하며 현금 색상은 고정한다. 정렬·금액 보기 전환으로 색상이 바뀌지 않게 한다. 삭제 뒤 전체 팔레트를 영구 보존하는 새 저장 기능은 만들지 않는다.
- hover·키보드 focus·터치 선택으로 목록 행과 대응 구간을 함께 강조한다. 목록의 이름·비율 영역은 최소 44px 버튼이며 금액을 숨기거나 tooltip을 열어야 이해할 수 있는 구조를 피한다. 같은 행 재선택·Escape로 강조를 해제한다. 비율 선택은 편집을 열거나 데이터를 저장하지 않는다.
- 작은 막대 구간에 독립된 작은 클릭 영역을 만들지 않는다. 목록이 모든 항목의 확실한 접근 경로다. 0% 항목은 목록에 남기되 막대 폭을 부풀리지 않는다.
- 막대 폭은 반올림 표시 문자열이 아닌 원본 비중에서 구한다. 현금 100%, 소수 비율, 10개 대상에서도 실제 비례를 유지한다. 투자금 0원일 때 기존 안내를 우선하고 저장된 배분 의도를 바꾸지 않는다.
- 막대는 목록과 중복 낭독하지 않는 장식 그래픽으로 처리한다. 의미 있는 이름·비율·선택 상태는 목록에서 제공한다.
- 기존 Anime.js 경로에서 결과 변경을 짧게 보간한다. 제거되는 개별 막대 전용 코드·테스트만 정리하고 행 정렬·숫자 전환·reduced-motion·실패 복구는 보존한다.

### 2. 설정을 행 단위로 확실하게 선택

- `금액 보기`는 왼쪽 설명 + 오른쪽 분명한 스위치 모양으로 표시한다. native checkbox와 기존 switch role·checked·onChange 의미는 유지한다.
- 행 전체를 label로 유지하고 높이를 48px 이상 확보한다. 글자·여백·스위치 어느 곳을 눌러도 정확히 한 번 전환되게 한다. label과 input에 중복 toggle handler를 달지 않는다.
- `비율순 / 입력순`은 native radio group을 유지하고 각 행 전체를 48px 이상의 선택 영역으로 만든다. 체크 표시·선택 배경과 명확한 focus ring으로 현재 상태를 구분한다.
- 변경해도 메뉴는 열린 채로 유지한다. Space로 스위치를 전환하고 radio는 방향키로 이동·선택할 수 있어야 한다. Escape·바깥 클릭·외부로의 Tab 이동은 기존 닫힘 계약을 유지한다.
- 라벨 클릭 누락이 공유 메뉴 blur 처리에서 재현되면, 내부 pointer 상호작용 종료 후 실제 focus가 외부에 있는지 판단하도록 최소 수정한다. 단순 timeout 추가나 전역 `preventDefault`로 우회하지 않는다.
- Portfolio 전용 CSS에서 input의 크기·padding·focus를 명시한다. shared input 전역 규칙은 이번 해결에 필수라는 증거가 없으면 수정하지 않는다.

### 3. 샘플에서 시작하고 원하는 만큼 조정

#### 선택한 방향과 도입 순서

| 대안 | 장점 | 한계 | 결정 |
| --- | --- | --- | --- |
| 7개 고정 샘플만 제공 | 처음 선택하기 쉽다 | 비율을 바꾸려면 바로 금액 편집으로 전환해야 한다 | 출발점으로 사용 |
| 처음부터 주력·보조 자산 선택 | 자유도가 높다 | 자산·비율을 모르는 사용자에게 첫 결정이 많다 | 후속 직접 조합 경로 |
| 샘플 선택 → 비율 조정 → 기존 검토·적용 | 쉽게 시작하고 같은 화면에서 자기 배분으로 바꿀 수 있다 | 임시 미리보기와 저장 draft의 경계를 명확히 해야 한다 | **추천, 1차 출시** |

1차는 일곱 샘플, 구성 설명, 미리보기, 주력/보조 비율 조정까지 제공한다. 이름·대상을 자유롭게 바꾸는 기존 편집도 유지한다. 2차는 같은 도우미에 `직접 조합` 진입을 추가해 주력 자산과 보조 자산을 직접 고르게 한다. 샘플과 직접 조합을 서로 다른 편집기로 만들지 않는다.

#### 샘플 구성과 탐색 언어

일곱 구성은 그대로 보존한다. **상대 위험도를 첫 탐색 축으로, 투자 방식과 구성은 복수 태그로 표시한다.** 아래 번호는 문서 식별용이며 1~7을 검증된 안전도 점수로 표시하지 않는다. 첫 선택을 자동으로 확정하지 않는다.

| 탐색 구간 | 원본 샘플 | 구간을 설명하는 구성 특징 |
| --- | --- | --- |
| 방어 지향 | S1·S2·S3 | 레버리지 없는 주식형 70% + 금 30%. 이 샘플 집합 내에서 분산·방어를 지향 |
| 성장 지향 | S4 | 금 없이 나스닥100 ETF와 배당주 ETF에 배분 |
| 공격 지향 | S5·S6·S7 | 일간 2배 레버리지 ETF 포함. S7에는 BTC도 포함 |

- 구간은 자산 구성에 따른 정성적 탐색 분류이며, 공인 위험 등급이나 측정된 손실 확률이 아니다. `방어 지향`을 원금 보장·절대 저위험으로 표현하지 않는다. 구간 설명에서 비교 범위가 이 샘플 집합임을 밝힌다.
- S1~S3은 같은 구간의 세 선택지다. SCHD·JEPQ·VOO 사이의 위험도를 고정 순위로 단정하지 않는다. 향후 동일 기간·통화·배당 재투자·리밸런싱 조건에서 변동성·최대낙폭을 비교한 근거가 생기면 세분화를 검토한다. GOLD의 실제 비교 수단도 그때 명시한다.
- S5→S6은 같은 자산 조합에서 QLD 비중이 커지는 차이를 설명한다. S7은 다른 위험 요인을 추가한 선택지로, S6보다 항상 더 위험한 ‘다음 레벨’로 배치하지 않는다.
- 상단에는 `전체 / 방어 지향 / 성장 지향 / 공격 지향`을 제공하고 기본값은 `전체`다. 구간 선택은 해당 샘플을 좁혀 보여주며 언제든 전체로 복귀할 수 있다. 숫자 안전도 slider나 7단계 점수는 만들지 않는다.
- 같은 구간 안에서는 속성으로 비교한다. 태그는 배타적인 카테고리가 아니며 SCHD에는 `배당주`와 `인덱스`가 함께 붙을 수 있다. 1차에는 카드의 설명 태그로 제공하고 별도의 다중 필터 조작까지 요구하지 않는다.

| 샘플 | 투자 방식 태그 | 구성 태그 |
| --- | --- | --- |
| S1 | 배당주 · 인덱스 | 금 포함 |
| S2 | 옵션 인컴 | 금 포함 |
| S3 | 인덱스 · S&P 500 | 금 포함 |
| S4 | 인덱스 · 나스닥100 · 배당주 | — |
| S5·S6 | 인덱스 · 일간 2배 레버리지 · 배당주 | 금 포함 |
| S7 | 인덱스 · 일간 2배 레버리지 | 금 포함 · BTC 포함 |

목록은 `위험 구간 → 구성명 → 태그 → 비율 막대` 순서로 읽는다. S5의 예시는 `공격 지향 / 레버리지 + 배당·금 / 인덱스 · 일간 2배 레버리지 · 배당주 · 금 포함 / 50:30:20`이다. 태그가 길면 줄바꿈하며 작은 글자나 가로 스크롤에 의존하지 않는다.

| ID | 표시 이름 | 주력 | 보조 1 | 보조 2 | 선택에 필요한 짧은 설명 |
| --- | --- | --- | --- | --- | --- |
| S1 | 배당 + 금 | SCHD 70% | 금 30% | — | 배당주와 금 자산을 함께 구성 |
| S2 | 인컴 + 금 | JEPQ 70% | 금 30% | — | 옵션 인컴 전략과 금 자산을 함께 구성 |
| S3 | 미국 대형주 + 금 | VOO 70% | 금 30% | — | S&P 500 추종 ETF와 금 자산을 함께 구성 |
| S4 | 나스닥100 + 배당 | QQQM 70% | SCHD 30% | — | 주식형 ETF 두 개를 조합 |
| S5 | 레버리지 + 배당·금 | QLD 50% | SCHD 30% | 금 20% | 일간 2배 레버리지 ETF 포함 |
| S6 | 레버리지 비중 확대 | QLD 70% | SCHD 20% | 금 10% | S5보다 QLD 배분 비중이 큼 |
| S7 | 레버리지 + 비트코인·금 | QLD 50% | BTC 30% | 금 20% | 일간 레버리지 ETF와 가상자산 포함 |

- `안정형`이라는 이름으로 S1/S2를 표시하지 않는다. SCHD는 주식형 배당 ETF이고 JEPQ는 주식과 옵션 인컴 전략을 사용한다. 배당·분배금이 있다는 이유로 손실 위험이 없다고 표현하지 않는다.
- QLD에는 `일간 2배` 태그와 “장기 수익률이 나스닥100의 두 배가 되는 것은 아니에요”를 선택 상세에 표시한다. S7에는 `BTC 포함`도 표시한다. 별도 동의 체크박스를 추가하는 대신 선택에 필요한 사실을 설명한다.
- 금은 상품명이 아닌 `금(GOLD)`로 표시하고, ETF·현물 등 실제 투자 수단 선택은 이 앱이 대신하지 않는다고 자산 설명에 적는다.
- S5·S6·S7은 `공격 지향` 구간에 노출하고 `일간 2배 레버리지`를 속성으로 함께 표시한다. 더 높은 번호가 더 성장하거나 정량적으로 더 위험하다고 점수화하지 않는다.
- 기존 `growth/stable`은 앱 내 배분 분류다. 새 샘플의 위험 등급으로 재사용하지 않는다. 현금·금은 기존 stable, SCHD·JEPQ·VOO·QQQM·QLD·BTC는 기존 growth 분류로 생성한다. 기존 사용자의 사용자 지정 분류는 샘플을 고르지 않는 한 그대로 둔다.
- `안정 N%` 근처의 `분류 기준` 설명에는 “금·채권·현금 등 앱 내 안정 분류의 합계이며, 포트폴리오의 손실 위험 점수는 아니에요”를 제공한다. 샘플 상세와 검토에서는 레버리지/BTC 포함 여부도 함께 읽게 한다. 자유 이름을 일부 문자열만 보고 상품으로 단정하지 않고, 알려진 정확한 이름만 카탈로그 설명에 연결한다.
- 기본 현금 100% 경로를 유지한다. 현재 제시된 7개를 보완한다는 이유로 임의의 ‘안전 투자 추천’을 추가하지 않는다.

#### 최초 설정과 기존 사용자 진입

```text
최초 설정: 시작 → 배분 [샘플로 시작 / 기존 직접 입력] → 검토 → 이대로 시작
                               ↓
                    샘플 목록 → 미리보기 [비율 조정]
                               ↓
                         이 구성으로 채우기
                               ↓
                        기존 배분 편집으로 복귀

기존 사용자: 결과 → 배분 수정 → 샘플 불러오기 → 미리보기
                                             ↓
                                  현재 초안과 교체 내용 확인
                                             ↓
                                  초안 교체 → 기존 전체 적용
```

- 최초 설정의 배분 단계에서 대상이 없을 때 `샘플로 시작`을 잘 보이게 하고, `직접 입력`과 현금 100% 진행을 함께 제공한다. 복귀한 사용자 초안을 자동으로 샘플로 바꾸지 않는다.
- 기존 결과에는 큰 샘플 카드 목록을 상시 추가하지 않는다. `배분 수정` 안의 보조 action으로 진입시켜 결과 화면의 한눈에 읽는 구성을 유지한다.
- 도우미는 기존 PortfolioDialog의 sheet/panel 경계를 재사용한다. 부모 편집기는 비활성화하고 최상위 surface만 focus를 소유한다. 샘플 목록↔상세↔비율 조정은 도우미 내부 단계로 전환해 dialog를 계속 중첩하지 않는다.
- 목록은 스크롤 가능한 간결한 행으로 구성한다. 선택 상세에는 구성명·한 줄 설명·100% 막대·항목 비율·현재 Main 투자금 기준 금액을 보여준다. 미리보기의 금액 공개는 사용자가 연 편집 맥락에 한정하며 결과의 금액 보기 설정을 바꾸지 않는다.
- 원본 샘플에서 비율을 바꾸면 `샘플에서 조정한 구성`과 `위험 구간 미평가`로 표시하고 원본의 위험 구간 badge를 그대로 상속하지 않는다. 투자 방식·구성 태그는 현재 선택 자산에서 산출한다. 임의 조합의 위험도 계산기를 이번에 만들지 않는다. `샘플 비율로 되돌리기`는 임시 미리보기만 되돌리며 원본 구간 표시도 복구한다. 원화 환산 오차만 있는 경우는 원본 구성으로 보되 실제 계산 비율을 함께 보여준다.
- 도우미를 보기만 하거나 취소하면 현재 초안·applied·저장 상태를 변경하지 않는다. 이전 단계 이동은 열린 도우미 내 입력을 유지한다. 수정한 임시 구성을 닫을 때는 기존 폐기 확인을 재사용하고, 닫기 후 새로 열면 새 선택으로 시작한다. 미확정 도우미 입력은 새로고침 후 복구 대상으로 저장하지 않는다.

#### 주력·보조 비중 조정 규칙

- `Main`은 기존 앱명과 혼동되므로 UI에서는 `주력 자산 / 보조 자산`이라고 부른다.
- 주력은 50~90%, 5%p 단위다. `− / 70% / +`와 직접 숫자 입력을 제공한다. 50%에서 감소, 90%에서 증가는 비활성화한다. 잘못된 직접 입력을 조용히 반올림하지 않고 범위와 단위를 설명한다.
- 보조가 하나면 `100 − 주력 비율`을 자동 배정한다. 별도의 보조 비율 입력을 요구하지 않는다.
- 보조가 둘이면 첫 보조를 5%p 단위로 조정하고 둘째는 나머지다. 둘 다 최소 5%이며, 둘째를 0%로 만들려면 `보조 자산 제거`로 하나 구성으로 전환한다. 합계는 항상 100%다.
- 주력을 바꾸면 기존 보조 간 비율을 최대한 유지한다. 첫 보조의 새 비율은 `5 × Math.round((남은 비율 × 기존 보조1 / 기존 보조합) / 5)`를 구해 `5..남은 비율−5`에 제한하고, 보조2는 정확한 잔여로 정한다. 예: 50/30/20에서 주력을 70으로 올리면 70/20/10이다.
- 1차 샘플 조정은 자산 선택을 고정하고 비율만 바꾼다. 원본 S5의 50/30/20을 임의로 50/25/25로 초기화하지 않는다.
- 2차 직접 조합은 `주력 선택 → 주력 비중 → 보조 1~2개 선택·분배`로 이어진다. 자산 풀은 금·SCHD·JEPQ·VOO·QQQM·QLD·BTC이며 역할과 무관하게 선택할 수 있다. 자산 선택은 미리 확정하지 않고 주력 비율 control의 시작값만 70%로 둔다.
- 같은 자산을 주력/보조 또는 두 보조에 중복 선택할 수 없다. 보조를 새로 두 개 골랐을 때만 균등 배분을 초기값으로 쓰고, 홀수 5%p가 남으면 먼저 선택한 자산에 배정한다(주력 55% → 보조 25%/20%). 보조 하나를 제거하면 나머지가 전체 잔여 비율을 받는다.
- 주력 자산을 교체할 때 이미 보조로 선택된 자산은 선택 불가로 표시한다. 임의 역할 교환으로 사용자의 선택을 조용히 바꾸지 않는다.
- 비율 도우미의 50~90% 제한은 일반 Portfolio 편집기에는 적용하지 않는다. 자유 이름·10개 대상·현금 배분을 계속 사용할 수 있다.

#### 미리보기에서 기존 draft로 넘어가는 계약

- 카탈로그는 정적 코드 데이터다. 샘플 ID·성향·상품 메타데이터를 workspace schema에 추가하지 않는다. 확정 이후에는 기존 자유 이름 항목과 비중으로 저장하며, 샘플 변경이 이미 저장한 계획을 자동 갱신하지 않는다.
- 샘플의 명칭·비율만 고르는 동안에는 repository write가 없다. `이 구성으로 채우기`를 누르면 전체 후보 draft를 메모리에서 만들고 검증한 뒤 한 번의 action으로 교체한다. 항목별 dispatch·저장을 순차 수행하지 않는다.
- 후보 변환은 `createCashOnlyDraft` → 각 비율에 대응하는 정수 원화 금액 → 기존 `setItemAmount` → `materializeAllocation`/`validateApplicableDraft` 순서다. 정수 원화는 소수점 이하 버림으로 계산하고 잔여는 기존 자동 현금에 둔다. shareUnits 재계산까지 끝난 **실제 후보**를 미리보기에 사용한다. 원본 예시 비율과 차이가 있으면 계산된 비율·잔여 현금을 표시한다.
- 0원이 되거나 기존 최소 입력 금액 1,000원 미만이 되는 선택 자산은 조용히 빼지 않는다. “이 비율로 나누기에는 투자금이 작아요”와 금액·비율 조정 경로를 보여주고 채우기를 막는다. 음수 현금·합계 불일치도 후보를 저장하지 않고 차단한다. Main 투자금 0원은 기존 Main 수정 안내를 사용한다.
- 기존 초안에 대상이 있거나 현금을 직접 설정한 경우, `현재 초안 N개 → 새 구성 M개, 기존 대상과 현금 배분을 교체`를 후보와 함께 명시한다. 최종 버튼은 `초안을 이 구성으로 바꾸기`다. 기존 데이터와 자동 병합하지 않는다. applied는 기존 전체 적용 성공 전까지 보존한다.
- 취소는 교체 전 draft를 그대로 유지한다. 교체 확정은 기존 draft 자동 저장·dirty 계산 경로를 사용한다. 이후 편집기의 `취소`는 기존 계약대로 applied로 돌아간다. 별도 undo 이력을 새로 만들지 않는다.
- 열린 동안 Main 투자금 또는 현재 draft가 바뀌면 최신 값으로 미리보기와 교체 비교를 다시 만들고 기존 확정 의사를 무효화한다. 저장 중·오프라인·충돌 상태는 기존 쓰기 잠금을 따른다. 저장 실패를 성공처럼 닫거나 applied에 반영하지 않는다.
- Simulation 수익률·기간은 변경하지 않는다. 샘플만으로 예상 수익률이나 투자 성향을 산출하지 않는다.

#### 설명 근거

2026-09-16 확인. 아래 자료는 상품 구조 설명의 근거이며 일곱 조합의 수익성·위험 순위를 검증한 백테스트가 아니다.

- [Schwab SCHD](https://www.schwabassetmanagement.com/products/schd): 배당 관련 지수를 추종하는 주식형 ETF.
- [JEPQ 공시](https://www.sec.gov/Archives/edgar/data/1485894/000119312525247756/d812991d497k.htm): 주식 및 ELN을 통한 콜옵션 전략, 인컴 추구와 상승 참여 제한.
- [Vanguard VOO](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf): S&P 500 추종.
- [Invesco QQQM](https://www.invesco.com/us/en/financial-products/etfs/invesco-nasdaq-100-etf.html): Nasdaq 100 ETF 제품 안내.
- [ProShares QLD](https://www.proshares.com/our-etfs/leveraged-and-inverse/qld): Nasdaq-100 일간 수익률 2배 목표, 하루를 넘긴 성과의 차이.
- [Investor.gov 가상자산 설명](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/ETPBulletinSeptember2024): 비트코인의 높은 투기성·변동성.

## 실행 순서

Task 1·2는 기존 UI 개선 단위로 먼저 완료 가능하다. 샘플 기능은 Task 4 → 5, 직접 조합은 후속 Task 6으로 진행한다. 질문 기반 탐색은 Task 7의 3차 제품 설계를 거친다. Task 3의 문서·화면 검증은 각 출시 범위에 맞춰 마지막에 수행한다.

### Task 1 — 설정 클릭 재현과 조작성 개선

**Files:** `src/portfolio/ui/PortfolioManagementMenu.tsx`, `src/portfolio/ui/portfolio.css`, `tests/unit/portfolio/PortfolioDialogs.test.tsx`, `tests/portfolio.spec.ts`. 공유 blur가 원인이면 `src/journey/ui/AppManagementMenu.tsx`, `tests/unit/journey/AppManagementMenu.test.tsx`, `tests/app-journey.spec.ts`도 수정한다.

- [ ] 기존 `seedMain`·`seedAppliedPortfolio` fixture로 메뉴를 열고 input 자체·label 텍스트·오른쪽 빈 여백을 각각 실제 pointer로 눌러 checked 변경과 메뉴 유지 여부를 확인한다. 금액 보기와 두 정렬 행을 모두 확인한다.
- [ ] 아래처럼 input 중심을 피한 브라우저 회귀를 추가한다. 모든 클릭은 매번 새로 연 메뉴와 알려진 초기 상태에서 시작한다. `locator.check()`만으로 라벨 조작성을 통과 처리하지 않는다.

```ts
const toggle = page.getByRole('switch', { name: '금액 보기' });
const label = toggle.locator('..');
const box = await label.boundingBox();
if (!box) throw new Error('금액 보기 라벨이 표시되지 않음');
await label.click({ position: { x: box.width - 12, y: box.height / 2 } });
await expect(toggle).toBeChecked();
await expect(page.getByRole('button', { name: '관리 메뉴' }))
  .toHaveAttribute('aria-expanded', 'true');
```

- [ ] 재현 결과에 따라 이벤트 결함을 먼저 수정하고 스위치·선택 행 표현을 적용한다. 변경 callback 1회, 키보드 조작, 재열기·새로고침 후 보기 설정 유지, 배분 workspace 불변을 검증한다.
- [ ] `npm run test:unit -- tests/unit/portfolio/PortfolioDialogs.test.tsx tests/unit/journey/AppManagementMenu.test.tsx`와 `npm run check`를 실행한다.

**완료 기준:** 작은 input을 정확하게 겨냥하지 않아도 한 번에 바뀌고, 내부 선택 도중 메뉴가 닫히지 않는다. 공유 메뉴를 고친 경우 세 앱의 메뉴·확인 dialog focus가 유지된다.

### Task 2 — 결과 요약·100% 막대·목록 결합

**Files:** `src/portfolio/ui/PortfolioSummary.tsx`, `src/portfolio/ui/portfolio.css`, `tests/unit/portfolio/PortfolioSummary.test.tsx`, `tests/portfolio.spec.ts`, `tests/motion-system.spec.ts`.

**Interface:** 기존 `PortfolioSummary({ investmentWon, allocation, preferences, onEdit })` props를 유지한다. 이미 생성하는 `items`를 막대와 목록에 함께 전달한다. 선택 상태는 component local state이며 reducer action이나 preference record를 추가하지 않는다.

- [ ] 기존 50/25/15/10 fixture에 대해 막대 순서·실제 폭·현금 포함·정렬 후 색상 유지·0% 목록 보존을 검사한다. 금액 기본 숨김과 금액 보기 시 안정 비중 우선 표시도 유지·갱신한다.
- [ ] hero 다음에 아래 형태로 실제 비중 막대를 넣고 목록의 개별 track을 제거한다. `--allocation-color`는 같은 대상의 행과 구간에 동일하게 부여한다.

```tsx
<div className="portfolio-summary__bar" aria-hidden="true">
  {items.filter(item => item.shareUnits > 0).map(item => (
    <span key={item.id} data-segment-id={item.id}
      style={{ width: `${item.shareUnits / 10_000}%` }} />
  ))}
</div>
```

- [ ] 목록의 hover/focus/touch 강조를 단일 active id로 연결하고 대상 제거 시 선택을 해제한다. 기존 편집 버튼은 결과 편집 진입점으로 유지한다.
- [ ] 개별 fill animation을 제거·교체하고 막대 및 숫자의 최종 상태 복구를 검증한다. 정렬 도중 금액 표시 전환·연속 적용·reduced-motion에서도 숫자와 폭이 불일치하지 않게 한다.
- [ ] `npm run test:unit -- tests/unit/portfolio/PortfolioSummary.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx`와 `npm run check`를 실행한다.

**완료 기준:** 요약·전체 막대·항목을 같은 표면에서 읽고, 모든 대상의 비율을 색상이나 hover에 의존하지 않고 확인한다. 숨긴 금액이 접근성 이름에도 노출되지 않는다.

### Task 3 — 문서 정합성과 실제 화면 검증

**Files:** `DESIGN.md`, `README.md`, `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`, `docs/superpowers/evidence/2026-09-16-portfolio-overview-and-settings.md` (구현 증거 작성 시 신규).

- [ ] 승인된 구현 방향에 맞춰 현재 문서의 `항목별 비례 막대 목록`을 `전체 100% 막대와 대응 목록`으로 변경한다. 이 계획을 현행 승인 사실로 소급하지 않는다. 편집 화면 계약은 유지한다.
- [ ] 390×844, 768×1024, 1280×900에서 기본 4항목·10항목·긴 이름·현금 100%·0%·소수 비율·투자금 0원·금액 표시 상태를 확인한다. 가로 overflow, 메뉴 containment, focus ring, 48px 설정 행, 막대 가독성과 편집 후 focus 반환을 기록한다.
- [ ] 390px 기본 4항목에서 요약·막대·목록이 첫 화면에서 함께 읽히게 한다. 10항목·확대 200%는 스크롤을 허용하고 글자와 조작 영역을 축소하지 않는다.
- [ ] 터치 가능한 브라우저 context에서 라벨 여백 탭을 검증한다. 브라우저 엔진 차이를 확인할 수 없으면 해당 한계를 증거에 남긴다.
- [ ] 아래 명령의 실제 결과와 before/after 캡처를 증거 문서에 기록한다. 공유 메뉴를 수정하면 전체 E2E까지 실행한다.

```bash
npm run check
npm run test:unit -- tests/unit/portfolio tests/unit/journey
npx playwright test tests/portfolio.spec.ts tests/motion-system.spec.ts tests/app-journey.spec.ts --project=chromium --reporter=list
# AppManagementMenu 또는 공유 스타일 변경 시:
npm run test:e2e -- --reporter=list
git diff --check
```

**인계:** 변경 파일·목적, 테스트 pass/fail, 실제 확인한 viewport·입력 장치, 남은 재현 한계를 기록한다. 이번 계획의 작성 완료를 제품 개선 완료로 보고하지 않는다.

### Task 4 — 샘플 카탈로그·후보 draft 변환 (1차)

**Files:** 신규 `src/portfolio/domain/portfolioExamples.ts`, `tests/unit/portfolio/portfolioExamples.test.ts`; 수정 `src/portfolio/application/portfolioReducer.ts`, `tests/unit/portfolio/portfolioReducer.test.ts`. PRD와 DESIGN에 샘플 도우미의 비율 입력·초안 교체 계약을 먼저 반영한다.

**Interfaces:** 이 단계에서 구현할 최소 모델이다. 성향 점수·추천 가중치·가상자산 가격 feed를 미리 넣지 않는다.

```ts
type ExampleAsset = 'GOLD' | 'SCHD' | 'JEPQ' | 'VOO' | 'QQQM' | 'QLD' | 'BTC';
type ExampleLeg = { asset: ExampleAsset; percent: number };
type PortfolioExample = {
  id: string;
  title: string;
  riskBand: 'defensive' | 'growth' | 'aggressive'; // 정성적 탐색 구간
  legs: readonly ExampleLeg[]; // 주력, 보조1, 보조2 순서
};
type StrategyTag = 'dividend-equity' | 'option-income' | 'index'
  | 'sp500' | 'nasdaq100' | 'daily-2x';
type CompositionTag = 'gold' | 'bitcoin';
// 태그는 정적 자산 카탈로그에서 합집합으로 구하며 riskBand와 독립적이다.
// 표시 이름은 위 표를 사용하고 workspace에는 이 메타데이터를 저장하지 않는다.
// 후보를 먼저 만들고 기존 draft 검증까지 통과시킨다.
function draftFromExample(
  legs: readonly ExampleLeg[], investmentWon: number, now: number,
): PortfolioDraft;
// PortfolioAction에 추가: { type: 'draft-replaced'; draft: PortfolioDraft }
```

- [ ] 표의 S1~S7 데이터를 그대로 등록한다. GOLD 표시 이름은 `금(GOLD)`, BTC는 `BTC`, 다른 항목은 정확한 티커로 생성한다. 생성 ID는 각 자산의 고정 key, order는 0부터 연속 정수다.
- [ ] riskBand가 S1~S3 defensive, S4 growth, S5~S7 aggressive인지 검사한다. SCHD의 배당주·인덱스 동시 태그, QLD의 일간 2배, GOLD/BTC의 구성 태그를 검증한다. 기존 growth/stable 합계로 riskBand를 역산하지 않는다.
- [ ] 같은 자산 중복·잘못된 비율·합계 100% 아님을 거부한다. 일반 입력 제한을 바꾸지 않고 후보 생성 경로에 주력 범위·5%p 규칙과 최소 금액 검증을 둔다.
- [ ] 80만 원의 S5는 QLD 40만·SCHD 24만·금 16만, 현금 0원이어야 한다. 1,000,003원과 작은 투자금에서는 실제 share 변환 후 합계·잔여 현금·최소 금액을 검증한다. 0원·음수·NaN·최대 허용 범위 초과도 거부한다.
- [ ] reducer는 유효한 전체 후보에만 `draft-replaced`를 허용한다. applied·view·setupStep은 보존하고 기존 dirty 비교를 사용한다. 잘못된 후보는 draft를 일부라도 변경하지 않는다.
- [ ] 다음 행동 테스트를 추가하고 실패를 확인한 뒤 구현한다.

```ts
const next = portfolioReducer(state, { type: 'draft-replaced', draft: candidate });
expect(next.applied).toEqual(state.applied);
expect(next.draft).toEqual(candidate);
expect(next.dirty).toBe(true); // candidate가 기존 applied와 다른 fixture
expect(next.setupStep).toBe(state.setupStep);
```

- [ ] `npm run test:unit -- tests/unit/portfolio/portfolioExamples.test.ts tests/unit/portfolio/portfolioReducer.test.ts tests/unit/portfolio/allocation.test.ts`와 `npm run check`를 실행한다.

**완료 기준:** 7개 샘플이 기존 schema로 표현되고 변환 실패에 부분 변경이 없다. 저장 계층과 다른 앱 소유 데이터는 수정하지 않는다.

### Task 5 — 샘플 선택·비율 조정·초안 교체 연결 (1차)

**Files:** 신규 `src/portfolio/ui/PortfolioExamplePicker.tsx`, `src/portfolio/ui/PortfolioCompositionEditor.tsx`, `tests/unit/portfolio/PortfolioExamplePicker.test.tsx`; 수정 `PortfolioSetupFlow.tsx`, `PortfolioEditSurface.tsx`, `PortfolioApp.tsx`, `PortfolioSummary.tsx`, `portfolio.css` (모두 `src/portfolio/ui/`), `tests/unit/portfolio/PortfolioApp.test.tsx`, `tests/portfolio.spec.ts`, `tests/account-workspace.spec.ts`.

**책임:** Picker는 샘플 탐색과 단계·미확정 선택을 소유한다. CompositionEditor는 `legs`와 `onChange(legs)`를 받아 비율 조정·막대·실제 후보 금액을 보여준다. 부모가 최신 투자금·현재 draft와 확인된 후보를 연결하고 기존 `dispatchDraft`로 한 번 전달한다. 후보 변환에서 저장소를 호출하지 않는다.

- [ ] 진입·탐색·취소는 draft 저장을 발생시키지 않고, 교체 확정만 한 번 발생시키는 통합 테스트를 추가한다. 같은 샘플이라도 동일 후보이면 불필요한 dirty를 만들지 않는다.
- [ ] 최초 배분과 기존 편집에 진입점을 추가한다. 3절의 UI·분류 설명·원본/조정 상태·샘플 비율 복원·중도 닫기 계약을 구현한다. 결과 화면은 전체 비율을 읽는 표면으로 유지한다.
- [ ] 전체/세 위험 구간 탐색과 복수 태그를 연결한다. S1~S3이 같은 구간에 보이고 S7을 S6의 상위 레벨로 표시하지 않는지 확인한다. 비율 변경 시 원본 위험 badge를 제거하고 원본 복원 시 되돌리는 행동을 테스트한다.
- [ ] 주력 50/90 경계, 직접 잘못된 입력, 보조 한 개·두 개, 50/30/20 → 70/20/10, 55/25/20 등 합계 보존을 검사한다. 막대와 텍스트 비율은 같은 값을 사용한다.
- [ ] 임시 후보와 확정 draft의 비율·금액이 일치하는지 검증한다. 원화 환산에서 실제 비율이 달라진 경우 원본 샘플 비율을 적용 결과처럼 표시하지 않는다.
- [ ] 기존 비어 있지 않은 초안과 직접 현금을 교체할 때 바뀌는 구성을 보여주고 명시 확정한다. 저장 실패·충돌·오프라인·연속 클릭·Main 투자금 갱신에서 입력과 applied를 보존한다.
- [ ] 확인 전 Main 금액 갱신 시 재계산·재확인, 성공 시에만 기존 전체 적용으로 넘어가는 흐름을 계정 테스트로 검증한다. 교체 취소는 기존 초안, 편집 전체 취소는 기존 applied로 돌아간다.
- [ ] 도우미 닫기 후 진입 버튼 focus, 모바일 스크롤과 footer containment, 키보드 조작, reduced-motion을 확인한다. 최초 `시작 → 배분 → 검토` 진행을 불필요한 필수 4단계로 바꾸지 않는다.
- [ ] `npm run test:unit -- tests/unit/portfolio`와 `npm run check`, `npx playwright test tests/portfolio.spec.ts --project=chromium --reporter=list`, `npx playwright test tests/account-workspace.spec.ts --project=cloud --reporter=list`를 실행한다. Task 3 문서·반응형 검증을 함께 완료한다.

**완료 기준:** 샘플 탐색·조정·원래대로 복원·초안 채우기·전체 적용·취소가 구분되고, 계정 저장 실패에도 기존 계획을 잃지 않는다.

### Task 6 — 주력·보조를 직접 고르는 경로 (2차)

**Files:** `PortfolioExamplePicker.tsx`, `PortfolioCompositionEditor.tsx`, `portfolio.css`, 해당 unit/E2E 테스트. 기존 일반 편집 경로는 유지한다.

- [ ] 도우미에 `직접 조합`을 추가하고 같은 비율 편집기로 연결한다. 선택 결과는 Task 4의 `ExampleLeg[]`와 후보 변환을 그대로 사용한다.
- [ ] 주력 선택 → 50~90% 설정 → 중복 없는 보조 1~2개 선택 순서로 진행한다. 자산의 정체·특성을 짧게 설명하고 결과를 특정 투자 성향에 적합하다고 자동 명명하지 않는다.
- [ ] 직접 조합은 `위험 구간 미평가`로 표시하고 현재 자산의 투자 방식·구성 태그만 계산한다. 기존 샘플과 비율이 비슷하다는 이유로 위험 구간을 추정하지 않는다.
- [ ] 보조 추가·삭제·중복 선택 방지·이전 단계 복귀 시 입력 유지·55%와 두 보조의 25/20 분배를 검사한다. 선택하지 않은 자산을 기본 추천처럼 자동 채우지 않는다.
- [ ] Task 5의 교체·실패·금액 환산 검증을 직접 조합에도 적용한다. 새 저장 계약을 만들지 않는다.
- [ ] focused unit/E2E 및 Task 3의 390/768/1280px 검증을 실행한다.

**완료 기준:** 샘플 없이도 같은 미리보기·조정·적용 흐름으로 배분을 만들 수 있다. 1차 출시는 이 후속 작업을 기다릴 필요가 없다.

### Task 7 — 질문으로 투자 방식 탐색 (3차 제품 설계)

2026-09-16 후속 사용자 아이디어: MBTI 검사처럼 몇 가지 질문에 답하면 성향에 맞는 샘플을 제안하는 재미있는 진입을 제공한다. **이번 구현 작업이 아닌 후속 제품 범위**로 기록한다. 별도 질문·결과 설계를 확정한 뒤 구현 계획으로 구체화한다.

**방향:** `몇 가지 질문 → 위험 감수 범위 → 투자 방식 취향 → 비교할 샘플 2~3개 → 샘플 미리보기·조정`. 먼저 감당 가능한 범위에서 후보를 좁힌 뒤 배당·인컴·인덱스 등 속성 선호로 비교 대상을 고른다. 단일 최고 점수 포트폴리오를 자동 적용하지 않는다. `샘플 직접 보기`로 언제든 건너뛸 수 있게 한다.

#### 선택성과 발견 경로 — 사용자 확정

- 검사는 초기 설정 wizard의 추가 단계가 아니다. 질문을 시작하거나 완료한 적이 없어도 일곱 샘플·자유 입력·직접 조합·검토·적용을 모두 사용할 수 있다. 검사 유도 모달·배너·미완료 배지·필수 응답을 추가하지 않는다.
- 진입은 **Portfolio 결과 페이지 최하단**이다. Main의 `미래 성장 보기`처럼 결과를 다 읽은 뒤 추가로 스크롤·스와이프하거나 키보드로 더 탐색하면 `내 투자 성향 알아보기`가 드러난다. 보조 문구는 `어떤 투자 방식이 나와 맞을까?`로 한다. 상단 주요 행동이나 샘플 고르기 앞의 필수 분기에는 두지 않는다.
- Main의 기존 하단 탐색 설계와 동일하게, 페이지 끝에 도착한 동작과 끝에서 더 탐색하는 동작을 구분한다. 열린 sheet·menu·입력 필드 내부의 스크롤이나 스와이프는 진입 노출 신호로 사용하지 않는다. 구현 시 Main의 기존 노출 판정·접근성 패턴을 확인해 재사용하며 별도 임의 임계값을 도입하지 않는다.
- Tab으로 CTA에 focus하면 즉시 표시하고 44px 이상 조작 영역과 focus ring을 보장한다. 노출 후에는 해당 페이지에서 유지하고, reduced-motion에서는 움직임 없이 표시한다. 추가 스크롤은 버튼을 보여주기만 하며 **검사는 버튼을 누른 후에만** 시작한다.
- 시작한 검사는 언제든 닫거나 건너뛸 수 있다. 닫으면 기존 결과·스크롤 위치를 유지하고 노출된 진입 버튼으로 focus를 돌린다. 미완료 응답은 금융 draft나 applied를 바꾸지 않는다.
- 나중에 검사 결과에서 샘플을 골라도 기존 배분을 곧바로 바꾸지 않는다. 동일한 미리보기 → 초안 교체 확인 → 전체 적용 흐름으로 연결한다.

```text
기본 경로: 샘플 또는 직접 입력 → 검토·적용 → Portfolio 결과
                                               ↓ 더 탐색
                                   [내 투자 성향 알아보기]
                                               ↓ 직접 클릭
                                   선택 검사 → 샘플 비교
```

질문 초안은 5~6개로 제한한다.

| 질문 축 | 예시 | 결과에서 쓰는 목적 |
| --- | --- | --- |
| 자금 사용 시점 | 이 돈을 언제쯤 사용할 예정인가요? | 짧은 기간에 필요한 자금을 성장 선호 점수와 분리 |
| 손실 감당 여력 | 가치가 크게 줄어도 생활비·예정 지출에 영향이 없나요? | 감정적 선호와 실제 감당 여력을 분리 |
| 하락 시 행동 | 크게 하락하면 유지·추가·축소 중 무엇을 할 것 같나요? | 불확실성에 대한 선호를 설명 |
| 현금흐름 선호 | 정기 분배금과 장기 자산 증가 중 무엇이 더 끌리나요? | 배당·인컴과 지수 탐색 경로를 연결 |
| 관리 방식 | 단순하게 유지하고 싶은가요, 자주 확인·조정하고 싶은가요? | 유지 관리 선호를 설명 |
| 상품 이해 | 일간 레버리지와 가상자산의 특성을 알고 있나요? | 복잡한 상품을 제안할 때 필요한 이해 확인 |

- 응답은 검사 도중 local state에만 두는 것을 1차 원칙으로 삼는다. 로그인 프로필·workspace에 투자 성향을 영구 저장하는 기능은 별도 요구가 생길 때 검토한다. 소득·자산 금액을 추가 수집하지 않는다.
- 결과는 `위험 감수 범위`와 `선호하는 투자 방식`을 분리해서 설명한다. 예를 들어 `방어 지향 구간에서 비교 / 배당·인컴 선호`로 보여주며, `안전한 투자자`처럼 성격과 안전을 단정하지 않는다. 재미있는 별칭은 보조로 쓸 수 있지만 과학적으로 검증된 성격 검사나 정식 투자 적합성 판정처럼 표시하지 않는다.
- `왜 이런 결과인가요?`에서 어떤 답변이 탐색 방향에 영향을 주었는지 설명한다. 답변 수정·다시 하기·모든 샘플 보기 경로를 제공한다.
- 짧은 사용 시점·낮은 손실 감당 여력에는 현재 S1~S7 중 하나를 강제로 제안하지 않는다. “현재 예시에서 맞는 구성을 찾기 어려워요”와 현금 100% 유지/직접 배분 경로를 제공한다. SCHD+금도 자동 ‘안전형’ 대체재로 쓰지 않는다.
- 주식 성장 선호 응답만으로 QLD/BTC를 추천하지 않는다. 관련 이해와 명시적 탐색 의향을 확인하지 못하면 기본 결과 후보에서 제외한다. 설명을 읽은 후 전체 샘플을 직접 보는 경로는 유지한다.
- S1과 S2, S3와 S4의 차이는 단순 점수 순위로 설명할 수 없으므로 결과에서 둘 이상을 비교하게 한다. 수익률 예측·변동성 수치·최적 조합 계산을 근거 없이 붙이지 않는다.
- 결과에서 샘플을 선택한 뒤에는 Task 5의 미리보기로 합류한다. `이 구성으로 채우기`와 전체 적용은 계속 사용자가 결정한다. 질문만으로 Portfolio·Main·Simulation 값을 바꾸지 않는다.

**후속 설계 인수 기준:** 질문 이해도·중도 이탈·결과 설명의 납득 가능성·샘플 비교 가능성을 사용자 관찰로 확인한다. 상충 응답·모르겠음·모든 응답 건너뛰기·제안할 샘플 없음·답변 변경을 포함한 결정표와 테스트 사례를 먼저 작성한다. 위험을 감당하기 어렵다는 응답이 재미 점수에 덮여 레버리지/가상자산 제안으로 이어지지 않는지 검증한다.

**선택성·발견 검증:** 검사를 한 번도 열지 않고 초기 설정·샘플 적용·재편집을 완료하는 E2E를 유지한다. 추가 탐색 전 CTA 비노출, 페이지 끝 도착만으로는 미노출, 끝에서 추가 wheel/swipe 후 노출, Tab focus 시 노출, 클릭 전 검사 미시작, 내부 sheet 스크롤 무반응, 검사 취소 후 결과·focus 복귀를 390/768/1280px와 reduced-motion에서 검증한다. 검사 때문에 정상 금융 흐름에 새로운 진행 조건이 생기면 실패다.

**시작 문서/다음 소유자:** Product/UX가 이 절을 바탕으로 질문 문구·결정표·결과 예시를 설계하고, 개발 담당자는 확정된 입력/출력 계약 이후 기존 샘플 카탈로그와 연결한다. 질문 개수·유형 이름·점수 규칙은 아직 확정 사항이 아니다.
