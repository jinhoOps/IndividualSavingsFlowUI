<!-- refreshed: 2026-06-29 -->
# Architecture

**Analysis Date:** 2026-06-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              Vite multi-page browser application             │
│  `index.html`, `apps/main/index.html`, `apps/simulation/index.html`,
│  `apps/portfolio/index.html`, `vite.config.ts`               │
└───────────────┬────────────────────┬────────────────────────┘
                │                    │
                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript entry layer                    │
│  `src/entries/step1.ts`  `src/entries/step2.ts`              │
│  `src/entries/step3.ts`                                      │
└───────────────┬────────────────────┬────────────────────────┘
                │                    │
                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│         Shared globals, storage bridge, Web Components        │
│  `shared/core/utils.js`, `shared/core/share-utils.js`,        │
│  `src/core/storage/CompatibilityBridge.ts`,                  │
│  `shared/components/app-header.js`,                          │
│  `shared/components/data-hub-modal.js`                       │
└───────────────┬────────────────────┬────────────────────────┘
                │                    │
                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Step applications                       │
├──────────────────┬──────────────────┬───────────────────────┤
│ Step 1 Main      │ Step 2 Simulation │ Step 3 Portfolio      │
│ `apps/main/*`    │ `apps/simulation/*`│ `apps/portfolio/*`   │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Browser persistence and share surfaces           │
│  `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`,
│  `localStorage`, `IndexedDB`, URL hash payloads, JSON export  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root redirect | Sends bare-root visits into the Main app while preserving query/hash state. | `index.html` |
| Vite app shell | Defines the GitHub Pages base path, PWA plugin, public assets, and multi-page Rollup inputs. | `vite.config.ts` |
| Step 1 entry | Loads shared globals, the compatibility bridge, common styles, Step 1 styles, shared Web Components, and the Main app. | `src/entries/step1.ts` |
| Step 2 entry | Loads shared globals, the compatibility bridge, common styles, Step 2 styles, shared Web Components, and the Simulation app. | `src/entries/step2.ts` |
| Step 3 entry | Loads shared globals, the compatibility bridge, common styles, Step 3 styles, shared Web Components, and the Portfolio app. | `src/entries/step3.ts` |
| Compatibility bridge | Exposes legacy `window.IsfStorageHub`, `window.IsfHubStorage`, and `window.IsfBackupManager` APIs over TypeScript storage services. | `src/core/storage/CompatibilityBridge.ts` |
| Modern store | Owns IndexedDB database `isf-v2-db`, Step 1 history, Step 2 simulations, backup object stores, and active Step 1 localStorage state. | `src/core/storage/IsfStore.ts` |
| Main bootstrap | Creates controllers, binds Step 1 events, syncs initial UI, renders, initializes backups, PWA, onboarding, and share-id loading. | `apps/main/modules/bootstrap-controller.js` |
| Main state | Holds module-level mutable Step 1 UI/data state and resolves initial inputs from hash/share/local persistence. | `apps/main/modules/state.js` |
| Main persistence | Commits sanitized inputs, auto-saves, imports/exports JSON, handles ISF codes, restores backups, and handles view mode. | `apps/main/modules/persistence-controller.js` |
| Main renderer | Computes monthly snapshots/projections, renders summary cards, Sankey/network views, transfer lists, projection tables, and the inputs panel. | `apps/main/modules/render-orchestrator.js` |
| Main event bindings | Wires DOM controls to persistence, rendering, visualization, presets, financial modal, snapshots, and global browser events. | `apps/main/modules/event-bindings.js` |
| Financial detail modal | Primary Step 1 editor for income, accounts, expenses, savings, investments, integrated outflow edits, validation, and pending-save UI. | `apps/main/modules/financial-modal-controller.js` |
| Main calculations | Builds monthly snapshots, savings/invest buckets, projection records, summary cards, and financial-income warnings. | `apps/main/modules/calculator.js` |
| Main sanitization | Migrates older input models to won units, normalizes item arrays, repairs account connections, validates maturity/month/rate fields, and derives totals. | `apps/main/modules/input-sanitizer.js` |
| Portfolio app | Runs the Step 3 portfolio manager as an object-style state/helpers/UI application. | `apps/portfolio/app.js` |
| Simulation app | Initializes Step 2 draft state, restores session/hash data, syncs Step 1 data, initializes UI/controllers/PWA/backups. | `apps/simulation/app.js` |
| Shared app header | Provides step navigation, status display, data hub event dispatch, tutorial dispatch, and financial-income warning surface. | `shared/components/app-header.js` |
| Shared share utils | Builds/parses compressed URL-hash payloads, view mode flags, share IDs, and JSON export/import envelopes. | `shared/core/share-utils.js` |
| Shared PWA manager | Registers service worker, checks app version, handles install/update lifecycle feedback, and triggers pre-update backups. | `shared/pwa/pwa-manager.js` |

