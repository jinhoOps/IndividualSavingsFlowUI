# Phase 08: Step 2 Redesign & Re-planning - Research

**Researched:** 2026-06-17  
**Domain:** Step 2 vanilla ES module redesign, local-first persistence fallback, strategy comparison simulation  
**Confidence:** HIGH for codebase attachment points, MEDIUM for browser API fallback guidance and Phase 08 execution-default investment assumptions

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### First-Screen Decision Flow
- **D-01:** The first screen must lead with a careful choice frame: dividend and covered-call strategies may underperform index/growth investing in long-term total assets, then immediately show the user's projected future assets and monthly cash-flow outcome.
- **D-02:** Use a choice-guide tone. The screen should help users who care about retirement planning, monthly cash flow, or psychological comfort evaluate dividend strategies, while still making the total-return tradeoff visible.
- **D-03:** The top KPI set is final expected assets, expected monthly dividend/cash flow, and difference versus the selected index/growth benchmark.
- **D-04:** The annual detail table should not dominate the first screen. Keep the first screen card/graph-led and move the full year-by-year table into a collapsed detail section.

### Input Simplification And Step 1 Sync
- **D-05:** Always visible first-screen inputs are initial investment amount, monthly investment amount, and time horizon.
- **D-06:** Strategy assumptions use strategy cards plus a default-collapsed advanced settings panel. Selecting a card auto-sets dividend yield, dividend growth, capital growth, and DRIP assumptions; advanced settings allow manual edits.
- **D-07:** Strategy cards are grouped as index/growth, dividend growth, and covered-call/monthly-income. Existing ETF presets move into card examples or advanced settings rather than driving the first screen.
- **D-08:** Step 2 should automatically import the original Step 1 monthly investment capacity on entry. Users may edit the value inside Step 2, but that edit is Step 2-only and must not mutate Step 1 source data.
- **D-09:** Resetting Step 2 must discard Step 2-only edits and re-import the original Step 1 value. The currently broken automatic import/editable flow is in scope for Phase 08.

### Comparison Cards And Graph
- **D-10:** The baseline comparison set is user-selectable index/growth benchmark (Nasdaq or S&P 500), SCHD as dividend-growth representative, and JEPI/QQQI/DIVO as covered-call/monthly-income representatives.
- **D-11:** The main graph compares final asset growth lines across index/SCHD/covered-call strategies, with monthly dividend/cash flow as the secondary axis or supporting metric.
- **D-12:** Covered-call/monthly-income strategies should primarily be described as retirement cash-flow tools. For early-career users and investing beginners, the UI must strongly explain that higher monthly distributions can mean giving up part of upside participation.
- **D-13:** The final judgment message should be goal/life-stage based: during asset accumulation, consider index/growth first; during cash-flow or retirement planning, dividend strategies may fit.

### 50,000,000 KRW Guidance And Storage Fallback
- **D-14:** The 50,000,000 KRW-or-less warning is based on initial investment amount only, not initial amount plus future monthly contributions.
- **D-15:** The warning tone should be a strong guide: users with 50,000,000 KRW or less initial investment should first consider growing capital through index/growth investing before relying on dividend or covered-call income. Use cautious wording such as "consider" and "compare" rather than absolute advice.
- **D-16:** When IndexedDB is blocked or fails, Step 2 should silently fall back to LocalStorage while showing a small status/feedback message such as temporary save mode. The fallback must not interrupt the user's flow with a modal by default.
- **D-17:** The LocalStorage fallback must preserve the Step 2 simulation list core flow: save, list, load, and delete. Full automatic backup/restore parity is not required for this phase.

### ETF And Strategy Assumptions
- **D-18:** Strategy assumptions should be conservative example assumptions, not real-time or guaranteed market data.
- **D-19:** Use `public/data/indices/*.json` and cleaned historical backdata as the evidence base, but expose conservative learning ranges rather than raw averages.
- **D-20:** Display strategy assumptions as ranges for dividend yield, dividend growth, and capital growth so users do not read them as exact predictions. Use conservative default values internally for calculations, editable through advanced settings.
- **D-21:** Phase 08 planning should include cleanup of root-level QQQ CSV backdata (`qqq_raw.csv`, `qqq_daily_raw.csv`, `qqq_daily_stooq.csv`) so runtime code does not depend on loose root files. Data should belong under `public/data/indices/` or a documented generation pipeline.

### Mobile Structure And Interaction
- **D-22:** Mobile screen order is judgment statement, inputs, KPI cards, graph, comparison cards, then detail view.
- **D-23:** Mobile comparison cards should be three high-density vertical cards: index, SCHD, covered-call. Each card is limited to one-line conclusion, two key values, and one caveat; deeper explanation belongs in disclosure/help text.
- **D-24:** Mobile graph interaction should keep period segmented controls and touch tooltip behavior. Feedback should feel clear and playful through constrained micro-interactions: selected card response, short line redraw, and KPI number update. Avoid random motion that implies the result changed or causes layout shift.
- **D-25:** Mobile detail remains a collapsed section with horizontal table scrolling, plus summary cards for key years/key values.

### the agent's Discretion
- The planner may choose exact visual copy and component names as long as the decisions above remain visible in the plan.
- The planner may decide whether strategy calculations live in existing Step 2 modules or a new small assumptions module, provided the Step 2 vanilla ES module pattern remains intact.
- The planner may choose exact LocalStorage key names and schema migration shape, provided IndexedDB and LocalStorage paths share normalization and tests cover both paths.

