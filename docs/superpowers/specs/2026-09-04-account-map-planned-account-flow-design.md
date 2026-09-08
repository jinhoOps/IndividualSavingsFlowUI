# Account Map Planned Account Flow Design

**Date:** 2026-09-04

**Status:** Implemented and verified on 2026-09-07. Final execution evidence is recorded in the [implementation plan](../plans/2026-09-04-account-map-planned-account-flow.md).

**Scope:** Replace the current purpose-to-location explanation map with a Main-assisted, explicitly confirmed monthly account-flow graph. Add planned many-to-many transfers between accounts, a remainder-routing rule, touch-first flow inspection, reusable financial-location editing, and a Main-owned edit overlay that visually remains inside Account Map without transferring Main ownership.

## 1. Authority and Current-Product Boundary

This design supersedes the presentation and relationship semantics in:

- [Account Map Meaningful Layout Design](2026-08-25-account-map-meaningful-layout-design.md)
- the map, interaction, setup, and editing clauses of [Account Map Purpose-Node Flow Design](2026-08-13-account-map-purpose-node-flow-design.md)
- the Account Map clauses in [Connected Account Map Workspace Design](2026-08-06-connected-account-map-workspace-design.md) where they describe purpose-to-location links as the only supported relationship

The Product PRD and `DESIGN.md` have been updated in the same implementation to describe planned account-to-account transfers and the Main-owned edit overlay. They remain the canonical product and UI contracts.

Main continues to own and write only its five monthly amounts. Account Map continues to read Main and may write only `workspace.locations` and `workspace.accountMap`. Simulation and Portfolio remain unchanged and read-only from Account Map's perspective.

The new flow is a user-declared **monthly plan**, not bank integration. It does not read balances or transactions, execute transfers, predict actual month-end cash, or claim that a remainder rule equals the user's real bank balance.

The retired `ConsumerInstrument` and `MonthlyFlow` contracts in `src/workspace/domain/accountMapContract.ts` are historical evidence only. They must not be reintroduced as a supported runtime path. The new contract is defined from the current Main, location, purpose-link, storage, and recovery boundaries.

## 2. Problem

The current Account Map combines income, housing, living, saving, and investing links into one location total and one 100% denominator. If a salary account receives 3.1 million won and also funds one or more outflow purposes, the same monthly plan appears as a larger undirected amount. A user can mistake that figure for balance, net inflow, or actual movement.

The current graph cannot describe common plans such as:

```text
Salary account -> living-expense account
Salary account -> brokerage account
Living-expense account -> brokerage account with whatever remains
```

The current touch contract also hides editing behind a second activation. Location creation asks for bank, brokerage, cash, institution, and display name, while location editing exposes only the display name. Setup and edit surfaces use different field implementations and the setup grid leaves a visually isolated final card at desktop widths.

## 3. User Outcome

Without selecting anything, the user can answer:

- Where does monthly income enter?
- Which accounts route money to which other accounts?
- Where are housing, living, saving, and investing amounts used or retained?
- Is any planned amount unassigned or short?

After touching, clicking, or focusing an account, the user can answer:

- What reaches this account from upstream?
- What leaves or is retained here?
- Which downstream accounts and purposes depend on it?
- Is a connection fixed or a "send the remainder" rule?

The user can edit a financial location's type, institution, and display name, edit a flow through an explicit action, and temporarily edit Main values without perceiving a disruptive app-to-app page replacement.

## 4. Chosen Approach

Use a **Main-assisted explicit flow graph**.

Main provides the five external monthly reference amounts. Existing purpose-to-location links identify where those amounts enter, are used, or are retained. Account Map may derive a transfer suggestion only when the topology is unambiguous, but no suggestion becomes stored product data until the user confirms it.

This approach is preferred over:

1. A fully manual graph, which is accurate but repeats amounts and creates unnecessary setup work.
2. A fully inferred graph, which is easy for a single salary account but becomes false when income sources or purpose destinations are many-to-many.
3. A visual-only regrouping of the current graph, which cannot represent the account-to-account flow the user wants and retains the mixed-total ambiguity.

## 5. Main Input and Suggestion Boundary

### 5.1 Values Account Map reads

