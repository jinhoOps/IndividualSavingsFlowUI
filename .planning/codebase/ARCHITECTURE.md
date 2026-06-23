<!-- refreshed: 2026-06-23 -->
# Architecture

**Analysis Date:** 2026-06-23

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Vite Multi-Page Frontend                   │
├──────────────────┬──────────────────┬───────────────────────┤
│ Step 1 Main      │ Step 2 Simulation│ Step 3 Portfolio       │
│ `apps/main`      │ `apps/simulation`│ `apps/portfolio`       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│               TypeScript Entry/Compatibility Layer           │
│ `src/entries/*.ts`, `src/core/storage/*`                     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Shared UI, Utility, PWA, and Browser Storage APIs            │
│ `shared/components`, `shared/core`, `shared/pwa`, `shared/storage` │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser Runtime: DOM, LocalStorage, IndexedDB, Service Worker │
│ `public/manifest.webmanifest`, `shared/legacy/sw.js`         │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Vite build shell | Defines base path, PWA manifest, public directory, and HTML page inputs | `vite.config.ts` |
| Step entry bridges | Load shared globals, styles, web components, and the active step app as side effects | `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts` |
| Step 1 app shell | Starts the main household cash-flow app | `apps/main/app.js` |
| Step 1 bootstrap | Creates controllers, binds events, initializes storage/PWA/onboarding, and triggers first render | `apps/main/modules/bootstrap-controller.js` |
| Step 1 state | Holds module-level UI/input state resolved from share hash, view mode, or persisted inputs | `apps/main/modules/state.js` |
| Step 1 render pipeline | Converts state and calculator output into summary cards, tables, Sankey, and network map UI | `apps/main/modules/render-orchestrator.js`, `apps/main/modules/list-renderer.js`, `apps/main/modules/sankey-renderer.js`, `apps/main/modules/network-map-renderer.js` |
| Step 1 persistence | Saves current inputs, backups, share/view state, and pending-bar state | `apps/main/modules/persistence-controller.js` |
| Step 2 app shell | Initializes dividend/strategy simulation, syncs Step 1 data, storage, backup, and PWA | `apps/simulation/app.js` |
| Step 2 controllers | Own simulation persistence, normalization, event binding, strategy selection, and rendering orchestration | `apps/simulation/modules/feature-controllers.js`, `apps/simulation/modules/ui-controller.js` |
| Step 3 app object | Owns portfolio creator/detail workflows, event binding, and top-level rendering | `apps/portfolio/app.js` |
| Step 3 state/DOM helpers | Store portfolio data and render portfolio lists, creator rows, modal rows, and pending bars | `apps/portfolio/modules/state.js`, `apps/portfolio/modules/dom.js` |
| Shared web components | Provide app navigation/status and data-hub modal event surfaces used by all steps | `shared/components/app-header.js`, `shared/components/data-hub-modal.js` |
| Storage bridge | Exposes legacy `window.IsfStorageHub` and `window.IsfBackupManager` APIs through TypeScript IndexedDB services | `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts` |

## Pattern Overview

**Overall:** Vite-served multi-page application with vanilla JavaScript feature modules and a TypeScript compatibility/storage layer.

**Key Characteristics:**
- Each step is a separately addressable HTML page under `apps/*/index.html` and is registered as a Vite Rollup input in `vite.config.ts`.
- Page entry files in `src/entries/*.ts` are side-effect bootstraps; they import shared CSS/components and then import the step's `apps/*/app.js`.
- Runtime application logic uses module-level state objects and controller modules rather than React component state. React dependencies exist in `package.json`, but active page code is DOM/web-component driven.
- Cross-step persistence is browser-only: LocalStorage and IndexedDB are accessed through `window.IsfStorageHub`, `window.IsfHubStorage`, and `window.IsfBackupManager`.
- Shared UI contracts use DOM events from custom elements, especially `open-data-hub`, `select-simulation`, `restore-backup`, `export-json`, and related data-hub events.

## Layers

**HTML Route Layer:**
- Purpose: Defines page markup, semantic regions, DOM ids, and the script entry for each step.
- Location: `apps/main/index.html`, `apps/simulation/index.html`, `apps/portfolio/index.html`, `index.html`
- Contains: Static HTML, app-specific DOM targets, app-header/data-hub custom elements, page-specific module script tags.
- Depends on: Vite module loading and `src/entries/*.ts`.
- Used by: Browser navigation and Playwright tests in `tests/step1.spec.ts`, `tests/step2.spec.ts`.