### Deferred Ideas (OUT OF SCOPE)
- Live market data or current ETF yield fetching — future data integration phase.
- Personalized investment advice or suitability profiling — out of scope for this static planning tool.
- Full LocalStorage backup/restore parity with IndexedDB backup services — future storage-hardening phase if needed.
- Broad React migration of Step 2 — future modernization phase unless separately scoped.
</user_constraints>

## Summary

Phase 08 should attach to the existing Step 2 app under `apps/simulation`, not `apps/step2`; the Vite entry `src/entries/step2.ts` already imports shared utilities, `CompatibilityBridge`, shared styles, app/header/data hub components, `apps/simulation/styles.css`, and `apps/simulation/app.js`. [VERIFIED: codebase grep] The redesign should keep the existing vanilla ES module pattern and split new behavior into small modules rather than moving Step 2 to React. [VERIFIED: 08-CONTEXT.md]

The highest-risk implementation areas are `renderers.js`, `ui-controller.js`, `feature-controllers.js`, `step1-connector.js`, `CompatibilityBridge.ts`, and `data-hub-modal.js`. [VERIFIED: codebase grep] Current Step 2 already has state, calculator, DOM registry, renderers, UI controller, feature controller, and Step 1 connector modules, so the planner should extend those boundaries instead of creating a parallel app shell. [VERIFIED: codebase grep]

The storage fallback must be deliberately narrow: Step 2 simulation save/list/load/delete should keep working when IndexedDB fails, but backups do not need full LocalStorage parity. [VERIFIED: 08-CONTEXT.md] MDN documents IndexedDB as an asynchronous browser database API and Web Storage as origin-bound storage with different private-browsing persistence behavior, so a small fallback adapter around Step 2 list CRUD is a reasonable browser-local degradation path. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API]

**Primary recommendation:** Build Phase 08 as a three-wave Step 2 vertical redesign: first storage/import correctness, then strategy comparison model and data cleanup, then mobile-first layout plus Playwright visual/regression gates. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Step 1 monthly investment auto-import | Browser / Client | Storage Layer | Step 2 reads Step 1 state through `step1-connector.js` and `window.IsfStorageHub`; no backend exists. [VERIFIED: codebase grep] |
| Step 2-only monthly investment edits | Browser / Client | Session/Local storage | Edits live in `state.draft` and `sessionStorage` today; they must not write Step 1 source data. [VERIFIED: codebase grep] |
| Strategy comparison calculations | Browser / Client | Static data | The current calculator is pure client-side math over `state.draft`; historical JSON is static under `public/data/indices`. [VERIFIED: codebase grep] |
| Simulation list persistence | Storage Layer | Browser / Client | `feature-controllers.js` calls `window.IsfStorageHub` for save/list/load/delete; fallback should live behind this storage contract. [VERIFIED: codebase grep] |
| Mobile layout order and interactions | Browser / Client | CSS | Current layout and chart are HTML/CSS/SVG with no server dependency. [VERIFIED: codebase grep] |
| Data/backdata cleanup | Static Assets | Scripts | Runtime market JSON is under `public/data/indices`; root QQQ CSV files are loose repository artifacts. [VERIFIED: codebase grep] |

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-03 | Step 2 목표 중심 재기획 및 에디토리얼 레이아웃 구현 | Existing Step 2 surfaces and DESIGN.md rules define the implementation path; Phase 08 context adds strategy comparison, 50M KRW warning, mobile order, and IndexedDB fallback. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: 08-CONTEXT.md] |

</phase_requirements>

## Project Constraints

- No `AGENTS.md` exists in the repository root. [VERIFIED: shell check]
- No project-local `.codex/skills` or `.agents/skills` directory exists. [VERIFIED: shell check]
- Source comments and agent-facing documentation should use Korean honorific tone and UTF-8 where project conventions apply. [VERIFIED: .planning/codebase/CONVENTIONS.md]
- Internal financial values must remain Won integers; UI may convert for readability. [VERIFIED: .planning/codebase/CONVENTIONS.md]
- CSS edits must preserve responsive media-query integrity and verify mobile layouts at 760/768px-class widths. [VERIFIED: .planning/codebase/CONVENTIONS.md]
- Keep changes surgical and preserve the modern hybrid architecture: vanilla ES modules in `apps/`, TypeScript for storage/core bridges, shared Web Components for common UI. [VERIFIED: .planning/codebase/ARCHITECTURE.md]

## Standard Stack

### Core

| Library / Platform | Version | Purpose | Why Standard |
|--------------------|---------|---------|--------------|
| Vanilla ES Modules | Browser-native | Step 2 UI orchestration under `apps/simulation/modules` | Existing Step 2 and Phase 07 patterns use focused vanilla modules. [VERIFIED: codebase grep] |
| Vite | 5.4.21 installed | Multi-page dev/build entry for `src/entries/step2.ts` | Current project uses Vite entries for each app step. [VERIFIED: npm ls] |
| TypeScript | 5.9.3 installed | Storage bridge and model/type layer | `CompatibilityBridge.ts`, `IsfStore.ts`, and `models.ts` are already TypeScript. [VERIFIED: npm ls] [VERIFIED: codebase grep] |
| IndexedDB via `IsfStore` | Browser API | Primary local persistence | Current bridge routes `saveStep2Entry`, `listStep2Entries`, and delete/list calls into `isfStore`. [VERIFIED: codebase grep] |
| LocalStorage | Browser API | Fallback Step 2 simulation list CRUD only | Existing legacy storage hub already has `saveToLocal` and `loadFromLocal` helper patterns. [VERIFIED: codebase grep] |
| SVG | Browser-native | Strategy comparison chart | Current `drawSimulationChart` renders an SVG with `viewBox`, polylines, circles, and touch/mouse hit rectangles. [VERIFIED: codebase grep] |

