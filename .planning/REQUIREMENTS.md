# Requirements: IndividualSavings Flow UIUX v1.9

**Defined:** 2026-06-19
**Core Value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## v1.9 Requirements

### Household Hub

- [ ] **HH-01**: User can open a Step 1.2 household planning surface from the Step 1 flow without losing the existing Step 1 financial setup context.
- [ ] **HH-02**: User can mark household context for one-income or dual-income couples so downstream calculations do not assume both partners earn income.
- [ ] **HH-03**: User can merge two shared Step 1 data hashes into one household flow preview.
- [ ] **HH-04**: User can see shared or meeting-account nodes merged into a single household node without duplicate Sankey branches.
- [ ] **HH-05**: User can review merge warnings when two data sources contain conflicting account or category names.

### Adaptive Budgeting

- [ ] **BUD-01**: User can set a monthly target budget on variable expense items.
- [ ] **BUD-02**: User can enter actual spending for a variable expense item separately from the planned amount.
- [ ] **BUD-03**: User can see budget progress, remaining amount, and overspend state for each tracked variable expense.
- [ ] **BUD-04**: User can see an end-of-month spending projection from current actual spending pace.

### Zero-Input Capture

- [ ] **CAP-01**: User can paste Korean bank or card notification text into a Step 1.2 capture input.
- [ ] **CAP-02**: User can preview parsed date, amount, merchant, and candidate expense category before saving.
- [ ] **CAP-03**: User can correct a parsed transaction before it updates Step 1 expense actuals.
- [ ] **CAP-04**: User sees a clear fallback message when pasted text cannot be parsed confidently.

### Spending Comparison

- [ ] **CMP-01**: User can select a prior DataHub Step 1 snapshot for comparison against current Step 1 values.
- [ ] **CMP-02**: User can view previous and current expense categories in a grouped bar chart using consistent won-unit conversion.
- [ ] **CMP-03**: User can see category-by-category spending differences in chart labels or tooltips.
- [ ] **CMP-04**: User can use the comparison view on mobile without broken layout or hidden labels.
- [ ] **CMP-05**: User sees an empty-state explanation when no comparable prior snapshot exists.

### Real-Estate Affordability

- [ ] **REAL-01**: User can enter household income assumptions for apartment affordability, including spouse income as optional.
- [ ] **REAL-02**: User can configure DSR, LTV, available cash, interest rate, and loan term assumptions.
- [ ] **REAL-03**: User can see estimated maximum purchase price, loan amount, monthly repayment, and required cash in a concise result table.
- [ ] **REAL-04**: User can compare multiple affordability scenarios across conservative, balanced, and aggressive assumption presets.
- [ ] **REAL-05**: User can see a plain-language affordability classification for extreme and mixed result bands, including an explicit middle-band state.

## Future Requirements

### Household Hub

- **HH-06**: User can persist household-merged profiles as reusable shared household plans.
- **HH-07**: User can resolve merge conflicts with a dedicated side-by-side editor.

### Zero-Input Capture

- **CAP-05**: User can maintain custom parser rules for unsupported bank or card text formats.

### Real-Estate Affordability

- **REAL-06**: User can export real-estate affordability results as a shareable image or DataHub entry.
- **REAL-07**: User can compare affordability against live or imported apartment price datasets.

## Out of Scope

| Feature | Reason |
|---------|--------|
| GitHub issue #7 major index and asset backtesting dashboard | Backtesting was already moved out to `stock-snowball`; reintroducing it here conflicts with the project direction. |
| Live bank/card account scraping | The project should stay static/offline-first; pasted text parsing is enough for this milestone. |
| Live mortgage rate or real-estate listing integration | v1.9 should prove the planning model first with user-editable assumptions. |
| Legal or financial advice wording | The app can provide planning estimates, not binding lending or purchase advice. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HH-01 | Phase 10 | Pending |
| HH-02 | Phase 10 | Pending |
| HH-03 | Phase 12 | Pending |
| HH-04 | Phase 12 | Pending |
| HH-05 | Phase 12 | Pending |
| BUD-01 | Phase 10 | Pending |
| BUD-02 | Phase 10 | Pending |
| BUD-03 | Phase 10 | Pending |
| BUD-04 | Phase 10 | Pending |
| CAP-01 | Phase 11 | Pending |
| CAP-02 | Phase 11 | Pending |
| CAP-03 | Phase 11 | Pending |
| CAP-04 | Phase 11 | Pending |
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

---
*Requirements defined: 2026-06-19*
*Last updated: 2026-06-19 after v1.9 requirement definition*
