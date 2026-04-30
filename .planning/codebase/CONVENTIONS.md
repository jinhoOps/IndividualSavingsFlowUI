# Coding Conventions

## Language
- **Core Principle**: All responses, comments, and documentation must be in **Korean (Polite/존댓말)** and **UTF-8**.

## Styling (CSS)
- **Methodology**: BEM (Block Element Modifier) or Snake Case (word-word) is used consistently.
- **Responsive**: Mobile-First design. Media queries (760px threshold) must be preserved at the bottom of the file.
- **Theme**: Uses variables defined in `shared/styles/step-theme.css`.

## Logic (JavaScript)
- **Module System**: ES6 Modules (`import`/`export`).
- **Architecture**: 3-Layer structure:
  1. **State**: Central source of truth.
  2. **Helper/Calculator**: Pure functions for data transformation.
  3. **UI**: DOM manipulation and event binding.
- **Units**:
  - UI Input/Display: **Man-won (만원)**.
  - Storage/Calculation: **Won (원)**.

## Documentation
- **LLM Wiki**: New patterns and architectural decisions must be updated in `.gemini/knowledge/wiki/`.
- **Audit Trail**: Major changes recorded in `log.md`.
