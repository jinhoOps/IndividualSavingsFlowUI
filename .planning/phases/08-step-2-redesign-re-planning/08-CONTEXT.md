# Phase 08: Step 2 Redesign & Re-planning - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase redesigns the Step 2 simulation experience in `apps/simulation` so users can judge whether dividend growth and covered-call/monthly-income strategies are worth choosing despite likely long-term total-return disadvantages versus index/growth investing.

The phase includes Step 2 first-screen recomposition, simplified inputs, index-vs-dividend-vs-covered-call comparison cards, future asset and monthly cash-flow visualization, 50,000,000 KRW-or-less initial-capital guidance, mobile layout restructuring, Step 1 monthly-investment import repair, and IndexedDB-blocked LocalStorage fallback for Step 2 simulation lists.

This phase should not introduce live market-price integrations, investment advice personalization, a broad React migration, or a complete replacement of the global storage architecture.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap And Project State
- `.planning/ROADMAP.md` — Phase 08 goal and success criteria, including Step 2 redesign, 50,000,000 KRW warning, IndexedDB-blocked fallback, and strategy comparison requirements.
- `.planning/REQUIREMENTS.md` — Active UI-03 milestone context and prior UI design-system requirement history.
- `.planning/PROJECT.md` — Current milestone purpose, current architecture, and Step 2 modernization decisions.
- `.planning/STATE.md` — Current workflow position and Phase 08 status.

### Prior Phase Context
- `.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-CONTEXT.md` — Explicitly defers Step 2 storage fallback, warning banner UX, and mobile table redesign to Phase 08.
- `.planning/phases/05-portfolio-creation-allocation-ui/05-CONTEXT.md` — Editorial card, amount-hint, and portfolio input patterns relevant to consistency.

### Design System
- `DESIGN.md` — Authoritative ISF visual system and editorial UI rules.
- `shared/styles/step-theme.css` — Shared step theme imported by Step 2 entry.
- `src/styles/globals.css` — Global Vite/Tailwind-era styling imported by Step 2 entry.

### Step 2 Source
- `src/entries/step2.ts` — Step 2 Vite entry that imports compatibility bridge, shared styles, components, and `apps/simulation/app.js`.
- `apps/simulation/index.html` — Current Step 2 structure, warning banner, inputs, KPI grid, graph, and table markup.
- `apps/simulation/styles.css` — Current Step 2 responsive styles and mobile table/KPI behavior.
- `apps/simulation/app.js` — Step 2 bootstrap and orchestration entry.
- `apps/simulation/modules/state.js` — Step 2 draft/session state and reset defaults.
- `apps/simulation/modules/calculator.js` — Current dividend projection calculations.
- `apps/simulation/modules/renderers.js` — KPI, warning banner, chart, table, tooltip, and draft rendering.
- `apps/simulation/modules/ui-controller.js` — Input binding, Step 1 import/edit flow, display options, strategy presets, and modal events.
- `apps/simulation/modules/feature-controllers.js` — Save/load/delete, backup, normalization, portable format, and reset flow.
- `apps/simulation/modules/step1-connector.js` — Step 1 data import boundary.
- `apps/simulation/modules/dom.js` — Step 2 DOM registry.
- `apps/simulation/modules/constants.js` — Storage keys and Step 2 constants.

### Storage And Data
- `src/core/storage/CompatibilityBridge.ts` — Modern bridge for legacy Step 2 storage methods.
- `src/core/storage/IsfStore.ts` — IndexedDB-backed Step 2 simulation persistence.
- `src/core/storage/BackupService.ts` — Backup behavior; full backup parity is not required for LocalStorage fallback.
- `shared/storage/hub-storage.js` — Legacy storage hub and existing localStorage helper patterns.
- `public/data/indices/spy.json` — S&P 500/index historical data source.
- `public/data/indices/qqq.json` — Nasdaq/growth historical data source.
- `public/data/indices/schd.json` — SCHD historical data source.
- `public/data/indices/qld.json` and `public/data/indices/tqqq.json` — Aggressive growth examples; not first-screen defaults unless planner intentionally scopes them as advanced examples.
- `qqq_raw.csv`, `qqq_daily_raw.csv`, `qqq_daily_stooq.csv` — Loose root QQQ backdata files to clean up or document during Phase 08.
- `scripts/generate_qqq_data.py` and `scripts/generate_market_data.py` — Existing data generation scripts relevant to backdata cleanup.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/simulation/modules/renderers.js`: already renders KPI cards, the warning banner, SVG chart, tooltip, and table; this is the primary redesign surface.
- `apps/simulation/modules/ui-controller.js`: already handles period tabs, assumptions, display options, presets, and Step 1 sync override; this is the primary interaction surface.
- `apps/simulation/modules/feature-controllers.js`: already owns save/load/delete/reset/normalize; LocalStorage fallback and reset-to-Step-1 behavior should connect here.
- `apps/simulation/modules/calculator.js`: current projection engine can be extended from a single dividend strategy to index/SCHD/covered-call comparison outputs.
- `src/core/storage/CompatibilityBridge.ts` and `src/core/storage/IsfStore.ts`: existing modern persistence path for Step 2 entries.
- `shared/storage/hub-storage.js`: contains simple `saveToLocal` / `loadFromLocal` helpers and legacy Step 2 IndexedDB store behavior that can inform fallback design.

### Established Patterns
- Step apps use vanilla ES modules in `apps/step*/` or `apps/simulation/`, with Vite entries in `src/entries/`.
- The project favors local-first static operation and should continue working without a server.
- Internal financial values must remain in Won; display may convert for readability.
- Phase 07 established that Step redesign work should use calm editorial panels and avoid broad React migration.
- Existing Step 2 has inline styles in `index.html`; Phase 08 can move these into `apps/simulation/styles.css` as part of the redesign if scoped carefully.

### Integration Points
- Step 2 route is `apps/simulation/index.html`, not an `apps/step2/` directory.
- Step 1 data import currently goes through `apps/simulation/modules/step1-connector.js` and `ui-controller.js`; Phase 08 must fix the auto-import/edit/reset behavior at this boundary.
- Data Hub simulation list events are wired through `shared/components/data-hub-modal.js` and Step 2 `feature-controllers.js`; fallback must keep list/load/delete usable.
- Automated verification currently has `tests/step1.spec.ts` only; Phase 08 planning should add Step 2 Playwright coverage rather than overloading Phase 07 tests.

</code_context>

<specifics>
## Specific Ideas

- The first-screen message should follow "choice guide, then numbers": guide the user through the tradeoff before presenting final assets and monthly cash-flow results.
- The user clarified that "growth/index" means a benchmark such as Nasdaq or S&P 500, not a single ticker.
- The comparison set should support index (Nasdaq or S&P 500), SCHD, and covered-call/monthly-income examples JEPI, QQQI, and DIVO.
- Covered-call UI should be especially explicit for early-career users and investing beginners: monthly distributions can come at the cost of upside participation.
- Mobile interaction should be more fun and certain than the current static feel, but through stable micro-interactions rather than random layout movement.
- Root CSV files are known clutter and should be cleaned up or documented as part of Phase 08 data hygiene.

</specifics>

<deferred>
## Deferred Ideas

- Live market data or current ETF yield fetching — future data integration phase.
- Personalized investment advice or suitability profiling — out of scope for this static planning tool.
- Full LocalStorage backup/restore parity with IndexedDB backup services — future storage-hardening phase if needed.
- Broad React migration of Step 2 — future modernization phase unless separately scoped.

</deferred>

---

*Phase: 08-Step 2 Redesign & Re-planning*
*Context gathered: 2026-06-17*
