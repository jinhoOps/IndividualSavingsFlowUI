# Roadmap: Individual Savings Flow (ISF) v1.9

**Milestone:** v1.9 TODO/GitHub Issue Resolution
**Status:** Planned
**Defined:** 2026-06-19

## Milestone Goal

Resolve the next Step 1 household-flow work from `TODO.md` and open GitHub issues, focusing on newlywed/household planning, real-estate affordability, and historical spending comparison while keeping backtesting out of this project.

## Phase Summary

| Phase | Name | Goal | Requirements | Success Criteria |
|---:|---|---|---|---:|
| 10 | Step 1.2 Household Budget Foundation | Add the Step 1.2 surface and adaptive budget model without breaking existing Step 1 setup. | HH-01, HH-02, BUD-01, BUD-02, BUD-03, BUD-04 | 5 |
| 11 | Zero-Input Spending Capture | Parse pasted Korean bank/card text into reviewable spending actuals. | CAP-01, CAP-02, CAP-03, CAP-04 | 4 |
| 12 | Dual-Flow Household Merge | Combine two shared Step 1 data sources into one household flow preview. | HH-03, HH-04, HH-05 | 4 |
| 13 | Historical Spending Comparison | Compare current Step 1 expenses against prior DataHub snapshots with a grouped bar chart. | CMP-01, CMP-02, CMP-03, CMP-04, CMP-05 | 5 |
| 14 | Real-Estate Affordability Planner | Estimate apartment purchase capacity from household income and DSR/LTV assumptions. | REAL-01, REAL-02, REAL-03, REAL-04, REAL-05 | 5 |

## Phase Details

### Phase 10: Step 1.2 Household Budget Foundation

**Goal:** Add a Step 1.2 household planning surface and budget/actual fields for variable expenses while preserving existing Step 1 data flow.

**Requirements:** HH-01, HH-02, BUD-01, BUD-02, BUD-03, BUD-04

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Sanitizer-backed household context, variable actual spending, and derived budget helpers.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — Compact `신혼부부 예산` summary panel on the Step 1 default screen.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-03-PLAN.md — Detailed household budget modal, explicit save/cancel workflow, and Step 1 regressions.

**Success criteria:**

1. Step 1 exposes a Step 1.2 household planning entry point and can return to the original Step 1 setup without data loss.
2. Household context supports one-income and dual-income cases, including optional spouse income.
3. Variable expense items accept target budget and actual spending fields without corrupting existing saved Step 1 data.
4. Budget progress, remaining amount, overspend state, and end-of-month projection render from the same sanitized data model.
5. Existing Step 1 summary cards, modal editing, persistence, and Sankey rendering still pass targeted regression checks.

### Phase 11: Zero-Input Spending Capture

**Goal:** Let users paste domestic bank/card notification text and convert confident parses into reviewable expense actuals.

**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04

**Success criteria:**

1. A Step 1.2 capture input accepts pasted Korean notification text without page reload.
2. Parser output includes date, amount, merchant, and candidate category when confidence is sufficient.
3. User can correct parsed fields before committing them to expense actuals.
4. Unsupported or ambiguous text produces a clear fallback state and does not mutate saved data.

### Phase 12: Dual-Flow Household Merge

**Goal:** Merge two shared Step 1 hashes into one household Sankey preview with safe conflict handling.

**Requirements:** HH-03, HH-04, HH-05

**Success criteria:**

1. User can paste or load two Step 1 share hashes and preview a merged household flow.
2. Shared, public, or meeting-account nodes merge into one household node rather than duplicate Sankey branches.
3. Conflicting account or category names are shown as warnings before the preview is accepted.
4. Merge logic avoids circular references and preserves the original individual data sources.

### Phase 13: Historical Spending Comparison

**Goal:** Add a comparison view that shows current expenses against a selected prior DataHub snapshot.

**Requirements:** CMP-01, CMP-02, CMP-03, CMP-04, CMP-05

**Success criteria:**

1. User can choose a comparable prior Step 1 snapshot from DataHub.
2. Grouped bar chart renders previous and current category values using consistent won-unit conversion.
3. Category differences are visible through labels or tooltips.
4. Mobile layout remains usable without clipped labels, hidden legend, or horizontal overflow surprises.
5. Empty state clearly explains that comparison requires at least one prior compatible snapshot.

### Phase 14: Real-Estate Affordability Planner

**Goal:** Provide a planning calculator for apartment purchase capacity using household income, DSR/LTV, cash, and loan assumptions.

**Requirements:** REAL-01, REAL-02, REAL-03, REAL-04, REAL-05

**Success criteria:**

1. User can enter household income with optional spouse income and one-income mode.
2. User can edit DSR, LTV, available cash, interest rate, and loan term assumptions.
3. Result table shows maximum purchase price, loan amount, monthly repayment, required cash, and binding constraint.
4. Conservative, balanced, and aggressive presets produce visibly different scenarios without hiding the assumptions.
5. Result classification covers extreme bands and the middle state in plain Korean without presenting the estimate as financial advice.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HH-01 | Phase 10 | Complete |
| HH-02 | Phase 10 | Complete |
| BUD-01 | Phase 10 | Complete |
| BUD-02 | Phase 10 | Complete |
| BUD-03 | Phase 10 | Complete |
| BUD-04 | Phase 10 | Complete |
| CAP-01 | Phase 11 | Pending |
| CAP-02 | Phase 11 | Pending |
| CAP-03 | Phase 11 | Pending |
| CAP-04 | Phase 11 | Pending |
| HH-03 | Phase 12 | Pending |
| HH-04 | Phase 12 | Pending |
| HH-05 | Phase 12 | Pending |
| CMP-01 | Phase 13 | Pending |
| CMP-02 | Phase 13 | Pending |
| CMP-03 | Phase 13 | Pending |
| CMP-04 | Phase 13 | Pending |
| CMP-05 | Phase 13 | Pending |
| REAL-01 | Phase 14 | Pending |
| REAL-02 | Phase 14 | Pending |
| REAL-03 | Phase 14 | Pending |
| REAL-04 | Phase 14 | Pending |
| REAL-05 | Phase 14 | Pending |

**Coverage:**

- v1.9 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

## Out of Scope Guardrails

- GitHub issue #7 remains outside this project because backtesting belongs in `stock-snowball`.
- Live account scraping and live listing/rate integrations are deferred to avoid breaking the static/offline-first model.
- Affordability outputs are planning estimates only, not lending decisions or financial advice.

## Next

Start with `$gsd-discuss-phase 11` to clarify the zero-input spending capture flow before implementation planning.