Account Map reads the latest applied Main values:

- `monthlyNetIncomeWon`
- `monthlyHousingWon`
- `monthlyLivingWon`
- `monthlySavingWon`
- `monthlyInvestmentWon`

It may derive:

```text
consumption = housing + living
planned outflow = housing + living + saving + investing
overall remaining = income - planned outflow
```

It may also derive each system-purpose target and reconcile existing purpose-to-location allocations against that target.

### 5.2 Values Account Map cannot infer

Main does not identify:

- an account or institution
- which account receives each income source
- which account pays or retains a purpose amount
- an account-to-account path
- transfer ordering
- a fixed transfer versus a remainder rule
- actual spending or an actual month-end remainder

Account Map must ask for or confirm those facts. It must never silently treat the primary-income account as the source of every transfer when there is more than one active income location.

### 5.3 Safe suggestion rule

When exactly one active location receives all active `system:income` allocation, Account Map may suggest fixed transfers from that location to distinct outflow-purpose locations. Suggestions aggregate multiple purpose allocations that share the same destination. A purpose allocated to the income location creates no account transfer.

When there are multiple income locations, ambiguous destinations, or an existing user-declared transfer path, Account Map asks the user to choose the source, target, and amount. It does not guess based on location order, display name, institution, or amount rank.

No sweep transfer is created automatically. The user explicitly adds it and chooses its destination.

## 6. Domain Contract

### 6.1 Existing purpose-location link

`PurposeLocationLink` remains the boundary between a Main-derived purpose and the location where that amount enters, is used, or is retained.

- `system:income` is an external inflow at the linked location.
- `system:housing` and `system:living` are planned uses at the linked location.
- `system:saving` and `system:investing` are planned retained allocations at the linked location.
- Custom-purpose links inherit the meaning of their system parent.

These links are not account-to-account transfers.

### 6.2 New account transfer link

Add an Account Map-owned contract equivalent to:

```ts
type AccountTransferAllocation =
  | { kind: 'fixed'; monthlyAmountWon: number }
  | { kind: 'sweep' };

type AccountTransferLink = {
  id: string;
  sourceLocationId: string;
  targetLocationId: string;
  allocation: AccountTransferAllocation;
  status: 'active' | 'suspended';
  suspendedReason?: 'location-archived' | 'user';
  createdAt: number;
  updatedAt: number;
};
```

The final implementation may encode the active/suspended states as a discriminated union to make `suspendedReason` exact, matching current `PurposeLocationLink` conventions. `sweep` deliberately differs from the existing `PurposeLocationLink.remainder`: a purpose remainder allocates the unassigned part of one purpose target, while a transfer sweep routes the nonnegative amount left at one account after local allocations and fixed outgoing transfers. The user-facing copy remains `남은 금액 전부`.

### 6.3 Versioning

- Increment `AccountMapApplied` from schema version 2 to 3 and add `transfers`.
- Increment `AccountMapDraft` from schema version 1 to 2, add `transfers`, and represent the new guided steps.
- Increment the canonical workspace from schema version 3 to 4 and write only `isf-workspace-v4`. The schema and key numbers remain aligned.
- Preserve `isf-workspace-v3` byte-for-byte as the read-only migration and deployment-rollback source. A v4 repository reads v3 only when v4 is absent, converts it in memory, and never writes, deletes, or normalizes v3.
- When both v4 and v3 are absent, retain the existing supported retired v1/v2 conversion path and convert its result in memory to v4 without mutating the retired source.
- Accept Account Map applied v2 or v3 and draft v1 or v2 inside workspace v4. Converting the workspace envelope does not silently convert the Account Map sub-slice.
- Merely loading, viewing, or migrating the workspace envelope performs no Account Map sub-slice write.
- The first user-confirmed flow save converts the affected Account Map state atomically while preserving locations, purpose links, custom purposes, Main, Simulation, and Portfolio.
- Advance whole-workspace backup to format version 3 for workspace v4. Format v2 workspace-v3 backups and the already-supported format v1 inputs remain read-only import sources and are converted before one atomic v4 replacement.

