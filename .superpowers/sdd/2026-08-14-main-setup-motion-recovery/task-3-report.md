# Task 3 report

## Files

- `src/main/ui/main.css`: changed the intro skip control from a pill to a quiet text-only visual while retaining the absolute safe-area position and 44px minimum hit area.
- `tests/unit/main/MainWelcomeIntro.test.tsx`: added computed-style assertions for the visual contract.

## TDD evidence

RED command:

```bash
npx vitest run tests/unit/main/MainWelcomeIntro.test.tsx
```

Result: expected failure in `focuses the one 44px skip button`; `backgroundColor` was `buttonface` instead of `rgba(0, 0, 0, 0)` against the existing pill CSS. The remaining 12 tests passed.

GREEN command:

```bash
npx vitest run tests/unit/main/MainWelcomeIntro.test.tsx
```

Result: still one failure with `buttonface`. Vitest/jsdom in this worktree creates zero `document.styleSheets` for the imported CSS, so `getComputedStyle` does not observe CSS rules. The assertion is intentionally retained as an observable computed-style check rather than replaced with a source-text assertion or test-only style injection.

## Implementation

Applied the brief’s exact quiet-control declarations: transparent default/hover background, zero border, zero radius, 54% text color, 600 weight, centered text, and preserved 44px minimum height, safe-area positioning, and focus-visible outline. `MainWelcomeIntro.tsx` was not modified.

## Self-review

- Only the two requested source/test files were changed.
- Button markup, accessible name, focus behavior, handlers, safe-area position, and hit-area size remain unchanged.
- `git diff --check` passes.

## Concerns

The focused unit test cannot reach GREEN under the current Vitest/jsdom CSS configuration because CSS imports are not installed into the document. Browser-level computed-style verification or a repository-level Vitest CSS setup adjustment is needed before claiming the unit test passes.
