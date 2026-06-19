# Phase 10: Step 1.2 Household Budget Foundation - Research

**Researched:** 2026-06-19  
**Domain:** Step 1 vanilla ES module extension, household budget data model, variable expense actual tracking  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Step 1.2 Entry And Surface
- **D-01:** Step 1.2 uses a hybrid structure: a compact `신혼부부 예산` summary panel on the Step 1 default screen, with detailed input and editing in a modal.
- **D-02:** The summary panel should follow the existing Step 1 direction from Phase 09: summary-first default screen, detail work inside modal flows, and explicit save/cancel behavior.
- **D-03:** The summary panel should not become a full second editor on the default screen. It is a status and entry surface, not the full working area.

### Newlywed Household Context
- **D-04:** The household model is designed around newlywed couples by default.
- **D-05:** Spouse income is optional. The UI and calculations must work when only one partner has income or only one income value is entered.
- **D-06:** Phase 10 should support one-income and dual-income cases without implying that both partners must earn income.

### Summary Panel Density
- **D-07:** The default Step 1.2 summary panel shows three compact metrics: household monthly income, current variable expense actual-vs-target, and remaining variable budget.
- **D-08:** The summary panel includes a short status badge such as `여유`, `주의`, or `초과` so users can judge the household budget state without opening the modal.
- **D-09:** Category-level budget rows and detailed item editing belong inside the modal, not the default summary panel.

### Variable Expense Budget Tracking
- **D-10:** Only variable expense items receive target-vs-actual budget tracking in Phase 10.
- **D-11:** Fixed expenses remain existing planned expense values and should not gain actual-spending controls in this phase.
- **D-12:** The budget model should let variable expenses represent target budget, actual spending, remaining amount, and overspend state.
- **D-13:** Phase 11 pasted transaction capture should be able to feed into the same actual-spending field introduced here.

### End-Of-Month Projection
- **D-14:** End-of-month spending projection uses a simple month-progress method in Phase 10: current actual spending is scaled by elapsed days in the current month.
- **D-15:** The projection should be presented as a lightweight planning estimate, not a precise forecast.
- **D-16:** More advanced transaction-history-based forecasting is deferred until after Phase 11 adds parsed spending events.

### the agent's Discretion
- The planner may choose exact field names for the added data shape, provided existing saved Step 1 data sanitizes safely and legacy records continue to load.
- The planner may choose the exact threshold rules for `여유`, `주의`, and `초과`, provided they are deterministic, compact, and easy to test.
- The planner may choose the exact modal layout and CSS class names as long as it reuses existing Step 1 modal/card patterns and keeps mobile density controlled.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Pasted Korean bank/card notification parsing into actual spending — Phase 11.
- Dual-flow ISF hash merge and household Sankey preview — Phase 12.
- Historical spending comparison chart — Phase 13.
- Real-estate affordability calculator — Phase 14.
- Transaction-history-based or recent-7-day forecasting — future extension after transaction capture exists.
- Live banking/account scraping — out of scope for v1.9.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HH-01 | User can open a Step 1.2 household planning surface from the Step 1 flow without losing the existing Step 1 financial setup context. | Use a compact summary panel entry and a separate modal/draft controller that commits through `commitImmediateInputs()` only. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:363] [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57] |
| HH-02 | User can mark household context for one-income or dual-income couples so downstream calculations do not assume both partners earn income. | Add a sanitized `householdContext` object with deterministic defaults and optional spouse income set to 0 when absent. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52] |
| BUD-01 | User can set a monthly target budget on variable expense items. | Treat existing `expenseItems[].amount` as the canonical monthly target for backward compatibility; add UI labels that name it as the variable budget target. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:327] |
| BUD-02 | User can enter actual spending for a variable expense item separately from the planned amount. | Add `expenseItems[].actualSpent` for variable expense items only, sanitized in Won and preserved through save/import/share. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:296] |
| BUD-03 | User can see budget progress, remaining amount, and overspend state for each tracked variable expense. | Derive progress rows from sanitized `amount` and `actualSpent`; render row text with DOM APIs/textContent. [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:3] |
| BUD-04 | User can see an end-of-month spending projection from current actual spending pace. | Compute projection as `actualSpent / elapsedDays * daysInMonth`, with zero-safe guards and estimate wording. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- In repositories with `.codegraph/`, use CodeGraph before grep/find or direct code reads when understanding or locating code. [VERIFIED: user-provided AGENTS.md instructions]
- `codegraph_explore` should be the first choice for code understanding; `codegraph_node` can read individual source files with line numbers. [VERIFIED: user-provided AGENTS.md instructions]
- No code files may be edited during this research phase. [VERIFIED: user request]
- The output file must be `.planning/phases/10-step-1-2-household-budget-foundation/10-RESEARCH.md`. [VERIFIED: user request]

