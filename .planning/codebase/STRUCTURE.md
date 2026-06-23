# Codebase Structure

**Analysis Date:** 2026-06-23

## Directory Layout

```text
IndividualSavingsFlowUI/
├── apps/                    # Active multi-page application pages and vanilla JS feature modules
│   ├── main/                # Step 1 household cash-flow app
│   ├── simulation/          # Step 2 dividend/strategy simulation app
│   └── portfolio/           # Step 3 accumulative portfolio app
├── shared/                  # Runtime modules shared by all steps
│   ├── components/          # Custom elements and shared UI managers
│   ├── core/                # Global utility and share/clipboard helpers
│   ├── legacy/              # Legacy service worker file
│   ├── pwa/                 # PWA manager
│   ├── storage/             # Legacy JS storage/backup globals
│   └── styles/              # Shared step theme CSS
├── src/                     # TypeScript entry and modernized core layer
│   ├── components/          # React-oriented common components
│   ├── core/                # Typed storage and model/money helpers
│   ├── entries/             # Vite page entry bridges
│   └── styles/              # Global CSS imported by page entries
├── public/                  # Vite public assets, manifest, icons, static index data
├── tests/                   # Playwright end-to-end tests
├── scripts/                 # Version sync and data generation scripts
├── .github/workflows/       # GitHub Actions deployment workflow
├── .planning/               # GSD planning/codebase documents
├── index.html               # Root page
├── vite.config.ts           # Vite, PWA, and Rollup multi-page config
├── playwright.config.ts     # E2E test runner config
├── tsconfig.json            # TypeScript config for src/apps/shared
├── package.json             # npm scripts and dependencies
└── package-lock.json        # npm lockfile
```

## Directory Purposes

**`apps/`:**
- Purpose: Contains the active user-facing step pages and their page-local source code.
- Contains: HTML entry pages, page CSS, `app.js`, and `modules/*.js` for each step.
- Key files: `apps/main/index.html`, `apps/main/app.js`, `apps/simulation/index.html`, `apps/simulation/app.js`, `apps/portfolio/index.html`, `apps/portfolio/app.js`

**`apps/main/`:**
- Purpose: Step 1 household cash-flow UI for income, accounts, expense/savings/investment flows, Sankey visualization, snapshots, and sharing.
- Contains: Static HTML DOM contract, page styles, bootstrap app, and feature modules.
- Key files: `apps/main/modules/bootstrap-controller.js`, `apps/main/modules/state.js`, `apps/main/modules/dom.js`, `apps/main/modules/calculator.js`, `apps/main/modules/render-orchestrator.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/sankey-builder.js`

**`apps/simulation/`:**
- Purpose: Step 2 strategy comparison and dividend simulation UI.
- Contains: Static HTML DOM contract, page styles, app bootstrap, simulation state, controllers, renderers, calculators, and Step 1 connector.
- Key files: `apps/simulation/modules/state.js`, `apps/simulation/modules/feature-controllers.js`, `apps/simulation/modules/ui-controller.js`, `apps/simulation/modules/step1-connector.js`, `apps/simulation/modules/calculator.js`, `apps/simulation/modules/renderers.js`

**`apps/portfolio/`:**
- Purpose: Step 3 portfolio creation and allocation management UI.
- Contains: Static HTML DOM contract, page styles, app object, state class, DOM renderer, calculator, chart builder, and Step 1 connector.
- Key files: `apps/portfolio/modules/state.js`, `apps/portfolio/modules/dom.js`, `apps/portfolio/modules/calculator.js`, `apps/portfolio/modules/chart-builder.js`, `apps/portfolio/modules/step1-connector.js`

**`shared/`:**
- Purpose: Shared browser runtime modules consumed by every step.
- Contains: Custom elements, utility functions, share/clipboard helpers, PWA manager, legacy storage globals, and shared theme CSS.
- Key files: `shared/components/app-header.js`, `shared/components/data-hub-modal.js`, `shared/components/feedback-manager.js`, `shared/core/utils.js`, `shared/core/share-utils.js`, `shared/pwa/pwa-manager.js`, `shared/storage/hub-storage.js`, `shared/storage/backup-manager.js`, `shared/styles/step-theme.css`

**`src/`:**
- Purpose: Vite/TypeScript layer that bridges active vanilla apps into a typed build and modern storage implementation.
- Contains: Page entry modules, typed storage services, type definitions, global CSS, and React-oriented common components.
- Key files: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`, `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`, `src/core/types/models.ts`, `src/core/types/money.ts`

**`public/`:**
- Purpose: Static files copied by Vite without module transformation.
- Contains: PWA manifest, icons, and static index data JSON.
- Key files: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/data/indices/README.md`

**`tests/`:**
- Purpose: End-to-end regression coverage for active step flows.
- Contains: Playwright specs.
- Key files: `tests/step1.spec.ts`, `tests/step2.spec.ts`

