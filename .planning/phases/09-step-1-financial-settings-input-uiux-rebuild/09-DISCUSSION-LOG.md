# Phase 09: Step 1 Financial Settings Input UIUX Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 09-Step 1 Financial Settings Input UIUX Rebuild
**Areas discussed:** Default Screen Structure, Item Creation Flow, Account Allocation Complexity, Sankey Stability, Preset Quick Setup

---

## Default Screen Structure

| Question | Options Considered | User's choice |
|----------|--------------------|---------------|
| Step 1 기본 화면에서 재무 항목을 어떻게 보여주는 것이 가장 맞나요? | 요약 카드 우선; 현재 탭 유지; 대시보드 중심 | 수입+계좌 탭과 지출+저축+투자 묶음 탭을 카드/목록으로 보여주고 클릭 시 상세 편집 |
| 두 묶음 안에서 카드/목록을 어떤 단위로 보여줄까요? | 카테고리 카드 + 내부 항목 목록; 개별 항목 카드; 계좌 중심 카드 | 카테고리 카드 + 내부 항목 목록 |
| 카드를 클릭했을 때 상세 편집은 어떤 형태가 좋을까요? | 오른쪽/하단 상세 패널; 모달 팝업; 페이지 안 확장 | 모달 팝업 |
| 기본 화면에서 Sankey는 어느 위치가 좋을까요? | 요약 카드 아래 고정; 상단 핵심 비주얼; 별도 결과 탭 | 요약 카드 아래 고정 |

**Notes:** Step 1 should adopt the Step 3 feel: polished summaries first, detail editing after selection.

---

## Item Creation Flow

| Question | Options Considered | User's choice |
|----------|--------------------|---------------|
| 새 항목을 추가할 때 어떤 흐름이 좋을까요? | 단계형 만들기 화면; 카테고리 모달 안에서 바로 추가; 빠른 추가 + 나중에 상세 보완 | 단계형 만들기 화면 |
| 단계형 만들기 화면은 어디에 열리는 게 좋을까요? | 전용 생성 모달; 카테고리 상세 모달 내부; 기본 화면 아래 생성 패널 | 전용 생성 모달 |
| 새 항목 생성 시 계좌 연결은 어떻게 처리할까요? | 필수 단계로 선택; 추천 기본값 자동 선택; 나중에 연결 허용 | 필수 단계 + 추천 기본값 자동 선택 + 사용자 변경 가능 |
| 생성 흐름에서 저장 전 확인은 어느 정도가 좋을까요? | 최종 확인 화면; 즉시 생성 + 되돌리기; 검증 실패만 표시 | 최종 확인 화면 |

**Notes:** The user explicitly said the existing account-management path failed. Account creation/selection/editing should happen inside the income/expense/savings/investment add/edit modals instead.

---

## Account Allocation Complexity

| Question | Options Considered | User's choice |
|----------|--------------------|---------------|
| 수입이 여러 계좌로 나뉘는 분배는 사용자가 어디까지 직접 설정하게 할까요? | 기본은 단일 입금, 필요 시 분배; 항상 분배 가능 UI 노출; 분배 기능 제거 | 기본은 단일 입금, 필요 시 분배 |
| 계좌 자체는 어떤 수준으로 다루는 게 좋을까요? | 간단한 계좌 별칭만; 역할 프리셋 포함; 상세 계좌 모델 | 간단한 계좌 별칭만 |
| 지출/저축/투자 항목에서 출금 계좌는 어떻게 보여주는 게 좋을까요? | 요약 배지 + 상세에서 변경; 목록에서 바로 선택; 계좌 정보 숨김 | 요약 배지 + 상세에서 변경, 누락 시 자동으로 가장 큰 적절한 계좌 선택 |
| 계좌 배분 금액이 항목 총액과 맞지 않을 때는 어떻게 처리할까요? | 자동 보정 + 경고; 저장 차단; Sankey에서만 보정 | 자동 보정 |

**Notes:** Existing data may be incomplete. The phase should include deterministic correction for missing or mismatched account links.

---

## Sankey Stability

| Question | Options Considered | User's choice |
|----------|--------------------|---------------|
| Sankey의 수입 시작점은 어떻게 고정할까요? | 총수입 단일 루트 노드; 개별 수입 노드 유지; 기본은 총수입, 상세 모드만 개별 수입 | 총수입은 수입들의 도착점이자 지출들의 시작점 |
| 총수입과 계좌 사이의 관계는 어떻게 표현할까요? | 총수입 → 계좌 → 지출/저축/투자; 총수입 → 항목, 계좌는 보조 표시; 기본은 총수입 → 항목, 상세만 계좌 포함 | 개별 수입 → 총수입 → 계좌 → 지출/저축/투자 |
| Sankey에 필요한 계좌 연결이 누락된 데이터는 어떻게 보여줄까요? | 자동 보정 후 안내; 미지정 계좌 노드 표시; Sankey 숨김 + 수정 요청 | 미지정 계좌 감지 시 수동 새로고침으로 자동 보정 및 재정렬 |
| Sankey 기본/상세 모드는 어떻게 나눌까요? | 기본은 안정 요약, 상세는 펼침; 항상 상세 표시; 단일 모드만 유지 | 기본은 안정 요약, 상세는 펼침 |

**Notes:** Merged Sankey hover information must be line-broken and list-like so it remains readable.

---

## Preset Quick Setup

| Question | Options Considered | User's choice |
|----------|--------------------|---------------|
| 프리셋은 어떤 범위까지 한 번에 만들어야 할까요? | 지출/저축/투자 전체 배분; 지출 프리셋만; 카테고리별 개별 프리셋 | 지출/저축/투자 전체 배분 |
| 기본 4가지 유형은 어떤 성격이면 좋을까요? | 보수/균형/성장/현금흐름; 연령/생애단계 기반; 지출 습관 기반 | 안정/균형/성장/야수 |
| 사용자 지정 프리셋은 어떤 방식이 좋을까요? | 마지막 선택 유형을 복사해서 시작; 빈 값에서 시작; 균형형 기본값에서 시작 | 마지막 선택 유형을 복사해서 시작, 포커스 해제 시 % 자동 계산 |
| 프리셋 적용 마지막 확인창의 보정 규칙은 어떻게 고정할까요? | 금액 1만원 단위 + % 정수 단위; 항상 금액 우선; 항상 % 우선 | 금액 보정/% 보정 선택형, 사용자 입력 %는 원본 그대로 표시 |

**Notes:** This was identified as a missing core gray area after the initial four topics. The user wants this to become a main Step 1 financial-settings capability.

---

## the agent's Discretion

- Exact preset percentages for `안정`, `균형`, `성장`, and `야수`.
- Exact account recommendation heuristic, as long as missing links are corrected deterministically.
- Exact modal/component filenames, as long as the Step 1 vanilla ES module structure is preserved.

## Deferred Ideas

- Detailed bank-account model with bank name, account type, and live balance.
- Live banking or transaction import.
- Broad React rewrite of Step 1.
- Separate standalone account-management product surface.