## Summary

Phase 10 should be implemented as a narrow extension of the current Step 1 vanilla ES module architecture, not as a React migration or a new state/persistence system. The existing flow already has the right boundaries: `render-orchestrator.js` builds summary cards, `financial-summary.js` owns summary view models, `financial-summary-renderer.js` renders cards safely with DOM APIs, `financial-modal-controller.js` owns modal draft/save behavior, and `persistence-controller.js` commits via `sanitizeInputs()` before persistence and rerender. [VERIFIED: CodeGraph apps/main/modules/render-orchestrator.js:41] [VERIFIED: CodeGraph apps/main/modules/financial-summary.js:151] [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:79] [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:407] [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57]

The safest budget data model is to keep `expenseItems[].amount` as the canonical monthly target because existing Sankey, summaries, projection, saved records, imports, and share payloads already consume it as a Won amount. Add one new persisted field, `actualSpent`, only for variable expense rows, and derive remaining/progress/overspend/projection from `amount` and `actualSpent`. [VERIFIED: CodeGraph apps/main/modules/calculator.js:38] [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:327] This avoids corrupting legacy Step 1 records while giving Phase 11 a stable field to update after transaction capture. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md]

**Primary recommendation:** Add a focused household budget module/controller under `apps/main/modules/`, register new DOM nodes in `dom.js`, extend `sanitizeInputs()` for `householdContext` and variable expense `actualSpent`, then render a three-metric compact panel plus a modal detail editor that saves only through `persistence.commitImmediateInputs()`. [VERIFIED: CodeGraph apps/main/modules/dom.js:88] [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Step 1.2 entry panel | Browser / Client | Static HTML | The app is a static/local-first browser app and Step 1 UI is rendered from `apps/main/index.html` plus vanilla ES modules. [VERIFIED: .planning/codebase/STACK.md] |
| Household context data | Browser / Client | Local storage / IndexedDB bridge | Step 1 state initializes from sanitized local/share data and persists client-side through `IsfStorageHub`. [VERIFIED: CodeGraph apps/main/modules/state.js:12] [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:37] |
| Variable target/actual tracking | Browser / Client | Local storage / IndexedDB bridge | Budget fields are Step 1 input data and must survive save/import/share through the same sanitizer/persistence path. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52] |
| Month-progress projection | Browser / Client | — | Projection is a deterministic derived view from current date and sanitized actual spending; no backend or external service is involved. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md] |
| Modal editing and explicit save | Browser / Client | — | Existing category modal uses draft state and commits only on explicit save. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:363] [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:407] |
| Regression verification | Browser / Client test runner | Node.js tooling | Current coverage is Playwright E2E in `tests/step1.spec.ts`. [VERIFIED: CodeGraph tests/step1.spec.ts:1] |

## Standard Stack

### Core

| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Vanilla JavaScript ES modules under `apps/main/modules` | project-local | Step 1 state, rendering, modal, persistence, and Sankey orchestration | Existing Step 1 architecture is vanilla ES modules, and broad React migration is explicitly out of scope. [VERIFIED: .planning/codebase/STACK.md] [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md] |
| `shared/core/utils.js` / `window.IsfUtils` | project-local | Won parsing, formatting, sanitizer helpers, Korean money hints | Project convention requires internal Won values and existing utilities for conversion/formatting. [VERIFIED: .planning/codebase/CONVENTIONS.md] |
| `input-sanitizer.js` | project-local | Backward-compatible Step 1 data normalization | All persisted/imported/shared Step 1 inputs pass through `sanitizeInputs()`. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52] |
| `persistence-controller.js` | project-local | Explicit save boundary | `commitImmediateInputs()` sanitizes, clears draft, refreshes UI, persists, and rerenders. [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57] |
| Playwright | 1.60.0 | Step 1 browser regression tests | Existing `tests/step1.spec.ts` is Playwright-based and local binary reports version 1.60.0. [VERIFIED: local command `.\\node_modules\\.bin\\playwright.cmd --version`] |