**`scripts/`:**
- Purpose: Build-time version maintenance and market/index data generation.
- Contains: Node scripts, Python data scripts, migration helper, and script output.
- Key files: `scripts/bump-version.js`, `scripts/sync-version.js`, `scripts/generate_market_data.py`, `scripts/migrate_okf.cjs`

**`.planning/`:**
- Purpose: GSD project planning and codebase intelligence artifacts.
- Contains: Milestone/phase artifacts, UI reviews, and codebase maps.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `index.html`: Root app entry page.
- `apps/main/index.html`: Step 1 HTML route; imports `src/entries/step1.ts`.
- `apps/simulation/index.html`: Step 2 HTML route; imports `src/entries/step2.ts`.
- `apps/portfolio/index.html`: Step 3 HTML route; imports `src/entries/step3.ts`.
- `src/entries/step1.ts`: Step 1 Vite entry bridge.
- `src/entries/step2.ts`: Step 2 Vite entry bridge.
- `src/entries/step3.ts`: Step 3 Vite entry bridge.

**Configuration:**
- `vite.config.ts`: Vite config, PWA config, base path `/IndividualSavingsFlowUI/`, public directory, and Rollup HTML inputs.
- `tsconfig.json`: TypeScript config covering `src`, `apps`, and `shared`; defines `@/*` and `@shared/*` aliases.
- `tsconfig.node.json`: Node-side TypeScript config reference.
- `playwright.config.ts`: Playwright test config and local Vite web server.
- `package.json`: npm scripts for dev, build, preview, type check, version sync, and E2E tests.
- `.github/workflows/deploy.yml`: GitHub Actions deployment workflow.

**Core Logic:**
- `apps/main/modules/bootstrap-controller.js`: Step 1 app initialization and controller assembly.
- `apps/main/modules/state.js`: Step 1 singleton state and initial input resolution.
- `apps/main/modules/input-sanitizer.js`: Step 1 input normalization and cloning.
- `apps/main/modules/calculator.js`: Step 1 financial projections/calculations.
- `apps/main/modules/household-budget.js`: Step 1 household budget calculations.
- `apps/main/modules/sankey-builder.js`: Step 1 Sankey graph model builder.
- `apps/main/modules/render-orchestrator.js`: Step 1 top-level render pipeline.
- `apps/main/modules/event-bindings.js`: Step 1 event binding.
- `apps/main/modules/persistence-controller.js`: Step 1 save/share/backup/view-mode persistence.
- `apps/simulation/modules/calculator.js`: Step 2 dividend/strategy simulation math.
- `apps/simulation/modules/comparison-calculator.js`: Step 2 strategy comparison math.
- `apps/simulation/modules/assumptions.js`: Step 2 strategy assumptions.
- `apps/simulation/modules/feature-controllers.js`: Step 2 persistence, normalize/load/save/delete/backup/export workflows.
- `apps/simulation/modules/ui-controller.js`: Step 2 event handling and rendering orchestration.
- `apps/portfolio/modules/calculator.js`: Step 3 allocation, validation, and recurring investment calculations.
- `apps/portfolio/modules/state.js`: Step 3 portfolio and creator state persistence.
- `apps/portfolio/modules/dom.js`: Step 3 rendering and modal DOM workflows.

**Shared Runtime:**
- `shared/components/app-header.js`: Shared header custom element and step launcher/status UI.
- `shared/components/data-hub-modal.js`: Shared data import/export/backup modal custom element.
- `shared/components/feedback-manager.js`: Feedback display manager exposed to app code.
- `shared/core/utils.js`: Global utility methods and app version constant.
- `shared/core/share-utils.js`: Share-code/hash/JSON import-export helpers.
- `shared/core/clipboard-parser.js`: Clipboard parsing helper with unit test.
- `shared/pwa/pwa-manager.js`: PWA registration/update/version check helper.
- `shared/storage/hub-storage.js`: Legacy JS storage hub implementation.
- `shared/storage/backup-manager.js`: Legacy JS backup manager implementation.
- `shared/styles/step-theme.css`: Shared visual tokens, panel/button/form styles.

**Modern Storage:**
- `src/core/storage/CompatibilityBridge.ts`: Registers modern storage services under legacy global API names.
- `src/core/storage/IsfStore.ts`: IndexedDB wrapper for Step 1 history, Step 2 simulations, and backups.
- `src/core/storage/BackupService.ts`: Backup creation/listing/trimming service.
- `src/core/types/models.ts`: Typed data models.
- `src/core/types/money.ts`: Money conversion/formatting helpers.

**Testing:**
- `tests/step1.spec.ts`: Step 1 Playwright coverage.
- `tests/step2.spec.ts`: Step 2 Playwright coverage.
- `shared/core/clipboard-parser.test.js`: Clipboard parser test file.
- `playwright.config.ts`: E2E runner setup.

## Naming Conventions