If a v4 record exists, it is canonical and an invalid v4 record must not fall back to v3 or v1. A rolled-back v3 deployment continues to see its untouched v3 record; returning to the v4 deployment reveals the preserved v4 record. Already-open v3 writers cannot overwrite v4, and already-open v4 writers must coordinate the initial v3 snapshot with the v3 save-lock before committing through the v4 save-lock. The PWA reload remains the normal deployment-generation boundary.

## 7. Calculation Model

Use one pure `AccountFlowCalculator`. It receives Main, active locations, purpose links, and transfer links and returns calculated node/edge state without storage or UI effects.

Active transfer links form a directed acyclic graph. Process accounts in deterministic topological order. For each account:

```text
available before routing
  = external income allocated here
  + active inbound fixed transfers
  + active inbound sweep transfers

planned local allocation
  = active housing, living, saving, investing, and custom-purpose allocations here

remainder before sweep
  = available before routing
  - planned local allocation
  - active outbound fixed transfers
```

If the account has one active sweep transfer, route `max(remainder before sweep, 0)` to its target. Otherwise retain that nonnegative amount as `planned unassigned at this account`. A negative remainder becomes a visible account shortfall. Fixed and sweep transfers are internal routing and must not change the workspace-wide Main totals.

A sweep amount is an estimate from the monthly plan. Its UI label is `계획상 남은 금액` or `남은 금액 전부`, accompanied where needed by `실제 잔액·거래와 다를 수 있음`. If the plan yields zero, the rule remains visible as a rule rather than disappearing.

### 7.1 Structural validation

Block applying a graph that contains:

- a self-transfer
- two active transfers with the same source and target
- any active directed cycle
- more than one active sweep transfer from the same source
- a missing or archived source or target
- an invalid fixed amount

Financial shortfall, overall Main deficit, or an unassigned amount is a visible planning condition, not malformed storage. The UI may save it after making the warning explicit. Existing purpose allocation excess rules remain enforced unless the implementation spec amendment explicitly replaces them with an equally clear warning contract.

## 8. Guided Setup

Replace the five-card auto-fit setup with one centered, responsive, step-based surface.

1. **Confirm Main basis**
   - Show the five read-only Main amounts grouped as incoming, spending, and saving/investing.
   - Offer `이 금액으로 계속` and `Main 금액 수정`.
2. **Confirm locations**
   - Ask where income enters and where each purpose is used or retained.
   - Reuse existing valid locations and the shared financial-location fields.
3. **Confirm account flows**
   - Present safe fixed-transfer suggestions.
   - Let the user accept, edit, remove, or add fixed and sweep transfers.
4. **Review the whole flow**
   - Render the same graph model used by the completed screen.
   - Show structural errors and financial warnings before apply.

The setup surface is horizontally centered at supported widths. Desktop must not produce a four-plus-one orphan-card layout. Mobile uses the same conceptual order in a single column with touch guardrails.

Going backward restores the prior step's final visible state. Anime.js cleanup or replay must never leave a previously visited step blank or left-offset.

## 9. Main-Owned Edit Overlay

Account Map visually retains its current screen while a Main-owned editor opens over it.

### 9.1 Ownership

- Account Map emits a typed request such as `{ target: 'living', returnTo: 'account-map' }`.
- A journey-level overlay host receives the request.
- The overlay mounts a Main-owned editor controller and repository.
- Account Map never receives a Main save callback and never writes Main data.
- The visual editor is extracted from the existing Main dashboard editor as a reusable `MainPlanEditor` presentation component.

### 9.2 Visual and accessibility behavior

- Keep the actual Account Map mounted behind the editor.
- Blur and slightly de-emphasize the background without changing its layout.
- Apply `inert` to background interaction and remove it from the active accessibility tree while the modal is open.
- Present a bottom sheet at mobile widths and a bottom-origin, content-width-limited dialog at desktop widths.
- Trap focus inside the editor, support Escape and browser Back as close actions, and restore focus to the invoking Main amount or edit button.
- Saving or cancelling closes with the reverse motion. Reduced motion renders both endpoints immediately.

