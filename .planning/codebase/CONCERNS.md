# Codebase Concerns

**Analysis Date:** 2024-05-24

## Tech Debt

**Legacy App Entries:**
- Issue: Legacy vanilla JS entry points are bloated and tightly coupled to the DOM.
- Files: `apps/step1/app.js`, `apps/step2/app.js`, `apps/step3/app.js`
- Impact: Harder to test, maintain, and share components between steps. File sizes exceed 30KB.
- Fix approach: Modularize core logic out of `app.js` and transition towards React/Vite-based structure like Step 4.

**AI Removal Cleanup:**
- Issue: Remnants of experimental Phase 10 AI features still need to be fully cleaned up to ensure absolute system integrity.
- Files: `shared/components/data-hub-modal.js`
- Impact: Potential dead code, confusion, or inadvertent bugs due to leftover logic.
- Fix approach: Conduct a codebase-wide audit to remove all remaining AI-related stubs, configurations, and comments.

## Known Bugs

**Data Loss in Item Comparison:**
- Symptoms: When comparing items with identical names, data gets overwritten instead of aggregating the amounts.
- Files: `apps/step1/modules/comparison-engine.js` (recently fixed, but regression risk remains)
- Trigger: Entering multiple identical items in input fields.
- Workaround: Automatically sanitize and aggregate identical item names at input level.

## Security Considerations

**Cross-Site Scripting (XSS):**
- Risk: Malicious code injection through shared link names, especially during partner data merge (ISF CODE).
- Files: `apps/step1/modules/input-sanitizer.js`, `shared/core/utils.js`
- Current mitigation: Forced `sanitizeInputs` applied during data merge.
- Recommendations: Ensure robust validation on all input fields globally and enforce sanitization before any DOM rendering.

## Performance Bottlenecks

**Complex Chart Rendering:**
- Problem: Rendering Sankey charts and backtest simulations is resource-intensive.
- Files: `apps/step1/modules/sankey-renderer.js`, `src/components/backtest/`
- Cause: SVG generation on the main thread for large data sets blocks the UI.
- Improvement path: Offload calculations to Web Workers or implement virtualized rendering/debouncing for chart updates.

## Fragile Areas

**Offline Data Sync:**
- Files: `shared/pwa/pwa-manager.js`, `shared/storage/hub-storage.js`
- Why fragile: PWA offline caching and IndexedDB synchronization have edge cases during intermittent network connectivity.
- Safe modification: Carefully test all CRUD operations under simulated offline network conditions.
- Test coverage: Lacks comprehensive automated offline E2E tests.

**Cross-Step Style Consistency:**
- Files: `src/styles/globals.css`, `shared/styles/step-theme.css`
- Why fragile: Mixing Vanilla JS (Steps 1-3) with React (Step 4) causes fragmentation in global variables and theming.
- Safe modification: Consolidate CSS variables into a single unified design token file.
- Test coverage: Visual regression testing is absent.

**App Header Event Listeners:**
- Files: `shared/components/app-header.js`
- Why fragile: Global event listeners can leak if not properly deregistered, causing memory bloat.
- Safe modification: Ensure listeners are tightly scoped to `connectedCallback` and `disconnectedCallback` lifecycle methods.
- Test coverage: Low coverage on component unmount behavior.

## Scaling Limits

**[Resource/System]:**
- Current capacity: Not applicable
- Limit: Not applicable
- Scaling path: Not applicable

## Dependencies at Risk

**[Package]:**
- Risk: Not applicable
- Impact: Not applicable
- Migration plan: Not applicable

## Missing Critical Features

**Data Validation & Error Handling:**
- Problem: Lack of strict runtime schema validation across steps.
- Blocks: Prevents robust type safety and predictability during data exchange between components.

## Test Coverage Gaps

**Offline State Transitions:**
- What's not tested: Application behavior during unstable network connections and subsequent IndexedDB sync.
- Files: `shared/pwa/pwa-manager.js`
- Risk: Data loss or corruption if sync fails silently.
- Priority: High

---

*Concerns audit: 2024-05-24*