## Pattern Overview

**Overall:** Multi-page Vite shell around legacy vanilla JavaScript applications with a TypeScript storage compatibility layer.

**Key Characteristics:**
- Use `apps/*/index.html` as page shells and `src/entries/*.ts` as bundler entry points.
- Keep page-specific application logic under `apps/main/modules/`, `apps/simulation/modules/`, and `apps/portfolio/modules/`.
- Share cross-step browser globals, Web Components, PWA behavior, storage, and share/import/export utilities from `shared/` and `src/core/`.
- Main Step 1 is controller-oriented: a module-level `state` object is read/written by controllers, then `renderAll()` recomputes derived views.
- Step 2 and Step 3 keep older object/module patterns; extend them locally unless code is genuinely cross-step.

## Layers

**Page Shell Layer:**
- Purpose: Provide HTML routes, static DOM anchors, metadata, and page-specific module entry tags.
- Location: `index.html`, `apps/main/index.html`, `apps/simulation/index.html`, `apps/portfolio/index.html`
- Contains: Root redirect, `<app-header>`, `<data-hub-modal>`, page panels, forms, modals, SVG containers, table bodies, and script tags.
- Depends on: Bundled entry modules from `src/entries/*.ts`.
- Used by: Vite Rollup inputs in `vite.config.ts`.

