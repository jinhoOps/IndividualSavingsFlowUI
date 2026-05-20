# Testing Strategy and Practices

This document outlines the testing methodologies used in the Individual Savings Flow UI project.

## 1. Testing Infrastructure

*   **Vitest Framework:** The project has `vitest` and `@vitest/ui` configured as dependencies in `package.json`. However, the current adoption of Vitest is minimal.
*   **Custom Test Scripts:** Existing tests (such as `shared/core/clipboard-parser.test.js`) are currently implemented as lightweight Node scripts using basic `console.log` assertions rather than a full test runner suite.
*   **Testing Commands:** Although `npm run check` and `npm run lint` are mapped to TypeScript validation (`tsc --noEmit`), automated test runners are not actively integrated into the primary build pipeline.

## 2. Agent-Driven Testing Methodology

Because the codebase relies heavily on agent operations, testing is generally defined by strict success criteria rather than extensive TDD unit tests.

*   **Goal-Driven Verification:** All execution plans must include explicit verification steps. Plans should be structured as:
    ```
    1. [Implementation Step] → verify: [observable check/assertion]
    2. [Implementation Step] → verify: [observable check/assertion]
    ```
*   **Evaluator Phase:** The validation cycle must proactively ensure that the system's core invariants are untouched.
*   **Responsive Regression Checking:** In UI validation, there is an absolute mandate to verify mobile layout integrity (resolutions <= 760px). The Evaluator must ensure no styles were broken.

## 3. Future Testing Recommendations

*   **Unit Tests Migration:** As the application scales and React is fully integrated, the existing script-based unit tests (`*.test.js`) should be migrated to the already installed `Vitest` framework to harness modern assertion APIs and test isolation.
*   **Type Checking:** The repository uses `tsc --noEmit` as its primary static analysis tool. Ensuring TypeScript definitions correctly reflect the vanilla JS `IsfUtils` and state modules will enhance reliability without requiring massive unit test coverage.
