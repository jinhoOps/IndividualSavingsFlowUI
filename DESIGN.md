## Overview (Visual Theme & Atmosphere)

Individual Savings Flow (ISF) is designed to be an accessible yet precise financial tracking application. The base atmosphere is built on a **paper-like canvas (ISF Pearl)** combined with **Glassmorphism panels**, creating a clean, modern, and trustworthy financial tool that avoids the sterile, intimidating feel of traditional spreadsheets.

The design philosophy is deeply rooted in Donald Norman's **Human-Centered Design (HCD) 6 Principles**:
1. **Discoverability**: Constant visibility of the overall structure via `AppHeader` and hierarchical information disclosure.
2. **Feedback**: Immediate status updates via Pending Bar (dirty state), Toast Messages, and interactive button states (scale down).
3. **Conceptual Model**: Strict unit consistency (UI shows **만원**, Storage keeps **원**). A logical flow from Summary → Visualization → Controls → Projection.
4. **Mapping**: Real-time visualization updates (Sankey/Charts) directly mapped to input changes.
5. **Constraints**: Input validation (positive numbers only) and rational boundaries for simulation limits (e.g., max 40 years).
6. **Signifiers**: Clear interactive cues using distinct border radii, shadows, and status indicators.

## Colors

### Brand & Accent
- **ISF Sunset / Primary** (`{colors.primary}` / `var(--tone-primary)` — #ea5b2a): The core brand identity color, used for primary actions, critical CTA, and active states.
- **ISF Deep Sea / Accent** (`{colors.accent}` / `var(--tone-accent)` — #1e8b7c): Secondary emphasis, positive values, and income indicators.

### Surface & Background
- **ISF Pearl / Canvas** (`{colors.canvas}` / `var(--bg)` — #f3f4ef): The main background color providing a soft, paper-like texture to reduce eye strain.
- **Glass Panel** (`{colors.surface-glass}` / `var(--panel)` — rgba(255, 255, 255, 0.9)): Translucent panels used for cards and modular sections to create depth without heavy drop shadows.

## Typography

### Font Family
The typography primarily uses **Gowun Dodum** for a clean, modern, and highly legible experience across both data and body text. **Black Han Sans** may be used as a secondary fallback for high-impact numerical displays if needed, but consistency is maintained by prioritizing Gowun Dodum.

### Hierarchy

| Token | Size | Weight | Use |
|---|---|---|---|
| `{typography.display}` | 32px | Bold | Major section headers, large summary figures — Gowun Dodum |
| `{typography.title-lg}` | 24px | Bold | Card titles, primary data points — Gowun Dodum |
| `{typography.title-md}` | 18px | Bold | Sub-section headers, modal titles — Gowun Dodum |
| `{typography.body-md}` | 16px | Regular | Default running-text, standard inputs — Gowun Dodum |
| `{typography.caption}` | 14px | Regular | Helper text, small labels, units (만원) — Gowun Dodum |

## Components

### Navigation & Feedback
- **`AppHeader`**: Persistent top navigation exposing the application structure (Step 1, Step 2) and global status indicators (Sync Banner).
- **`Pending Bar`**: Floating action bar at the bottom appearing only when data is modified (dirty state) with 'Save' and 'Cancel' actions.
- **`Toast Message`**: Handled via `FeedbackManager` for non-blocking success/error notifications.

### Interactive Elements
- **`Button`**: Distinct physical feedback using `transform: scale(0.96)` on `:active`. Rounded `{rounded.pill}` for primary CTAs.
- **`Input`**: Standardized numeric inputs tailored for currency (만원), rounded `{rounded.sm}` (8px).
- **`DataHubModal`**: A centralized modal for backup, sharing, and history, ensuring a unified mental model for data management.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 14px · `{spacing.lg}` 24px · `{spacing.xl}` 32px.
- **Card internal padding:** Typically `24px` to allow data to breathe.

### Information Architecture (Panel Flow)
The layout follows a strict cognitive sequence to reduce user load:
1. **Summary**: High-level overview.
2. **Visualization**: Sankey or Dividend Charts.
3. **Controls**: Detailed numeric inputs.
4. **Projection**: Future simulations and timelines.

## Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, `{colors.canvas}` background | Base application floor |
| Glass Panel | Translucent background + subtle blur + faint border | Primary content cards, input groupings |
| Floating | Drop shadow, elevated z-index | Pending Bar, DataHubModal, Toast Messages |

## Do's and Don'ts

### Do
- **Unit Consistency**: Always display values in **만원** to the user, but persist and compute internally in **원**. Use `IsfUtils` for conversions.
- **Component Reuse**: Check `shared/` directory (Header, Feedback) before building new UI elements.
- **Immediate Feedback**: Always trigger the Pending Bar when state is dirtied.
- **Modern Hybrid (No-build Oriented)**: Prefer vanilla ES6 modules for simplicity, but leverage Vite, TypeScript, and TailwindCSS for infrastructure stability and type safety. Maintain compatibility with legacy browser-native execution where possible.

### Don't
- Don't use heavy solid colors for cards; stick to the Glass Panel aesthetic on the ISF Pearl canvas.
- Don't truncate or break responsive CSS media queries during edits (Physical Integrity).
- Don't mix font families arbitrarily; Black Han Sans is for numbers/displays, Gowun Dodum is for reading.

## Responsive Behavior

### Breakpoints & Adaptability
- **Mobile-First Validation**: Layouts must visually hold up at <= 768px.
- **Touch Targets**: Buttons and interactive elements must be easily tappable on mobile devices.
- **PWA Ready**: The UI must function gracefully offline, with local persistence logic (`IsfStorageHub`) stepping in.

### Collapsing Strategy
- Complex charts (Sankey) scale down proportionally or switch to simplified summary views on very small screens.
- Multi-column control panels stack into single columns below 768px.

## Agent Prompt Guide

```yaml
context: "ISF UI Development"
design_rules:
  - "Use {colors.primary} (#ea5b2a) for primary actions."
  - "Use {colors.accent} (#1e8b7c) for positive indicators."
  - "Canvas is {colors.canvas} (#f3f4ef), cards are Glassmorphism panels."
  - "Format all currency inputs/displays in '만원' using IsfUtils."
  - "Persist all data in '원' via IsfStorageHub."
  - "Add transform: scale(0.96) to button :active states."
  - "Leverage Modern Hybrid infrastructure (Vite/TS/Tailwind) while respecting browser-native simplicity."
  - "Ensure responsive layouts don't break under 768px."
```
