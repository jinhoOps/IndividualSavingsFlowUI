---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: TODO/GitHub Issue Resolution
status: planning
last_updated: "2026-06-19T05:36:27.976Z"
last_activity: 2026-06-19
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-19 — Milestone v1.9 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-19)

**Core value:** 단순한 프리셋과 단계별 카드/시뮬레이션 흐름으로 개인 자산 흐름을 빠르게 이해하고 조정하게 한다.
**Current focus:** Planning next milestone

## Accumulated Context

### Roadmap Evolution

- Phase 9 added: Step 1 Financial Settings Input UIUX Rebuild
- v1.8 shipped: portfolio creation/storage, Step 1 modular and financial setup rebuild, Step 2 strategy comparison redesign.

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

## Decisions

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

## Operator Next Steps

- Start the next milestone with `$gsd-new-milestone`