### Supporting

| Library / Platform | Version | Purpose | When to Use |
|--------------------|---------|---------|-------------|
| Playwright | 1.60.0 installed | Browser/mobile regression verification | Add Step 2 coverage for mobile order, storage fallback, chart readability, and warning visibility. [VERIFIED: npm ls] |
| React / React DOM | 19.2.5 installed | Future gradual UI modernization | Do not use for Phase 08 unless a later plan explicitly scopes React migration; Phase 08 context defers broad React migration. [VERIFIED: npm ls] [VERIFIED: 08-CONTEXT.md] |
| Vitest | 4.1.5 installed | Unit tests for pure calculation modules | Use if the planner extracts strategy assumptions/calculation into DOM-free modules. [VERIFIED: npm ls] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing SVG renderer | Chart.js / D3 | Adds dependency and migration surface; current SVG renderer already supports mobile tooltip hit zones. [VERIFIED: codebase grep] |
| `CompatibilityBridge` fallback adapter | New global storage system | Contradicts Phase 08 boundary against replacing global storage architecture. [VERIFIED: 08-CONTEXT.md] |
| Existing vanilla modules | Broad React migration | Explicitly deferred by Phase 08 context. [VERIFIED: 08-CONTEXT.md] |

**Installation:**

No new package installation is recommended for Phase 08. [VERIFIED: package.json] Existing installed versions were checked with `npm ls vite typescript @playwright/test vitest react react-dom --depth=0`. [VERIFIED: npm ls]

## Package Legitimacy Audit

No external packages should be installed for this phase. [VERIFIED: 08-CONTEXT.md] The package-legitimacy gate is not applicable because there are no new recommended packages. [VERIFIED: package.json]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | npm | — | — | — | — | No install planned. [VERIFIED: package.json] |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Step 2 Entry
  src/entries/step2.ts
    -> shared IsfUtils + CompatibilityBridge + shared styles
    -> apps/simulation/app.js
       -> initDom()
       -> restore hash/session draft
       -> uiController.init()
       -> checkReturningUser()
       -> checkStep1SyncData()
       -> renderDraft()
          -> strategy comparison calculator
          -> KPI + chart + comparison cards + collapsed detail table

Step 1 Source Data
  IsfStorageHub.getLatestStep1Snapshot()
    -> step1-connector.js
       -> original monthlyInvest/startInvest import
       -> Step 2-only editable draft
       -> reset re-imports Step 1 source

Simulation Persistence
  feature-controllers.js
    -> Step2Storage facade
       -> IndexedDB path through CompatibilityBridge / IsfStore
       -> LocalStorage fallback path for save/list/load/delete
    -> DataHubModal simulation list
```

### Recommended Project Structure

```text
apps/simulation/
├── app.js                         # keep bootstrap/orchestration
├── index.html                     # reorder first screen and add stable DOM anchors
├── styles.css                     # move durable inline styles here
└── modules/
    ├── assumptions.js             # new: strategy card defaults/ranges/examples
    ├── comparison-calculator.js   # new: index vs SCHD vs covered-call projections
    ├── storage-fallback.js        # new: Step 2 LocalStorage CRUD adapter
    ├── step1-connector.js         # update: original import cache + reset re-import
    ├── feature-controllers.js     # update: storage facade + reset behavior
    ├── renderers.js               # update: KPI/graph/cards/collapsed details
    ├── ui-controller.js           # update: strategy cards, advanced assumptions
    └── dom.js                     # update: new DOM registry entries
