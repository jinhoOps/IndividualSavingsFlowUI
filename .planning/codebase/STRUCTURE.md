# Codebase Structure

**Analysis Date:** 2026-06-29

## Directory Layout

```text
IndividualSavingsFlowUI/
├── index.html                 # Root redirect into the Main app
├── package.json               # npm scripts, Vite/TypeScript/Playwright dependencies
├── vite.config.ts             # Multi-page Vite build and PWA configuration
├── tsconfig.json              # TypeScript project checking configuration
├── playwright.config.ts       # E2E test configuration
├── apps/                      # Page-specific browser applications
│   ├── main/                  # Step 1 household cash-flow app
│   │   ├── index.html         # Step 1 DOM shell
│   │   ├── app.js             # Step 1 app start module
│   │   ├── styles.css         # Step 1 page styles
│   │   └── modules/           # Step 1 controllers, renderers, state, calculators
│   ├── simulation/            # Step 2 dividend/simulation app
│   │   ├── index.html         # Step 2 DOM shell
│   │   ├── app.js             # Step 2 app bootstrap
│   │   ├── styles.css         # Step 2 page styles
│   │   └── modules/           # Step 2 state, UI, renderers, calculators, connectors
│   └── portfolio/             # Step 3 portfolio manager
│       ├── index.html         # Step 3 DOM shell
│       ├── app.js             # Step 3 object-style app bootstrap
│       ├── styles.css         # Step 3 page styles
│       └── modules/           # Step 3 state, DOM helpers, calculator, chart/snapshot modules
├── src/                       # TypeScript entry layer and modernized core
│   ├── entries/               # Vite page entries for Step 1/2/3
│   ├── core/                  # Typed storage, compatibility bridge, models, money helpers
│   ├── components/            # React/TSX components currently limited to common UI
│   └── styles/                # Global CSS tokens/base styles
├── shared/                    # Cross-step vanilla JS components, globals, storage, PWA, styles
│   ├── components/            # Custom elements and feedback manager
│   ├── core/                  # Utility and share/import/export globals
│   ├── pwa/                   # PWA manager global
│   ├── storage/               # Legacy storage/backup implementations
│   ├── legacy/                # Service worker source
│   └── styles/                # Shared step theme CSS
├── public/                    # Static public assets and data
│   └── data/indices/          # Index data JSON fixtures/assets
├── docs/adr/                  # Architecture decision records
├── tests/                     # Playwright E2E tests
├── scripts/                   # Version bump/sync scripts
├── dist/                      # Build output
├── test-results/              # Playwright run artifacts
└── .planning/                 # GSD planning, codebase maps, milestone/phase docs
```

## Directory Purposes

**`apps/`:**
- Purpose: Houses the three routed browser applications.
- Contains: One subdirectory per step app with `index.html`, `app.js`, `styles.css`, and local `modules/`.
- Key files: `apps/main/app.js`, `apps/simulation/app.js`, `apps/portfolio/app.js`

**`apps/main/`:**
- Purpose: Step 1 Main app for household cash-flow input, financial detail editing, Sankey/network visualizations, projections, presets, snapshots, and data hub operations.
- Contains: Static DOM shell, page CSS, app start module, and focused modules for state, rendering, persistence, event binding, calculation, sanitization, modal editing, and visualization.
- Key files: `apps/main/index.html`, `apps/main/app.js`, `apps/main/styles.css`, `apps/main/modules/bootstrap-controller.js`, `apps/main/modules/state.js`, `apps/main/modules/render-orchestrator.js`

**`apps/main/modules/`:**
- Purpose: Step 1 feature modules.
- Contains: `*-controller.js` behavior modules, `*-renderer.js` view modules, `calculator.js`, `input-sanitizer.js`, `constants.js`, `dom.js`, storage/snapshot/preset/visualization helpers.
- Key files: `apps/main/modules/financial-modal-controller.js`, `apps/main/modules/persistence-controller.js`, `apps/main/modules/event-bindings.js`, `apps/main/modules/calculator.js`, `apps/main/modules/sankey-builder.js`, `apps/main/modules/sankey-renderer.js`

**`apps/simulation/`:**
- Purpose: Step 2 dividend/investment simulation app.
- Contains: Static DOM shell, page CSS, bootstrap module, state module, UI/feature controllers, calculators, renderers, Step 1 connector, assumptions, and storage fallback.
- Key files: `apps/simulation/index.html`, `apps/simulation/app.js`, `apps/simulation/modules/state.js`, `apps/simulation/modules/step1-connector.js`, `apps/simulation/modules/ui-controller.js`