Opening the overlay pushes one same-URL history entry carrying an Account Map Main-editor marker. In-app close, Escape, successful save, and browser Back all converge on the marked entry's `popstate` close path so they cannot leave a stale history entry. If the draft is dirty, Back or Escape asks before discarding; declining immediately restores the marker and keeps the overlay and input intact. The overlay never nests another marked entry and removes its listener on unmount.

### 9.3 Refresh after Main save

After Main saves, the overlay host closes and asks Account Map to reload the current workspace revision. Account Map then:

- adopts the latest Main source and workspace revision
- preserves stored locations, purpose links, and account transfers
- recalculates all derived amounts
- derives one map-level `확인 필요` state from `applied.sourceMainUpdatedAt !== main.updatedAt`
- does not rewrite any Account Map data until the user confirms it
- announces `Main 기준이 바뀌었어요. 흐름을 확인해 주세요.`

If Main save fails or conflicts, keep the overlay and its input visible. Account Map remains inert until the user resolves or cancels the editor. Confirming the refreshed basis runs an explicit `confirm-current-main` Account Map command: it recalculates each existing purpose-location remainder against the latest Main target, rejects when fixed purpose allocations exceed that target, leaves all account transfer records unchanged, and then advances `sourceMainUpdatedAt`. This is the only operation that clears the map-level `확인 필요` state.

## 10. Completed Map and Layout

### 10.1 Deterministic layered graph

Render one layered flow graph:

- external income anchors begin the graph
- each account appears exactly once
- account-to-account transfers establish intermediate depth
- housing, living, saving, investing, and custom-purpose anchors terminate their linked account paths
- desktop progresses left to right
- mobile progresses top to bottom

Use deterministic topological ranks and stable tie-breaking. A deterministic crossing-reduction pass may reorder nodes within a rank, but repeated input and viewport must produce the same positions and focus order.

Node dimensions and ordinary edge thickness remain invariant to amount. Amount affects text and calculated state, not node size, line width, or persisted coordinates. Transfer edges may show direction because their source and target are explicitly stored. Purpose-location and transfer edges must remain visually distinguishable by both text and non-color cues.

Overview and default zoom must preserve the whole account-to-account topology. Semantic zoom may collapse custom-purpose detail or suppress unselected edge labels, but it must not omit an account transfer and thereby change the perceived route.

### 10.2 Default and focused states

Default state shows the whole topology, account and purpose names, Main purpose totals, structural state, and financial warnings. It does not display a mixed account total or every edge amount at once.

The first pointer, touch, or keyboard selection of an account pins the complete reachable upstream and downstream subgraph. It:

- keeps related nodes and edges prominent
- dims unrelated nodes and edges
- reveals amounts only on related edges
- labels fixed transfers with their amount
- labels sweep transfers `남은 금액 전부` and shows a planned estimate separately
- opens a compact detail surface grouping incoming flow, local allocations, and outgoing flow

Do not use the old second-activation-to-edit discovery rule. The pinned detail contains explicit `계좌 정보 편집`, `연결 추가`, and `흐름 편집` actions. Background activation and Escape clear the pinned state. Pointer hover and keyboard focus expose equivalent information without requiring animation.

A purpose selection focuses the accounts and transfers that supply or terminate that purpose. A transfer-edge selection focuses its source, target, amount rule, and directly dependent sweep result.

## 11. Editing and Shared UI

### 11.1 Financial locations

Extract one controlled `FinancialLocationFields` component used by both create and edit flows. It covers:

- bank, brokerage, or cash kind
- institution quick selection where supported
- custom institution name
- display name

Switching to cash clears the institution. Bank and brokerage edits require a valid institution in the current UI, while older stored locations without one remain readable and can be repaired through edit. Changing kind does not remove roles or links; roles continue to derive from active purpose use.

Extend location edit intents and commands to update `kind`, `institution`, and `shortName` atomically with conflict detection and duplicate validation. The Account Map write still preserves Main, Simulation, and Portfolio byte-for-byte at the domain boundary.

### 11.2 Money input

Extract a controlled `FormattedMoneyInput` based on the existing core money parsing and caret functions. Use it for Account Map transfer amounts and existing Account Map money fields in scope. This work does not force unrelated app editors to migrate in the same change.

### 11.3 Flow editing