### Supporting

| Library / Module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `financial-summary.js` | project-local | Summary view-model generation | Extend or call from a new household summary builder for default-screen compact metrics. [VERIFIED: CodeGraph apps/main/modules/financial-summary.js:151] |
| `financial-summary-renderer.js` | project-local | Safe DOM rendering for summary cards | Reuse rendering style and textContent safety for new compact panel/status cards. [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:3] |
| `financial-modal-controller.js` | project-local | Existing modal draft/edit/save pattern | Reuse the modal behavior pattern, or create `household-budget-modal-controller.js` with the same draft/save contract. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:130] |
| `render-orchestrator.js` | project-local | Central renderAll pipeline | Add household summary render call near existing `renderFinancialSummaryGroups()` so save/import/share refreshes stay aligned. [VERIFIED: CodeGraph apps/main/modules/render-orchestrator.js:41] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing vanilla Step 1 modules | React component migration | Rejected for Phase 10 because broad React migration is out of scope and Step 1 already has working vanilla module boundaries. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md] |
| Existing persistence/sanitizer | New household storage key | Rejected because it would split save/import/share behavior and risk losing Step 1 context. [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:37] |
| Existing `amount` as target | Persist separate `budgetTarget` and `amount` | Avoid duplicating target fields; if an imported `budgetTarget` appears, sanitizer may treat it as an alias and normalize into `amount`. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:327] |

**Installation:**
```bash
# No new packages for Phase 10.
npm install
```

**Version verification:** Existing tool versions were verified locally: Node.js `v24.15.0`, npm `11.10.0`, Playwright `1.60.0`. [VERIFIED: local command]

## Package Legitimacy Audit

Phase 10 should install no external packages. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | — | — | — | — | — | No install required |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Step 1 default screen
  |
  | click "신혼부부 예산" entry / household summary card
  v
Household budget modal draft
  |-- householdContext: mode + optional spouseMonthlyIncome
  |-- variable expense rows: amount target + actualSpent
  |
  | explicit save
  v
persistence.commitImmediateInputs(nextInputs)
  |
  v
sanitizeInputs()
  |-- legacy records get householdContext defaults
  |-- expenseItems keep existing amount target
  |-- only variable expense rows keep actualSpent
  |-- account repair remains unchanged
  v
state.inputs + local/share persistence
  |
  v
renderAll()
  |-- financial summary cards stay first
  |-- household budget panel refreshes compact metrics
  |-- Sankey consumes existing planned amount flow
  |-- modal can reopen from sanitized data
```

### Recommended Project Structure

```text
apps/main/
├── index.html                         # Add compact household panel host and modal shell
├── styles.css                         # Add compact panel/modal styles using existing tokens
└── modules/
    ├── dom.js                         # Register household panel/modal nodes
    ├── input-sanitizer.js             # Sanitize householdContext and actualSpent
    ├── household-budget.js            # Pure derived metrics/projection/status helpers
    ├── household-budget-renderer.js   # DOM-safe summary + row rendering
    ├── household-budget-controller.js # Modal draft/edit/save bindings
    └── render-orchestrator.js         # Call household renderer from renderAll()