**Files:**
- Step app entry files use `app.js`: `apps/main/app.js`, `apps/simulation/app.js`, `apps/portfolio/app.js`.
- Step modules use kebab-case for JavaScript files: `bootstrap-controller.js`, `render-orchestrator.js`, `step1-connector.js`, `financial-summary-renderer.js`.
- TypeScript core services use PascalCase class/service filenames: `CompatibilityBridge.ts`, `IsfStore.ts`, `BackupService.ts`.
- Type definition/helper files use lower-case names: `models.ts`, `money.ts`.
- Tests use `.spec.ts` or `.test.js`: `tests/step1.spec.ts`, `shared/core/clipboard-parser.test.js`.
- CSS is either shared global/theme CSS or step-local `styles.css`: `src/styles/globals.css`, `shared/styles/step-theme.css`, `apps/main/styles.css`.

**Directories:**
- Active pages are grouped by step under `apps/<step>/`.
- Page-local modules live under `apps/<step>/modules/`.
- Shared browser modules are grouped by capability under `shared/<capability>/`.
- Typed core code lives under `src/core/<capability>/`.
- Static public assets live under `public/<asset-type>/`.

## Where to Add New Code

**New Step 1 Feature:**
- Primary code: `apps/main/modules/`
- HTML targets: `apps/main/index.html`
- Styles: `apps/main/styles.css`, or `shared/styles/step-theme.css` only for reusable step-wide styles.
- DOM handles: `apps/main/modules/dom.js`
- Event binding: `apps/main/modules/event-bindings.js`
- Rendering: `apps/main/modules/render-orchestrator.js` plus focused renderer modules such as `apps/main/modules/list-renderer.js`
- Persistence: `apps/main/modules/persistence-controller.js` or storage services under `src/core/storage/`
- Tests: `tests/step1.spec.ts`

**New Step 2 Feature:**
- Primary code: `apps/simulation/modules/`
- HTML targets: `apps/simulation/index.html`
- Styles: `apps/simulation/styles.css`
- DOM handles: `apps/simulation/modules/dom.js`
- Event binding/orchestration: `apps/simulation/modules/ui-controller.js`
- Save/load/backup behavior: `apps/simulation/modules/feature-controllers.js`
- Step 1 import behavior: `apps/simulation/modules/step1-connector.js`
- Tests: `tests/step2.spec.ts`

**New Step 3 Feature:**
- Primary code: `apps/portfolio/modules/`
- HTML targets: `apps/portfolio/index.html`
- Styles: `apps/portfolio/styles.css`
- State: `apps/portfolio/modules/state.js`
- DOM/render behavior: `apps/portfolio/modules/dom.js`
- Calculations/validation: `apps/portfolio/modules/calculator.js`
- New E2E tests: add `tests/step3.spec.ts`

**New Shared Component/Module:**
- Custom element: `shared/components/<name>.js`
- Shared utility: `shared/core/<name>.js`
- Shared styles/tokens: `shared/styles/step-theme.css`
- Import registration: add imports to each relevant `src/entries/step*.ts`

**New Storage Capability:**
- Typed implementation: `src/core/storage/`
- Model updates: `src/core/types/models.ts`
- Legacy/global API exposure: `src/core/storage/CompatibilityBridge.ts`
- Legacy JS fallback only if needed: `shared/storage/`

**New Page/Step:**
- HTML route: `apps/<new-step>/index.html`
- Entry bridge: `src/entries/<new-step>.ts`
- App bootstrap: `apps/<new-step>/app.js`
- Modules: `apps/<new-step>/modules/`
- Styles: `apps/<new-step>/styles.css`
- Build config: add a Rollup input in `vite.config.ts`
- Navigation: update `shared/components/app-header.js`
- Tests: add `tests/<new-step>.spec.ts`

**Utilities:**
- Shared browser utilities: `shared/core/`
- Typed helpers used by TypeScript layer: `src/core/`
- App-specific helpers: keep them inside `apps/<step>/modules/` unless at least two steps consume them.

## Special Directories

**`.codegraph/`:**
- Purpose: CodeGraph index used for code navigation and architecture exploration.
- Generated: Yes
- Committed: Project-dependent; treat as an index/cache unless repository policy says otherwise.

**`.planning/`:**
- Purpose: GSD planning artifacts, phase/milestone docs, UI reviews, and generated codebase maps.
- Generated: Yes
- Committed: Yes, as project planning context.

**`dist/`:**
- Purpose: Vite production build output.
- Generated: Yes
- Committed: No for normal source changes.

**`node_modules/`:**
- Purpose: npm dependency install directory.
- Generated: Yes
- Committed: No.

**`test-results/`:**
- Purpose: Playwright output and failure artifacts.
- Generated: Yes
- Committed: No.

**`graphify-out/`:**
- Purpose: Graphify/cache output for code/document graph tooling.
- Generated: Yes
- Committed: Project-dependent; avoid placing hand-written source here.

**`public/data/indices/`:**
- Purpose: Static market/index JSON data available at runtime.
- Generated: Partly; scripts in `scripts/` can generate or refresh data.
- Committed: Yes, because the app reads these files as public assets.

---

*Structure analysis: 2026-06-23*