An account-flow editor owns source, target, allocation kind, fixed amount, and status. A transfer may be added from a selected account or selected edge. Structural validation is shown before save. Single-edge field edits use rebasing where safe; deletion, topology changes, or compound edits require explicit latest-state review on conflict. The domain and persistence layers call the `남은 금액 전부` allocation a `sweep`; `remainder` remains reserved for purpose-location allocation.

## 12. Motion

Anime.js enhances state continuity after layout is correct; it never determines geometry.

- Setup step changes use a small opacity and vertical-distance transition inside the centered surface.
- Opening Main edit blurs/de-emphasizes Account Map and raises the editor from the bottom.
- Closing reverses the transition and restores invoking focus.
- Newly applied or edited graphs may animate nodes from their previous deterministic positions to their new positions.
- A newly pinned flow may reveal its direction once with opacity or dash-offset while keeping the final edge and label in the DOM.
- Do not continuously pulse, change node size, change amount-based edge thickness, or replay because of measurement or focus movement.
- Every animation uses shared motion tokens, `useAnimeScope`/approved lifecycle helpers, and a caught failure path that clears inline styles and exposes the final state.
- `prefers-reduced-motion: reduce` skips movement and renders the final state immediately.

## 13. Failure, Concurrency, and Lifecycle

- Invalid storage remains read-only until recovery.
- Draft input survives a rejected command, unavailable storage, or conflict.
- A safe single-field transfer edit may rebase against the latest revision.
- Compound edits, transfer deletion, source/target changes, or topology collisions require a manual review step and never overwrite silently.
- Archiving a location previews and suspends all incident purpose and transfer links.
- Restoring a location does not automatically reactivate either link type; the user selects which relationships to restore.
- A Main change never silently edits a fixed transfer or a remainder destination.
- If Main disappears while the overlay or Account Map recovery is active, abandon replay without a write and show the existing Main-required recovery surface.

## 14. Accessibility and Responsive Contract

- All actionable controls remain at least 44px.
- Account, purpose, and transfer controls expose direction, rule, state, and accessible names without relying on color.
- The canonical screen-reader table changes from an undirected purpose-location list to ordered flow rows with source, target, rule or amount, and status. Purpose anchors remain represented so the whole monthly plan is understandable without the canvas.
- Focus order follows deterministic graph reading order, then the pinned detail actions.
- The Main overlay uses a labelled modal, focus trap, inert background, Escape/Back close, and focus restoration.
- At 390px, 768px, and desktop widths, the document and every overlay remain horizontally contained. The default visualization remains visible without a summary pushing it entirely below the first viewport.
- Touch panning must not prevent normal vertical page scrolling, and tapping a node must not be mistaken for a pan.

## 15. Component and Module Boundaries

The implementation should converge on these responsibilities; exact filenames may follow existing conventions:

- `AccountFlowCalculator`: pure financial-flow calculation and warnings
- `AccountFlowSuggestion`: pure, conservative Main-assisted suggestion generation
- `AccountFlowValidation`: topology and reference validation
- `AccountFlowLayout`: pure responsive deterministic positions
- `AccountFlowViewModel`: graph-to-screen labels and focused reachable subgraphs
- `AccountFlowCanvas`: rendering and interaction only
- `AccountFlowEditor`: account-transfer editing only
- `FinancialLocationFields`: shared Account Map location create/edit fields
- `FormattedMoneyInput`: shared controlled money entry
- `MainPlanEditor`: Main-owned presentation component
- `MainPlanEditOverlay`: journey-owned modal host using Main controller/repository
- Account Map application commands and repository: Account Map-owned writes only

The current large `AccountMapApp`, `AccountMapModal`, setup, connection-detail, graph, and layout responsibilities should move behind these boundaries only as required by this feature. Do not broaden into unrelated repository-wide refactoring.

## 16. Documentation Changes Required With Implementation

Update in the implementation change:

- Product PRD Account Map journey, storage contract, acceptance criteria, and non-goals
- `DESIGN.md` Account Map, modal, motion, responsive, and accessibility clauses
- the superseded Account Map specs listed in section 1 with a pointer to this design rather than contradictory current claims
- README only if the user-visible product description or operation instructions change
- an ADR if the implementation changes the workspace schema version or storage key instead of the approved sub-slice-only versioning

