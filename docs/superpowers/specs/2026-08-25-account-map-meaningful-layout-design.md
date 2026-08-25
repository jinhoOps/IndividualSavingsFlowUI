# Account Map Meaningful Layout Design

**Date:** 2026-08-25

**Status:** Approved design; implementation pending

**Scope:** Replace the purpose/account layout toggle with one deterministic, account-first map that lets a user find the primary monthly income account first and inspect an account's purpose-linked monthly composition only when needed.

## 1. Authority and Boundary

This design supersedes only the map-presentation, layout-selection, linear-table reading-order, and related acceptance clauses in [Account Map Purpose-Node Flow Design](2026-08-13-account-map-purpose-node-flow-design.md). It does not change the persisted `AccountMapAppliedV1`/`AccountMapDraftV1` data contract, the `PurposeLocationLink` meaning, Main ownership, Account Map's `workspace.locations` and `workspace.accountMap` write set, editing modal, archive/restore, or semantic zoom contract unless explicitly stated below.

The existing `layout: 'purpose' | 'account'` field is presentation-only state. The new map must not use it to render a second layout, and a legacy saved value must remain readable without migration failure or any write solely to normalize it. A later workspace write may retain the value for compatibility or remove it through an explicitly approved schema migration; this feature does neither.

The map is an explanation of monthly plan connections, not a transaction ledger or an actual-transfer path. A connecting line means that a purpose and a financial location have an active monthly link. It must not use arrowheads or copy that claims money is transferred directly from one location node to another.

## 2. User Outcome

On first view, the user can answer: **"Which account is connected to my main monthly income, and which accounts matter most in the plan?"**

On hover, keyboard focus, tap, or click, the user can answer: **"Which monthly purposes are connected to this account, and in what share?"**

The map must not require a user to choose between `목적 중심` and `계좌 중심` before either answer is available.

## 3. Chosen Presentation

### 3.1 A single account-first map

- Remove the `목적 중심` / `계좌 중심` controls and their persisted-layout mutation from the applied-map UI.
- Keep the existing graph's location, purpose, status nodes and active/suspended link filtering. No node is duplicated and no new transfer relationship is inferred.
- Keep each ordinary node's dimensions invariant to its amount. Existing responsive fitting may vary dimensions by viewport and visible-node count, but amount must not change a node's size or make an edge thicker, darker, or otherwise more visually dominant.
- Keep edge treatment neutral. Connection amount is disclosed only through the existing focused/pinned state and the account detail described below.
- Keep `전체`, `기본`, and `상세` semantic zoom, pan behavior, node modal, and reduced-motion behavior. Zoom changes density; it does not restore an alternative layout.

### 3.2 Primary-income anchor

For an applied map, calculate each active location's income weight from **all** active `system:income` links in the applied data, before semantic-zoom filtering. Sum each location's income-link amounts. The location with the greatest weight is the **primary income account**.

- Desktop: place the primary income account in the first, top-left slot.
- Mobile: place it in the first, topmost grid slot.
- When income weights tie, sort by normalized `shortName`, then stable location ID. This prevents a visually unexplained position change.
- `전체` zoom must choose the primary income account as the `system:income` representative even when it is not the first stored link. It must not fall back to storage order.
- If no active income link exists, there is no false account anchor. Keep locations in their normal deterministic order and place `system:income` first in the purpose column with its existing unresolved state.

The anchor is a position rule, not a larger node, a special edge, or a different interaction target. Its accessible name adds `주 수입 계좌` only when it is a real location anchor.

### 3.3 Deterministic visual weight

Every non-status node receives a stable layout weight. The map uses that weight only to select a slot; it never changes the node or edge's visual dimensions.

1. Primary income account.
2. Other locations, ordered by their sum of active link amounts, then active-link count, normalized name, and stable ID.
3. System purposes, ordered `수입`, `주거`, `생활비`, `저축`, `투자`.
4. Active custom purposes, ordered by parent system-purpose order, target amount descending, normalized name, and stable ID.
5. Status nodes, after ordinary nodes.

On desktop, use one stable two-column relationship map: locations occupy the left column and purposes the right column. The primary income account is the first location and therefore the top-left node. Other locations continue down the left column in their deterministic order. System purposes and then custom purposes continue down the right column in their deterministic order. Status nodes retain the existing centered, non-endpoint treatment.

On mobile, preserve the same reading order in the existing responsive grid: locations first, with the primary income account in the topmost slot, followed by purposes. This mobile order is not evidence of a transfer sequence.

This is deliberately a ranked graph layout rather than a force simulation: the same data and viewport always produce the same positions, so a user can build spatial memory and keyboard focus order remains predictable.

## 4. Progressive Account Detail

Node interaction retains the existing transient, pinned, then modal state machine. The change is the content revealed before editing.

- Hover and keyboard focus show the existing relationship emphasis plus a static concise account connection detail for a location node.
- First tap/click/Enter/Space pins the same detail so touch users can read it without hover. It does not open the edit modal.
- Second activation opens the existing edit modal. Purpose nodes retain their current purpose summary and edit behavior; they do not pretend to be accounts.
- Leaving or blurring a transient node clears only the transient detail. `Escape`, background activation, and the existing focus rules continue to clear a pinned detail.