```

### Pattern 1: Sanitizer-First Data Extension

**What:** Add data fields at the sanitizer boundary so loaded legacy records, imported JSON, share hashes, reset presets, and manual modal saves all converge to one shape. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52]  
**When to use:** Any persisted Step 1 field, especially `householdContext` and `actualSpent`. [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57]

**Recommended shape:**
```javascript
// Source: current Step 1 sanitizer/persistence pattern
{
  householdContext: {
    profile: "newlywed",
    incomeMode: "single-income", // or "dual-income"
    spouseMonthlyIncome: 0
  },
  expenseItems: [
    {
      id: "food",
      name: "식비",
      group: "변동비",
      amount: 600000,      // canonical monthly target in Won
      actualSpent: 250000, // current-month actual in Won, variable rows only
      accountId: "acc-living"
    }
  ]
}
```

### Pattern 2: Derived Budget Metrics, Not Stored Status

**What:** Store only inputs; derive `target`, `actual`, `remaining`, `progressRate`, `overspent`, `projectedMonthEnd`, and badge state in a pure helper. [VERIFIED: CodeGraph apps/main/modules/financial-summary.js:121]  
**When to use:** Summary panel metrics, modal rows, and tests. [VERIFIED: CodeGraph tests/step1.spec.ts:841]

**Recommended thresholds:** `초과` when actual > target, `주의` when actual pace projects above target or actual/target >= 80%, otherwise `여유`. [ASSUMED]

### Pattern 3: Explicit Modal Save

**What:** Modal edits should live in controller draft state and mutate durable state only on save. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:130]  
**When to use:** Household mode/spouse income fields and variable actual rows. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:407]

**Example:**
```javascript
// Source: current financial modal save pattern
const nextInputs = {
  ...baselineInputs,
  householdContext: nextHouseholdContext,
  expenseItems: nextExpenseItems,
};
persistence.commitImmediateInputs(nextInputs);
```

### Anti-Patterns to Avoid

- **Adding target fields that diverge from `expenseItems[].amount`:** Existing Sankey and projection use `amount`; separate unsynced targets would make the summary and Sankey disagree. [VERIFIED: CodeGraph apps/main/modules/calculator.js:38]
- **Saving actual spending before modal confirmation:** Existing Phase 09 behavior requires explicit save/cancel. [VERIFIED: CodeGraph tests/step1.spec.ts:919]
- **Rendering rows with `innerHTML`:** Current safe renderers build elements and set `textContent`; keep the same XSS boundary. [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:3]
- **Putting category-level tables on the default screen:** CONTEXT locks detailed rows inside the modal. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Money parsing/formatting | Custom regex or unit converter | `IsfUtils.toWon`, `sanitizeMoney`, `formatMoney`, `convertToKoreanWon` | Project convention requires Won-unit consistency and existing helpers. [VERIFIED: .planning/codebase/CONVENTIONS.md] |
| Persistence | New localStorage key or separate household store | `persistence.commitImmediateInputs()` | Keeps save/import/share/backup/render flow unified. [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57] |
| Sanitization/migration | Ad hoc load-time patches in renderer | `sanitizeInputs()` and helper functions | Existing state initialization and imports already route through sanitizer. [VERIFIED: CodeGraph apps/main/modules/state.js:12] |
| Modal framework | A second modal lifecycle system | Existing financial modal pattern or a small controller matching it | Preserves explicit save/cancel and mobile density. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:363] |
| Budget status storage | Persisting `status`, `remaining`, `projection` | Pure derived helper | Avoids stale derived values when date or actual changes. [ASSUMED] |

**Key insight:** Phase 10 is a data-shape and workflow extension, not a new application surface. The risk is inconsistent state, not missing UI primitives. [VERIFIED: CodeGraph apps/main/modules/persistence-controller.js:57]

## Common Pitfalls

### Pitfall 1: Unknown Expense Fields Get Dropped
**What goes wrong:** Adding `actualSpent` only in the modal draft will not survive sanitization unless `sanitizeAllocationItems()` or an expense-specific wrapper preserves it. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:327]  
**Why it happens:** `sanitizeAllocationItems()` reconstructs a narrow `normalizedItem` with only `id`, `name`, `amount`, `accountId`, optional `group`, optional `annualRate`, and optional maturity fields. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:327]  
**How to avoid:** Add an expense-specific post-processing step in `sanitizeExpenseItems()` that preserves `actualSpent` only when `group === "변동비"` or another deterministic variable-expense predicate matches. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:222]  
**Warning signs:** Saved `actualSpent` exists in modal state but disappears after page reload or JSON export/import. [ASSUMED]

### Pitfall 2: Duplicate Household Income
**What goes wrong:** Spouse income is added to both `householdContext.spouseMonthlyIncome` and `incomes[]`, inflating household metrics or Sankey flow against the resolved Phase 10 boundary. [VERIFIED: user final decision 2026-06-19]
**Why it happens:** Current Sankey derives income from `incomes[]`, while Phase 10 household context is separate. [VERIFIED: CodeGraph apps/main/modules/calculator.js:26]  
**How to avoid:** For Phase 10, treat spouse income as household budget context only; do not add an automatic spouse income row to `incomes[]`, and do not alter Sankey income rows. [VERIFIED: user final decision 2026-06-19]
**Warning signs:** `총수입` Sankey node changes when only household context spouse income is edited. [VERIFIED: user final decision 2026-06-19]

### Pitfall 3: Projection Division Edge Cases
**What goes wrong:** Early-month or invalid-date projection returns Infinity/NaN. [ASSUMED]  
**Why it happens:** Projection divides by elapsed days. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md]  
**How to avoid:** Use `elapsedDays = clamp(today.getDate(), 1, daysInMonth)` and return 0 when actual is 0. [ASSUMED]  
**Warning signs:** Summary panel shows `NaN원`, `Infinity`, or empty projection text. [ASSUMED]

### Pitfall 4: Summary Panel Becomes a Full Editor
**What goes wrong:** Default screen gains dense rows and inputs, undoing Phase 09 summary-first direction. [VERIFIED: .planning/milestones/v1.8-phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md]  
**Why it happens:** Budget tracking naturally invites per-category rows. [ASSUMED]  
**How to avoid:** Default panel shows only the three locked metrics and status badge; rows stay in the modal. [VERIFIED: .planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md]  
**Warning signs:** More than three household metrics or per-item inputs appear before Sankey. [ASSUMED]

## Code Examples

### Sanitize Variable Expense Actuals

```javascript
// Source: recommended extension to current input-sanitizer.js pattern
function isVariableExpenseItem(item) {
  return normalizeAllocationGroupName(item?.group) === "변동비";
}

