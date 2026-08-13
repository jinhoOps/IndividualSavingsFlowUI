# Connected Account Map Workspace Design

**Status:** Approved, amended by the current Product PRD
**Date:** 2026-08-06

> **2026-08-13 ownership amendment:** Portfolio owns aggregate investment allocation only. Existing shared financial locations and location-scoped plans remain in the workspace for compatibility, but Portfolio does not list, create, rename, archive, or otherwise manage them. Phase B Account Map owns account and custody-location management. Any Portfolio-to-location connection UI requires a separate approved specification.

## 1. Purpose

Account Map completes the first connected ISF workspace. It answers where the user's monthly income moves without turning Main into a detailed account editor or Portfolio into a brokerage tracker.

This design also expands Main from a scalar dashboard into a summary-first home:

1. Main explains the current monthly plan.
2. Simulation explains long-term growth.
3. Portfolio explains investment allocation.
4. Account Map explains where money moves.

The feature is delivered in stages because shared financial locations, Portfolio scope, Account Map flows, workspace backup, and Main summaries have distinct ownership and regression surfaces.

## 2. Product Principles

- Main remains the owner of five monthly scalar amounts.
- Purpose groups are more important than account or institution categories in the map.
- A real financial location may serve multiple purposes without being duplicated in storage.
- Account Map owns stable financial-location identities; Portfolio may reference them only through a separately approved connection contract.
- Existing user-entered flows are never silently redistributed after Main changes.
- The first release is local and manual. It stores no account numbers, credentials, live balances, transactions, or institution sessions.
- All calculations and persisted amounts use integer Korean won.
- The UI omits repeated uses of `계좌` where the surrounding Account Map context already makes the meaning clear.
- Current legacy code is a temporary capability reference, not a runtime foundation for the new React product.

## 3. Delivery Decomposition

### Phase A: Shared Financial Location and Portfolio Contract

- Add a shared financial-location registry.
- Extend Portfolio's domain contract to support an aggregate scope and location scopes.
- Keep the Portfolio UI aggregate-only. Preserve existing location scopes in the domain contract without exposing location management or per-location editing.
- Define a versioned whole-workspace backup envelope and atomic restore.

### Phase B: New Account Map Product

- Replace the readiness screen with the new React Account Map.
- Implement first-run setup, applied map state, drafts, flows, purpose groups, semantic zoom, responsive layout, and editing.
- Read the latest Main and preserved Portfolio/location state without writing back to Main or Portfolio.

### Phase C: Connected Main Summary

- Keep the cashflow donut as the primary monthly summary.
- Replace the existing metric cards with Main, Simulation, Portfolio, and Account Map result cards.
- Add the ASCII savings/investment expression and restrained interactions.

### Phase D: Repository-wide Legacy Extinction

- Remove every retired JavaScript runtime, compatibility path, storage key, test, build entry, selector, asset, and documentation reference after replacement evidence exists.
- Keep only the approved React/TypeScript products and the new storage contracts.

### Separate Follow-up: Hidden Trophy Room

The common trophy registry, hidden management-menu app, trophy page, undisclosed unlock conditions, and GitHub link are a separate design cycle. This design only reserves a non-financial unlock-event seam for the Main ASCII face.

## 4. Ownership and Dependency Graph

```text
Main monthly plan ───────────────▶ Simulation
       │
       ├────────────────────────▶ Portfolio allocation
       │                              │
       └──────────────┐               │
                      ▼               ▼
                Account Map ◀── Shared financial locations

Main home reads summaries from Main, Simulation, Portfolio, and Account Map.
```

### Main

Main continues to own only:

- monthly net income;
- housing consumption;
- other living consumption;
- saving;
- investment;
- update time.

It does not own detailed financial locations, instruments, Portfolio allocations, or Account Map flows.

### Simulation

Simulation continues to read the latest Main saving and investment amounts and owns its own assumptions and result. No write-back is added.

### Portfolio

Portfolio owns investment allocations. It supports:

- one aggregate `전체 기준` scope;
- preserved scopes keyed by a shared investment-capable location ID for compatibility.

The current applied Portfolio is interpreted as the aggregate scope. Portfolio does not create, list, or edit location scopes. A future connection experience requires separate approval but should not require another schema redesign.

### Shared Financial Location Registry

The registry owns stable identities and common metadata. Phase B Account Map manages every supported role. Portfolio does not create or edit registry entries and stores no copied names or institution metadata in its own plan. Before Phase B the registry is retained as dormant compatibility data.

### Workspace Repository

