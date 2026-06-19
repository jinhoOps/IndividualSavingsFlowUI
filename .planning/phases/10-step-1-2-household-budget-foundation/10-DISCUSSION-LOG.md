# Phase 10: Step 1.2 Household Budget Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 10-Step 1.2 Household Budget Foundation
**Areas discussed:** Step 1.2 entry method, newlywed household context, summary panel density, variable expense budget tracking, end-of-month projection

---

## Step 1.2 Entry Method

| Option | Description | Selected |
|--------|-------------|----------|
| Step 1 안의 접히는 패널 | Step 1 요약 카드 아래나 근처에 `신혼부부 예산` 패널을 두고 접었다 펼침 | |
| Step 1 상단 탭 | `개인 설정 / 부부 예산`처럼 같은 Step 1 안에서 탭 분리 | |
| 요약 카드에서 여는 모달 | 기본 화면은 깔끔하게 유지하고 카드/버튼으로 모달을 엶 | |
| 혼합형: 요약 패널 + 상세 모달 | 기본 화면에는 컴팩트 요약 패널, 상세 입력/수정은 모달 | ✓ |

**User's choice:** 4번, 혼합형: 요약 패널 + 상세 모달.
**Notes:** User wanted to think more about panel/tab/modal tradeoffs. The selected approach preserves the Phase 09 summary-first Step 1 direction while keeping detailed work out of the default screen.

---

## Newlywed Household Context

| Option | Description | Selected |
|--------|-------------|----------|
| 신혼부부 기준 + 한쪽 소득 허용 | Newlywed household by default; spouse income can be absent | ✓ |
| Strict dual-income model | Require both partners to have income | |
| Generic household model | Avoid newlywed framing and use broad household wording | |

**User's choice:** "이건 그냥 신혼부부 기준으로 두되 한쪽값이 없어도 가능하게 하라는 뜻임."
**Notes:** This locks the product framing and avoids overcomplicating household identity fields in Phase 10.

---

## Summary Panel Density

| Option | Description | Selected |
|--------|-------------|----------|
| 초압축 3지표 | 가구 월소득, 이번 달 변동비 실제/목표, 남은 예산만 표시 | |
| 3지표 + 경고 뱃지 | 3지표에 `여유`, `주의`, `초과` 상태 뱃지를 추가 | ✓ |
| 미니 예산 리스트 포함 | 주요 변동비 3개를 작은 행으로 기본 화면에 노출 | |
| 요약만, 항목 리스트는 모달 안 | 합계/상태만 기본 패널에 두고 항목별 내용은 모달에서만 표시 | |

**User's choice:** 2번, 3지표 + 경고 뱃지.
**Notes:** User emphasized high information density with compact design. Detailed item rows remain in the modal.

---

## Variable Expense Budget Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| 변동비만 | 식비, 교통, 쇼핑, 여가처럼 매달 흔들리는 지출에만 목표/실제 추적 | ✓ |
| 모든 지출 | 고정비까지 전부 목표/실제 추적 | |
| 사용자가 추적할 항목만 선택 | 각 지출 항목마다 예산 추적 토글을 둠 | |

**User's choice:** 1번, 변동비만.
**Notes:** User initially did not understand the data-model question, so it was reframed as planned monthly spending versus this month's actual spending. This keeps Phase 10 focused and avoids fixed-expense complexity.

---

## End-Of-Month Projection

| Option | Description | Selected |
|--------|-------------|----------|
| 단순 진행률 방식 | 월 경과율 기준으로 현재 실제 지출을 월말까지 환산 | ✓ |
| 최근 7일 속도 방식 | 최근 일주일 지출 속도로 월말을 예측 | |
| 직접 입력 방식 | 사용자가 예상 지출을 직접 입력 | |

**User's choice:** 1번, 단순 진행률 방식.
**Notes:** Phase 10 is a foundation. More advanced forecasting can wait until Phase 11 introduces transaction capture.

---

## the agent's Discretion

- Exact data field names for budget/actual/projection.
- Exact badge thresholds for `여유`, `주의`, and `초과`.
- Exact modal layout and class naming, as long as existing Step 1 patterns are reused.

## Deferred Ideas

- Recent-7-day or transaction-history-based projection after transaction capture exists.
- Pasted bank/card notification parsing, dual-flow merge, historical comparison, and real-estate affordability remain in later v1.9 phases.