```

### Pattern 1: Thin Storage Facade

**What:** Wrap Step 2 save/list/load/delete in one local module that first tries `window.IsfStorageHub`, then switches to LocalStorage fallback mode after IndexedDB failure. [VERIFIED: codebase grep]  
**When to use:** Use for `saveCurrent`, `refreshList`, `loadById`, and `deleteById` only; do not route backup restore parity through it. [VERIFIED: 08-CONTEXT.md]  
**Example:**

```javascript
// Source: shared/storage/hub-storage.js saveToLocal/loadFromLocal pattern + feature-controllers.js CRUD contract.
export async function saveStep2Simulation(data) {
  try {
    const entry = normalizeEntry(data);
    const saved = await window.IsfStorageHub.saveStep2Entry(entry);
    return saved || entry;
  } catch (_error) {
    const next = upsertLocalEntry(normalizeEntry(data));
    setFallbackMode(true);
    return next;
  }
}
```

### Pattern 2: Strategy Assumptions as Data, Calculator as Pure Logic

**What:** Put strategy card metadata, display ranges, and conservative internal defaults in `assumptions.js`; keep projection math in `comparison-calculator.js`. [VERIFIED: codebase grep]  
**When to use:** Use whenever UI cards and advanced settings need the same assumptions without duplicating constants in DOM event handlers. [VERIFIED: codebase grep]  
**Example:**

```javascript
// Source: existing ui-controller.js PRESET_ASSETS constants, refactored into data.
export const STRATEGIES = {
  index: { label: "지수/성장", benchmarkOptions: ["qqq", "spy"], defaultKey: "qqq" },
  dividendGrowth: { label: "배당성장", examples: ["SCHD"], defaults: { yield: 3.5, growth: 5.0, capitalGrowth: 4.0, drip: true } },
  coveredCall: {
    label: "월 현금흐름",
    examples: ["JEPI", "QQQI", "DIVO"],
    defaultsByExample: {
      JEPI: { cashFlowYield: 7.0, distributionGrowth: 0.0, capitalGrowth: 1.5, drip: false, displayRange: { cashFlowYield: "6-9%", distributionGrowth: "0-1%", capitalGrowth: "0-3%" } },
      QQQI: { cashFlowYield: 9.0, distributionGrowth: 0.0, capitalGrowth: 2.0, drip: false, displayRange: { cashFlowYield: "7-11%", distributionGrowth: "0-1%", capitalGrowth: "0-4%" } },
      DIVO: { cashFlowYield: 4.5, distributionGrowth: 1.0, capitalGrowth: 3.0, drip: false, displayRange: { cashFlowYield: "3.5-6%", distributionGrowth: "0-2%", capitalGrowth: "1-5%" } }
    }
  }
};
```

The covered-call defaults above are Phase 08 execution defaults from the resolved user decision: use conservative editable assumptions rather than live/guaranteed market data. They must be labeled as examples/ranges in the UI and remain editable through advanced settings. [RESOLVED: 2026-06-17]

### Pattern 3: Stable Mobile Order Through DOM Order First

**What:** Put judgment, inputs, KPI, graph, comparison cards, and details in the HTML order, then use CSS only for refinement. [VERIFIED: 08-CONTEXT.md]  
**When to use:** Use for the first-screen mobile-first flow so CSS `order` cannot accidentally diverge from screen-reader and keyboard order. [ASSUMED]

### Anti-Patterns to Avoid

- **Broad React rewrite:** Phase 08 explicitly defers broad Step 2 React migration. [VERIFIED: 08-CONTEXT.md]
- **Exact-looking investment prediction copy:** Context requires conservative examples/ranges, not guaranteed live market data. [VERIFIED: 08-CONTEXT.md]
- **Random chart/card motion:** Context allows constrained micro-interactions only when they do not imply result changes or cause layout shift. [VERIFIED: 08-CONTEXT.md]
- **Root CSV runtime dependency:** Context requires root QQQ CSV clutter cleanup or documentation; runtime should depend on `public/data/indices` or scripts. [VERIFIED: 08-CONTEXT.md]
- **User-controlled HTML interpolation in lists:** Phase 07 fixed similar rendering risks with DOM-built options; Step 2/DataHub list rendering still uses `innerHTML` for simulation names and ids. [VERIFIED: codebase grep]

## Concrete File-Level Guidance

| File | Guidance | Risk |
|------|----------|------|
| `apps/simulation/index.html` | Replace current intro/basic/simulation order with judgment statement, always-visible initial/monthly/horizon inputs, KPI grid, graph, comparison cards, and collapsed details. [VERIFIED: 08-CONTEXT.md] | Large markup edits can leave stale IDs unless `dom.js` is updated. [VERIFIED: codebase grep] |
| `apps/simulation/styles.css` | Move current inline layout styles from HTML into CSS and add mobile-first dense cards; preserve `@media (max-width: 760px)`. [VERIFIED: codebase grep] | CSS truncation has been a documented project risk. [VERIFIED: .planning/codebase/CONVENTIONS.md] |
| `apps/simulation/modules/dom.js` | Add selectors for judgment message, benchmark segmented control, strategy cards, advanced panel, fallback status, comparison cards, details summary cards. [VERIFIED: codebase grep] | Missing selectors will silently skip rendering because current renderers guard missing DOM. [VERIFIED: codebase grep] |
| `apps/simulation/modules/state.js` | Extend draft with `benchmark`, `selectedStrategy`, `strategyAssumptions`, and `step1ImportedMonthlyInvest` or similar original-source cache. [VERIFIED: 08-CONTEXT.md] | Reset must re-import Step 1 value instead of zeroing monthly investment. [VERIFIED: 08-CONTEXT.md] |
| `apps/simulation/modules/step1-connector.js` | Change import behavior to auto-load Step 1 original monthly investment on entry and expose a helper for reset re-import. [VERIFIED: 08-CONTEXT.md] | Current `checkStep1SyncData` only auto-applies when both current initial and monthly values are zero, then prompts on differences. [VERIFIED: codebase grep] |
| `apps/simulation/modules/feature-controllers.js` | Fix `saveCurrent` return contract and route CRUD through a Step 2 storage facade; update `reset()` to re-import Step 1 source. [VERIFIED: codebase grep] | Current bridge `saveStep2Entry` returns `void` through `IsfStore.saveStep2Simulation`, while `saveCurrent` reads `entry.id`. [VERIFIED: codebase grep] |
| `apps/simulation/modules/calculator.js` | Keep existing single-strategy math only if useful; otherwise extract comparison projection to a new pure module and keep exports deterministic. [VERIFIED: codebase grep] | Existing chart/KPI expects PR/TR single-strategy fields; comparison graph needs a new result shape. [VERIFIED: codebase grep] |
| `apps/simulation/modules/renderers.js` | Split KPI, chart, comparison cards, warning, and details renderers; use DOM node creation for user/imported strings. [VERIFIED: codebase grep] | Current renderer uses multiple `innerHTML` writes; safe only while values are numeric/static. [VERIFIED: codebase grep] |
| `apps/simulation/modules/ui-controller.js` | Replace old preset category/subcategory UI with three strategy cards, benchmark selection, advanced settings, and period segmented controls. [VERIFIED: 08-CONTEXT.md] | Current preset constants include leveraged/growth examples that should move out of first-screen driver role. [VERIFIED: codebase grep] |
| `src/core/storage/CompatibilityBridge.ts` | Make `saveStep2Entry` return the saved entry or normalized input and consider fallback capability flags. [VERIFIED: codebase grep] | `IsfBackupManager.isIndexedDbAvailable()` currently always returns `true`, which hides blocked IndexedDB states. [VERIFIED: codebase grep] |
| `shared/components/data-hub-modal.js` | Ensure simulation list rendering escapes names/ids or builds DOM nodes. [VERIFIED: codebase grep] | Existing `updateSimulationList` interpolates `e.name` and `e.id` into Shadow DOM HTML. [VERIFIED: codebase grep] |
| `public/data/indices/*.json` | Use `qqq.json`, `spy.json`, and `schd.json` as available evidence files; add covered-call examples as assumptions rather than pretending JSON exists for JEPI/QQQI/DIVO. [VERIFIED: codebase grep] |
| `qqq_raw.csv`, `qqq_daily_raw.csv`, `qqq_daily_stooq.csv` | Delete if not needed or move to a documented script fixture; current contents are Stooq API instructions/404, not clean runtime data. [VERIFIED: file read] |

## Strategy Comparison Model

Use three strategy families: index/growth benchmark (`qqq` or `spy`), dividend growth (`SCHD`), and covered-call/monthly-income examples (`JEPI`, `QQQI`, `DIVO`). [VERIFIED: 08-CONTEXT.md] Existing static JSON includes `qqq`, `spy`, `schd`, `qld`, and `tqqq`, but not JEPI, QQQI, or DIVO JSON files. [VERIFIED: codebase grep]

Recommended result shape:

| Field | Purpose | Source |
|-------|---------|--------|
| `year` | Shared x-axis | Existing calculator yearly loop. [VERIFIED: codebase grep] |
| `principal` | Initial plus monthly contributions | Existing calculator logic. [VERIFIED: codebase grep] |
| `strategies.index.asset` | Benchmark final asset line | New comparison calculator. [ASSUMED] |
| `strategies.dividendGrowth.asset` | SCHD-style asset line | New comparison calculator. [ASSUMED] |
| `strategies.coveredCall.asset` | Covered-call asset line | New comparison calculator. [ASSUMED] |
| `strategies.*.monthlyCashFlowAfterTax` | Cash-flow KPI/card value | Existing tax utility pattern via `calculateIncomeTax`. [VERIFIED: codebase grep] |
| `benchmarkDelta` | Difference versus selected index/growth benchmark | Required top KPI. [VERIFIED: 08-CONTEXT.md] |

Default examples should be conservative and editable, and the UI should display ranges so users do not read them as promises. [VERIFIED: 08-CONTEXT.md] Exact numeric ranges require product/user confirmation because this research did not verify ETF current distributions or forward-return assumptions against issuer data. [ASSUMED]

## Data / Backdata Cleanup

`public/data/indices/qqq.json`, `spy.json`, and `schd.json` are available runtime JSON sources; `qqq` and `spy` each contain 6,657 daily points from 2000-01-01 to 2026-05-27, while `schd` contains 3,885 daily points from 2011-01-01 to 2026-05-27. [VERIFIED: local JSON parse] The root CSV files are tiny loose artifacts: `qqq_raw.csv` contains Stooq API instructions, `qqq_daily_raw.csv` contains `404: Not Found`, and `qqq_daily_stooq.csv` contains Stooq API instructions. [VERIFIED: file read]

Recommended cleanup:

1. Remove runtime references to root CSV files and assert no imports/fetches reference them. [VERIFIED: codebase grep]
2. Delete the three root CSV files after grep confirms no runtime/script dependency. If execution finds a real dependency, relocate only the required file under a clearly named non-runtime archive path such as `scripts/fixtures/qqq-backdata/` and document why in the plan summary. [RESOLVED: 2026-06-17]
3. Add a short comment or README note near `scripts/generate_qqq_data.py` / `scripts/generate_market_data.py` explaining that `public/data/indices/*.json` is the runtime source. [VERIFIED: codebase grep]
4. Do not add live market fetching in Phase 08. [VERIFIED: 08-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Whole storage architecture | A second global storage hub | `CompatibilityBridge` + small Step 2 fallback facade | Existing app already routes legacy calls through the bridge. [VERIFIED: codebase grep] |
| Live ETF data integration | Runtime quote/yield fetcher | Static assumptions + editable advanced settings | Live market data is deferred. [VERIFIED: 08-CONTEXT.md] |
| New chart dependency | Chart library migration | Existing SVG renderer, refactored for multi-line comparison | Current renderer already supports touch/mouse hit zones and `viewBox`. [VERIFIED: codebase grep] |
| Financial advice engine | Suitability/personalization scoring | Goal/life-stage choice-guide copy | Personalized investment advice is out of scope. [VERIFIED: 08-CONTEXT.md] |
| Full backup parity in LocalStorage | Backup/restore clone of IndexedDB | Save/list/load/delete fallback only | Phase scope explicitly limits fallback parity. [VERIFIED: 08-CONTEXT.md] |

**Key insight:** Phase 08 is a product-flow redesign over an existing local-first shell; broad architecture replacement would add risk without serving the locked decisions. [VERIFIED: 08-CONTEXT.md]

## Recommended Plan Slices / Waves

### Wave 1: Storage, Step 1 Import, and Data Contract

- Add failing Step 2 Playwright coverage for Step 1 auto-import, Step 2-only edit, reset re-import, and IndexedDB-blocked save/list/load/delete fallback. [VERIFIED: 08-CONTEXT.md]
- Fix `CompatibilityBridge.saveStep2Entry` return contract and `IsfBackupManager.isIndexedDbAvailable()` accuracy or bypass it with a Step 2 storage facade. [VERIFIED: codebase grep]
- Implement LocalStorage fallback for simulation list CRUD only, with a small "temporary save mode" status. [VERIFIED: 08-CONTEXT.md]
- Normalize Step 2 portable format so `totalInitialAsset` is saved; current `toPortableFormat()` omits it even though the draft and UI use it. [VERIFIED: codebase grep]

### Wave 2: Strategy Model and Backdata Cleanup

- Extract strategy assumptions and comparison calculator modules. [VERIFIED: codebase grep]
- Convert current ETF preset constants into strategy cards/examples and collapsed advanced settings. [VERIFIED: 08-CONTEXT.md]
- Use `qqq.json`, `spy.json`, and `schd.json` as static evidence; represent JEPI/QQQI/DIVO with the resolved conservative editable defaults and ranges from `assumptions.js`. [RESOLVED: 2026-06-17]
- Clean or relocate `qqq_raw.csv`, `qqq_daily_raw.csv`, and `qqq_daily_stooq.csv`; add grep verification that runtime code does not depend on root CSV files. [VERIFIED: file read]

### Wave 3: Mobile-First Editorial UI and Visual Verification

- Recompose first screen in DOM order: judgment, inputs, KPI, graph, comparison cards, collapsed detail. [VERIFIED: 08-CONTEXT.md]
- Replace old table-dominant dashboard with KPI/card/graph-led rendering and collapsed year-by-year details. [VERIFIED: 08-CONTEXT.md]
- Add 50,000,000 KRW initial-investment warning based only on `totalInitialAsset`; current warning uses total operation scale and a 100,000,000 KRW threshold. [VERIFIED: codebase grep]
- Add Playwright checks for 390px, 768px, and desktop: no horizontal document overflow, chart nonblank, readable labels, stable card positions after interactions, warning visibility, and screenshots. [VERIFIED: Phase 07 summaries]

## Common Pitfalls

### Pitfall 1: Step 1 Auto-Import Mutates the Wrong Source

**What goes wrong:** Editing the Step 2 monthly value accidentally changes or appears to change the Step 1 source value. [VERIFIED: 08-CONTEXT.md]  
**Why it happens:** Current Step 2 stores imported values directly in `state.draft` and only tracks `state.isSyncedWithStep1`; it does not keep a durable original Step 1 import cache for reset semantics. [VERIFIED: codebase grep]  
**How to avoid:** Store source import metadata separately from editable draft fields and make reset call a connector helper that reloads Step 1 source. [ASSUMED]  
**Warning signs:** Reset sets monthly investment to zero or to the last Step 2 edit instead of Step 1's current `monthlyInvest`. [VERIFIED: 08-CONTEXT.md]

### Pitfall 2: Save Succeeds in IndexedDB but UI Treats It as Failure

**What goes wrong:** `saveCurrent()` can fail after saving because it expects `entry.id` from a function that returns `void` in the modern bridge path. [VERIFIED: codebase grep]  
**Why it happens:** `CompatibilityBridge.saveStep2Entry` returns `isfStore.saveStep2Simulation(data)`, and `saveStep2Simulation` is typed `Promise<void>`. [VERIFIED: codebase grep]  
**How to avoid:** Normalize an entry before save, save it, and return the normalized entry from both IndexedDB and LocalStorage paths. [ASSUMED]  
**Warning signs:** Header shows "저장 실패" while IndexedDB contains a record. [ASSUMED]

### Pitfall 3: 50M Warning Uses the Old 100M Rule

**What goes wrong:** Users with low starting capital may not see the required warning if monthly contributions push total operation scale above the old threshold. [VERIFIED: codebase grep]  
**Why it happens:** Current `renderKpiCards` computes `initialAsset + monthlyCapacity * 12 * years` and compares against 100,000,000. [VERIFIED: codebase grep]  
**How to avoid:** Use only `state.draft.totalInitialAsset <= 50000000` for the warning trigger. [VERIFIED: 08-CONTEXT.md]  
**Warning signs:** Warning copy still mentions "총 자산 운용 규모 1억 원". [VERIFIED: codebase grep]

### Pitfall 4: Chart Motion Looks Like Data Changed

**What goes wrong:** Micro-interactions can imply the simulation changed or cause layout shift. [VERIFIED: 08-CONTEXT.md]  
**Why it happens:** Strategy cards, KPI numbers, and line redraws update together and can move the surrounding layout if dimensions are not fixed. [ASSUMED]  
**How to avoid:** Use stable card heights, fixed graph aspect ratio, transform/opacity-only selected states, and no random position changes. [ASSUMED]  
**Warning signs:** `document.documentElement.scrollWidth` grows after card selection or KPI text wraps unpredictably. [VERIFIED: Phase 07 summaries]

### Pitfall 5: Shadow DOM List XSS Regression

**What goes wrong:** Imported/saved simulation names can be interpolated into DataHub Shadow DOM HTML. [VERIFIED: codebase grep]  
**Why it happens:** `data-hub-modal.js` builds simulation list rows with `innerHTML` using `e.name` and `e.id`. [VERIFIED: codebase grep]  
**How to avoid:** Build simulation list DOM nodes with `textContent`/`dataset` or escape values consistently before interpolation. [VERIFIED: Phase 07 summaries]

## Code Examples

### Reset Re-Imports Step 1 Source

```javascript
// Source: apps/simulation/modules/step1-connector.js + feature-controllers.js reset flow.
export async function resetWithStep1Source() {
  state.draft = createEmptyDraft();
  const imported = await importStep1SourceIntoDraft({ silent: true });
  state.isSyncedWithStep1 = Boolean(imported);
  state.currentSimulationId = "";
  renderDraft();
  markClean();
}
```

### Multi-Strategy Projection Shape

```javascript
// Source: apps/simulation/modules/calculator.js yearly projection loop, extended for comparison.
export function calculateStrategyComparison(draft, assumptions) {
  const years = Number(draft.dividendSim?.years || 10);
  const rows = [];
  for (let year = 1; year <= years; year += 1) {
    rows.push({
      year,
      principal: calculatePrincipal(draft, year),
      strategies: projectAllStrategies(draft, assumptions, year)
    });
  }
  return rows;
}
```

Helper names in this example are illustrative and need implementation. [ASSUMED]

### Safe Simulation List Rendering

```javascript
// Source: Phase 07 DOM-built option pattern + shared/components/data-hub-modal.js target surface.
const item = document.createElement("div");
item.className = "simulation-item";
const name = document.createElement("span");
name.className = "simulation-name";
name.textContent = entry.name || "Simulation";
name.title = entry.name || "Simulation";
item.append(name);
```

## State of the Art

| Old Approach | Current Phase 08 Approach | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| ETF preset combinations drive Step 2 first screen | Strategy families drive choice; ETF examples move to cards/advanced settings | Phase 08 context, 2026-06-17 | Reduces beginner cognitive load. [VERIFIED: 08-CONTEXT.md] |
| Single dividend PR/TR projection | Index vs dividend-growth vs covered-call comparison | Phase 08 context, 2026-06-17 | Makes opportunity cost visible. [VERIFIED: 08-CONTEXT.md] |
| Annual table visible as a dominant output | KPI/card/graph first, detail table collapsed | Phase 08 context, 2026-06-17 | Supports mobile-first judgment flow. [VERIFIED: 08-CONTEXT.md] |
| IndexedDB-only Step 2 list path | IndexedDB primary with LocalStorage CRUD fallback | Phase 08 context, 2026-06-17 | Preserves core flow in blocked/private modes. [VERIFIED: 08-CONTEXT.md] |

**Deprecated/outdated:**

- Old warning rule based on total operation scale below 100M KRW should be replaced with initial-investment-only 50M KRW guidance. [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- Root QQQ CSV files should not be treated as runtime data. [VERIFIED: file read]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JEPI/QQQI/DIVO use resolved Phase 08 conservative execution defaults and ranges rather than live/current issuer data. | Architecture Patterns / Strategy Comparison Model | Misleading investment expectations; executor must keep values editable, display ranges, and label them as examples. |
| A2 | DOM order should mirror mobile visual order for accessibility and keyboard order. | Architecture Patterns | Low implementation risk; if existing layout constraints force CSS order, planner must add accessibility verification. |
| A3 | Helper names in pseudo-code examples are illustrative. | Code Examples | Planner must create actual module names/functions consistently. |

## Open Questions (RESOLVED)

1. **Exact conservative assumptions for JEPI/QQQI/DIVO**
   - What we know: Phase 08 requires conservative examples and ranges, not live/guaranteed market data. [VERIFIED: 08-CONTEXT.md]
   - RESOLVED: Use Phase 08 execution defaults in `apps/simulation/modules/assumptions.js`, displayed as ranges and editable in advanced settings. JEPI default: 7.0% cash-flow yield, 0.0% distribution growth, 1.5% capital growth, DRIP off, displayed as 6-9% / 0-1% / 0-3%. QQQI default: 9.0% cash-flow yield, 0.0% distribution growth, 2.0% capital growth, DRIP off, displayed as 7-11% / 0-1% / 0-4%. DIVO default: 4.5% cash-flow yield, 1.0% distribution growth, 3.0% capital growth, DRIP off, displayed as 3.5-6% / 0-2% / 1-5%. These are conservative product assumptions, not live/current issuer data or promises. [RESOLVED: user decision, 2026-06-17]

2. **Whether to delete or relocate root CSV clutter**
   - What we know: The three root CSV files are not clean data and are in Phase 08 cleanup scope. [VERIFIED: file read]
   - RESOLVED: Delete `qqq_raw.csv`, `qqq_daily_raw.csv`, and `qqq_daily_stooq.csv` from the repository root after grep confirms no runtime/script dependency. Preserve reproducibility by documenting `public/data/indices/*.json` as the runtime evidence source and `scripts/generate_qqq_data.py` / `scripts/generate_market_data.py` as the intentional generation path. If execution discovers an actual dependency, relocate only the required file to a documented non-runtime archive path and state the reason in `08-02-SUMMARY.md`. [RESOLVED: user decision, 2026-06-17]

3. **Step 2 simulation display name**
   - What we know: DataHub renders `e.name || "Simulation"`, but current `toPortableFormat()` does not include a user-facing name. [VERIFIED: codebase grep]
   - RESOLVED: Preserve the current save/list/load UX and do not add a new naming UI. Normalize saved Step 2 entries so `id` and `name` both survive save/load in IndexedDB and LocalStorage fallback. If an existing entry has `name`, keep it; otherwise generate a stable display name from selected benchmark/strategy, horizon, and local save timestamp, then render `name` as text and use `id` only as the storage/list key. This closes the known save entry id/display-name mismatch without blocking execution on a new naming question. [RESOLVED: user decision, 2026-06-17]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, scripts, tests | yes | v24.15.0 | none needed. [VERIFIED: shell check] |
| npm | package scripts | yes | 11.10.0 | none needed. [VERIFIED: shell check] |
| Playwright | UI verification | yes | 1.60.0 | Manual browser screenshots only if Playwright launch fails. [VERIFIED: shell check] |
| Vite | local dev server | yes | 5.4.21 installed | static preview not sufficient for module/PWA checks. [VERIFIED: npm ls] |
| git | optional docs commit | available with `-c safe.directory=...` | repository ownership warning without safe.directory | Use approved `git -c safe.directory=D:/jhkSandBox/CODE/IndividualSavingsFlowUI ...`. [VERIFIED: shell check] |

**Missing dependencies with no fallback:** none found. [VERIFIED: shell check]  
**Missing dependencies with fallback:** git default invocation is blocked by dubious ownership; use safe.directory-scoped git command. [VERIFIED: shell check]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Static local-first app has no auth subsystem in Phase 08 scope. [VERIFIED: .planning/PROJECT.md] |
| V3 Session Management | partial | Step 2 uses `sessionStorage` for temporary draft restore; keep sensitive assumptions non-secret and clearable. [VERIFIED: codebase grep] |
| V4 Access Control | no | No multi-user server access boundary exists. [VERIFIED: .planning/PROJECT.md] |
| V5 Input Validation | yes | Use `IsfUtils` / `utils.sanitizeMoney` / `utils.sanitizeRate`, and DOM-built rendering for user/imported strings. [VERIFIED: codebase grep] |
| V6 Cryptography | no | No cryptographic feature should be added in Phase 08. [VERIFIED: 08-CONTEXT.md] |
| V12 Files and Resources | partial | JSON import/export remains in DataHub; keep parsing through `IsfShare.parseImportedJson` and normalize imported Step 2 data. [VERIFIED: codebase grep] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Imported simulation name/id HTML injection in DataHub | Tampering / XSS | Build rows with DOM APIs or escape before `innerHTML`. [VERIFIED: codebase grep] |
| Malformed imported JSON changes model shape | Tampering | Route imports through `featureController.normalize()` and extend normalization for new fields. [VERIFIED: codebase grep] |
| IndexedDB blocked/failing causes data loss | Denial of Service | LocalStorage CRUD fallback plus visible temporary-save status. [VERIFIED: 08-CONTEXT.md] |
| Misleading financial certainty | Repudiation / User harm | Use example/range copy and avoid live/guaranteed claims. [VERIFIED: 08-CONTEXT.md] |

## UI Verification Risks

- **Chart readability:** Assert `#simChartSvg` has nonzero bounding box, stable `viewBox`, visible multi-line labels/legend, and touch tooltip behavior at 390px and 768px. [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox] [VERIFIED: Phase 07 summaries]
- **No random layout movement:** Assert card/KPI/graph bounding boxes do not jump after strategy selection except transform-only selected states. [VERIFIED: 08-CONTEXT.md]
- **Mobile order:** Assert vertical y-order is judgment -> inputs -> KPI -> graph -> cards -> details at 390px and 768px. [VERIFIED: 08-CONTEXT.md]
- **50M warning:** Assert `totalInitialAsset <= 50000000` shows the warning and `totalInitialAsset > 50000000` hides it regardless of monthly contribution. [VERIFIED: 08-CONTEXT.md]
- **Fallback storage:** In Playwright, inject a failing `indexedDB.open` or failing bridge methods before page load and verify save/list/load/delete still works through LocalStorage without a modal. [VERIFIED: 08-CONTEXT.md]
- **Service worker freshness:** Keep Playwright `serviceWorkers: 'block'` to avoid stale PWA assets during UI tests. [VERIFIED: playwright.config.ts]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/08-step-2-redesign-re-planning/08-CONTEXT.md` - locked Phase 08 decisions and boundaries. [VERIFIED: file read]
- `apps/simulation/*` and `apps/simulation/modules/*` - Step 2 architecture, state, calculator, renderer, UI, storage, Step 1 connector. [VERIFIED: codebase grep]
- `src/core/storage/CompatibilityBridge.ts` and `src/core/storage/IsfStore.ts` - current IndexedDB bridge and return-contract risk. [VERIFIED: codebase grep]
- `shared/storage/hub-storage.js` and `shared/components/data-hub-modal.js` - legacy LocalStorage helper pattern and DataHub list rendering surface. [VERIFIED: codebase grep]
- `DESIGN.md`, `.planning/codebase/*.md`, and Phase 07 summaries - project conventions and verification patterns. [VERIFIED: file read]

### Secondary (MEDIUM confidence)

- MDN IndexedDB API - browser IndexedDB behavior baseline. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API]
- MDN Web Storage API - browser LocalStorage/session behavior baseline. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API]
- MDN SVG `viewBox` attribute - responsive SVG coordinate/viewport behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox]

### Tertiary (LOW confidence)

- Exact conservative forward assumptions for JEPI/QQQI/DIVO are Phase 08 execution defaults, editable and range-labeled rather than sourced as live/current issuer data. [RESOLVED: 2026-06-17]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - verified with `npm ls`, package files, and codebase imports. [VERIFIED: npm ls]
- Architecture: HIGH - verified through local Step 2 modules and Phase 08 context. [VERIFIED: codebase grep]
- Storage fallback: MEDIUM - local code surfaces are verified; browser API rationale is based on MDN docs. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API]
- Investment assumption values: MEDIUM - Phase 08 has resolved conservative execution defaults; they are product assumptions, not live/current issuer data. [RESOLVED: 2026-06-17]
- UI verification risks: HIGH - Phase 07 established Playwright viewport/screenshot patterns, and Phase 08 decisions define target behavior. [VERIFIED: Phase 07 summaries]

**Research date:** 2026-06-17  
**Valid until:** 2026-07-17 for codebase architecture and Phase 08 execution-default assumptions. If later phases choose to source live/current ETF data, they must run a fresh data-source research pass. [RESOLVED: 2026-06-17]