**`apps/portfolio/`:**
- Purpose: Step 3 accumulative portfolio manager.
- Contains: Static DOM shell, page CSS, object-style app bootstrap, portfolio state, DOM helpers, calculator, chart builder, snapshot manager, and Step 1 connector.
- Key files: `apps/portfolio/index.html`, `apps/portfolio/app.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/dom.js`, `apps/portfolio/modules/calculator.js`

**`src/entries/`:**
- Purpose: Vite page entry points that assemble shared globals/styles/components and then import the corresponding app.
- Contains: `step1.ts`, `step2.ts`, `step3.ts`.
- Key files: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`

**`src/core/`:**
- Purpose: Modern TypeScript core for storage, compatibility, money utilities, and shared data models.
- Contains: `storage/`, `types/`.
- Key files: `src/core/storage/CompatibilityBridge.ts`, `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`, `src/core/types/models.ts`, `src/core/types/money.ts`

**`src/components/`:**
- Purpose: Typed UI component area for React/TSX pieces.
- Contains: Common components only.
- Key files: `src/components/common/Toast.tsx`

**`src/styles/`:**
- Purpose: Global CSS imported by all step entries.
- Contains: Base/global CSS.
- Key files: `src/styles/globals.css`

**`shared/`:**
- Purpose: Cross-step browser modules and styles that are not owned by a single app.
- Contains: Custom elements, feedback manager, utility/share globals, PWA manager, legacy storage modules, service worker source, shared step theme.
- Key files: `shared/components/app-header.js`, `shared/components/data-hub-modal.js`, `shared/components/feedback-manager.js`, `shared/core/utils.js`, `shared/core/share-utils.js`, `shared/pwa/pwa-manager.js`, `shared/styles/step-theme.css`

**`shared/storage/`:**
- Purpose: Legacy storage/backup modules retained for compatibility/reference.
- Contains: Hub storage and backup manager globals.
- Key files: `shared/storage/hub-storage.js`, `shared/storage/backup-manager.js`

**`public/`:**
- Purpose: Vite public assets copied into build output.
- Contains: Static data under `public/data/indices/`; referenced icons/manifest assets are configured through Vite/PWA.
- Key files: `public/data/indices/README.md`, `public/data/indices/kospi.json`, `public/data/indices/qqq.json`

**`docs/adr/`:**
- Purpose: Architecture decisions that constrain future changes.
- Contains: ADR markdown files.
- Key files: `docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md`, `docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md`

**`tests/`:**
- Purpose: Playwright E2E coverage.
- Contains: Browser-level specs.
- Key files: `tests/step1.spec.ts`

**`scripts/`:**
- Purpose: Release/version automation used by npm scripts.
- Contains: Node scripts.
- Key files: `scripts/bump-version.js`, `scripts/sync-version.js`

**`.planning/`:**
- Purpose: GSD planning system artifacts and codebase maps.
- Contains: Project state, roadmap, requirements, phase/milestone docs, diagrams, codebase map outputs.
- Key files: `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `index.html`: Root redirect to `./apps/main/`.
- `apps/main/index.html`: Step 1 HTML page shell and DOM anchors.
- `apps/simulation/index.html`: Step 2 HTML page shell and DOM anchors.
- `apps/portfolio/index.html`: Step 3 HTML page shell and DOM anchors.
- `src/entries/step1.ts`: Step 1 Vite entry.
- `src/entries/step2.ts`: Step 2 Vite entry.
- `src/entries/step3.ts`: Step 3 Vite entry.
- `apps/main/app.js`: Imports and starts Step 1 bootstrap.
- `apps/simulation/app.js`: Initializes Step 2 runtime.
- `apps/portfolio/app.js`: Initializes Step 3 runtime.

**Configuration:**
- `package.json`: npm scripts, package metadata, dependencies.
- `vite.config.ts`: Multi-page Vite input, PWA manifest/workbox config, base path.
- `tsconfig.json`: TypeScript compiler checks.
- `tsconfig.node.json`: Node-side TypeScript compiler config.
- `playwright.config.ts`: E2E test configuration.
- `.gitignore`: Ignored generated/local files.