**Entry and Boot Layer:**
- Purpose: Load global dependencies in the required order and start each step app.
- Location: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`
- Contains: Side-effect imports for utilities, storage bridge, global/shared CSS, page CSS, Web Components, PWA/share/feedback globals, and app modules.
- Depends on: `shared/core/utils.js`, `src/core/storage/CompatibilityBridge.ts`, `shared/components/*`, `apps/*/app.js`.
- Used by: `apps/*/index.html`.

**Shared Browser Services Layer:**
- Purpose: Provide cross-app services and custom elements through ES modules and `window.*` compatibility APIs.
- Location: `shared/core/`, `shared/components/`, `shared/pwa/`, `src/core/storage/`
- Contains: `IsfUtils`, `IsfShare`, `IsfPwaManager`, `AppHeader`, `DataHubModal`, `IsfStore`, `BackupService`, compatibility globals.
- Depends on: Browser APIs: DOM, `localStorage`, `IndexedDB`, service workers, `fetch`, URL/hash APIs.
- Used by: All three app entries and app modules.

**Step 1 Main Application Layer:**
- Purpose: Household cash-flow input, financial detail editing, Sankey/network visualization, projections, presets, snapshots, and data hub operations.
- Location: `apps/main/app.js`, `apps/main/modules/`
- Contains: Bootstrap, state, constants, DOM references, controllers, renderers, calculators, sanitizer, storage manager, visualization builders.
- Depends on: Shared globals (`window.IsfUtils`, `window.IsfShare`, `window.IsfStorageHub`, `window.IsfBackupManager`, `window.IsfPwaManager`), DOM anchors from `apps/main/index.html`.
- Used by: `src/entries/step1.ts` and Playwright specs under `tests/`.

**Step 2 Simulation Application Layer:**
- Purpose: Dividend/investment simulation draft editing, Step 1 data sync, saved simulation listing, backup/PWA integration, and rendering.
- Location: `apps/simulation/app.js`, `apps/simulation/modules/`
- Contains: Draft state, feature controller, UI controller, calculators, assumptions, renderers, Step 1 connector, storage fallback.
- Depends on: Shared globals and storage bridge; Step 1 latest data through `getHubStorage()`/`IsfStorageHub`.
- Used by: `src/entries/step2.ts`.

**Step 3 Portfolio Application Layer:**
- Purpose: Accumulative portfolio creation, editing, allocation ratio calculation, chart/list rendering, and portfolio persistence.
- Location: `apps/portfolio/app.js`, `apps/portfolio/modules/`
- Contains: Object-style app orchestration, portfolio state class, DOM helper module, calculator, chart builder, snapshot manager, Step 1 connector.
- Depends on: Shared globals and storage bridge; Step 1 latest investment capacity through `apps/portfolio/modules/step1-connector.js`.
- Used by: `src/entries/step3.ts`.

**Persistence Layer:**
- Purpose: Store active state, history, backups, Step 1 snapshots, Step 2/portfolio entries, share payloads, and import/export files.
- Location: `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`, `src/core/storage/CompatibilityBridge.ts`, `shared/core/share-utils.js`, `shared/storage/hub-storage.js`, `shared/storage/backup-manager.js`
- Contains: IndexedDB stores, localStorage active state, backup list operations, compatibility aliases, URL-hash compression, JSON envelope import/export.
- Depends on: Browser `indexedDB`, `localStorage`, Blob/download APIs.
- Used by: Main persistence controller, Simulation app/controllers, Portfolio state/snapshot modules, PWA manager.

## Data Flow

### Primary Step 1 Request Path

1. Browser loads `apps/main/index.html`, which imports `src/entries/step1.ts` (`apps/main/index.html:14`).
2. `src/entries/step1.ts` loads shared globals/components and imports `apps/main/app.js` (`src/entries/step1.ts:1`).
3. `apps/main/app.js` calls `startStep1App()` (`apps/main/app.js:1`).
4. `startStep1App()` waits for `DOMContentLoaded`, then `bootstrap-controller.js` creates render, persistence, and visualization controllers (`apps/main/modules/bootstrap-controller.js:31`, `apps/main/modules/bootstrap-controller.js:59`).
5. `state.inputs` is initialized from URL hash/share/view mode or local persisted inputs in `apps/main/modules/state.js:12`.
6. `bindStep1Events()` connects form/modal/visualization/data-hub controls to controllers (`apps/main/modules/event-bindings.js:71`).
7. `renderAll()` builds a monthly snapshot, simulates projection data, renders summaries, Sankey/network maps, transfer lists, projection table, input hints, and panels (`apps/main/modules/render-orchestrator.js:33`).
8. On edits, handlers sanitize inputs and call `persistPrimaryState()` or `commitImmediateInputs()` (`apps/main/modules/event-bindings.js:102`, `apps/main/modules/persistence-controller.js:33`, `apps/main/modules/persistence-controller.js:53`).
9. Storage calls flow through `window.IsfStorageHub`, which is provided by `src/core/storage/CompatibilityBridge.ts:20` and backed by `src/core/storage/IsfStore.ts:12`.

### Financial Detail Edit Flow

1. Step 1 controls dispatch or handle an `open-financial-modal` path from `apps/main/modules/event-bindings.js:97`.
2. `createFinancialModalController()` keeps `baselineInputs`, category-specific draft items, outflow draft state, validation errors, and pending-bar state (`apps/main/modules/financial-modal-controller.js:242`).
3. Draft rows are cloned from visible inputs via category helpers and validated with `validateItems()`/`findFirstValidationError()` (`apps/main/modules/financial-modal-controller.js:191`, `apps/main/modules/financial-modal-controller.js:205`).
4. Candidate inputs are assembled with `setItemsForCategory()` and `withIncomeSplitFlag()` (`apps/main/modules/financial-modal-controller.js:196`, `apps/main/modules/financial-modal-controller.js:489`).
5. Saving routes through the passed persistence controller, which sanitizes, persists, and re-renders (`apps/main/modules/persistence-controller.js:53`).

### Step 1 Rendering Flow

1. `renderAll()` reads visible inputs from `helpers.getVisibleInputs(state)` (`apps/main/modules/render-orchestrator.js:29`).
2. `buildMonthlySnapshot()` converts normalized inputs into income/outflow breakdowns and net cash-flow targets (`apps/main/modules/calculator.js:26`).
3. `simulateProjection()` builds month-by-month financial projections from balances, rates, maturity months, savings/invest buckets, debt, and surplus transfer rules (`apps/main/modules/calculator.js:192`).
4. `buildSankeyData()` and `renderSankey()` draw the cash-flow visualization (`apps/main/modules/render-orchestrator.js:62`).
5. `renderNetworkMap()` renders account-level network data from Sankey nodes and transfers (`apps/main/modules/render-orchestrator.js:69`).
6. `refreshInputsPanel()` applies normalized inputs to the form and re-renders item lists (`apps/main/modules/ui-controller.js:97`).

### Step 2 Step 1 Sync Flow

1. `apps/simulation/app.js` initializes state/draft, restores session/hash data, then calls `checkStep1SyncData()` (`apps/simulation/app.js:24`, `apps/simulation/app.js:65`).
2. `checkStep1SyncData()` resolves the latest Step 1 snapshot from the storage bridge or local Step 1 key (`apps/simulation/modules/step1-connector.js:83`, `apps/simulation/modules/step1-connector.js:138`).
3. The connector maps Step 1 `startInvest`, `monthlyInvest`, and `horizonYears` into simulation draft fields (`apps/simulation/modules/step1-connector.js:25`, `apps/simulation/modules/step1-connector.js:53`).
4. Imported values mark the draft dirty and trigger `renderDraft()` (`apps/simulation/modules/step1-connector.js:175`).

### Step 3 Portfolio Flow

1. Browser loads `apps/portfolio/index.html`, which imports `src/entries/step3.ts`; that entry imports `apps/portfolio/app.js` (`src/entries/step3.ts:16`).
2. `App.init()` creates `IsfState`, loads persisted portfolio state, binds DOM handlers, and renders (`apps/portfolio/app.js:18`).
3. Creator input changes mutate the active creator through state methods and update only the creator UI (`apps/portfolio/app.js:45`, `apps/portfolio/app.js:259`).
4. Saving validates name/assets, calculates total and ratios with `IsfCalculator`, opens a confirmation modal, then persists via `state.addPortfolio()` (`apps/portfolio/app.js:79`, `apps/portfolio/app.js:188`).
5. Portfolio Step 1 handoff data is available through `Step1Connector.fetchLatestSnapshot()` (`apps/portfolio/modules/step1-connector.js:12`).

**State Management:**
- Step 1 uses exported module-level mutable state in `apps/main/modules/state.js`; helper functions in `apps/main/modules/state-helpers.js` mutate or derive form state.
- Step 2 uses exported singleton-style state from `apps/simulation/modules/state.js`.
- Step 3 creates an `IsfState` instance in `apps/portfolio/app.js` and stores it on the `App` object.
- Cross-app persisted state flows through `window.IsfStorageHub` and `window.IsfBackupManager` aliases created by `src/core/storage/CompatibilityBridge.ts`.

## Key Abstractions

**Step Entries:**
- Purpose: Bundle-order control for legacy global dependencies, styles, Web Components, and app modules.
- Examples: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`
- Pattern: Side-effect imports first, then page app import.

**Compatibility Globals:**
- Purpose: Let legacy JavaScript modules continue calling `window.IsfStorageHub`, `window.IsfHubStorage`, `window.IsfBackupManager`, and `window.IsfUtils`.
- Examples: `src/core/storage/CompatibilityBridge.ts`, `shared/core/utils.js`, `shared/core/share-utils.js`
- Pattern: Browser global facade over typed storage/services.

**DOM Registry:**
- Purpose: Centralize static DOM lookups for Step 1 controllers and renderers.
- Examples: `apps/main/modules/dom.js`
- Pattern: Export one `dom` object with named element handles and computed getters for late-rendered custom element internals.

**Controller Factories:**
- Purpose: Encapsulate Step 1 behavior around injected collaborators and return command objects.
- Examples: `apps/main/modules/persistence-controller.js`, `apps/main/modules/render-orchestrator.js`, `apps/main/modules/visualization-controller.js`, `apps/main/modules/preset-setup-controller.js`, `apps/main/modules/financial-modal-controller.js`
- Pattern: `createXController({ dependencies })` returns methods used by bootstrap/event bindings.

**Sanitized Input Model:**
- Purpose: Keep Step 1 inputs model-versioned, in won units, bounded, complete, and account-connected before calculation/rendering.
- Examples: `apps/main/modules/input-sanitizer.js`, `apps/main/modules/constants.js`, `src/core/types/models.ts`
- Pattern: Clone/migrate/sanitize input data before persistence or render.

**Calculation Builders:**
- Purpose: Convert input state into render-ready snapshots, projections, Sankey/network data, summaries, and portfolio allocation metrics.
- Examples: `apps/main/modules/calculator.js`, `apps/main/modules/sankey-builder.js`, `apps/main/modules/financial-summary.js`, `apps/portfolio/modules/calculator.js`, `apps/simulation/modules/calculator.js`
- Pattern: Pure or mostly pure functions that return plain data structures for renderers.

**Shared Web Components:**
- Purpose: Reuse app chrome and data-management modal across step pages.
- Examples: `shared/components/app-header.js`, `shared/components/data-hub-modal.js`
- Pattern: Custom elements that dispatch semantic events consumed by app controllers.

## Entry Points

**Root Redirect:**
- Location: `index.html`
- Triggers: Browser navigation to repo root path.
- Responsibilities: Preserve query/hash and redirect to `./apps/main/`.

**Main App Page:**
- Location: `apps/main/index.html`
- Triggers: Browser navigation to `/apps/main/`.
- Responsibilities: Provide Step 1 DOM, import `src/entries/step1.ts`, host app header/data hub and all Main UI anchors.

**Step 1 Bundled Entry:**
- Location: `src/entries/step1.ts`
- Triggers: `<script type="module">` in `apps/main/index.html`.
- Responsibilities: Load shared globals/styles/components and start `apps/main/app.js`.

**Step 1 Runtime Start:**
- Location: `apps/main/app.js`
- Triggers: Module import from `src/entries/step1.ts`.
- Responsibilities: Call `startStep1App()`.

**Step 1 Bootstrap:**
- Location: `apps/main/modules/bootstrap-controller.js`
- Triggers: `DOMContentLoaded` or immediate init when document is ready.
- Responsibilities: Create controllers, bind events, sync UI, render all, initialize storage/PWA/onboarding/share flows.

**Simulation App Page and Entry:**
- Location: `apps/simulation/index.html`, `src/entries/step2.ts`, `apps/simulation/app.js`
- Triggers: Browser navigation to `/apps/simulation/`.
- Responsibilities: Initialize Step 2 draft simulation, restore session/hash state, load saved rows, sync Step 1 data, render UI.

**Portfolio App Page and Entry:**
- Location: `apps/portfolio/index.html`, `src/entries/step3.ts`, `apps/portfolio/app.js`
- Triggers: Browser navigation to `/apps/portfolio/`.
- Responsibilities: Initialize portfolio manager state, bind creator/detail modal events, render and persist portfolios.

**Build Entry Configuration:**
- Location: `vite.config.ts`
- Triggers: `npm run build` or `vite build`.
- Responsibilities: Register root, Main, Simulation, and Portfolio HTML files as Rollup inputs and configure PWA output.

## Architectural Constraints

- **Threading:** Single-threaded browser event loop; no Web Workers are used in application code.
- **Global state:** Step apps depend on `window.IsfUtils`, `window.IsfShare`, `window.IsfStorageHub`, `window.IsfBackupManager`, `window.IsfPwaManager`, `customElements`, `localStorage`, and `indexedDB`; initialize through `src/entries/*.ts` before app modules.
- **Module state:** Step 1 exports mutable `state` from `apps/main/modules/state.js`; do not create competing Step 1 state stores.
- **Circular imports:** Not detected in reviewed architecture paths; controllers coordinate through bootstrap-injected command objects rather than direct mutual imports.
- **DOM coupling:** Step 1 modules assume IDs/classes from `apps/main/index.html` match keys in `apps/main/modules/dom.js`.
- **Routing:** There is no client router; each step is a separate HTML page and app launcher links use relative `../main/`, `../simulation/`, and `../portfolio/` paths.
- **Persistence compatibility:** Legacy shared storage files exist under `shared/storage/`, but current bundled entries install the TypeScript compatibility bridge from `src/core/storage/CompatibilityBridge.ts`.
- **Deployment base:** All routes and PWA scope assume `/IndividualSavingsFlowUI/` from `vite.config.ts`.
- **Decision constraints:** `docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md` makes the Step 1 financial detail modal the only primary financial editor. `docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md` is marked superseded and must not be used to remove restored Step 1 account-flow requirements.

## Anti-Patterns

### Bypassing Entry Initialization

**What happens:** Importing `apps/main/app.js`, `apps/simulation/app.js`, or `apps/portfolio/app.js` directly without the corresponding `src/entries/*.ts` skips required shared globals and styles.
**Why it's wrong:** App modules expect `window.IsfUtils`, storage bridge APIs, PWA/share utilities, custom elements, and shared CSS to exist before runtime code executes.
**Do this instead:** Add page boot logic through `src/entries/step1.ts`, `src/entries/step2.ts`, or `src/entries/step3.ts`.

### Editing Step 1 Data Without Sanitization

**What happens:** Mutating `state.inputs` or persisted data with raw imported/form values bypasses model migration, account repair, bounds, derived totals, and won-unit normalization.
**Why it's wrong:** Calculators/renderers assume sanitized `modelVersion: 10` inputs with valid accounts, item arrays, rates, maturity months, and monthly totals.
**Do this instead:** Route new data through `sanitizeInputs()` in `apps/main/modules/input-sanitizer.js` or through persistence methods in `apps/main/modules/persistence-controller.js`.

### Creating Another Step 1 Primary Editor

**What happens:** Adding a second editor surface for ordinary income/expense/savings/investment edits outside the financial detail modal.
**Why it's wrong:** `docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md` defines the financial detail modal as the target editing surface.
**Do this instead:** Extend `apps/main/modules/financial-modal-controller.js` and the matching modal DOM in `apps/main/index.html`.

### Writing Storage Against Old Shared Hub Directly

**What happens:** New code imports `shared/storage/hub-storage.js` or `shared/storage/backup-manager.js` as the primary storage implementation.
**Why it's wrong:** The current entries install `src/core/storage/CompatibilityBridge.ts`, which redirects legacy global calls to `src/core/storage/IsfStore.ts` and `src/core/storage/BackupService.ts`.
**Do this instead:** Use `window.IsfStorageHub`/`window.IsfBackupManager` from legacy modules or typed services under `src/core/storage/` from TypeScript modules.

## Error Handling

**Strategy:** Browser-first defensive handling with try/catch around storage, import/hash parsing, PWA, and async initialization; user-visible feedback uses `window.IsfFeedback`, status indicators, modal errors, banners, or `alert()` in older Step 3 flows.

**Patterns:**
- Storage save failures update the header status to error in `apps/main/modules/persistence-controller.js`.
- JSON and ISF-code import failures show feedback and do not mutate state in `apps/main/modules/persistence-controller.js`.
- Hash parsing failures in Step 2 are caught during `initApp()` in `apps/simulation/app.js`.
- Step 1 modal validation returns localized row/category messages before saving in `apps/main/modules/financial-modal-controller.js`.
- IndexedDB methods in `src/core/storage/IsfStore.ts` reject on open/transaction errors; compatibility callers catch or surface errors where needed.

## Cross-Cutting Concerns

**Logging:** Use `console.log`, `console.warn`, and `console.error` for initialization, storage migration, PWA, and connector failures in `apps/portfolio/app.js`, `apps/simulation/app.js`, `shared/pwa/pwa-manager.js`, and `src/core/storage/CompatibilityBridge.ts`.

**Validation:** Step 1 input validation/sanitization belongs in `apps/main/modules/input-sanitizer.js`; modal-level row validation belongs in `apps/main/modules/financial-modal-controller.js`; portfolio validation belongs in `apps/portfolio/app.js` and `apps/portfolio/modules/calculator.js`; TypeScript data shapes are in `src/core/types/models.ts`.

**Authentication:** Not applicable; this is a local browser app with local/share-code data flows and no user identity provider.

**Persistence:** Use `src/core/storage/IsfStore.ts` and `src/core/storage/BackupService.ts` through the compatibility bridge for active data, histories, simulations/portfolios, and backups. URL hash and JSON exchange use `shared/core/share-utils.js`.

**Styling:** Global design tokens live in `src/styles/globals.css` and `shared/styles/step-theme.css`; page-specific styling lives in `apps/main/styles.css`, `apps/simulation/styles.css`, and `apps/portfolio/styles.css`.

---

*Architecture analysis: 2026-06-29*
