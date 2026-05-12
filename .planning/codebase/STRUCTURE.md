# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
[project-root]/
├── apps/               # Multi-step application logic (Vanilla JS)
│   ├── step1/          # Individual Savings Flow (Entry step)
│   ├── step2/          # Portfolio Adjustment
│   ├── step3/          # Dashboard/KPI
│   └── step4/          # Backtest Simulator (Mount point)
├── shared/             # Common components and logic
│   ├── components/     # Reusable Web Components (AppHeader, DataHubModal)
│   ├── core/           # Shared utilities and parsers
│   ├── storage/        # Storage abstractions and backup managers
│   └── styles/         # Shared CSS themes
├── src/                # Modern React/TypeScript source
│   ├── components/     # React components for Step 4
│   ├── core/           # Backtest engine and modernized storage
│   ├── entries/        # Vite entry points for all steps
│   └── styles/         # Global React styles
├── public/              # Static assets and market data
│   ├── data/           # Historical market index data (JSON)
│   └── icons/          # PWA icons
├── scripts/            # Data processing and maintenance scripts
└── .planning/          # Project management and codebase documentation
```

## Directory Purposes

**apps/:**
- Purpose: Contains the legacy and current vanilla JS logic for each step of the application.
- Contains: `app.js`, `index.html`, `styles.css`, and a `modules/` subdirectory for modular logic.
- Key files: `apps/step1/app.js`, `apps/step2/modules/calculator.js`.

**shared/:**
- Purpose: Shared resources used across both Vanilla and React parts of the app.
- Contains: Web components, global utilities, and storage handlers.
- Key files: `shared/components/data-hub-modal.js`, `shared/storage/hub-storage.js`.

**src/:**
- Purpose: Modernized part of the codebase using TypeScript and React.
- Contains: React components, the backtest engine, and the new IndexedDB-based store.
- Key files: `src/core/backtest/engine.ts`, `src/core/storage/IsfStore.ts`.

**public/data/:**
- Purpose: Holds large static datasets used for simulations.
- Contains: JSON files with historical price data for various indices (e.g., KOSPI, S&P 500).
- Key files: `public/data/indices/gold.json`, `public/data/indices/kospi.json`.

## Key File Locations

**Entry Points:**
- `src/entries/step1.ts`: Initializes Step 1 (Vanilla).
- `src/entries/step4.tsx`: Mounts Step 4 (React).

**Configuration:**
- `vite.config.ts`: Build and dev server configuration.
- `package.json`: Dependency management and scripts.

**Core Logic:**
- `src/core/backtest/engine.ts`: Core simulation logic for backtesting.
- `apps/step1/modules/calculator.js`: Core projection logic for Step 1.

**Testing:**
- `src/core/backtest/engine.test.ts`: Unit tests for the backtest engine.
- `shared/core/clipboard-parser.test.js`: Tests for SMS/Clipboard parsing.

## Naming Conventions

**Files:**
- Vanilla Modules: `kebab-case.js` (e.g., `input-sanitizer.js`)
- React Components: `PascalCase.tsx` (e.g., `BacktestDashboard.tsx`)
- Logic/Services: `PascalCase.ts` or `camelCase.ts` (e.g., `IsfStore.ts`, `engine.ts`)

**Directories:**
- Folders: `kebab-case` (e.g., `backtest-simulator`)

## Where to Add New Code

**New Feature (Step 1-3):**
- Primary code: `apps/step[N]/modules/`
- UI elements: `apps/step[N]/index.html` (or a new Web Component in `shared/components/`)

**New Feature (Step 4+):**
- Primary code: `src/components/backtest/`
- Logic: `src/core/`

**Utilities:**
- Shared helpers: `shared/core/utils.js` or `src/core/utils/` (if TS-specific).

## Special Directories

**.planning/:**
- Purpose: Project roadmap, requirements, and codebase mapping.
- Generated: No (Manually maintained by agents).
- Committed: Yes.

**public/data/indices/:**
- Purpose: Pre-processed historical data for the simulator.
- Generated: Yes (via `scripts/*.py`).
- Committed: Yes.

---

*Structure analysis: 2026-05-12*
