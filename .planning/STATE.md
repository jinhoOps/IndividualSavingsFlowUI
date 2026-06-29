---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: milestone
current_phase: 10.8
current_phase_name: 계좌 관리 맵
status: executing
stopped_at: Completed 10.8-01-PLAN.md
last_updated: "2026-06-29T08:54:35.604Z"
last_activity: 2026-06-29
last_activity_desc: Phase 10.8 inserted after Phase 10.7 for account management map work
progress:
  total_phases: 10
  completed_phases: 5
  total_plans: 23
  completed_plans: 21
  percent: 91
---

# Project State

## Current Position

Phase: 10.8 — 계좌 관리 맵
Plan: 10.8-02 next
Status: Phase 10.8 in progress
Last activity: 2026-06-29 — Plan 10.8-01 completed: dedicated Account Map route, page-owned draft storage, Main connector, and draft builder

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-26)

**Core value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.
**Current focus:** Phase 10.8 — 계좌 관리 맵 is executing; Plan 10.8-02 is next.

## Accumulated Context

### Roadmap Evolution

- Phase 9 added: Step 1 Financial Settings Input UIUX Rebuild
- Phase 10.5 inserted after Phase 10 (URGENT): Financial Settings UX Integration Repair
- Phase 10.6 inserted after Phase 10.5: Financial Detail Modal Editing UX Repair
- v1.8 shipped: portfolio creation/storage, Step 1 modular and financial setup rebuild, Step 2 strategy comparison redesign.
- Phase 10.8 inserted after Phase 10.7: 계좌 관리 맵 (URGENT)
- Plan 10.8-01 completed: dedicated Account Map route, page-owned draft storage, Main connector, and draft builder.

## Key Decisions

- **AI Removal (D-04)**: 시스템 복잡성 감소 및 정적 웹의 오프라인 안정성을 위해 실험적 AI 기능을 제거하고 코어 엔진 고도화에 집중함.
- **Phase 07 Gap Closure**: Step 1 bootstrap was split into focused vanilla ES module controllers; safe datalist rendering and allocation group open-state regressions are covered by the full Phase 07 Playwright gate.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 08-step-2-redesign-re-planning P01 | 33 min | 3 tasks | 8 files |
| Phase 08-step-2-redesign-re-planning P02 | 17 min | 2 tasks | 6 files |
| Phase 08-step-2-redesign-re-planning P03 | 19 min | 3 tasks | 7 files |
| Phase 08-step-2-redesign-re-planning P04 | 13 min | 2 tasks | 6 files |
| Phase 09-step-1-financial-settings-input-uiux-rebuild P01 | 28 min | 3 tasks | 6 files |
| Phase 09-step-1-financial-settings-input-uiux-rebuild P02 | 32 min | 3 tasks | 8 files |
| Phase 09-step-1-financial-settings-input-uiux-rebuild P03 | 21 min | 3 tasks | 9 files |
| Phase 09-step-1-financial-settings-input-uiux-rebuild P04 | 22 min | 3 tasks | 7 files |
| Phase 09-step-1-financial-settings-input-uiux-rebuild P05 | 52 min | 4 tasks | 5 files |
| Phase 10.5-financial-settings-ux-integration-repair P01 | 22 min | 2 tasks | 4 files |
| Phase 10.5 P03 | 29 min | 2 tasks | 4 files |
| Phase 10.6-financial-detail-modal-editing-ux-repair P01 | 18 min | 2 tasks | 5 files |
| Phase 10.6-financial-detail-modal-editing-ux-repair P02 | 52 min | 2 tasks | 4 files |
| Phase 10.6-financial-detail-modal-editing-ux-repair P03 | 24min | 2 tasks | 4 files |
| Phase 10.6.1 P01 | 10 min | 2 tasks | 3 files |
| Phase 10.6.1 P02 | 13 min | 2 tasks | 9 files |
| Phase 10.6.1 P03 | 25 minutes | 2 tasks | 8 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P01 | 38 min | 2 tasks | 3 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P02 | 8 min | 2 tasks | 3 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P03 | 36 min | 2 tasks | 5 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P04 | 8 min | 2 tasks | 9 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P05 | 31 min | 2 tasks | 7 files |
| Phase 10.7-account-flow-extraction-and-portfolio-boundary P06 | 32 min | 3 tasks | 6 files |
| Phase 10.8-account-management-map P01 | 55 min | 3 tasks | 10 files |

