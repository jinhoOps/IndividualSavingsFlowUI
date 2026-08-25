# Current Product Money Input Formatting Design

**Date:** 2026-08-25

**Status:** Approved

**Scope:** Current TypeScript product money inputs and Portfolio add-item quick adjustments

## Goal

Every current TypeScript product direct Won input displays Korean thousands separators while editing, while calculations, validation, persistence, and reducer actions continue to receive safe integer Won values without separators.

Portfolio's `PortfolioItemSheet` receives four add-only quick amount controls directly below the amount input:

- `-50만`
- `-10만`
- `+10만`
- `+50만`

Each control applies its integer Won delta and clamps at 0 Won. The existing 1,000 Won minimum and monthly-investment ceiling remain unchanged.

## Shared input boundary

Move the existing caret-safe money normalization contract from the Main-only domain path to a narrow shared core helper. Keep the Main import path as a compatibility facade so Main's established behavior and tests remain stable.

The shared helper owns:

- parsing comma-separated or plain digit input to a safe integer Won value;
- formatting safe integer Won values for direct input display;
- digit-relative caret mapping after formatting;
- non-negative quick amount adjustment.

The helper must distinguish empty input from a displayed zero so each existing surface can preserve its current empty/zero behavior. It must never use `Number('1,000')` for calculation or validation.

## Surface behavior

- Portfolio item and cash inputs format on every edit and parse only at action/blur/submit boundaries.
- `PortfolioItemSheet` quick adjustments are rendered only for `mode="add"`; edit sheets retain the existing dialog, discard confirmation, Escape, focus containment, and return-focus behavior.
- Starting Principal formats typed values and keeps its existing large quick adjustment labels and zero clamp.
- Account Map setup, location picker, custom-purpose target, link amount, and restore target inputs format on edit and pass separator-free safe integers to callbacks and commands.
- Main `MoneyField`, Simulation `GoalAmountStep`, and Simulation `AdvancedSettings` retain their established contracts and receive regression coverage only unless shared-helper extraction requires import-only changes.

## Constraints

- No workspace schema, storage key, migration, Main ownership, cross-app write boundary, legacy route, or anime.js motion changes.
- No temporary inline styling; the new Portfolio controls use existing CSS conventions and a CSS-only layout addition.
- All new visible controls are at least 44px high, keyboard reachable, and expose their visible labels as accessible names.
- The four Portfolio controls remain on one row at 390px, and affected 390px, 768px, and desktop flows retain overflow containment, focus, touch-target, and visualization visibility.

## Verification

- Shared helper and affected component unit tests with an observed RED/GREEN cycle.
- `npm run check`.
- Focused Portfolio, Simulation, and Account Map unit tests.
- Portfolio, Simulation, and Account Map Playwright flows, including Portfolio sheet focus and 390px/768px/desktop containment checks.
- `git diff --check` and final status/diff inspection.
