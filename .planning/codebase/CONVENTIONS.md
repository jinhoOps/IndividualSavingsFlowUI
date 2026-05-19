# Coding Conventions

**Analysis Date:** 2026-05-12

## Naming Patterns

**Files:**
- Kebab-case for utility and component files: `clipboard-parser.js`, `step-theme.css`.
- Simple name for entry points: `app.js`, `utils.js`.
- Test files suffix: `.test.js`.

**Functions:**
- CamelCase for logic and UI actions: `formatMoney`, `calculateIncomeTax`, `bindControls`.
- Action-prefixed for UI: `handleSaveSnapshot`, `syncBackupUi`.

**Variables:**
- CamelCase for instances and state: `selectedPresetStyle`, `currentInputs`.
- DOM elements often prefixed/grouped in `dom` object: `dom.inputsForm`, `dom.saveSnapshotBtn`.

**Types/Constants:**
- UPPER_SNAKE_CASE for global constants: `MONEY_UNIT`, `STORAGE_KEY`, `FINANCIAL_INCOME_WARN_THRESHOLD_WON`.

**CSS:**
- BEM (Block Element Modifier) or Snake-case: `income-row`, `status-badge--warn`, `card__label`.
- Utility classes with `is-` prefix: `is-active`, `is-dirty`.

## Code Style

**Formatting:**
- Indentation: 2 spaces.
- Semicolons: Required.
- Quotes: Double quotes for HTML/Strings, single/double mix in JS (mostly double).

**Linting:**
- `typescript` (tsc) used for type checking and basic linting (`npm run lint`).
- No explicit ESLint/Prettier config found in root, but scripts are defined.

**3-Layer Architecture (JS):**
- **State**: Centralized `state` object for application data. `apps/step1/modules/state.js`.
- **Helpers**: Pure functions for calculation and data transformation. `apps/step1/modules/calculator.js`, `apps/step1/modules/input-sanitizer.js`.
- **UI/DOM**: Event binding and rendering logic. `apps/step1/app.js`, `apps/step1/modules/dom.js`.

## Import Organization

**Order:**
1. External/Core utilities: `import { IsfUtils } from "../../shared/core/utils.js";`
2. Constants: `import { ... } from "./modules/constants.js";`
3. Domain logic/sanitizers: `import { ... } from "./modules/input-sanitizer.js";`
4. UI/State: `import { dom } from "./modules/dom.js";`, `import { state } from "./modules/state.js";`

**Path Aliases:**
- Not explicitly configured in Vite for JS, uses relative paths.

## Error Handling

**Patterns:**
- Try-catch blocks for I/O operations (Storage, IDB).
- Fallback values in sanitizers: `sanitizeMoney(value, fallback = 0)`.
- User-facing feedback via `window.IsfFeedback`.

## Domain-Specific Rules (Critical)

**Unit Consistency:**
- **UI Level**: Use **만원 (Man-won)** for all user inputs and displays.
- **Logic/Storage Level**: Use **원 (Won)** for all internal calculations and persisted data.
- **Conversion**: Always use `IsfUtils.toWon()` when reading from UI and `IsfUtils.toMan()` when rendering to UI.

**Currency Display:**
- 10,000 만원 (1억) 이상: `X 억 Y 만원` 형태로 표기.
- Helper: `IsfUtils.formatMoney()`.

**Thresholds:**
- 연간 이자/배당 소득 **1,900만 원** 초과: `warn` (과세주의).
- 연간 이자/배당 소득 **3,400만 원** 초과: `crit` (과세경고).

## Module Design

**Exports:**
- Named exports preferred for modules.
- IIFE wrappers for shared legacy core files (`shared/core/utils.js`) to support both ESM and global `window` access.

**Physical Integrity:**
- CSS/HTML 수정 시 파일 하단의 `@media` 쿼리가 누락되지 않도록 주의.

---

*Convention analysis: 2026-05-12*
