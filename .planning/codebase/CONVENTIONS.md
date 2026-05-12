# Coding Conventions

**Analysis Date:** [YYYY-MM-DD]

## Naming Patterns

**Files:**
- Kebab-case for module and component files: `clipboard-parser.js`, `app-header.js`, `engine.test.ts`.

**Functions/Variables:**
- CamelCase for functions and variables.

**Types:**
- PascalCase for TypeScript interfaces and types.

## Code Style

**CSS:**
- BEM (Block Element Modifier) convention is strictly required for CSS class naming.

**Comments:**
- No descriptive comments in JS files. The codebase relies on self-documenting code and clear function names.

## Data & Security

**Data Integrity (Unit Consistency):**
- **UI Input/Display:** Man-won (만원) (e.g., 350 만원).
- **Internal Logic/Storage:** Won (원) (e.g., 3500000).
- **Required Conversion:** Must use `IsfUtils.toWon` and `IsfUtils.toMan` for all transitions between UI representation and State/Logic storage.

**Security:**
- **Input Sanitization:** `sanitizeInputs` is explicitly required for external data (e.g., external state injection, data merging) to prevent tampering and XSS.
- Example Location: `apps/step1/modules/input-sanitizer.js` and `apps/step1/modules/state.js`.

## Web Components & Memory

**Lifecycle Management:**
- EventListener lifecycle management must be strictly handled via `connectedCallback` and `disconnectedCallback` within Custom Elements to prevent memory leaks.
- Example Location: `shared/components/app-header.js` and `shared/components/data-hub-modal.js`.

---

*Convention analysis: [YYYY-MM-DD]*