## 17. Acceptance Criteria

- A user can represent one-to-many and many-to-many planned account transfers, including salary account to living and brokerage accounts and a living-account sweep to brokerage.
- Main supplies only its five read-only monthly references; ambiguous account paths always require confirmation.
- One unambiguous income location may produce reviewable fixed-transfer suggestions, but suggestions are never persisted automatically.
- Account nodes never show a total that sums income and outflow purpose links into one denominator.
- Default view shows the entire account-transfer topology without requiring hover or touch.
- First touch/focus/click shows the selected account's reachable upstream and downstream flow, related amounts, and explicit edit actions.
- A sweep rule remains visible at a zero planned estimate and never claims to be an actual balance.
- The graph rejects self-links, duplicate active pairs, cycles, missing/archived endpoints, and multiple active sweep destinations from one source.
- Financial shortages and Main deficit are visible warnings rather than storage corruption.
- Account kind, institution, and display name are editable through the same controlled fields used for creation.
- Main editing appears over a blurred, inert Account Map, uses Main-owned persistence, and returns to a refreshed Account Map without silent transfer mutation.
- Workspace v3 remains an untouched rollback source, workspace v4 becomes canonical atomically, and existing Account Map v2 data converts only after the user confirms a new flow save.
- A Main change produces one derived map-level confirmation state; confirming recalculates only purpose remainders and never mutates fixed or sweep account transfers.
- Main, Simulation, and Portfolio remain unchanged by every Account Map command.
- 390px, 768px, and desktop layouts contain the graph, focused detail, account/flow editors, and Main overlay.
- Pointer, touch, keyboard, screen-reader table, reduced motion, and Anime.js failure paths expose equivalent final information.

## 18. Required Verification

### Domain and storage

- Unit tests for single-source suggestions, no-suggestion ambiguity, aggregation by destination, and same-account omission.
- Unit tests for deterministic topological calculation, fixed transfers, sweep after fixed and local allocations, zero sweep, account shortfall, multiple sources, multiple destinations, and custom-purpose sinks.
- Validation tests for self-link, duplicate pair, cycle, multiple sweep, missing endpoint, archived endpoint, and invalid amount.
- Migration tests for applied v2 to v3 and draft v1 to v2 with no write on read.
- Workspace v3-to-v4 conversion, source preservation, v4 canonical precedence, invalid-v4 no-fallback, dual-lock, and already-open cross-generation writer tests.
- Backup format-v3 export and format-v2/format-v1 import conversion tests.
- Workspace import/export, reference validation, revision, save-lock, map-level Main confirmation, and stale/collision tests.
- Deep-equality assertions that Account Map writes preserve Main, Simulation, and Portfolio.

### Components and motion

- Focused tests for shared location create/edit parity, cash institution clearing, bank/brokerage institution validation, duplicate handling, and formatted money caret behavior.
- Main overlay tests for Main-owned save, Account Map refresh, cancelled edit, failed save input retention, inert background, focus trap, browser Back/Escape, and focus restoration.
- Motion tests for final state on success, reduced motion, synchronous Anime.js throw, cancellation, and reverse close.
- Canvas/view-model tests for whole-topology default, reachable upstream/downstream focus, unrelated dimming, explicit edit actions, edge rules, canonical reading order, and no mixed total.

### Browser and repository

- Account Map Playwright coverage for the salary -> living/brokerage and living remainder -> brokerage example.
- The same flow at 390px, 768px, and desktop with overflow, overlay containment, visualization visibility, touch pan/tap disambiguation, keyboard focus order, 44px targets, and reduced motion.
- Main overlay save/cancel/failure and return-to-map coverage.
- Account archive/restore with incident purpose and transfer links.
- Reload and backup restore of both migrated v2 and native v3 Account Map states.
- `npm run check`.
- Focused Account Map, Main editor, workspace, migration, and motion unit groups.
- `npx playwright test tests/account-map.spec.ts` plus affected Main and motion-system specs.
- Full E2E when shared overlay, workspace validation, migration, or shared input changes affect more than Account Map.
- `npm run build` and `git diff --check`.