**Core Logic:**
- `apps/main/modules/bootstrap-controller.js`: Step 1 controller creation, startup, initial render, PWA/onboarding/share initialization.
- `apps/main/modules/state.js`: Step 1 mutable runtime state and initial input resolution.
- `apps/main/modules/state-helpers.js`: Step 1 state/form helpers.
- `apps/main/modules/input-sanitizer.js`: Step 1 model migration, sanitization, account repair, derived totals.
- `apps/main/modules/calculator.js`: Step 1 snapshot/projection/summary calculations.
- `apps/main/modules/render-orchestrator.js`: Step 1 render pipeline.
- `apps/main/modules/event-bindings.js`: Step 1 DOM event binding.
- `apps/main/modules/persistence-controller.js`: Step 1 persistence/import/export/share/backup operations.
- `apps/main/modules/financial-modal-controller.js`: Step 1 primary financial editor.
- `apps/main/modules/sankey-builder.js`: Step 1 Sankey graph data builder.
- `apps/main/modules/sankey-renderer.js`: Step 1 Sankey SVG renderer and PNG export.
- `apps/main/modules/network-map-renderer.js`: Step 1 account network renderer.
- `apps/simulation/modules/step1-connector.js`: Step 2 import/sync from Step 1 state.
- `apps/simulation/modules/feature-controllers.js`: Step 2 feature actions.
- `apps/simulation/modules/ui-controller.js`: Step 2 UI orchestration.
- `apps/portfolio/modules/state.js`: Step 3 portfolio state management.
- `apps/portfolio/modules/dom.js`: Step 3 DOM rendering/helpers.
- `apps/portfolio/modules/calculator.js`: Step 3 portfolio calculations/validation.

**Shared Logic:**
- `shared/core/utils.js`: Shared `window.IsfUtils` utility global.
- `shared/core/share-utils.js`: Shared `window.IsfShare` URL-hash and import/export global.
- `shared/components/app-header.js`: Shared navigation/status custom element.
- `shared/components/data-hub-modal.js`: Shared data management custom element.
- `shared/components/feedback-manager.js`: Shared feedback global.
- `shared/pwa/pwa-manager.js`: Shared PWA manager global.
- `src/core/storage/CompatibilityBridge.ts`: Legacy global storage/backup bridge over TypeScript services.
- `src/core/storage/IsfStore.ts`: IndexedDB/localStorage storage service.
- `src/core/storage/BackupService.ts`: Backup service.
- `src/core/types/models.ts`: Typed state/backup models.
- `src/core/types/money.ts`: Money helper types/utilities.

**Styling:**
- `src/styles/globals.css`: Global styles/tokens imported by every step entry.
- `shared/styles/step-theme.css`: Shared step theme styles.
- `apps/main/styles.css`: Step 1 page-specific CSS.
- `apps/simulation/styles.css`: Step 2 page-specific CSS.
- `apps/portfolio/styles.css`: Step 3 page-specific CSS.

**Testing:**
- `tests/step1.spec.ts`: Playwright coverage for Step 1 flows.
- `playwright.config.ts`: Test runner configuration.
- `test-results/`: Generated Playwright artifacts.

**Planning and Decisions:**
- `docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md`: Constraint that Step 1 financial edits belong in the financial detail modal.
- `docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md`: Superseded account-flow ADR; keep only as historical context.
- `.planning/codebase/ARCHITECTURE.md`: Architecture codebase map.
- `.planning/codebase/STRUCTURE.md`: Structure codebase map.

## Naming Conventions

**Files:**
- Use kebab-case for vanilla JS modules: `apps/main/modules/persistence-controller.js`, `apps/main/modules/input-sanitizer.js`.
- Use `*-controller.js` for modules that bind behavior or coordinate actions: `apps/main/modules/visualization-controller.js`, `apps/simulation/modules/ui-controller.js`.
- Use `*-renderer.js` for DOM/SVG rendering modules: `apps/main/modules/sankey-renderer.js`, `apps/main/modules/list-renderer.js`.
- Use `*-builder.js` for data builders: `apps/main/modules/sankey-builder.js`, `apps/portfolio/modules/chart-builder.js`.
- Use PascalCase for TypeScript classes/services and React components: `src/core/storage/IsfStore.ts`, `src/core/storage/BackupService.ts`, `src/components/common/Toast.tsx`.
- Use lowercase route app files: `apps/main/app.js`, `apps/simulation/app.js`, `apps/portfolio/app.js`.

**Directories:**
- Use app-route names under `apps/`: `apps/main/`, `apps/simulation/`, `apps/portfolio/`.
- Use `modules/` under each vanilla app for app-local JS modules.
- Use domain directories under `shared/`: `shared/components/`, `shared/core/`, `shared/pwa/`, `shared/storage/`, `shared/styles/`.
- Use typed domain directories under `src/core/`: `src/core/storage/`, `src/core/types/`.

## Where to Add New Code