**Entry/Bootstrap Layer:**
- Purpose: Assemble runtime side effects in the correct order: utilities, storage compatibility, global CSS, shared components, then app module.
- Location: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`
- Contains: Imports for `shared/core/utils.js`, `src/core/storage/CompatibilityBridge`, `src/styles/globals.css`, `shared/styles/step-theme.css`, step CSS, shared components, and step app files.
- Depends on: `shared/*`, `apps/*`, and TypeScript/Vite.
- Used by: Script tags in `apps/main/index.html`, `apps/simulation/index.html`, and `apps/portfolio/index.html`.

**Step Feature Layer:**
- Purpose: Own app-specific state, calculations, event handling, rendering, and persistence.
- Location: `apps/main/modules`, `apps/simulation/modules`, `apps/portfolio/modules`
- Contains: `state.js`, `dom.js`, `calculator.js`, controller modules, renderer modules, and feature-specific connectors.
- Depends on: Shared utilities/components/storage globals and the DOM ids declared by that step's HTML.
- Used by: `apps/main/app.js`, `apps/simulation/app.js`, `apps/portfolio/app.js`.

**Shared Runtime Layer:**
- Purpose: Provide reusable components, utilities, PWA behavior, share/export helpers, and storage contracts.
- Location: `shared/components`, `shared/core`, `shared/pwa`, `shared/storage`, `shared/styles`
- Contains: Custom elements, feedback manager, PWA manager, share utilities, legacy storage hub, backup manager, and shared CSS tokens.
- Depends on: Browser DOM, Custom Elements, LocalStorage, IndexedDB, and Service Worker APIs.
- Used by: All three step entries and app modules.

**Modern Storage Layer:**
- Purpose: Replace legacy global storage APIs while preserving the legacy app call sites.
- Location: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`, `src/core/types`
- Contains: `IsfStore` IndexedDB wrapper, backup service, money/type helpers, and global compatibility registration.
- Depends on: Browser IndexedDB/LocalStorage and TypeScript DOM types.
- Used by: Entry files before legacy app modules execute.

**Generated/Static Asset Layer:**
- Purpose: Provide PWA assets and offline/static market data.
- Location: `public/manifest.webmanifest`, `public/icons`, `public/data/indices`
- Contains: PWA manifest, icons, and static JSON index data.
- Depends on: Vite `publicDir`.
- Used by: PWA plugin config in `vite.config.ts`, app HTML metadata, simulation/index data workflows.

## Data Flow

### Primary Step 1 Household Flow

1. Browser loads `apps/main/index.html:13`, which imports `src/entries/step1.ts`.
2. `src/entries/step1.ts` imports `src/core/storage/CompatibilityBridge.ts`, shared styles/components, then `apps/main/app.js`.
3. `apps/main/app.js:1` imports `startStep1App`, then `apps/main/app.js:3` invokes it.
4. `apps/main/modules/bootstrap-controller.js:32` waits for DOM readiness and calls `init` at `apps/main/modules/bootstrap-controller.js:40`.
5. `apps/main/modules/bootstrap-controller.js:60` creates render, persistence, visualization, and item-editor controllers.
6. Initial inputs resolve in `apps/main/modules/state.js:28` from URL/share state or persisted data, using `apps/main/modules/input-sanitizer.js` and `apps/main/modules/storage-manager.js`.
7. Events are bound through `apps/main/modules/event-bindings.js`, UI flags are synced through `apps/main/modules/ui-controller.js`, and `controllers.render.renderAll()` runs from `apps/main/modules/bootstrap-controller.js:50`.
8. Render orchestration computes cards/projection/Sankey/network output through `apps/main/modules/calculator.js`, `apps/main/modules/financial-summary.js`, `apps/main/modules/sankey-builder.js`, and renderer modules.

### Step 2 Simulation Flow

1. Browser loads `apps/simulation/index.html:12`, which imports `src/entries/step2.ts`.
2. `src/entries/step2.ts` loads shared runtime modules and then imports `apps/simulation/app.js`.
3. `apps/simulation/app.js:24` initializes DOM, restores session/hash data, creates or normalizes `state.draft`, and calls `uiController.init()` at `apps/simulation/app.js:61`.
4. `apps/simulation/app.js:62` performs the first full render through `uiController.updateAll()`.
5. `apps/simulation/app.js:66` checks Step 1 synchronization through `apps/simulation/modules/step1-connector.js`.
6. `apps/simulation/modules/ui-controller.js` handles input, strategy, modal, data-hub, JSON import/export, and chart rerender events.
7. `apps/simulation/modules/feature-controllers.js` normalizes, saves, loads, deletes, backs up, and exports simulations through storage hub APIs.

### Step 3 Portfolio Flow

1. Browser loads `apps/portfolio/index.html:198`, which imports `src/entries/step3.ts`.
2. `src/entries/step3.ts` loads shared runtime modules and then imports `apps/portfolio/app.js`.
3. `apps/portfolio/app.js:276` waits for `DOMContentLoaded` and calls `App.init()`.
4. `apps/portfolio/app.js:18` creates `IsfState`, loads persisted portfolios from `apps/portfolio/modules/state.js`, binds events, and calls `App.render()`.
5. `apps/portfolio/app.js:32` binds creator, modal, validation, pending-bar, save, and delete handlers.
6. `apps/portfolio/app.js:207` renders portfolio cards and creator rows through `apps/portfolio/modules/dom.js`, using calculations from `apps/portfolio/modules/calculator.js`.
7. `apps/portfolio/modules/state.js` persists portfolio data to LocalStorage through `shared/storage/hub-storage.js` compatibility APIs.

### Shared Storage and Backup Flow

1. Every page entry imports `src/core/storage/CompatibilityBridge.ts` before importing the legacy app module.
2. `src/core/storage/CompatibilityBridge.ts:10` registers browser globals.
3. `src/core/storage/CompatibilityBridge.ts:92` assigns `target.IsfStorageHub` and `target.IsfHubStorage`.
4. `src/core/storage/CompatibilityBridge.ts:96` assigns `target.IsfBackupManager`.
5. `src/core/storage/IsfStore.ts:12` manages IndexedDB database `isf-v2-db` with stores for Step 1 history, Step 2 simulations, and backups.
6. `src/core/storage/BackupService.ts` writes backup entries through the `IsfStore.perform` transaction helper.

**State Management:**
- Step 1 uses a singleton `state` object in `apps/main/modules/state.js`.
- Step 2 uses a singleton `state` object and draft helpers in `apps/simulation/modules/state.js`.
- Step 3 uses an `IsfState` class instance created by `apps/portfolio/app.js`.
- Shared persistent state is stored in LocalStorage and IndexedDB via global compatibility APIs.

## Key Abstractions

**Step Controllers:**
- Purpose: Keep top-level app flows out of low-level render/calculation modules.
- Examples: `apps/main/modules/bootstrap-controller.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/visualization-controller.js`, `apps/simulation/modules/feature-controllers.js`, `apps/simulation/modules/ui-controller.js`
- Pattern: Factory functions or exported controller objects that receive callbacks and operate over module-level state.

**DOM Registry Modules:**
- Purpose: Centralize `document.getElementById` lookups for a step.
- Examples: `apps/main/modules/dom.js`, `apps/simulation/modules/dom.js`, `apps/portfolio/modules/dom.js`
- Pattern: Export a `dom`/`IsfDom.nodes` object and use it from controllers/renderers.

**Renderers:**
- Purpose: Convert computed data into DOM/SVG fragments.
- Examples: `apps/main/modules/list-renderer.js`, `apps/main/modules/sankey-renderer.js`, `apps/main/modules/network-map-renderer.js`, `apps/simulation/modules/renderers.js`, `apps/portfolio/modules/dom.js`
- Pattern: Stateless or state-adjacent functions called by controllers after state changes.

**Calculators and Builders:**
- Purpose: Keep finance calculations and graph construction separate from event handling.
- Examples: `apps/main/modules/calculator.js`, `apps/main/modules/household-budget.js`, `apps/main/modules/sankey-builder.js`, `apps/simulation/modules/calculator.js`, `apps/simulation/modules/comparison-calculator.js`, `apps/portfolio/modules/calculator.js`
- Pattern: Functions/classes that accept plain data and return derived records for renderers.

**Global Compatibility APIs:**
- Purpose: Preserve legacy vanilla JS callers while moving implementation to TypeScript services.
- Examples: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`
- Pattern: Entry-time registration of `window.IsfStorageHub`, `window.IsfHubStorage`, and `window.IsfBackupManager`.

**Custom Elements:**
- Purpose: Provide reusable navigation/status and data management UI across steps.
- Examples: `shared/components/app-header.js`, `shared/components/data-hub-modal.js`
- Pattern: Web Components emit custom DOM events consumed by app controllers.

## Entry Points

**Root Redirect/Shell:**
- Location: `index.html`
- Triggers: Browser navigation to `/IndividualSavingsFlowUI/`
- Responsibilities: Root landing/redirect shell for the multi-page app.

**Step 1 Main:**
- Location: `apps/main/index.html`, `src/entries/step1.ts`, `apps/main/app.js`
- Triggers: Browser navigation to `/apps/main/index.html`
- Responsibilities: Household cash-flow input, Sankey/network visualization, snapshots, sharing, backups, and Step 1 to Step 2 handoff.

**Step 2 Simulation:**
- Location: `apps/simulation/index.html`, `src/entries/step2.ts`, `apps/simulation/app.js`
- Triggers: Browser navigation to `/apps/simulation/index.html`
- Responsibilities: Dividend/growth/covered-call strategy comparison, Step 1 data import, simulation storage, sharing, and backups.

**Step 3 Portfolio:**
- Location: `apps/portfolio/index.html`, `src/entries/step3.ts`, `apps/portfolio/app.js`
- Triggers: Browser navigation to `/apps/portfolio/index.html`
- Responsibilities: Accumulative portfolio creation, allocation validation, portfolio list/detail modals, and LocalStorage persistence.

**PWA/Offline Runtime:**
- Location: `vite.config.ts`, `public/manifest.webmanifest`, `shared/legacy/sw.js`, `shared/pwa/pwa-manager.js`
- Triggers: Vite PWA plugin and page-level PWA manager initialization.
- Responsibilities: Manifest generation, service worker behavior, version checks, and update feedback.

## Architectural Constraints

- **Threading:** Browser single-threaded event loop; no Web Workers are detected in active app code.
- **Global state:** Runtime depends on module-level singletons in `apps/main/modules/state.js` and `apps/simulation/modules/state.js`, plus browser globals registered by `src/core/storage/CompatibilityBridge.ts` and `shared/core/utils.js`.
- **DOM contracts:** App modules assume specific ids/classes declared in each `apps/*/index.html`; changing markup requires updating the matching `apps/*/modules/dom.js`.
- **Storage compatibility:** Legacy modules call `window.IsfStorageHub`, `window.IsfHubStorage`, `window.IsfBackupManager`, `window.IsfShare`, `window.IsfFeedback`, and `window.IsfPwaManager`; entry files must import shared/bridge modules before app modules.
- **Routing:** There is no client-side router. New pages must be added as separate HTML inputs in `vite.config.ts`.
- **Circular imports:** No circular dependency chain is documented here; verify with CodeGraph before reorganizing `apps/main/modules` because controllers share callbacks and singleton state.

## Anti-Patterns

### Bypassing Entry Files

**What happens:** Importing `apps/*/app.js` directly can execute app code before compatibility globals and shared custom elements are registered.
**Why it's wrong:** App modules expect `window.IsfStorageHub`, `window.IsfShare`, `window.IsfFeedback`, `app-header`, and `data-hub-modal` to exist.
**Do this instead:** Add shared setup in `src/entries/step1.ts`, `src/entries/step2.ts`, or `src/entries/step3.ts`, then import the step app last.

### Scattering DOM Queries

**What happens:** New feature modules directly query page DOM instead of using the step's DOM registry.
**Why it's wrong:** The app already centralizes ids in `apps/main/modules/dom.js`, `apps/simulation/modules/dom.js`, and `apps/portfolio/modules/dom.js`; scattering queries makes markup refactors brittle.
**Do this instead:** Add DOM handles to the matching `dom.js` module and consume those handles from controllers/renderers.

### Writing Storage Directly From Feature Code

**What happens:** Feature code writes raw LocalStorage/IndexedDB keys instead of using storage hub or state helpers.
**Why it's wrong:** Backup, migration, and compatibility behavior lives in `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, and `src/core/storage/BackupService.ts`.
**Do this instead:** Use `window.IsfStorageHub`/`window.IsfHubStorage` in legacy modules, or add typed service methods in `src/core/storage`.