For a focused or pinned location, include only active links in the **월 연결 구성** detail:

```text
해당 계좌의 월 연결 합계 = sum(active link.monthlyAmountWon for location)
목적별 월 연결 비중 = purpose link monthlyAmountWon / 해당 계좌의 월 연결 합계
```

Each purpose is listed once. Multiple active links that resolve to the same purpose are summed before the percentage is calculated. A zero-total location has no percentage breakdown and instead states that it has no active monthly connection. The detail labels the figures `월 계획 연결 기준 · 실제 잔액·거래·계좌 간 이동이 아님`. Link amounts remain available in the modal and accessible relationship table.

The detail is a compact, non-modal disclosure adjacent to the pinned/focused node when it fits, and otherwise is contained within the map surface without viewport overflow. It must not obscure an actionable control or become a black browser-style tooltip.

## 5. Motion and Accessibility

The percentage breakdown may use anime.js only when an account becomes pinned by first tap/click/Enter/Space. Hover and keyboard focus always show the final static detail. Each row enters once from its final proportion; it must not continuously pulse, resize graph nodes, change edge appearance, or replay during ordinary layout measurement or focus movement.

- The final static percentage and label are present in the DOM before or at the start of the animation.
- `prefers-reduced-motion: reduce` renders the final detail immediately with no anime.js motion.
- Hover, keyboard focus, tap, and click expose equivalent account information. Touch users can dismiss the pinned detail through the existing background or Escape-equivalent behavior.
- The location node's accessible name continues to include kind, name, connection count and summary amount; add primary-income status where applicable.
- The linear relationship table follows this one canonical account-first ordering: primary income account first, then the remaining locations by the deterministic layout weight; each location lists linked purpose and amount. It no longer changes reading order for a removed layout toggle.
- At 390px, 768px, and desktop widths, the disclosure stays inside the map/card bounds, preserves 44px targets, and does not hide map content or modal controls.

## 6. Data and Failure Handling

- Layout computation is pure and derives only from the graph passed to it, viewport, and zoom. It makes no storage write.
- A missing, archived, suspended, or zero-value candidate never becomes a false primary-income account. The no-anchor recovery in section 3.2 is used instead.
- Updating Main, archiving a location, or changing a link may change the deterministic ranking after the next render. It must clear a transient/pinned target that is no longer visible using the current interaction contract rather than retaining stale detail.
- Existing conflict recovery, modal input preservation, atomic link writes, and Main/Simulation/Portfolio deep-equality guarantees remain unchanged.

## 7. Documentation and Migration Updates During Implementation

Implementation must amend the current Product PRD, `DESIGN.md`, and the 2026-08-13 purpose-node design so they no longer claim a purpose/account layout choice, a saved layout selection, or toggle-dependent table order. Historical plans remain historical records and are not rewritten.

## 8. Acceptance Criteria

- The applied map presents no `목적 중심` or `계좌 중심` control, while legacy applied data containing either layout value still loads.
- Given two or more income-linked locations, the greatest active `system:income` total is the first desktop/mobile slot and the overview representative; tie handling is deterministic.
- At the same viewport, visible-node count, and visual state, ordinary-node dimensions and edge styling are invariant to amount.
- The same graph, viewport, and zoom always produce the same node order and no overlap; desktop uses the account-left/purpose-right two-column map with the primary anchor in the top-left slot, and mobile uses it in the topmost slot.
- Amount ranking changes only placement order. It does not create synthetic transfers, arrow direction, duplicate location nodes, or persisted coordinates.
- A location hover/focus/pin shows an active-link, purpose-aggregated **월 연결 구성** whose percentages sum to 100% subject only to displayed rounding; it is labelled as a monthly-plan connection measure, not a balance, transaction, or transfer-path measure. Zero-total locations state the empty condition.
- The percentage detail is available through pointer, keyboard, and touch without requiring the edit modal; second activation still opens the existing modal.
- Anime.js detail motion is one-shot only for a newly pinned account, remains static for hover/focus, and is replaced by its final static state under reduced motion.
- Purpose details, status nodes, semantic zoom, modal editing, archive/restore, storage ownership, and whole-workspace compatibility continue to meet the superseded design's requirements.
- The account-first linear table, node labels, 390px/768px/desktop containment, focus order, and touch-target behavior are covered by focused unit and Playwright tests.

## 9. Required Verification

- Focused `mapLayout` tests for primary-income selection from unfiltered active links, overview representative selection, tie order, no-anchor recovery, desktop two-column/mobile anchor slots, fixed dimensions, and deterministic node order.
- Focused `AccountMapCanvas` tests for removed controls, canonical table order, transient/pinned 월 연결 구성, purpose aggregation, connection-not-transfer copy, zero-total copy, and pointer/keyboard/touch parity.
- Focused motion tests for pin-only one-shot detail animation, static hover/focus detail, and `prefers-reduced-motion` final-state rendering.
- Account Map Playwright coverage at 390px, 768px, and desktop for no horizontal overflow, map/detail containment, focus progression, 44px controls, and visualization visibility.
- `npm run check`, Account Map unit tests, `npx playwright test tests/account-map.spec.ts`, and the repository's relevant cross-app regression suite.
- `git diff --check` and document cross-check against the Product PRD, `DESIGN.md`, and the amended 2026-08-13 design.
