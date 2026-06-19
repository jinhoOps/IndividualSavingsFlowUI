---
phase: 08-step-2-redesign-re-planning
verified: 2026-06-17T08:52:21Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Step 2 at 390px and 768px and visually inspect the first-screen flow."
    expected: "The screen reads in this order: judgment statement, simplified inputs, KPI cards, graph, comparison cards, collapsed detail; no overlap, clipped text, or incoherent spacing."
    why_human: "Playwright verifies order, overflow, chart box, screenshots, and interactions, but final visual quality and readability still require human judgment."
  - test: "Use the visible Step 2 save button and DataHub list in a browser session, then load and delete one saved simulation."
    expected: "The flow feels understandable, fallback status copy is non-blocking, and saved simulation names are recognizable to the user."
    why_human: "Automated tests verify CRUD behavior, but user-flow clarity and status-message clarity are human UX checks."
---

# Phase 8: Step 2 Redesign & Re-planning Verification Report

**Phase Goal:** 배당성장과 커버드콜의 개념적 이해를 돕고, 단순 지수추종 및 성장주 대비 총수익률의 열세에도 불구하고 이를 선택하는 이유(월 현금 흐름 확보, 은퇴 계획 등)를 투자자 본인이 판단할 수 있도록 돕는 미래 자산 시뮬레이션을 전면 재기획 및 구현
**Verified:** 2026-06-17T08:52:21Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Roadmap SC1: 복잡한 입력 항목을 간소화하고, 직관적인 미래 자산 성장 그래프와 KPI 카드로 화면이 전면 재배치됨 | VERIFIED | `index.html` keeps primary inputs to initial asset, monthly investment, and horizon (`totalInitialAsset`, `totalMonthlyInvestCapacity`, `simYearsTabs`); `renderers.js` renders KPI cards and multi-line SVG chart from `calculateStrategyComparison`; Phase 08 Playwright tests cover desktop/tablet/mobile order and chart box. |
| 2 | Roadmap SC2: IndexedDB 차단 환경에서도 LocalStorage 오프라인 폴백이 작동함 | VERIFIED | `feature-controllers.js` imports `saveStep2Simulation`, `listStep2Simulations`, `getStep2SimulationById`, and `deleteStep2Simulation` from `storage-fallback.js`; direct spot-check forced bridge failures and verified save/list/load/delete via LocalStorage. |
| 3 | Roadmap SC3: 5천만 원 이하 순수 투자자산 경고가 UI에 명시적으로 노출됨 | VERIFIED | `renderers.js` uses only `state.draft.totalInitialAsset <= 50000000`; `index.html` copy says "5천만 원 이하 초기 자금 안내"; tests cover 50,000,000 visible and 50,000,001 hidden despite high monthly investment. |
| 4 | Roadmap SC4: 지수/성장 vs 배당성장 vs 커버드콜의 장단점과 가이드 카드/비교 기능이 제공됨 | VERIFIED | `assumptions.js` defines Nasdaq/S&P 500, SCHD, JEPI/QQQI/DIVO; `comparison-calculator.js` returns final assets, monthly cash flow, and benchmark deltas; `renderers.js` renders three comparison cards and life-stage guidance. |
| 5 | D-08: Step 2 진입 시 원본 Step 1 월 투자 가능 금액이 자동 반영된다 | VERIFIED | `checkStep1SyncData()` resolves `window.IsfStorageHub.getLatestStep1Snapshot()`, normalizes Step 1 `monthlyInvest`, and applies it to draft when there is no Step 2 override; Playwright import test asserts `1750000`. |
| 6 | D-08: Step 2에서 월 투자 가능 금액을 수정해도 Step 1 원본 데이터는 변경되지 않는다 | VERIFIED | UI input only writes `state.draft.totalMonthlyInvestCapacity`; Playwright checks seeded `isf-step1-active` remains `monthlyInvest: 1750000` after Step 2 edit to `2250000`. |
| 7 | D-09: Step 2 초기화는 Step 2 편집값을 버리고 원본 Step 1 값을 다시 가져온다 | VERIFIED | `featureController.reset()` creates an empty draft, clears current simulation id, then awaits `reimportOriginalStep1Source()`; Playwright asserts reset restores Step 1 values. |
| 8 | D-16/D-17: IndexedDB 실패 환경에서도 Step 2 save/list/load/delete가 LocalStorage 폴백으로 동작한다 | VERIFIED | `storage-fallback.js` activates fallback after bridge errors and implements all four CRUD functions; direct module check returned `list:1`, loaded `totalInitialAsset:12300000`, deleted to `after:0`, `fallback:true`. |
| 9 | D-06/D-07: strategy cards map to editable conservative assumptions grouped by index/growth, dividend growth, and covered-call/monthly-income | VERIFIED | `assumptions.js` defines `STRATEGY_GROUPS`; `ui-controller.js` applies selected defaults into editable `dividendSim` fields and advanced settings. |
| 10 | D-10: comparison set includes Nasdaq/S&P 500 benchmark, SCHD, and JEPI/QQQI/DIVO examples | VERIFIED | `assumptions.js` contains Nasdaq, S&P 500, SCHD, JEPI, QQQI, and DIVO labels/options; `index.html` exposes benchmark and covered-call selectors. |
| 11 | D-11: projection data contains final asset growth lines and monthly dividend/cash-flow support metrics | VERIFIED | `comparison-calculator.js` yearly rows expose `finalAssets`, `monthlyCashFlowAfterTax`, and `benchmarkDelta`; chart tooltip includes asset and monthly cash-flow values. |
| 12 | D-18/D-19/D-20: assumptions are conservative examples, shown as ranges, and editable through advanced settings | VERIFIED | `assumptions.js` separates `defaults` and `displayRanges`; `renderers.js` and `ui-controller.js` display range note/disclaimer; `public/data/indices/README.md` documents JSON evidence boundary. |
| 13 | D-01/D-02: first screen starts with total-return tradeoff judgment in a choice-guide tone | VERIFIED | `index.html` first content section is `choiceJudgment` with copy about giving up part of total-asset growth for monthly cash flow. |
| 14 | D-03: top KPIs show final assets, expected monthly dividend/cash flow, and delta versus selected index/growth benchmark | VERIFIED | `renderKpiCards()` creates labels "최종 예상 자산", "예상 월 배당/현금흐름", and selected benchmark delta. |
| 15 | D-04/D-25: year-by-year detail table is collapsed, horizontally scrollable, and supported by summary cards | VERIFIED | `detailSection` is a `<details>` element; `renderDetailSummaryCards()` builds summary cards; CSS gives `.table-wrap` horizontal scrolling; tests verify collapsed default and local overflow. |
| 16 | D-05/D-06/D-07: first-screen inputs are initial investment, monthly investment, horizon, strategy cards, and collapsed advanced settings | VERIFIED | `index.html` includes three primary controls, strategy cards, and `simInputsContainer` advanced `<details>`; `ui-controller.js` binds strategy and advanced inputs. |
| 17 | D-12/D-13: covered-call copy explains retirement cash-flow use and upside tradeoff; final guidance distinguishes accumulation vs cash-flow phases | VERIFIED | `renderers.js` card caveat mentions upside participation limits; `renderFinalGuidance()` contrasts asset accumulation with retirement/monthly cash-flow planning. |
| 18 | D-14/D-15: 50M KRW warning is based only on initial investment and uses strong guide wording | VERIFIED | Warning condition references only `totalInitialAsset`; UI copy advises comparing index/growth capital growth before relying on dividend or covered-call cash flow. |
| 19 | D-22/D-23/D-24: mobile order, dense comparison cards, period controls, touch tooltip, and constrained micro-interactions are verified | VERIFIED | `index.html` DOM order matches required flow; tests cover 1280/768/390 order, touch tooltip, no document overflow, and stable chart position after strategy selection. |
| 20 | D-19: public/data/indices/*.json is documented as evidence base for conservative learning ranges | VERIFIED | `public/data/indices/README.md` names `qqq.json`, `spy.json`, `schd.json`, and `assumptions.js` boundary. |
| 21 | D-21: runtime code does not depend on loose root QQQ CSV files | VERIFIED | Runtime grep found no references under `apps`, `src`, `shared`, or `tests`; root CSV existence check returned none. |
| 22 | D-21: `qqq_raw.csv`, `qqq_daily_raw.csv`, and `qqq_daily_stooq.csv` are removed from repository root | VERIFIED | `Get-ChildItem qqq_raw.csv,qqq_daily_raw.csv,qqq_daily_stooq.csv` returned no files. |

**Score:** 22/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/simulation/modules/storage-fallback.js` | Step 2 LocalStorage CRUD fallback | VERIFIED | Exists, substantive, imported by `feature-controllers.js`, direct CRUD fallback spot-check passed. |
| `apps/simulation/modules/step1-connector.js` | Original Step 1 import/reset boundary | VERIFIED | Resolves latest Step 1 snapshot, caches source metadata, reimports on reset. |
| `src/core/storage/CompatibilityBridge.ts` | `saveStep2Entry` returns saved entry | VERIFIED | `saveStep2Entry` and alias create an entry, save it, and return it. |
| `apps/simulation/modules/assumptions.js` | Strategy metadata/defaults/ranges/evidence keys | VERIFIED | Defines groups, benchmarks, SCHD, JEPI/QQQI/DIVO, defaults, display ranges. |
| `apps/simulation/modules/comparison-calculator.js` | Index/SCHD/covered-call projection rows | VERIFIED | Direct import returned 10 rows with signed covered-call benchmark delta. |
| `apps/simulation/index.html` | Mobile-first DOM order and first-screen anchors | VERIFIED | Contains judgment, primary inputs, KPI/chart/cards/details anchors in actual DOM order. |
| `apps/simulation/modules/renderers.js` | KPI, cards, chart, warning, collapsed details | VERIFIED | Wired to `calculateStrategyComparison`; renders KPI/cards/chart/table/guidance and warning. |
| `apps/simulation/styles.css` | Responsive Step 2 editorial layout | VERIFIED | Contains warning, chart tooltip, detail/table scroll, responsive rules; screenshot artifacts exist. |
| `tests/step2.spec.ts` | Phase 08 regression coverage | VERIFIED | Contains Phase 08 storage/import, strategy, warning, mobile, chart, screenshot, and DataHub tests. |
| `public/data/indices/README.md` | Market-data evidence/source boundary | VERIFIED | Documents `qqq.json`, `spy.json`, `schd.json`, and `assumptions.js`. |
| `scripts/generate_qqq_data.py` | Generation output target note | VERIFIED | `py_compile` passed and script references `public/data/indices`. |
| `scripts/generate_market_data.py` | Generation output target note | VERIFIED | `py_compile` passed and script references `public/data/indices`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `feature-controllers.js` | `storage-fallback.js` | save/list/load/delete facade | VERIFIED | Automatic key-link pattern missed casing/name, but manual grep confirms import and calls for all CRUD functions. |
| `step1-connector.js` | `window.IsfStorageHub.getLatestStep1Snapshot` | `resolveLatestStep1Snapshot` | VERIFIED | `resolveLatestStep1Snapshot()` calls `hub.getLatestStep1Snapshot()`. |
| `calculator.js` | `comparison-calculator.js` | `calculateStrategyComparison` export | VERIFIED | Re-export present. |
| `assumptions.js` | `public/data/indices` | source evidence metadata | VERIFIED | Source paths/evidence keys for qqq/spy/schd present. |
| `renderers.js` | `comparison-calculator.js` | strategy comparison rows | VERIFIED | Imports `calculateStrategyComparison` through `calculator.js` and renders final rows. |
| `ui-controller.js` | `assumptions.js` | strategy and advanced settings binding | VERIFIED | Imports `getStrategyAssumptions` and applies defaults/ranges. |
| `data-hub-modal.js` | `feature-controllers.js` | simulation list events | VERIFIED | Emits `select-simulation` and `delete-simulation`; controller listens and calls load/delete. |
| data generation scripts | `public/data/indices` | documented output | VERIFIED | `verify.key-links` passed for both scripts. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `renderers.js` | `comparison.final`, `comparison.rows` | `calculateStrategyComparison(state.draft)` | Yes - direct module check produced index/SCHD/covered-call assets and cash-flow values | VERIFIED |
| `storage-fallback.js` | saved Step 2 entries | `window.IsfStorageHub` primary, LocalStorage fallback after bridge failure | Yes - forced failure wrote, listed, loaded, and deleted a normalized entry | VERIFIED |
| `step1-connector.js` | `state.draft.totalMonthlyInvestCapacity` and `totalInitialAsset` | `window.IsfStorageHub.getLatestStep1Snapshot()` normalized through connector | Yes - Playwright import/reset test verifies seeded values flow to UI and reset | VERIFIED |
| `data-hub-modal.js` | simulation list rows | `featureController.refreshList()` -> modal `updateSimulationList()` | Yes - visible DataHub Playwright test covers save/list/load/delete; rows use `textContent`/`dataset` | VERIFIED |
| `assumptions.js` | strategy defaults/ranges | static strategy metadata with `public/data/indices` evidence keys | Yes - direct module check resolved S&P 500 and DIVO; tests assert ranges/defaults | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Strategy comparison produces benchmark/SCHD/covered-call rows and signed deltas | `node --input-type=module -e "...calculateStrategyComparison..."` | `{"benchmark":"S&P 500","covered":"DIVO","rows":10,"delta":-65060961,"coveredCash":717627}` | PASS |
| LocalStorage fallback CRUD works after bridge failure | `node --input-type=module -e "...storage-fallback CRUD..."` | `{"saved":true,"list":1,"loaded":12300000,"after":0,"fallback":true}` | PASS |
| Key JS modules parse | `node --check renderers.js ui-controller.js storage-fallback.js comparison-calculator.js` | exit 0 | PASS |
| Data generation scripts parse | `python -m py_compile scripts/generate_qqq_data.py scripts/generate_market_data.py` | exit 0 | PASS |
| TypeScript check | `npm run check` | Orchestrator evidence: PASS | PASS |
| Schema drift | `gsd-tools query verify.schema-drift 08` | `drift_detected=false`, `blocking=false` | PASS |
| Phase 08 browser regression | `npx playwright test tests/step2.spec.ts -g "Phase 08" --reporter=list --timeout=30000` with managed Vite server | Orchestrator evidence: 10 passed; screenshot artifacts exist | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Conventional probes | `Get-ChildItem scripts -Recurse -Filter probe-*.sh` | No probe files found | SKIPPED |
| Declared probes/human-check blocks | `rg "<human-check>|probe-..."` over Phase 08 plans/summaries | No matches | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| UI-03 | 08-01, 08-02, 08-03, 08-04 | Button, Input, Card 등 핵심 컴포넌트 신규 디자인 룰 적용 | SATISFIED | Step 2 uses redesigned primary inputs, strategy cards, KPI cards, comparison cards, collapsed detail, and DataHub controls in `index.html`/`styles.css`; tests verify responsive order and no overflow. |

No additional Phase 08 requirement IDs were mapped in `.planning/REQUIREMENTS.md`; no orphaned phase-specific requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `apps/simulation/modules/step1-connector.js` | 11 | `return null` | INFO | Guard branch for missing Step 1 payload, not a stub. |
| `apps/simulation/modules/storage-fallback.js` | 17, 43, 119 | `return []` / `return null` | INFO | Defensive parse/id guards; real save/list/load/delete paths exist and passed spot-check. |
| `apps/simulation/modules/feature-controllers.js` | 130 | `return null` | INFO | `toPortableFormat()` guard for absent draft, not user-visible placeholder. |
| `shared/components/data-hub-modal.js` | 287 | `placeholder=` | INFO | Input placeholder text, not implementation placeholder. |
| `src/core/storage/CompatibilityBridge.ts` | 86, 122 | `console.log` | INFO | Existing bridge lifecycle logs, not console-only implementation. |

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in Phase 08 touched files.

### Human Verification Required

### 1. Mobile Visual Flow Inspection

**Test:** Open Step 2 at 390px and 768px and visually inspect the first-screen flow.
**Expected:** The screen reads in this order: judgment statement, simplified inputs, KPI cards, graph, comparison cards, collapsed detail; no overlap, clipped text, or incoherent spacing.
**Why human:** Playwright verifies order, overflow, chart box, screenshots, and interactions, but final visual quality and readability still require human judgment.

### 2. DataHub Save/Load/Delete UX Clarity

**Test:** Use the visible Step 2 save button and DataHub list in a browser session, then load and delete one saved simulation.
**Expected:** The flow feels understandable, fallback status copy is non-blocking, and saved simulation names are recognizable to the user.
**Why human:** Automated tests verify CRUD behavior, but user-flow clarity and status-message clarity are human UX checks.

### Gaps Summary

No blocker gaps found. All 22 roadmap and plan must-haves are verified in the codebase. Status is `human_needed` only because Phase 08 is a UI/user-flow phase and visual/readability checks remain human judgment items under the verification gate.

## Acknowledged Gaps

- 2026-06-19T10:51:36.9215399+09:00 - User approved proceeding despite `08-VERIFICATION.md` status `human_needed`. Open items are human UX checks for mobile visual flow and DataHub save/load/delete clarity.

---

_Verified: 2026-06-17T08:52:21Z_
_Verifier: the agent (gsd-verifier)_