export function sanitizeExpenseItems(items, fallbackAmount) {
  const normalized = sanitizeAllocationItems(items, DEFAULT_EXPENSE_ITEMS, fallbackAmount, "expense", "생활비");
  const rawById = new Map((Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object" && typeof item.id === "string")
    .map((item) => [item.id.trim(), item]));

  return normalized.map((item) => {
    if (!isVariableExpenseItem(item)) return item;
    const raw = rawById.get(item.id) || {};
    return {
      ...item,
      actualSpent: window.IsfUtils.sanitizeMoney(raw.actualSpent, 0, 0),
    };
  });
}
```

### Build Month-Progress Projection

```javascript
// Source: Phase 10 CONTEXT D-14, implemented as a pure helper
export function projectMonthEndSpending(actualSpent, now = new Date()) {
  const safeActual = window.IsfUtils.sanitizeMoney(actualSpent, 0, 0);
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const elapsedDays = Math.min(daysInMonth, Math.max(1, now.getDate()));
  return Math.round((safeActual / elapsedDays) * daysInMonth);
}
```

### Save Household Modal Draft Explicitly

```javascript
// Source: current financial-modal-controller.js save contract
function saveHouseholdBudgetDraft() {
  const nextInputs = {
    ...baselineInputs,
    householdContext: draftHouseholdContext,
    expenseItems: draftExpenseItems,
  };
  persistence.commitImmediateInputs(nextInputs);
  close();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dense Step 1 inputs on default screen | Summary-first cards with modal detail editing | Phase 09 / 2026-06-19 project state | Phase 10 must add a compact entry panel, not a full editor. [VERIFIED: .planning/STATE.md] |
| Item edits directly visible in broad panels | Modal draft state and explicit save | Phase 09 | Household budget edits should follow draft/save/cancel. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:407] |
| Missing account fallback inside visual layers | Account repair at sanitizer boundary | Phase 09 | Budget fields should follow the same sanitizer-boundary philosophy. [VERIFIED: .planning/STATE.md] |
| Manual account transfer settings | Source account-driven automatic flow | Phase 09 | Phase 10 should not reintroduce a separate account-management or transfer surface. [VERIFIED: CodeGraph tests/step1.spec.ts:1017] |

**Deprecated/outdated:**
- Separate account-management/product surface: rejected by Phase 09 and Phase 10 context. [VERIFIED: .planning/milestones/v1.8-phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md]
- Live banking or transaction scraping: out of scope for v1.9 and Phase 10. [VERIFIED: .planning/REQUIREMENTS.md]
- Real-estate affordability and historical comparison inside Phase 10: deferred to later phases. [VERIFIED: .planning/ROADMAP.md]

## Assumptions And Resolved Decisions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Status thresholds should be `초과` when actual > target, `주의` when projected over target or actual/target >= 80%, otherwise `여유`. | Architecture Patterns | Planner may choose a different deterministic threshold, requiring test expectation changes. |
| A2 | RESOLVED 2026-06-19: Spouse income affects only Step 1.2 household budget metrics in Phase 10 and must not automatically create or alter Sankey income rows. | Common Pitfalls / Open Questions (RESOLVED) | If implementation changes `incomes[]` or Sankey rows from spouse income in Phase 10, it violates the Phase 10 boundary; Sankey/dual-flow household merge belongs to Phase 12. |
| A3 | Derived budget status/projection should not be persisted. | Don't Hand-Roll | If later features need audit trails, a future event/history model may be required. |
| A4 | Projection helper should clamp elapsed days to avoid NaN/Infinity. | Common Pitfalls | Bad date handling could create broken UI labels. |

## Open Questions (RESOLVED)

1. **Should spouse income change Sankey in Phase 10?**
   - What we know: Phase 12 owns dual-flow household merge, and Phase 10 must preserve current Step 1 Sankey behavior. [VERIFIED: .planning/ROADMAP.md]
   - RESOLVED: Spouse income in Phase 10 affects only Step 1.2 household budget metrics. It must not automatically create income rows, mutate existing `incomes[]`, or alter Sankey income flows. Sankey/dual-flow household merge is Phase 12. [VERIFIED: user final decision 2026-06-19]
   - Planning consequence: Plans should keep spouse income in `householdContext.spouseMonthlyIncome` and use it only for household budget summary/modal calculations.

2. **What exactly defines "variable expense"?**
   - What we know: Preset output includes `변동비`, and Phase 10 says only variable expenses get tracking. [VERIFIED: .planning/milestones/v1.8-phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md]
   - RESOLVED: Variable expense in Phase 10 means expense rows normalized to the `변동비` group/predicate used by the Step 1 budget model. Fixed expense rows do not receive actual-spending controls. [VERIFIED: user final decision 2026-06-19]
   - Planning consequence: `actualSpent` is preserved and rendered only for rows where `isVariableExpenseItem(item)` resolves true for the Step 1 `변동비` predicate; fixed rows keep planned values only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, TypeScript, tests | Yes | v24.15.0 | — |
| npm | scripts and dependency commands | Yes | 11.10.0 | — |
| Playwright | `tests/step1.spec.ts` browser regression | Yes | 1.60.0 | Manual browser smoke only if unavailable |
| Vite | local app serving/build | Yes via package.json | 5.3.1 declared | Static file path tests where possible |

**Missing dependencies with no fallback:** none  
**Missing dependencies with fallback:** none

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Static local-first app has no login/auth surface in Phase 10. [VERIFIED: .planning/codebase/STACK.md] |
| V3 Session Management | no | No server session or cookie session is introduced. [VERIFIED: .planning/codebase/STACK.md] |
| V4 Access Control | no | No multi-user backend authorization boundary is introduced. [VERIFIED: .planning/codebase/STACK.md] |
| V5 Input Validation | yes | Sanitize numeric fields through `sanitizeInputs()` and `IsfUtils.sanitizeMoney`; render user text via DOM/textContent. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52] [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:3] |
| V6 Cryptography | no | No new crypto, secrets, or credential handling in Phase 10. [ASSUMED] |

