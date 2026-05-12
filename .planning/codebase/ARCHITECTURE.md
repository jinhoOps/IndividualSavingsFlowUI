<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Application Entry                       │
│  `src/entries/step[1-4].ts(x)` -> `apps/step[1-4]/index.html`│
├──────────────────┬──────────────────┬───────────────────────┤
│   Step 1-3 (JS)  │   Step 4 (React) │    Shared Components  │
│  `apps/step1-3`  │  `src/components`│   `shared/components` │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│  `apps/step*/modules/*.js` (Vanilla)                        │
│  `src/core/backtest/*.ts` (Modern Engine)                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage & Data Layer                     │
│  `src/core/storage/IsfStore.ts` (IndexedDB)                 │
│  `shared/storage/hub-storage.js` (Legacy/Bridge)            │
│  `public/data/indices/*.json` (Market Data)                 │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **App Orchestrator** | Coordinates modules, handles DOM events (Vanilla) | `apps/step[1-3]/app.js` |
| **Backtest Dashboard** | React root for Step 4 simulator | `src/components/backtest/BacktestDashboard.tsx` |
| **Backtest Engine** | core simulation logic for Step 4 | `src/core/backtest/engine.ts` |
| **IsfStore** | Modernized IndexedDB storage for state/history | `src/core/storage/IsfStore.ts` |
| **Compatibility Bridge**| Redirects legacy JS calls to modernized services | `src/core/storage/CompatibilityBridge.ts` |
| **HubStorage** | Legacy LocalStorage & IndexedDB abstraction | `shared/storage/hub-storage.js` |
| **DataHubModal** | UI for data backup/restore/import/export | `shared/components/data-hub-modal.js` |
| **PwaManager** | Service Worker and PWA lifecycle management | `shared/pwa/pwa-manager.js` |

## Pattern Overview

**Overall:** Hybrid Architecture (Progressive Enhancement)

**Key Characteristics:**
- **Modular Vanilla (Steps 1-3):** Separates logic into `state.js`, `calculator.js`, `dom.js`, and `app.js` (Orchestrator).
- **React/TypeScript (Step 4):** Modern component-based architecture for complex state and visualization.
- **Unified Storage:** Even legacy vanilla apps use the modernized `IsfStore` via `CompatibilityBridge.ts`.

## Layers

**UI Layer:**
- Purpose: Rendering and User Interaction.
- Location: `apps/step1-4/`, `src/components/`
- Contains: HTML templates, CSS, Vanilla DOM manipulation, React Components.
- Depends on: Logic Layer, Storage Layer.
- Used by: End User.

**Logic Layer:**
- Purpose: Financial calculations and data transformation.
- Location: `apps/step*/modules/`, `src/core/backtest/`
- Contains: `calculator.js`, `engine.ts`, `input-sanitizer.js`.
- Depends on: Shared Utilities.
- Used by: UI Layer.

**Storage Layer:**
- Purpose: Persistence and Data Integrity.
- Location: `src/core/storage/`, `shared/storage/`
- Contains: IndexedDB schemas, LocalStorage wrappers, Backup services.
- Depends on: Shared Utilities.
- Used by: UI Layer, Logic Layer.

## Data Flow

### Primary Request Path (Step 1-3)

1. **User Input:** Triggered in `apps/step*/app.js` via DOM event listeners.
2. **Sanitization:** Input is cleaned via `modules/input-sanitizer.js`.
3. **Calculation:** Business logic processed in `modules/calculator.js`.
4. **State Update:** Results saved to `modules/state.js` and persisted via `IsfStorageHub`.
5. **Rendering:** UI updated via `modules/dom.js` and specific renderers (e.g., `sankey-renderer.js`).

### Backtest Simulation Flow (Step 4)

1. **Parameters:** User sets backtest config in `BacktestDashboard.tsx`.
2. **Engine:** `engine.ts` performs simulation using market data from `public/data/indices/`.
3. **State:** Results managed by React state or local component state.
4. **Visualization:** `AssetChart.tsx` (Recharts) and `KpiGrid.tsx` display metrics.

**State Management:**
- **Vanilla:** Local `state` object in `modules/state.js`.
- **React:** Standard `useState` and `useMemo` hooks.
- **Persistence:** Modernized IndexedDB (`IsfStore`) synchronized via `localStorage`.

## Key Abstractions

**IsfStore:**
- Purpose: Centralized persistence for all application steps.
- Examples: `src/core/storage/IsfStore.ts`
- Pattern: Repository Pattern (abstracting IndexedDB/LocalStorage).

**CompatibilityBridge:**
- Purpose: Ensures legacy JS code can talk to modernized TS services.
- Examples: `src/core/storage/CompatibilityBridge.ts`
- Pattern: Adapter/Bridge Pattern.

## Entry Points

**Step 1-4 Entries:**
- Location: `src/entries/step1.ts` to `src/entries/step4.tsx`.
- Triggers: Vite build process, loaded by `apps/step*/index.html`.
- Responsibilities: Initializing the application, loading shared styles, and mounting UI.

## Architectural Constraints

- **Single-threaded Event Loop:** Standard browser environment constraints.
- **Global state:** Vanilla steps use window-level singletons (e.g., `window.IsfStorageHub`) for communication.
- **Circular imports:** Avoided by using a modular structure and clearly defined layers.
- **Legacy Compatibility:** New features must not break existing Vanilla JS steps.

## Anti-Patterns

### Large Orchestrator (app.js)

**What happens:** `apps/step1/app.js` grew to ~700 lines.
**Why it's wrong:** Becomes a "God Object" that is hard to maintain and test.
**Do this instead:** Extract domain-specific logic into smaller modules (e.g., `onboarding-manager.js`, `snapshot-manager.js`).

## Error Handling

**Strategy:** Fail-safe defaults and user feedback.

**Patterns:**
- **Sanitization:** Ensuring inputs never crash the calculator (`input-sanitizer.js`).
- **Feedback UI:** `FeedbackManager.js` for non-blocking error/success messages.

## Cross-Cutting Concerns

**Logging:** Console-based with warning/error levels.
**Validation:** Surgical sanitization of financial inputs.
**PWA:** Service Worker for offline capability (`shared/pwa/pwa-manager.js`).

---

*Architecture analysis: 2026-05-12*
