# Architecture Map

## System Overview
- **Pattern**: Multi-Step Vanilla JS Application.
- **Paradigm**: No-Build, pure Browser-standard ES6+ Modules.
- **Layers**: 3-Layer Architecture (State / Helper / UI) defined in constitutional principles.

## Core Components
### 1. State Management (`apps/step1/modules/state.js`)
- Centralized application state.
- `markDirty` pattern for tracking changes.

### 2. Logic & Calculation (`apps/step1/modules/calculator.js`)
- Monthly cash flow projection logic.
- Unit conversion: UI (Man-won) vs Internal Calculation (Won).

### 3. Shared Layer (`shared/`)
- **Hub Storage**: IndexedDB based data exchange between Step 1 and Step 2.
- **Share Utils**: LZ-based URL compression and sharing envelope logic.
- **PWA Manager**: Service worker and manifest integration.

### 4. UI Rendering (`apps/step1/modules/sankey-renderer.js`)
- Custom SVG-based Sankey Diagram implementation.
- Direct DOM manipulation without virtual DOM.

## Data Flow
1. User input (Step 1) → Sanitized → State Updated.
2. State Change → Trigger Re-calculation.
3. Re-calculation → Update UI (Cards, Table, Sankey).
4. Apply/Save → Persistence in IndexedDB/LocalStorage.
5. Bridge → Export minimal payload to `isf-hub-db-v1` for Step 2 consumption.