**New Step 1 Feature:**
- Primary code: `apps/main/modules/`
- DOM anchors: `apps/main/index.html`
- Styles: `apps/main/styles.css`
- Boot/event wiring: `apps/main/modules/bootstrap-controller.js` and `apps/main/modules/event-bindings.js`
- Tests: `tests/step1.spec.ts`

**New Step 1 Financial Edit Capability:**
- Primary code: `apps/main/modules/financial-modal-controller.js`
- Data validation/model normalization: `apps/main/modules/input-sanitizer.js`
- Modal DOM: `apps/main/index.html`
- Modal styles: `apps/main/styles.css`
- Do not create a second ordinary financial editor; extend the financial detail modal.

**New Step 1 Derived Calculation:**
- Calculation code: `apps/main/modules/calculator.js`
- Sanitized input support: `apps/main/modules/input-sanitizer.js`
- Render integration: `apps/main/modules/render-orchestrator.js`
- UI rendering: `apps/main/modules/financial-summary.js`, `apps/main/modules/financial-summary-renderer.js`, or a new focused renderer in `apps/main/modules/`

**New Step 1 Visualization:**
- Data builder: `apps/main/modules/*-builder.js`
- Renderer: `apps/main/modules/*-renderer.js`
- Controls/events: `apps/main/modules/visualization-controller.js` and `apps/main/modules/event-bindings.js`
- DOM container: `apps/main/index.html`
- Styles: `apps/main/styles.css`

**New Step 2 Feature:**
- Primary code: `apps/simulation/modules/`
- Bootstrap integration: `apps/simulation/app.js`
- DOM anchors: `apps/simulation/index.html`
- Styles: `apps/simulation/styles.css`
- Shared Step 1 import logic: `apps/simulation/modules/step1-connector.js`

**New Step 3 Feature:**
- Primary code: `apps/portfolio/modules/`
- App orchestration: `apps/portfolio/app.js`
- DOM anchors: `apps/portfolio/index.html`
- Styles: `apps/portfolio/styles.css`
- Shared Step 1 import logic: `apps/portfolio/modules/step1-connector.js`

**New Cross-Step Shared UI:**
- Web Component implementation: `shared/components/`
- Import from all needed entries: `src/entries/step1.ts`, `src/entries/step2.ts`, `src/entries/step3.ts`
- Shared styles: `shared/styles/step-theme.css` or `src/styles/globals.css`
- Page-specific overrides remain in `apps/*/styles.css`.

**New Cross-Step Storage or Data Model Capability:**
- Typed model: `src/core/types/models.ts`
- Storage implementation: `src/core/storage/IsfStore.ts` or `src/core/storage/BackupService.ts`
- Legacy bridge API: `src/core/storage/CompatibilityBridge.ts`
- Legacy app callers should use `window.IsfStorageHub` or `window.IsfBackupManager`.

**New Share/Import/Export Capability:**
- Shared hash/JSON helpers: `shared/core/share-utils.js`
- Step 1 command integration: `apps/main/modules/persistence-controller.js`
- Data hub UI integration: `shared/components/data-hub-modal.js`

**New App/Page Route:**
- Route shell: `apps/<new-step>/index.html`
- Runtime code: `apps/<new-step>/app.js` and `apps/<new-step>/modules/`
- Entry file: `src/entries/<new-step>.ts`
- Vite input: `vite.config.ts`
- Shared navigation update: `shared/components/app-header.js`

**Utilities:**
- Cross-step browser utilities: `shared/core/utils.js`
- Typed money/model utilities: `src/core/types/`
- App-local utilities: keep inside the relevant `apps/*/modules/` directory.

## Special Directories

**`.codegraph/`:**
- Purpose: Local code index for architecture/symbol discovery.
- Generated: Yes
- Committed: Project-dependent; treat as tool-managed.

**`.planning/`:**
- Purpose: GSD project state, roadmap, requirements, phase artifacts, and codebase maps.
- Generated: Partially
- Committed: Yes for planning artifacts intended to guide future work.

**`dist/`:**
- Purpose: Vite production build output.
- Generated: Yes
- Committed: Project-dependent; do not edit source behavior here.

**`test-results/`:**
- Purpose: Playwright reports/artifacts.
- Generated: Yes
- Committed: No

**`node_modules/`:**
- Purpose: npm installed dependencies.
- Generated: Yes
- Committed: No

**`public/data/indices/`:**
- Purpose: Static index data files served as public assets.
- Generated: No
- Committed: Yes

**`graphify-out/`:**
- Purpose: Generated graph/analysis output.
- Generated: Yes
- Committed: Project-dependent; do not treat as application source.

**`tmp/`:**
- Purpose: Temporary local working files.
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-06-29*