## Error Handling

**Strategy:** Browser-first defensive handling with `try/catch`, console logging, user feedback through `window.IsfFeedback`, and graceful fallback to local/session state where available.

**Patterns:**
- Step app bootstraps catch critical initialization failures and log them, as in `apps/simulation/app.js`.
- Storage operations return null/false or fallback data where possible, as in `shared/storage/hub-storage.js` and `shared/storage/backup-manager.js`.
- User-visible failures should route through feedback/status UI in `shared/components/app-header.js`, `shared/components/feedback-manager.js`, or step-specific feedback elements.
- Confirmation flows use browser `confirm`/`alert` in existing controllers; match that pattern for narrow edits unless replacing an entire workflow.

## Cross-Cutting Concerns

**Logging:** Console logging is used directly in `apps/simulation/app.js`, `apps/portfolio/app.js`, `shared/storage/hub-storage.js`, and storage bridge services. There is no central logger.

**Validation:** Input normalization is mostly local to feature modules: `apps/main/modules/input-sanitizer.js`, `apps/simulation/modules/feature-controllers.js`, and `apps/portfolio/modules/calculator.js`.

**Authentication:** Not applicable; the app is a client-side personal finance UI with browser-local data.

**Persistence:** Use storage hub compatibility APIs exposed by `src/core/storage/CompatibilityBridge.ts`; avoid introducing separate persistence paths.

**Styling:** Shared tokens/components live in `shared/styles/step-theme.css` and `src/styles/globals.css`; step-specific overrides live in each `apps/*/styles.css`.

---

*Architecture analysis: 2026-06-23*