### Known Threat Patterns for Vanilla Step 1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS through imported item/group names | Tampering / Information Disclosure | Build DOM nodes and assign `textContent`; do not use string HTML for user data. [VERIFIED: CodeGraph apps/main/modules/financial-summary-renderer.js:3] |
| Numeric injection or unit confusion | Tampering | Use `IsfUtils.toWon` and `sanitizeMoney`; store internal values in Won. [VERIFIED: .planning/codebase/CONVENTIONS.md] |
| Data corruption through legacy records | Tampering | Keep migration/sanitization at `sanitizeInputs()` and preserve legacy defaults. [VERIFIED: CodeGraph apps/main/modules/input-sanitizer.js:52] |
| Accidental local data overwrite | Tampering | Keep modal drafts isolated until explicit `commitImmediateInputs()` save. [VERIFIED: CodeGraph apps/main/modules/financial-modal-controller.js:407] |

## Targeted Verification Strategy

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`, so the full Validation Architecture section is omitted. [VERIFIED: .planning/config.json]

Planner should still add focused checks:

| Requirement | Suggested Test | Command |
|-------------|----------------|---------|
| HH-01 | E2E: compact `신혼부부 예산` panel opens modal and closing returns to Step 1 summary/Sankey without data loss. | `npx playwright test tests/step1.spec.ts -g "Phase 10"` |
| HH-02 | E2E/unit-in-page: sanitizer defaults `householdContext` to one-income and accepts spouse income 0/nonzero. | `npx playwright test tests/step1.spec.ts -g "Phase 10"` |
| BUD-01/BUD-02 | E2E: variable row target amount and actual spending save only after modal save. | `npx playwright test tests/step1.spec.ts -g "Phase 10"` |
| BUD-03 | E2E: row displays remaining, overspend, and status badge for under/over target cases. | `npx playwright test tests/step1.spec.ts -g "Phase 10"` |
| BUD-04 | Unit-in-page: projection formula with fixed dates avoids NaN/Infinity and matches expected Won output. | `npx playwright test tests/step1.spec.ts -g "Phase 10"` |
| Regression | Existing Phase 09 summary-first, modal, Sankey, tooltip, and mobile tests remain green. | `npx playwright test tests/step1.spec.ts` |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md` - locked Phase 10 decisions and deferred scope.
- `.planning/REQUIREMENTS.md` - HH-01, HH-02, BUD-01 through BUD-04.
- `.planning/ROADMAP.md` - Phase 10 success criteria and later phase boundaries.
- `.planning/STATE.md` - current Phase 09 decisions and Step 1 summary/modal/Sankey constraints.
- `.planning/codebase/CONVENTIONS.md` - Won-unit, sanitizer boundary, summary/modal ownership.
- `apps/main/modules/input-sanitizer.js` via CodeGraph - current sanitizer and allocation item normalization.
- `apps/main/modules/persistence-controller.js` via CodeGraph - `commitImmediateInputs()` save boundary.
- `apps/main/modules/financial-summary.js` and `financial-summary-renderer.js` via CodeGraph - summary view model/rendering.
- `apps/main/modules/financial-modal-controller.js` via CodeGraph - modal draft/edit/save behavior.
- `apps/main/modules/render-orchestrator.js` via CodeGraph - render pipeline.
- `tests/step1.spec.ts` via CodeGraph - current Step 1 regression coverage.

### Secondary (MEDIUM confidence)
- `.planning/codebase/STACK.md` - declared stack and platform constraints.
- `package.json` - declared scripts and dependency versions.

### Tertiary (LOW confidence)
- Assumed threshold recommendations; spouse-income/Sankey and variable-expense definitions are resolved in Open Questions (RESOLVED).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing package/tooling and Step 1 modules were verified locally and via CodeGraph.
- Architecture: HIGH - current render/sanitize/persist/modal flow was verified from source.
- Data shape recommendation: MEDIUM - backward-compatible approach is strongly supported by current code, but exact field naming is explicitly planner discretion.
- Pitfalls: MEDIUM - sanitizer field-dropping is verified; threshold/status includes assumptions, while spouse-income/Sankey and variable-expense semantics are resolved above.
- Security: MEDIUM - local input/render controls are verified; ASVS applicability is scoped to a static local-first app.

**Research date:** 2026-06-19  
**Valid until:** 2026-07-19 for codebase-local architecture, or until Step 1 sanitizer/modal/render flow changes.
