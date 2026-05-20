# Codebase Conventions

This document outlines the core conventions and standards established for the Individual Savings Flow UI project.

## 1. Architectural Integrity

*   **Three-Tier Architecture:** Logic within apps is consistently separated into three layers: `State`, `Helpers`, and `UI`. This structure must be preserved during all modifications.
*   **Helper Functions Preservation:** Essential helper functions (e.g., `markDirty` and other 14+ specific methods) form the core of the state management and synchronization. These must not be removed or altered without explicit architectural approval.
*   **No-build Orientation (Modern Hybrid):** The application prioritizes pure CSS and JS to ensure immediate browser executability. While modern tools like Vite, TypeScript, and Tailwind CSS are present (mainly to facilitate future migrations like React integration), the fundamental vanilla HTML/CSS/JS capability should remain respected wherever applicable.
*   **Surgical Edits:** Agents and developers must implement "Surgical Changes"—only modifying code strictly related to the current task. Unrelated code or perceived stylistic "improvements" should not be touched unless it's unused variable cleanup.

## 2. Style and Responsive Rules

*   **Physical CSS Integrity:** Do not truncate or modify the bottom structure of CSS files where media queries and utility classes reside. Ensure the file length and structure are properly compared pre- and post-modification.
*   **Responsive Priority:** Layouts must natively support mobile resolution (<= 760px) without breaking. Visual validation is required in Evaluator phases.
*   **CSS Naming Conventions:** All CSS class naming must adhere strictly to either **BEM** (`block__element--modifier`) or **Snake Case** (using hyphens/underscores consistently) to maintain styling uniformity.

## 3. Unit and Currency Consistency

Currency unit integrity is a critical rule for this financial application.

*   **Storage & Calculation:** All internal computations and persistent storage data are handled in **Won (원)**.
*   **UI Display:** All user inputs and visible UI texts are represented in **Manwon (만원)**.
*   **Large Value Formatting:** Values greater than or equal to 1억 원 (10,000 만원) must be displayed as `X 억 Y 만원` to optimize readability.
*   **Utility Usage:** Always use the `IsfUtils` functions for conversion to prevent precision and semantic errors:
    *   `IsfUtils.toWon()`: Manwon -> Won
    *   `IsfUtils.toMan()`: Won -> Manwon
    *   `IsfUtils.formatMoney()`: Formatting string outputs.

## 4. Domain & Finance Logic Rules

*   **Financial Comprehensive Income Tax Warnings:**
    *   If annual interest/dividend income exceeds **19,000,000 Won**, UI must display a `warn` alert.
    *   If it exceeds **34,000,000 Won**, UI must display a `crit` alert.

## 5. Development Etiquette

*   **Language & Encoding:** All responses, documentation, and source code text must use **Korean (존댓말)** and **UTF-8** encoding.
*   **No Human-Targeted Comments:** Avoid writing descriptive/explanatory comments in JavaScript files aimed at humans. The codebase is primarily maintained by agents, and the code should be self-explanatory.
