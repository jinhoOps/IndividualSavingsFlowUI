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
| 10.5 | Financial Settings UX Integration Repair | 5/5 | Complete    | 2026-06-24 |
| 10.6 | Financial Detail Modal Editing UX Repair | 3/3 | Complete   | 2026-06-25 |
| 10.6.1 | Legacy Editor Removal and Detail Modal Capability Absorption | 3/3 | Complete    | 2026-06-26 |
| 10.7 | Account Flow Extraction and Portfolio Boundary | 6/6 | Complete    | 2026-06-26 |
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

### Phase 10.5: Financial Settings UX Integration Repair *(INSERTED)*

**Goal:** Rework the Phase 10 financial settings experience into one integrated flow that preserves information density while reducing user fatigue.

**Requirements:** UXR-01, UXR-02, UXR-03, UXR-04

**Success criteria:**

1. The Step 1 default screen shows only the essential financial-setting state and next action, without duplicating the full editing surface.
2. The financial settings detail flow connects monthly income, monthly living expenses, monthly investment, savings, automatic savings, and result review in one coherent UX, with Phase 10 couple/self/spouse UI removed until a future dedicated spec.
3. Variable expense target, actual spending, remaining amount, status, and end-of-month projection are editable or visible in the detailed flow without overwhelming the default screen.
4. The repaired UX addresses the Phase 10 UI review blockers for copywriting, visuals, spacing, and experience design while preserving existing Step 1 persistence and sanitizer behavior.

### Phase 10.6: Financial Detail Modal Editing UX Repair *(INSERTED)*

**Goal:** Polish the existing `재무설정 상세` modal so read mode is compact, row-level editing is predictable, and pending changes are applied only through an explicit in-modal pending bar.

**Requirements:** UXR-05, UXR-06, UXR-07, UXR-08

**Success criteria:**

1. The modal opens in compact read mode with no duplicated tab/panel titles, repeated category labels, or icon-driven line wrapping.
2. Editing is row-level: one selected row expands, existing values remain editable, other rows stay in read mode, and outside clicks fold the edited row without discarding draft changes.
3. Money editing supports direct input, `+`/`-` steppers in 10,000 KRW increments, and increase-only quick buttons `+5만`, `+10만`, and `+100만`.
4. The pending bar appears only after real draft changes, uses `취소` / `적용`, never closes the modal by itself, and applies or discards draft changes while keeping the modal open.
5. `새 항목 추가` lives at the right side of each tab's item header and creates items in the same visible section, avoiding detached floating-button behavior.
6. The implementation removes user-facing traces of implementation language such as "신설 모달" and preserves existing sanitizer, persistence, Sankey, and no-couple-UI contracts.

### Phase 10.6.1: Legacy Editor Removal and Detail Modal Capability Absorption *(INSERTED)*

**Goal:** Remove the auxiliary legacy financial editor path and absorb any still-useful editing capabilities into the Financial Detail Modal as the only primary Step 1 editor.

**Requirements:** UXR-09, UXR-10, UXR-11, UXR-12

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 10.6.1-01-PLAN.md — Absorb income allocation, savings maturity, and item-level savings yield into Financial Detail Modal row editing.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10.6.1-02-PLAN.md — Delete the auxiliary item editor module and remove normal-path legacy DOM/controller wiring.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10.6.1-03-PLAN.md — Clean stale renderer/state/style traces and run final regression with source-first build verification.

**Depends on:** Phase 10.6

**Success criteria:**

1. The Step 1 summary surface has no normal user path into the legacy financial item editor, global item-editor pending bar, or hidden secondary editor DOM.
2. Financial Detail Modal supports the useful capabilities formerly reachable only through the legacy editor, including income account allocation, savings maturity month, and item-level savings yield.
3. Removed legacy editor modules, DOM, tests, selectors, and copy leave no user-facing traces such as secondary editor language, "main editor", or duplicated pending controls.
4. Existing sanitizer, persistence, Sankey rendering, share/import, and Phase 10.6 modal row-editing contracts continue to pass targeted regression checks.

### Phase 10.7: Account Flow Extraction and Portfolio Boundary *(INSERTED)*

**Goal:** Remove account-flow modeling from Step 1 so its Sankey returns to the simple `수입 → 지출(소비/저축/투자)` model, while defining whether richer 계좌흐름도 behavior belongs in Portfolio or a separate app/page.

**Requirements:** UXR-13, UXR-14, UXR-15, UXR-16

**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 10.7-01-PLAN.md — Simple Step 1 Sankey core and topology regression tests.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10.7-02-PLAN.md — Sanitizer/storage migration sidecar and import/share compatibility.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10.7-03-PLAN.md — Financial Detail Modal account-concept removal while preserving non-account editing.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10.7-04-PLAN.md — Step 1 render/UI/controller cleanup and source audit tests.

**Wave 5** *(blocked on Wave 2 and Wave 4 completion)*

- [x] 10.7-05-PLAN.md — Portfolio sidecar handoff detection, state boundary, and destination tests.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 10.7-06-PLAN.md — Step 1 Portfolio guidance, source-boundary tests, and account-flow boundary ADR.

**Depends on:** Phase 10.6.1

**Success criteria:**

1. Step 1 no longer exposes or depends on account/allocation concepts for its primary financial setup and Sankey generation.
2. Step 1 Sankey generation uses a simple income-to-consumption/savings/investment flow and avoids automatic account correction side effects in the primary path.
3. Existing saved account/allocation data is preserved or converted only for Portfolio/계좌흐름도 handoff, while Step 1 stores and renders the simplified model.
4. The phase documents and tests the boundary for moving richer account-flow management to Portfolio or a separate app/page before Phase 11 resumes.

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
| UXR-01 | Phase 10.5 | Complete |
| UXR-02 | Phase 10.5 | Complete |
| UXR-03 | Phase 10.5 | Complete |
| UXR-04 | Phase 10.5 | Complete |
| UXR-05 | Phase 10.6 | Complete |
| UXR-06 | Phase 10.6 | Complete |
| UXR-07 | Phase 10.6 | Complete |
| UXR-08 | Phase 10.6 | Complete |
| UXR-13 | Phase 10.7 | Complete |
| UXR-14 | Phase 10.7 | Complete |
| UXR-15 | Phase 10.7 | Complete |
| UXR-16 | Phase 10.7 | Complete |
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

- v1.9 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

## Out of Scope Guardrails

- GitHub issue #7 remains outside this project because backtesting belongs in `stock-snowball`.
- Live account scraping and live listing/rate integrations are deferred to avoid breaking the static/offline-first model.
- Affordability outputs are planning estimates only, not lending decisions or financial advice.

## Next

Phase 10.7 is planned. Next recommended step is `$gsd-execute-phase 10.7` to execute account-flow extraction before Phase 11 resumes.