## Decisions

- [Phase 10]: Step 1.2 household budgeting now uses a compact `신혼부부 예산` summary panel plus a separate draft modal with explicit `예산 저장` / `편집 취소` persistence.
- [Phase 10]: Household context (`single-income` / `dual-income` with optional spouse income) and variable expense `actualSpent` are sanitized at the Step 1 boundary so later phases can reuse the same fields.
- [Phase 08-01]: Step 2 save/list/load/delete now routes through a narrow storage facade; backup behavior remains on IndexedDB-capable paths only.
- [Phase 08-01]: Reset prefers the latest Step 1 source snapshot and falls back to cached original source metadata before returning to an empty draft.
- [Phase 08-01]: Saved Step 2 entries generate a display name from strategy context, horizon, and save timestamp when no existing name is present.
- [Phase 08-02]: Strategy assumptions are centralized in assumptions.js with conservative numeric defaults separated from display ranges.
- [Phase 08-02]: Strategy comparison rows expose signed Won benchmark deltas so underperformance versus Nasdaq or S&P 500 remains visible.
- [Phase 08-03]: Step 2 first-screen order now follows the mobile judgment flow in actual DOM order.
- [Phase 08-03]: DataHub simulation list names and ids are rendered with textContent and dataset while static modal templates remain unchanged.
- [Phase 08-04]: Step 2 runtime market evidence is documented under public/data/indices/*.json, while JEPI/QQQI/DIVO remain editable conservative assumptions in assumptions.js.
- [Phase 08-04]: Loose root QQQ CSV backdata files were deleted after runtime path scanning found no dependency.
- [Phase 09-01]: Account correction now runs at the Step 1 sanitizer boundary so saved, imported, shared, and rendered data use the same repaired account links.
- [Phase 09-01]: Sankey uses a real `total-income` / `총수입` node between individual income sources and account outflows, excluding deficit pseudo-income from total income.
- [Phase 09-02]: Preset setup uses Korean percentage presets (`안정`, `균형`, `성장`, `야수`, `사용자 지정`) and confirms overwrite inside the modal before persistence commit.
- [Phase 09-02]: Korean high-unit money labels stop at one lower unit: `억` displays down to `만`, and `조` displays down to `억`.
- [Phase 09-03]: Step 1 summaryCards now render two financial setup groups and five category cards before Sankey. — Phase 09 requires the default screen to be summary-first while keeping Sankey directly below.
- [Phase 09-03]: Category detail edits stay in financial modal draft state until persistence.commitImmediateInputs() save. — This preserves explicit save/cancel behavior and keeps sanitizer/persistence as the durable boundary.
- [Phase 09-03]: Guided item creation and simple account alias creation live inside the relevant category modal. — The standalone account-management path is rejected for Phase 09; account work belongs inside item flows.
- [Phase 09-04]: Manual Sankey account correction refresh reuses sanitizeInputs()/repairAccountConnections before persistence and rerender. — This keeps D-25 correction behavior aligned with saved/imported/shared Step 1 data.
- [Phase 09-04]: Merged Sankey tooltip metadata remains textContent-based and uses newline-separated rows with CSS pre-line wrapping. — This satisfies D-27 readability without opening an HTML injection surface.
- [Phase 09-05]: Expense/savings/invest detail editing now opens as compact cards and expands only the selected item. — This closes the UAT mobile density issue while preserving explicit save/cancel.
- [Phase 09-05]: Step 1 no longer exposes manual account-transfer settings; item source accounts drive automatic flow balancing. — This removes duplicate cash-flow modeling and keeps surplus/deficit output derived from required item account selections.
- [Phase 10.5-01]: Default Step 1 financial summary now has one static `재무설정 상세` CTA, and summary cards route to the same financial modal controller path.
- [Phase 10.5-01]: Visible Phase 10 couple/household overview UI was removed from the financial modal while sanitizer and household-budget data helpers remain intact.
- [Phase 10.5]: Phase 10.5-03: 월 생활비 uses dedicated variable/fixed sections; variable actual edits stay draft-only until 재무설정 저장. — Plan 03 requires selected variable rows to expose actual controls while fixed expenses remain actual-free.
- [Phase 10.6-01]: Financial modal dirty state now uses full baseline-vs-draft input comparison instead of row selection, modal open, empty add setup, or tab state.
- [Phase 10.6-01]: Variable expense range persists as variable-only `varianceAmount`; fixed rows strip it while existing `actualSpent` compatibility remains.
- [Phase 10.6-02]: Empty inline temporary rows are draft metadata and are filtered from dirty detection/persistence until meaningful values are entered.
- [Phase 10.6-02]: The integrated financial detail modal uses tab-header add actions and guarded pending close prompts while preserving commitImmediateInputs as the persistence boundary.
- [Phase 10.6-03]: Mobile financial rail uses four user-facing cells (수입, 생활비, 투자, 저축), with 저축 combining explicit and automatic savings.
- [Phase 10.6-03]: Legacy modal regression tests now assert Phase 09/10.5 contracts through row-click, inline-add, and in-place apply/cancel semantics.
- [Phase 10.6.1-01]: Income allocation editing now lives inside Financial Detail Modal income row edit state and persists by enabling split income account data when multiple allocations exist.
- [Phase 10.6.1-01]: Savings row additional settings expose item-level annual yield and maturity month while rows without item yield continue to use the global savings yield fallback.
- [Phase 10.6.1-02]: Financial Detail Modal remains the only ordinary Step 1 editor; the auxiliary item-editor controller, hidden legacy panels, global pending bar, and mobile editor FAB were removed. — ADR 0001 and UXR-09 require no second primary financial editor path after Plan 01 absorbed useful capabilities.
- [Phase ?]: 10.6.1-03: List renderer and state helpers were reduced to display-only support now that ordinary editing is modal-only.
- [Phase ?]: 10.6.1-03: Build output is verification-only for this phase; generated version/build artifacts are not committed under the source-first policy.
- [Phase 10.7-01]: Step 1 primary Sankey now ignores legacy account/allocation/correction/transfer fields and renders income through total-income directly to category destinations.
- [Phase 10.7-01]: Sankey help copy describes simple category flow instead of account network exploration.
- [Phase 10.7-02]: Legacy account/allocation/transfer data is preserved in `accountFlowHandoff` sidecar while primary Step 1 sanitize/snapshot paths strip account-flow fields.
- [Phase 10.7-02]: Import/share paths rely on `sanitizeInputs()` for sidecar retention, so persistence-controller changes were unnecessary.
- [Phase 10.7-03]: Financial Detail Modal no longer exposes account category, account selects, or income allocation controls in ordinary Step 1.
- [Phase 10.7-03]: Step 1 read surfaces render financial items without account badges, account cards, or account-specific warning calculations.
- [Phase 10.7-03]: The render orchestrator treats primary Step 1 as a simple Sankey/read surface and does not require live accounts for network-map rendering.
- [Phase 10.7-04]: Step 1 primary visualization now exposes only simple Sankey basic/detail modes; account network and transfer controls are removed from DOM and controller paths.
- [Phase 10.7-04]: Correction refresh and transfer-rule handlers were deleted from ordinary Step 1 so account sidecar data cannot mutate primary Sankey state.
- [Phase 10.7-05]: Portfolio consumes `accountFlowHandoff` only as destination-owned status data; visiting Portfolio does not rehydrate Step 1 primary account fields.
- [Phase 10.7-05]: Portfolio connector falls back from IndexedDB latest snapshot to `isf-step1-active` local data so browser-local handoff detection remains reliable.
- [Phase 10.7-06]: Portfolio is the account-flow destination boundary; Step 1 only shows navigation guidance when `accountFlowHandoff` exists.
- [Phase 10.7-06]: `accountFlowHandoff` remains handoff-only compatibility data and must not rehydrate Step 1 primary account fields.
- [Phase 10.8-01]: Account Map drafts save under isf-account-map-v1 and Main imports do not write back to isf-rebuild-v1.
- [Phase 10.8-01]: Account Map uses a distinct account-map route/header step and Vite entry instead of Portfolio routing.
- [Phase 10.8-01]: Account Map connector prefers active bridge/local Main data before older snapshot history.

## Operator Next Steps

- Continue Phase 10.8 with Plan 10.8-02: relationship-first map renderer, detail reveal, candidate review, and Account Map draft persistence.

## Session

**Last session:** 2026-06-29T08:54:06.843Z
**Stopped at:** Completed 10.8-01-PLAN.md
**Resume file:** None