The logical layers are stored in one versioned committed workspace document rather than independent cross-referencing localStorage records. App repositories expose typed slice reads and writes while preserving domain ownership.

- One committed-record replacement is the atomic boundary for normal saves and restore.
- The document carries a monotonic revision and update time.
- Writers use the repository's lease/revision protocol so a stale tab cannot overwrite a newer workspace.
- Same-tab subscribers and browser storage events refresh readers after a committed change.
- Draft slices are explicitly named and remain separate from applied slices inside the document.
- Existing Main, Simulation, Portfolio, Account Map, snapshot, and compatibility records are not imported into the new workspace document.

### Account Map

Account Map owns:

- first-run and edit drafts;
- representative income location;
- monthly flow amounts;
- unresolved and excess calculations;
- applied setup status;
- consumer instruments and their funding references;
- map-specific presentation selection, excluding persisted zoom and node coordinates.

Account Map reads current Main totals and the shared-location registry. It does not read or modify Portfolio plans or drafts.

## 5. Shared Data Contract

The exact TypeScript names may follow current conventions, but the semantic contract is fixed.

### Financial Location

```ts
type FinancialLocationKind = 'bank' | 'brokerage' | 'cash';
type FinancialRole = 'income' | 'spending' | 'saving' | 'investing';

interface FinancialLocation {
  id: string;
  shortName: string;
  institution?: {
    id?: string;
    name: string;
  };
  kind: FinancialLocationKind;
  roles: FinancialRole[];
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

Rules:

- `shortName` is required and contains at most eight Unicode display characters.
- Korean, Latin letters, numbers, and spaces are accepted so names such as `해외직투`, `ISA`, and `토스 ISA` work.
- Duplicate detection trims outer whitespace, collapses internal whitespace, and case-folds Latin text.
- Duplicate names are rejected across active locations, with an action to connect the existing entry.
- Institution search is optional. A user may save without selecting an institution.
- One location may have multiple roles and may appear once in each relevant purpose group while retaining one identity.
- Archiving hides the entry from new flows and default lists but preserves identity and references.

### Consumer Instrument

```ts
interface ConsumerInstrument {
  id: string;
  shortName: string;
  type: 'credit' | 'debit';
  fundingLocationId: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

A funding location is mandatory for both credit and debit instruments. They are presented as spending means inside the living-cost purpose group, not as bank or brokerage groups.

### Portfolio Scope

```ts
type PortfolioScope =
  | { type: 'aggregate' }
  | { type: 'location'; locationId: string };
```

- An investment-capable location created in Account Map does not appear in Portfolio until a separate connection UI is approved.
- Portfolio setup does not create financial locations.
- An aggregate Portfolio remains independent from location-scoped allocations.
- Location names and institution data are resolved from the registry at read time.
- Archiving a referenced location preserves every location-scoped Portfolio record byte-for-byte. Portfolio cleanup is outside Phase B.
- Phase B role changes are add-only. Role removal requires a separate dependency-handling specification.

### Account Map Flow

```ts
type FlowEndpoint =
  | { type: 'location'; id: string }
  | { type: 'instrument'; id: string };

interface MonthlyFlow {
  id: string;
  source: FlowEndpoint;
  target: FlowEndpoint;
  purpose: 'income' | 'spending' | 'saving' | 'investing';
  monthlyAmountWon: number;
  createdAt: number;
  updatedAt: number;
}
```

- Amounts are non-negative integer won.
- A flow requires a valid source and target.
- Purpose determines visual grouping; purpose is not a virtual transfer node.
- Transfer day, memo, foreign currency, balance, and transaction history are not first-release fields.

### Group Capacity

- Income: at most 10 active locations.
- Living cost: at most 10 combined active locations and consumer instruments.
- Saving: at most 10 active locations.
- Investing: at most 10 active locations.
- The same stored location counts once per purpose group in which it appears.
- Archived entries do not count toward limits.

## 6. Main Synchronization Rules

Account Map derives four reference totals from current Main:

- income;
- consumption, equal to housing plus living;
- saving;
- investment.

### Initial Apply

- The full Main income is assigned across selected income locations.
- One representative income location automatically receives the remaining amount after other income amounts are entered.
- The income allocation must equal Main income exactly before setup can be applied.
- The full Main consumption is initially assigned to the selected primary living-cost location.
- Saving and investment start as unresolved amounts until the user connects them.

The primary living-cost location may be the same stored identity as the representative income location.

### Later Main Changes

- Existing flows are preserved.
- An increase appears as `아직 연결하지 않은 금액` in the affected purpose group.
- A decrease that makes connected flows exceed the Main reference appears as `초과 연결` with a correction action.
- No existing flow is proportionally scaled, reordered, or deleted.
- Account Map never writes a correction back into Main.

## 7. Account Map First-run Experience

### Gate

If no applied Main plan exists, the route presents a lightweight explanation and a `월 자금 계획 만들기` action. It does not create a location registry, draft, or zero-value map.

### Step 1: Income Locations

The copy asks where income arrives rather than repeatedly saying `계좌`.

- Select an existing shared location or add a new one.
- Support multiple income locations.
- Choose the representative location that receives the automatic remainder.
- Block only when manually entered income exceeds Main income or the final sum cannot equal Main income.

### Step 2: Primary Living-cost Location

- Select the same location used for income, another existing location, or a newly created one.
- Consumer instruments may be added with mandatory funding references.
- Initialize the full Main consumption amount against the selected primary destination.

### Step 3: Initial Review

Show:

- resolved income;
- resolved consumption;
- unresolved saving;
- unresolved investment.

The review applies the map explicitly. Draft progress is saved locally and resumes on the next visit.

## 8. Applied Account Map Experience

### Purpose-first Groups

The map always emphasizes:

- 들어오는 돈;
- 생활비;
- 저축;
- 투자;
- unresolved or excess status when present.

Bank, brokerage, and cash are secondary icon or metadata distinctions. Purpose groups are visual regions with titles and totals, not intermediate money nodes.

Each group provides a concise `추가` action that can connect an existing registry entry or create a new one in that purpose.

### Read-first Editing

- The map itself is primarily explanatory.
- Selecting a location, instrument, or flow opens a contained bottom sheet or modal.
- Editing happens in the sheet or modal.
- Users do not draw edges by dragging and do not save arbitrary node coordinates.
- Empty-space dragging pans a map that is larger than its viewport.

### Reset

The management action is named `월 연결 다시 만들기`, not `처음부터 다시`.

It clears Account Map flows, representative-income selection, applied setup state, and setup draft. It preserves:

- the shared financial-location registry;
- archived entries;
- consumer instruments and their mandatory funding references;
- aggregate and location-scoped Portfolio data.

Preserved entries appear as available but unconnected during the new setup.

## 9. Semantic Zoom and Layout

Account Map uses three discrete information levels.

### 전체

- purpose group titles and totals;
- one representative location per group;
- `외 n개` for remaining entries;
- only major connections.

The Main mini map uses the same reduction rules.

### 기본

- every active short name;
- core connections;
- default level whenever the app is freshly entered.

### 상세

- all purpose groups remain visible;
- institution, kind, and multiple roles;
- every connection.

Zoom level is intentionally ephemeral. It survives sheet or modal interaction but resets to `기본` after refresh or leaving and returning to the app.

### Responsive Geometry

- Desktop places flow left to right.
- Mobile places flow top to bottom.
- Layout is deterministic from current groups and connections.
- Empty-space drag pans without changing node positions.
- Minus and plus buttons are the primary zoom controls.
- Wheel and pinch are optional equivalent inputs, not the only way to zoom.

### Flow Details

- Group totals remain visible at all levels.
- Individual amounts appear on pointer hover, touch selection, and keyboard focus.
- Each visible line has a wider transparent hit target.
- A selected line changes both color and stroke width.
- Detail content names source, target, and formatted monthly amount.
- Touch selection remains pinned until another target or outside area is selected.

## 10. Currency

- All first-release values are integer won.
- Main reconciliation is always won-based.
- A low-emphasis amount-display control in Account Map detail shows `₩` as active and `$` as unavailable.
- Hover, focus, or touch on `$` reveals `추후 지원`.
- The unavailable currency control does not appear in first-run setup or Main summaries and persists no dollar field.

## 11. Connected Main Home

The cashflow donut becomes the only primary scalar overview. Existing metric cards are replaced by four result cards.

### Layout

- Main result is first and full width.
- Simulation, Portfolio, and Account Map cards are equal peers below it.
- Desktop: three app columns.
- Tablet: two columns.
- Mobile: one column.
- No horizontal card carousel is used.

### Main Result Card

The primary number is saving plus investment as a percentage of Main income.

Expression states are:

1. 40% or below;
2. above 40% and below 50%;
3. 50% or above and below 60%;
4. 60% or above and below 70%;
5. 70% or above and below 80%;
6. 80% or above, shown as `???` rather than a better rating.

The expression is a five-to-six-line, fixed-width ASCII face rendered in a themed `<pre aria-hidden="true">`, not a semantic code block. Accessible percentage and status text are separate.

- Lower ranges use soft orange tones compatible with the surrounding theme.
- Higher ordinary ranges move toward the existing teal brand tone.
- `???` uses a neutral purple-gray tone.
- A changed result briefly fades to the new face.
- An on-screen, active-tab face blinks occasionally.
- Touch triggers one short random reaction such as a wink, side glance, or mouth change.
- A low-probability event shows won-sign eyes or an ASCII coin effect.
- `???` occasionally alternates its question marks.
- All motion stops off-screen, in an inactive tab, and under reduced motion.
- Financial numbers and status never change during a reaction.

The rare reaction may emit a non-financial unlock event for the future trophy system. The event has no effect on financial repositories or backups.

### Simulation Card

- The expected asset amount has the highest emphasis.
- `n년 후 · 연 x%` is smaller and lower emphasis.
- Before Simulation setup, calculate a preview from current Main using approved default assumptions.
- After setup, show the applied Simulation result.

### Portfolio Card

- Show the complete applied allocation as a compact donut.
- List the top three targets and percentages.
- Before an applied Portfolio exists, show only an unnamed blurred donut structure and a setup action.

### Account Map Card

- Use the `전체` reduction: groups, totals, one representative entry, and `외 n개`.
- Show one most important unresolved or excess status and total beneath the mini map.
- Before applied setup, show only an unnamed blurred mini-map structure and a setup action.

Blurred decorative previews are hidden from the accessibility tree and contain no fake financial names or amounts.

### Card Interaction

Card body interaction and navigation are separated for mobile clarity.

- Card body toggles a small detail disclosure.
- Desktop hover and keyboard focus preview the disclosure.
- Touch pins the disclosure until it is toggled or dismissed.
- A separate 44px action navigates to or sets up the app.
- Configured labels use `미래 성장 보기`, `투자 배분 보기`, or `계좌 연결 보기`.
- Unconfigured labels use an explicit setup action.

Additional detail remains limited to one or two secondary facts so card height changes minimally.

## 12. Workspace Backup and Restore

Main's management menu becomes the entry point for whole-workspace backup. The exported document uses the same canonical domain schema as the single committed workspace record, excluding repository lease metadata and the explicitly excluded Easter-egg state.

The versioned envelope contains:

- Main applied data and supported setup draft;
- Simulation settings;
- Portfolio aggregate and location-scoped allocations;
- shared financial locations;
- Account Map applied state, flows, instruments, and supported draft.

It excludes hidden-trophy and Easter-egg state.

Restore behavior:

1. Parse the entire new-format envelope.
2. Validate every schema, ID, cross-reference, capacity, and amount before writing.
3. If any validation fails, change nothing.
4. If validation passes, commit the replacement as one workspace-record write with the next revision.
5. Report success or the actionable failure reason.

There is no partial app selection, merge restore, or legacy-format import.

## 13. Error and Referential Behavior

- Duplicate short name: block creation and offer the existing entry.
- Group at capacity: block addition and explain that an entry may be archived.
- Income manual total above Main: block apply and focus the first correction.
- Unresolved or excess non-income flow: allow saving and show a persistent correction status.
- Referenced location archive: suspend Account Map links and preserve every Portfolio plan and draft byte-for-byte.
- Missing reference from corrupted current data: do not silently delete dependent data; surface recovery and block invalid writes.
- Repository write failure: retain the draft or edit state and offer retry.
- Invalid whole-workspace backup: perform no writes.

## 14. Accessibility and Motion

- Primary touch targets are at least 44px.
- Purpose, unresolved, excess, archived, and selected states are never conveyed by color alone.
- Every flow reachable by pointer is also reachable by keyboard and touch.
- Popovers, sheets, and modals contain focus and restore it to the owning trigger.
- Pan and semantic zoom have button alternatives and do not trap page scrolling unintentionally.
- ASCII art is decorative; adjacent real text carries meaning.
- Hover-only card information is also available by focus and touch disclosure.
- Reduced motion removes face, map, card, tooltip, and zoom transitions without hiding final state.

## 15. Legacy Disposition and Repository-wide Extinction

Account Map is the last product migration. After Phases A-C replace every required current behavior, Phase D removes repository-wide legacy code rather than preserving a parallel compatibility product.

Known current legacy surfaces include, but are not limited to:

- `apps/account-map/app.js`, its JavaScript modules, CSS, classic HTML behavior, `isf-account-map-v1`, and `isf-rebuild-v1`/snapshot fallback;
- the legacy `tests/account-map.spec.ts` contract;
- `src/entries/account-map.ts` imports of the old JavaScript runtime;
- `apps/main/app.js` and retired `apps/main/modules/*.js` renderers, controllers, sanitizers, storage, Sankey, account correction, and Account Map entry code;
- current compatibility-only tests, fixtures, adapters, shared legacy storage bridges, service-worker assets, selectors, HTML entry references, and documentation claims;
- legacy storage-key preservation assertions that no longer represent a supported compatibility promise.

Before deletion, the implementation plan must produce a complete inventory covering:

- runtime imports and dynamic imports;
- Vite and PWA entries;
- routes and HTML;
- selectors and CSS;
- localStorage and IndexedDB keys;
- import/export/backup paths;
- tests and fixtures;
- service worker and manifest assets;
- documentation and scripts.

Each capability receives either a new-module replacement reference or an explicit rejection. Old user data is not migrated. The product supports only the new workspace schema after extinction.

Deletion is complete only when searches, build output, and browser network requests contain no retired runtime or key references other than intentional historical documentation where clearly marked.

## 16. Verification Strategy

### Unit and Contract Tests

- financial-location validation, normalized duplicate detection, roles, capacities, and archive lifecycle;
- consumer-instrument funding references;
- Portfolio aggregate/location scopes and missing-reference handling;
- workspace lease/revision contention and stale-writer rejection;
- representative-income remainder and exact total;
- unresolved and excess derivation at every Main-change boundary;
- whole-workspace backup round-trip and atomic failure;
- deterministic group reduction and layout inputs;
- ASCII percentage boundaries and motion gating.

### Integration Tests

- create or rename an investment location in Account Map without changing Portfolio aggregate allocation;
- verify Portfolio exposes no location creation, rename, archive, or listing action;
- preserve or delete a location-scoped Portfolio during archive confirmation;
- reset Account Map flows without altering shared registry or Portfolio;
- read current Main changes without write-back;
- restore a valid workspace with all references intact.

### Browser Tests

- first-run gate and resumable setup;
- same location for income and living cost;
- multiple incomes with automatic remainder;
- unresolved and excess correction paths;
- 전체/기본/상세 at 390px, 768px, and desktop;
- deterministic horizontal and vertical layouts;
- pan, button zoom, optional wheel/pinch equivalence, and reset-to-default entry;
- flow pointer, touch, keyboard details and wide hit targets;
- sheets and modals, focus containment, and 44px targets;
- Main four-card configured and unconfigured states;
- blurred-preview accessibility;
- face reactions and reduced motion;
- full active E2E after repository-wide deletion.

### Legacy Removal Proof

- production build succeeds;
- full TypeScript and active unit suites pass;
- full active E2E passes;
- runtime import, route, selector, storage key, compatibility path, test, fixture, build output, and network request searches are clean;
- README, DESIGN, PRD, Roadmap, State, Requirements, and relevant ADR/spec status claims agree.

## 17. Acceptance Criteria

- A user with Main data can complete Account Map setup with the same location serving income and living cost.
- Multiple income locations always total Main income through a user-selected automatic remainder.
- Purpose groups remain the dominant visual structure at every zoom level.
- Main increases produce unresolved amounts and decreases produce excess warnings without silent flow changes.
- Account Map owns stable locations without copying metadata into Portfolio, and Portfolio exposes no location-management action.
- Portfolio retains an aggregate scope and can represent empty location scopes.
- The applied map is usable by pointer, touch, and keyboard at required viewports.
- Main shows the four approved summaries and the ASCII result behavior without duplicating the donut's scalar detail.
- Whole-workspace backup restores valid connected data atomically and rejects invalid or old formats without mutation.
- Account Map reset preserves shared locations and Portfolio data.
- The new products do not read or write retired schemas.
- Repository-wide legacy runtime, compatibility, and test surfaces are removed with fresh verification evidence.

## 18. Explicit Non-goals

- financial-institution login, Open Banking, or live synchronization;
- account numbers, live balances, transactions, or credential storage;
- foreign-currency calculation or exchange rates;
- transfer-day scheduling, execution, or reminders;
- arbitrary node-position persistence or direct edge drawing;
- per-location Portfolio editing UI in the shared-contract phase;
- partial, merged, or legacy backup restore;
- trophy-room UI or trophy-condition disclosure;
- Main write-back from any detailed app.
