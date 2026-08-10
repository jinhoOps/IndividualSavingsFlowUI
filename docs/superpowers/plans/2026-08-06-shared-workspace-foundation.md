# Shared Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the single versioned ISF workspace record, shared financial-location registry, aggregate/location Portfolio contract, and atomic whole-workspace backup that the new Account Map and connected Main will consume.

**Architecture:** A top-level workspace module composes the existing Main, Simulation, and Portfolio domain parsers into one exact schema stored by one revisioned repository. Existing app repository interfaces become thin typed slice adapters over that repository, while a shared location service owns normalized identity and archive semantics. Portfolio remains aggregate-first in Phase A but exposes shared investment locations and the scope contract without implementing per-location allocation editing.

**Tech Stack:** React 19, TypeScript, browser localStorage with the existing lease/revision concurrency pattern, Vitest + Testing Library, Playwright, Vite.

**Status (2026-08-10):** Phase A is current. Fresh final verification counted 633 passed unit tests and 69 passed / 60 skipped E2E tests (129 discovered). Type checks and the production build passed. The final independent controller review is recorded separately from this implementer commit.

## Global Constraints

- Follow [Connected Account Map Workspace Design](../specs/2026-08-06-connected-account-map-workspace-design.md).
- Work in the existing Orca-managed worktree; do not create, remove, or prune it.
- Main remains the completed baseline and continues to own only its five monthly scalar amounts.
- Use one committed `isf-workspace-v1` record as the only current app-data source of truth.
- Do not read, migrate, project, or delete current or legacy Main, Simulation, Portfolio, Account Map, snapshot, or compatibility keys in Phase A; they are ignored and removed only in the approved legacy-extinction phase.
- All app writes go through the workspace repository and increment one monotonic revision.
- A stale tab must not overwrite a newer workspace revision.
- All persisted amounts are non-negative integer Korean won unless an existing domain explicitly permits another exact value.
- Financial-location names allow Korean, Latin letters, digits, and spaces and contain at most eight Unicode code points after normalization.
- Active short names are globally unique after outer trim, whitespace collapse, and Latin case-folding.
- Account Map and Portfolio share location identity but never copy location names or institution metadata into app-owned plans.
- Portfolio remains aggregate-first; Phase A adds no per-location allocation editor.
- Workspace import validates every slice and reference before one committed replacement and supports no merge, partial restore, or old format.
- Easter-egg state is never included in the workspace record or backup.
- Preserve unrelated user and worker changes.
- Every code task follows RED → GREEN → focused verification → commit.

---

## File Structure

### New workspace domain

- `src/workspace/domain/financialLocation.ts`: location/institution/role types, normalization, exact parser, capacities.
- `src/workspace/domain/accountMapContract.ts`: Phase B-ready instrument and monthly-flow persistence types and exact parser; Phase A persists empty slices only.
- `src/workspace/domain/model.ts`: workspace schema, slices, empty document factory, Portfolio scope collection.
- `src/workspace/domain/validation.ts`: exact whole-document parser and cross-reference validation.
- `src/workspace/domain/locationCommands.ts`: pure create, rename, role, and archive commands.

### New workspace infrastructure

- `src/workspace/infrastructure/workspaceRepository.ts`: one-key load/update/replace/subscription repository.
- `src/workspace/infrastructure/workspaceSaveLock.ts`: generalized lease lock extracted from Main's proven concurrency contract.
- `src/workspace/infrastructure/workspaceBackup.ts`: canonical export and strict import parser.

### App adapters

- `src/main/infrastructure/mainRepository.ts`: preserve the public Main repository behavior over the Main workspace slice.
- `src/simulation/infrastructure/simulationRepository.ts`: async Simulation slice adapter.
- `src/simulation/infrastructure/mainSourceRepository.ts`: read the Main workspace slice.
- `src/portfolio/domain/model.ts`: schema v2 plan/draft scope.
- `src/portfolio/domain/validation.ts`: exact schema v2 validation.
- `src/portfolio/infrastructure/portfolioRepository.ts`: async aggregate Portfolio slice adapter.
- `src/portfolio/infrastructure/mainSourceRepository.ts`: read the Main workspace slice.
- `src/portfolio/infrastructure/locationRepository.ts`: shared investment-location query and command adapter.

### Portfolio and Main UI

- `src/portfolio/ui/InvestmentLocations.tsx`: aggregate-first list, empty state, and minimal create/rename/archive controls.
- `src/portfolio/ui/PortfolioApp.tsx`: async repositories and location surface composition.
- `src/portfolio/ui/portfolio.css`: contained responsive location list.
- `src/main/ui/MainManagementMenu.tsx`: whole-workspace backup labels and state.
- `src/main/ui/MainApp.tsx`: atomic export/import orchestration.

### Tests

- `tests/unit/workspace/financialLocation.test.ts`
- `tests/unit/workspace/validation.test.ts`
- `tests/unit/workspace/locationCommands.test.ts`
- `tests/unit/workspace/workspaceRepository.test.ts`
- `tests/unit/workspace/workspaceBackup.test.ts`
- update the exact Main, Simulation, and Portfolio tests named in Tasks 5-8;
- update `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`, and `tests/app-journey.spec.ts` only where externally observable storage or backup behavior changes.

---

### Task 0: Latest-main Gate and Phase-A Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `docs/superpowers/specs/2026-08-06-connected-account-map-workspace-design.md`
- Read: `src/main/infrastructure/mainRepository.ts`
- Read: `src/simulation/infrastructure/simulationRepository.ts`
- Read: `src/portfolio/infrastructure/portfolioRepository.ts`
- Read: current focused tests listed in File Structure

**Interfaces:**
- Consumes: current `main`, the approved design, and existing repository contracts.
- Produces: a clean, verified implementation baseline; no production changes.

- [ ] **Step 1: Confirm worktree ownership and diff**

Run:

```bash
git status --short
git branch --show-current
git log --oneline --decorate -12 main origin/main HEAD
git diff --name-status main...HEAD
```

Expected: only approved spec/plan commits differ; no unrelated uncommitted changes.

- [ ] **Step 2: Reconcile latest Main without deleting the Orca worktree**

If `main` advanced, inspect overlap first:

```bash
git diff --name-status HEAD..main -- src/main src/simulation src/portfolio src/workspace tests package.json vite.config.ts
```

Merge latest `main` with a normal merge only when the tree is clean. Resolve conflicts by preserving current product behavior and the approved spec. Do not reset or recreate the worktree.

- [ ] **Step 3: Run the full green baseline**

Run:

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
git diff --check
```

Expected: type checks pass, every active unit/E2E passes, retired suites remain explicitly skipped, and diff-check emits no output.

- [ ] **Step 4: Record the exact current storage keys for later non-consumption assertions**

Run:

```bash
rg -n "isf-(main|simulation|portfolio|account-map|rebuild|journey|step)" src tests apps shared public vite.config.ts
```

Copy the current-key list into the relevant tests in Tasks 5-7. Do not delete any key in Phase A.

---

### Task 1: Shared Financial-location Domain

**Files:**
- Create: `src/workspace/domain/financialLocation.ts`
- Create: `tests/unit/workspace/financialLocation.test.ts`

**Interfaces:**
- Consumes: integer timestamp conventions from current app models.
- Produces:

```ts
export type FinancialLocationKind = 'bank' | 'brokerage' | 'cash';
export type FinancialRole = 'income' | 'spending' | 'saving' | 'investing';
export interface InstitutionRef { id?: string; name: string }
export interface FinancialLocation {
  id: string;
  shortName: string;
  institution?: InstitutionRef;
  kind: FinancialLocationKind;
  roles: FinancialRole[];
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}
export const PURPOSE_CAPACITY: Record<FinancialRole, number>;
export function normalizeLocationName(value: string): string;
export function countDisplayCharacters(value: string): number;
export function parseFinancialLocation(value: unknown): FinancialLocation | null;
```

- [ ] **Step 1: Write exact parsing and normalization tests**

Create tests covering:

```ts
expect(normalizeLocationName('  토스   ISA  ')).toBe('토스 isa');
expect(normalizeLocationName('ISA')).toBe(normalizeLocationName('isa'));
expect(countDisplayCharacters('해외직투')).toBe(4);
expect(PURPOSE_CAPACITY).toEqual({ income: 10, spending: 10, saving: 10, investing: 10 });
```

Also assert:

- `ISA`, `토스 ISA`, and digits parse;
- empty, nine-code-point, duplicate-role, unknown-kind, unknown-role, negative timestamp, and extra-key records return `null`;
- an optional institution accepts exact `{ name }` or `{ id, name }` only;
- `archivedAt` is optional but must be a non-negative safe timestamp.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run tests/unit/workspace/financialLocation.test.ts
```

Expected: FAIL because `src/workspace/domain/financialLocation.ts` does not exist.

- [ ] **Step 3: Implement the exact domain parser**

Use code-point counting rather than UTF-16 length:

```ts
export const PURPOSE_CAPACITY = {
  income: 10,
  spending: 10,
  saving: 10,
  investing: 10,
} as const;

export function countDisplayCharacters(value: string): number {
  return Array.from(value).length;
}

export function normalizeLocationName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}
```

`parseFinancialLocation()` must use an exact-key helper, preserve the user's display casing/spacing after trimming and collapsing whitespace, reject duplicate roles, and return new arrays/objects rather than the input references.

- [ ] **Step 4: Run GREEN and type checks**

Run:

```bash
npx vitest run tests/unit/workspace/financialLocation.test.ts
npm run check
git diff --check
```

Expected: focused tests and type checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/domain/financialLocation.ts tests/unit/workspace/financialLocation.test.ts
git commit -m "feat(workspace): define financial locations"
```

---

### Task 2: Portfolio Scope and Final Workspace Schema

**Files:**
- Create: `src/workspace/domain/accountMapContract.ts`
- Create: `src/workspace/domain/model.ts`
- Create: `src/workspace/domain/validation.ts`
- Create: `tests/unit/workspace/validation.test.ts`
- Modify: `src/portfolio/domain/model.ts`
- Modify: `src/portfolio/domain/validation.ts`
- Modify: `tests/unit/portfolio/validation.test.ts`

**Interfaces:**
- Consumes: `FinancialLocation`, current `MainData`, current `CompoundSimulationDraft`, and Portfolio allocation fields.
- Produces:

```ts
export const WORKSPACE_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_STORAGE_KEY = 'isf-workspace-v1';
export type PortfolioScope = { type: 'aggregate' } | { type: 'location'; locationId: string };
export interface ConsumerInstrument {
  id: string;
  shortName: string;
  type: 'credit' | 'debit';
  fundingLocationId: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}
export type FlowEndpoint =
  | { type: 'location'; id: string }
  | { type: 'instrument'; id: string };
export interface MonthlyFlow {
  id: string;
  source: FlowEndpoint;
  target: FlowEndpoint;
  purpose: 'income' | 'spending' | 'saving' | 'investing';
  monthlyAmountWon: number;
  createdAt: number;
  updatedAt: number;
}
export interface WorkspaceDocument {
  schemaVersion: 1;
  revision: number;
  updatedAt: number;
  main: { applied: MainData | null; setupProgress: SetupProgress | null };
  simulation: { draft: CompoundSimulationDraft | null };
  portfolio: { plans: PortfolioPlan[]; draft: PortfolioDraft | null };
  locations: FinancialLocation[];
  accountMap: {
    applied: null;
    draft: null;
    instruments: ConsumerInstrument[];
    flows: MonthlyFlow[];
  };
}
export function createEmptyWorkspace(now?: number): WorkspaceDocument;
export function parseWorkspaceDocument(value: unknown): WorkspaceDocument | null;
```

`PortfolioPlan` and `PortfolioDraft` become schema version 2 and each gains `scope: PortfolioScope`. Phase A creates and edits only aggregate allocation values; location scopes may be absent or empty.

- [ ] **Step 1: Write Portfolio v2 RED tests**

Add tests asserting:

```ts
expect(parsePortfolioPlan({ ...validPlanV2, scope: { type: 'aggregate' } })).not.toBeNull();
expect(parsePortfolioPlan({ ...validPlanV2, scope: { type: 'location', locationId: 'loc-isa' } })).not.toBeNull();
expect(parsePortfolioPlan(validPlanV1)).toBeNull();
expect(parsePortfolioPlan({ ...validPlanV2, scope: { type: 'location', locationId: '' } })).toBeNull();
```

Run:

```bash
npx vitest run tests/unit/portfolio/validation.test.ts
```

Expected: FAIL because schema v1 still parses and `scope` is unknown.

- [ ] **Step 2: Implement the Portfolio v2 contract**

In `src/portfolio/domain/model.ts`:

```ts
export const PORTFOLIO_SCHEMA_VERSION = 2 as const;
export type PortfolioScope =
  | { type: 'aggregate' }
  | { type: 'location'; locationId: string };
```

Add `scope` to plan/draft, update exact keys and common parsing, and export `scopeKey(scope)` returning `aggregate` or `location:<id>` for uniqueness checks.

- [ ] **Step 3: Write whole-workspace RED tests**

Create `tests/unit/workspace/validation.test.ts` with fixtures using exact current domain values. Assert:

- `createEmptyWorkspace(100)` has revision 0 and every empty slice;
- one exact valid document parses;
- extra root or slice keys fail;
- old app-only objects fail;
- Portfolio plan scopes are unique;
- a location-scoped plan requires an active registry entry with `investing` role;
- consumer-instrument funding IDs and flow endpoint IDs resolve;
- duplicate active normalized location names fail;
- each purpose capacity is enforced;
- archived entries remain valid and do not count toward capacity;
- account-map slices are empty in Phase A, so non-empty instruments or flows fail until Phase B deliberately changes the parser contract.

Run:

```bash
npx vitest run tests/unit/workspace/validation.test.ts
```

Expected: FAIL because workspace model/parser files do not exist.

- [ ] **Step 4: Implement final workspace types and composition parser**

`accountMapContract.ts` defines the approved endpoint/instrument/flow types and exact primitive parsers. `validation.ts` composes existing exported app parsers and then runs cross-reference checks. Do not duplicate Main, Simulation, or Portfolio field validation.

Use one scope uniqueness pass:

```ts
const scopeKeys = plans.map(({ scope }) => scopeKey(scope));
if (new Set(scopeKeys).size !== scopeKeys.length) return null;
```

Return a deep reconstructed value so repository callers cannot mutate parsed storage by reference.

- [ ] **Step 5: Run focused GREEN**

Run:

```bash
npx vitest run tests/unit/portfolio/validation.test.ts tests/unit/workspace/validation.test.ts
npm run check
git diff --check
```

Expected: both suites pass with exact schema enforcement.

- [ ] **Step 6: Commit**

```bash
git add src/workspace/domain src/portfolio/domain tests/unit/workspace/validation.test.ts tests/unit/portfolio/validation.test.ts
git commit -m "feat(workspace): define workspace schema"
```

---

### Task 3: Pure Shared-location Commands

**Files:**
- Create: `src/workspace/domain/locationCommands.ts`
- Create: `tests/unit/workspace/locationCommands.test.ts`

**Interfaces:**
- Consumes: `WorkspaceDocument`, `FinancialLocation`, `FinancialRole`, `normalizeLocationName`, `scopeKey`.
- Produces:

```ts
export type LocationCommandError =
  | 'duplicate-name'
  | 'name-required'
  | 'name-too-long'
  | 'purpose-capacity'
  | 'location-not-found'
  | 'portfolio-reference';
export type LocationCommandResult =
  | { ok: true; workspace: WorkspaceDocument; location: FinancialLocation }
  | { ok: false; reason: LocationCommandError; referencedScopes?: string[] };
export interface LocationCommandDependencies {
  createId(): string;
  now(): number;
}
export interface CreateLocationInput {
  shortName: string;
  institution?: InstitutionRef;
  kind: FinancialLocationKind;
  roles: FinancialRole[];
}
export function createLocation(
  workspace: WorkspaceDocument,
  input: CreateLocationInput,
  dependencies?: Partial<LocationCommandDependencies>,
): LocationCommandResult;
export function renameLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  shortName: string,
  now?: number,
): LocationCommandResult;
export function setLocationRoles(
  workspace: WorkspaceDocument,
  locationId: string,
  roles: FinancialRole[],
  disposition?: PortfolioReferenceDisposition,
  now?: number,
): LocationCommandResult;
export function archiveLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  disposition?: PortfolioReferenceDisposition,
  now?: number,
): LocationCommandResult;
export function restoreLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  now?: number,
): LocationCommandResult;
```

Archive and investing-role removal accept an explicit dependency disposition:

```ts
type PortfolioReferenceDisposition = 'preserve' | 'delete';
```

- [ ] **Step 1: Write command RED tests**

Cover:

- create trims/collapses the display name and assigns stable injected ID/timestamps;
- case-folded duplicates return `duplicate-name` and do not mutate input;
- capacity 10 accepts the tenth and rejects the eleventh;
- multiple roles count once in each group;
- rename synchronizes through identity because plans contain only IDs;
- archive preserves referenced location plans by default;
- archive with `delete` removes only matching location-scoped plans, never aggregate;
- removing `investing` with a reference first returns `portfolio-reference` unless a disposition is supplied;
- archived entries can be restored if the active normalized name remains unique.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/workspace/locationCommands.test.ts
```

Expected: FAIL due to missing module.

- [ ] **Step 3: Implement immutable commands**

Every successful command returns a newly parsed/valid workspace candidate and never modifies the input. Use injected `{ createId, now }` dependencies in tests; production defaults use `crypto.randomUUID()` and `Date.now()`.

Archive flow:

```ts
const references = workspace.portfolio.plans.filter(
  ({ scope }) => scope.type === 'location' && scope.locationId === locationId,
);
if (references.length > 0 && disposition === undefined) {
  return {
    ok: false,
    reason: 'portfolio-reference',
    referencedScopes: references.map(({ scope }) => scopeKey(scope)),
  };
}
```

Return scope keys rather than inventing copied location metadata; keep the exported result field named `referencedScopes` consistently in both code and tests.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/workspace/locationCommands.test.ts tests/unit/workspace/validation.test.ts
npm run check
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/workspace/domain/locationCommands.ts tests/unit/workspace/locationCommands.test.ts
git commit -m "feat(workspace): manage shared locations"
```

---

### Task 4: Revisioned Workspace Repository and Subscriptions

**Files:**
- Create: `src/workspace/infrastructure/workspaceSaveLock.ts`
- Create: `src/workspace/infrastructure/workspaceRepository.ts`
- Create: `tests/unit/workspace/workspaceRepository.test.ts`
- Modify: `src/main/infrastructure/mainRepository.ts`
- Modify: `tests/unit/main/mainRepository.test.ts`

**Interfaces:**
- Consumes: `WORKSPACE_STORAGE_KEY`, `WorkspaceDocument`, `createEmptyWorkspace`, `parseWorkspaceDocument`.
- Produces:

```ts
export type WorkspaceLoadResult =
  | { status: 'found'; workspace: WorkspaceDocument }
  | { status: 'empty'; workspace: WorkspaceDocument }
  | { status: 'invalid'; raw: string }
  | { status: 'unavailable' };
export type WorkspaceWriteResult =
  | { status: 'saved'; workspace: WorkspaceDocument }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'invalid' | 'unavailable' };
export interface WorkspaceRepository {
  load(): WorkspaceLoadResult;
  update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult>;
  replace(expectedRevision: number, candidate: WorkspaceDocument): Promise<WorkspaceWriteResult>;
  subscribe(listener: (workspace: WorkspaceDocument) => void): () => void;
}
```

- [ ] **Step 1: Write repository RED tests**

Port the proven contention cases from `mainRepository.test.ts` into workspace terms and add:

- empty load returns `createEmptyWorkspace()` without writing;
- current-key absence ignores populated old keys;
- invalid JSON and invalid schema report `invalid` without fallback;
- update checks expected revision inside the acquired lock;
- successful update increments revision once and uses one `setItem(WORKSPACE_STORAGE_KEY, ...)` committed write;
- mutator output is parsed before write;
- verification failure reports unavailable and retains previous raw value;
- two instances cannot let a paused stale contender overwrite the winner;
- `subscribe()` receives same-tab commits and valid `storage` events, ignores unrelated/invalid events, and unsubscribes cleanly.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/workspace/workspaceRepository.test.ts
```

Expected: FAIL due to missing repository.

- [ ] **Step 3: Extract and generalize the existing lease algorithm**

Move the lock mechanics—not Main domain behavior—from `mainRepository.ts` into `workspaceSaveLock.ts`. Rename constants and records to `isf-workspace-v1-save-lease:`. Preserve:

- local in-instance queue;
- choosing/ticket arbitration;
- expiry recovery;
- owner assertion before commit;
- injected time/wait/yield hooks for deterministic tests.

Do not leave a second active Main-only lease implementation.

- [ ] **Step 4: Implement repository commit semantics**

Inside the acquired lock:

```ts
const loaded = this.load();
const current = loaded.status === 'empty' ? loaded.workspace
  : loaded.status === 'found' ? loaded.workspace
  : null;
if (current === null) return { status: loaded.status };
if (current.revision !== expectedRevision) {
  return { status: 'conflict', currentRevision: current.revision };
}
const candidate = mutate(structuredClone(current));
const next = parseWorkspaceDocument({
  ...candidate,
  revision: current.revision + 1,
  updatedAt: monotonicTimestamp(current.updatedAt, this.now()),
});
```

Write and verify the exact serialized value once. Notify same-tab subscribers only after verification.

- [ ] **Step 5: Remove only the generalized lock code from Main**

Keep `MainRepository` behavior intact until Task 5 moves its slice. Update Main lock tests to import the workspace lock or delete duplicate algorithm tests only after equivalent workspace tests pass. Do not weaken Main user-flow assertions.

- [ ] **Step 6: Run GREEN and contention stress**

```bash
npx vitest run tests/unit/workspace/workspaceRepository.test.ts tests/unit/main/mainRepository.test.ts
npm run check
git diff --check
```

- [ ] **Step 7: Commit**

```bash
git add src/workspace/infrastructure src/main/infrastructure/mainRepository.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/main/mainRepository.test.ts
git commit -m "feat(workspace): persist revisioned workspace"
```

---

### Task 5: Main Slice and Cross-app Main Readers

**Files:**
- Modify: `src/main/infrastructure/mainRepository.ts`
- Modify: `src/main/application/bootstrap.ts`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `src/simulation/infrastructure/mainSourceRepository.ts`
- Modify: `src/portfolio/infrastructure/mainSourceRepository.ts`
- Modify: `tests/unit/main/mainRepository.test.ts`
- Modify: `tests/unit/main/bootstrap.test.ts`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/simulation/mainSourceRepository.test.ts`
- Modify: `tests/unit/portfolio/mainSourceRepository.test.ts`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceRepository` and `workspace.main`.
- Produces: the current `MainRepository` user behavior backed only by the workspace record, plus Simulation/Portfolio read-only Main adapters.

- [ ] **Step 1: Change repository tests to the new storage contract**

Replace current-key expectations with a workspace fixture and assert:

- no workspace means new Main setup even if `isf-main-v2`, `isf-rebuild-v1`, and history contain data;
- applied Main loads from `workspace.main.applied`;
- save commits one new workspace revision and leaves Simulation, Portfolio, locations, and Account Map slices byte-equivalent by value;
- setup progress reads/writes only `workspace.main.setupProgress`;
- a workspace conflict returns a storage failure without overwriting the winner;
- current Main validation and recovery UI still handle invalid Main drafts before a write;
- existing old keys remain untouched.

- [ ] **Step 2: Run Main RED**

```bash
npx vitest run tests/unit/main/mainRepository.test.ts tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx
```

Expected: failures reference old keys and synchronous setup-progress methods.

- [ ] **Step 3: Adapt `MainRepository` to async slice writes**

Update setup-progress methods:

```ts
saveSetupProgress(step: SetupStep, draft: MainData, kind?: SetupProgressKind): Promise<void>;
clearSetupProgress(): Promise<void>;
```

`MainApp` awaits or deliberately starts these promises and reports the existing progress warning on rejection. Applied save loads the current workspace revision, updates only the Main slice, and maps conflict/unavailable results to the existing Main storage error contract.

Pending/quarantine keys are not recreated. If the workspace record itself is invalid, Main enters its existing recovery/error presentation with the raw workspace export action. Historical legacy recovery is not read.

- [ ] **Step 4: Adapt Simulation and Portfolio Main-source readers**

Both readers load `workspace.main.applied`, validate with the Main parser, and preserve their current `found`/`missing`/`invalid`/`unavailable` result shapes. They never subscribe or write.

- [ ] **Step 5: Run focused GREEN**

```bash
npx vitest run \
  tests/unit/main/mainRepository.test.ts \
  tests/unit/main/bootstrap.test.ts \
  tests/unit/main/MainApp.test.tsx \
  tests/unit/simulation/mainSourceRepository.test.ts \
  tests/unit/portfolio/mainSourceRepository.test.ts
npm run check
```

- [ ] **Step 6: Update one real-browser Main contract**

In `tests/main-react.spec.ts`, complete setup, assert `isf-workspace-v1` contains the applied Main slice, and assert old current/legacy keys seeded before entry are unchanged and never used. Refresh and confirm the dashboard totals.

Run:

```bash
npx playwright test tests/main-react.spec.ts --reporter=list
```

- [ ] **Step 7: Commit**

```bash
git add src/main src/simulation/infrastructure/mainSourceRepository.ts src/portfolio/infrastructure/mainSourceRepository.ts tests/unit/main tests/unit/simulation/mainSourceRepository.test.ts tests/unit/portfolio/mainSourceRepository.test.ts tests/main-react.spec.ts
git commit -m "refactor(workspace): store Main in workspace"
```

---

### Task 6: Simulation and Portfolio Slice Adapters

**Files:**
- Modify: `src/simulation/infrastructure/simulationRepository.ts`
- Modify: `src/simulation/ui/SimulationApp.tsx`
- Modify: `src/portfolio/infrastructure/portfolioRepository.ts`
- Modify: `src/portfolio/application/bootstrap.ts`
- Modify: `src/portfolio/application/portfolioReducer.ts`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `tests/unit/simulation/simulationRepository.test.ts`
- Modify: `tests/unit/simulation/SimulationApp.test.tsx`
- Modify: `tests/unit/portfolio/MemoryPortfolioRepository.ts`
- Modify: `tests/unit/portfolio/portfolioRepository.test.ts`
- Modify: `tests/unit/portfolio/bootstrap.test.ts`
- Modify: `tests/unit/portfolio/portfolioReducer.test.ts`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/simulation.spec.ts`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: `workspace.simulation`, `workspace.portfolio`, `PortfolioScope`, async `WorkspaceRepository`.
- Produces:

```ts
export interface SimulationRepository {
  load(): SimulationLoadResult;
  save(draft: CompoundSimulationDraft): Promise<SimulationSaveResult>;
  clear(): Promise<SimulationClearResult>;
}
export interface PortfolioRepository {
  load(): PortfolioStorageLoadResult;
  saveApplied(plan: PortfolioPlan): Promise<PortfolioWriteResult>;
  saveDraft(draft: PortfolioDraft): Promise<PortfolioWriteResult>;
  clearDraft(): Promise<PortfolioWriteResult>;
  clearScope(scope: PortfolioScope): Promise<PortfolioWriteResult>;
}
```

- [ ] **Step 1: Write async slice RED tests**

Assert for each adapter:

- no workspace yields empty even when its old key is populated;
- valid slice loads;
- save increments workspace revision and preserves every other slice;
- clear removes only its slice/scope;
- conflict/unavailable returns the current UI error result;
- Portfolio aggregate plan and draft always use `{ type: 'aggregate' }` in current UI;
- duplicate scope writes replace the matching scope only;
- current Portfolio v1 keys remain untouched and unread.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/simulation tests/unit/portfolio
```

Expected: old key assertions and synchronous write call sites fail.

- [ ] **Step 3: Implement Simulation adapter and UI awaits**

Map save/clear promises to current save indicators. Keep the latest Main refresh behavior unchanged. Use operation tokens or an in-component promise queue so a slower earlier save cannot overwrite the user's later state.

- [ ] **Step 4: Implement Portfolio scoped collection adapter**

`load()` returns the aggregate plan/draft to the current app bootstrap. `saveApplied()` upserts by `scopeKey`. `clearScope()` removes only the requested plan and matching draft. Current reset calls `clearScope({ type: 'aggregate' })`.

Every newly created current UI draft includes:

```ts
scope: { type: 'aggregate' }
```

- [ ] **Step 5: Run focused GREEN**

```bash
npx vitest run tests/unit/simulation tests/unit/portfolio
npm run check
```

- [ ] **Step 6: Update and run browser storage assertions**

Update `tests/simulation.spec.ts` and `tests/portfolio.spec.ts` to inspect the workspace slices after setup, refresh, Main change, and reset. Retain assertions that old seeded keys are unchanged.

Run:

```bash
npx playwright test tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list
```

- [ ] **Step 7: Commit**

```bash
git add src/simulation src/portfolio tests/unit/simulation tests/unit/portfolio tests/simulation.spec.ts tests/portfolio.spec.ts
git commit -m "refactor(workspace): store detailed apps in workspace"
```

---

### Task 7: Portfolio Shared-investment Location Surface

**Files:**
- Create: `src/portfolio/infrastructure/locationRepository.ts`
- Create: `src/portfolio/ui/InvestmentLocations.tsx`
- Create: `tests/unit/portfolio/locationRepository.test.ts`
- Create: `tests/unit/portfolio/InvestmentLocations.test.tsx`
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: workspace repository and pure location commands.
- Produces:

```ts
export interface InvestmentLocationRepository {
  list(): FinancialLocation[];
  create(input: {
    shortName: string;
    institution?: InstitutionRef;
    kind: 'bank' | 'brokerage' | 'cash';
  }): Promise<LocationWriteResult>;
  rename(id: string, shortName: string): Promise<LocationWriteResult>;
  archive(id: string, disposition?: 'preserve' | 'delete'): Promise<LocationWriteResult>;
  subscribe(listener: (locations: FinancialLocation[]) => void): () => void;
}
```

`list()` returns active `investing` locations in normalized display order. Creation always adds the `investing` role.

- [ ] **Step 1: Write repository RED tests**

Assert filtering, shared create, normalized duplicate errors, capacity, subscription updates, and archive reference confirmation. A preserved location-scoped plan remains in the workspace when the location is archived.

- [ ] **Step 2: Write UI RED tests**

Render the new surface and assert:

- heading `투자 위치` and explanatory `전체 기준 배분은 그대로 유지됩니다`;
- empty state when no investing locations exist;
- an Account Map-created `ISA` appears as `아직 배분하지 않음` without creating a plan;
- add form uses `짧은 이름`, `형태`, optional `기관` and an 8-character counter;
- duplicate/capacity/save errors remain by the form;
- rename updates the rendered registry value;
- archive asks whether linked Portfolio data should also be deleted, defaulting to preserve;
- controls remain 44px and do not imply per-location allocation editing.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/portfolio/locationRepository.test.ts tests/unit/portfolio/InvestmentLocations.test.tsx
```

- [ ] **Step 4: Implement repository adapter**

Load the latest revision for every command, run the pure command, and commit with that revision. Map `duplicate-name`, `purpose-capacity`, `portfolio-reference`, `conflict`, and `unavailable` to distinct UI results.

- [ ] **Step 5: Implement minimal aggregate-first UI**

Place `InvestmentLocations` after the current aggregate result/editor, not before the core Portfolio task. Use `기관` as an optional searchable text input in Phase A; Phase B may replace its suggestions with the approved institution catalog without changing stored `InstitutionRef`.

Do not add an allocation editor per location. Empty locations display a disabled/readiness-style `아직 배분하지 않음` status.

- [ ] **Step 6: Run focused GREEN and browser coverage**

```bash
npx vitest run tests/unit/portfolio/locationRepository.test.ts tests/unit/portfolio/InvestmentLocations.test.tsx tests/unit/portfolio/PortfolioApp.test.tsx
npx playwright test tests/portfolio.spec.ts --reporter=list
npm run check
git diff --check
```

At 390px, 768px, and desktop assert no overflow, readable 8-character names, 44px actions, and that refresh preserves locations in the workspace.

- [ ] **Step 7: Commit**

```bash
git add src/portfolio tests/unit/portfolio tests/portfolio.spec.ts
git commit -m "feat(portfolio): expose shared investment locations"
```

---

### Task 8: Whole-workspace Backup and Atomic Restore

**Files:**
- Create: `src/workspace/infrastructure/workspaceBackup.ts`
- Create: `tests/unit/workspace/workspaceBackup.test.ts`
- Modify: `src/main/ui/MainManagementMenu.tsx`
- Modify: `src/main/ui/MainApp.tsx`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: exact `WorkspaceDocument` parser and `WorkspaceRepository.replace()`.
- Produces:

```ts
export interface WorkspaceBackupEnvelope {
  format: 'isf-workspace-backup';
  formatVersion: 1;
  exportedAt: number;
  workspace: WorkspaceDocument;
}
export function exportWorkspaceBackup(workspace: WorkspaceDocument, now?: number): string;
export function importWorkspaceBackup(text: string): WorkspaceDocument;
```

Repository lease records, operational listeners, and future Easter-egg state are absent by construction.

- [ ] **Step 1: Write backup RED tests**

Assert:

- export/import round-trips Main, Simulation, aggregate/location Portfolio, locations, and empty Account Map contract;
- output has exact envelope keys and no old key names, lease fields, or trophy strings;
- malformed JSON, wrong format/version, extra keys, old Main-only backup, missing references, duplicate names, over-capacity groups, and invalid app slices throw stable error codes;
- import is a pure parse and performs no storage writes;
- replacing a valid import commits exactly one next workspace revision;
- replace conflict or write failure retains the old raw workspace.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/workspace/workspaceBackup.test.ts
```

- [ ] **Step 3: Implement canonical backup functions**

Before export, parse the supplied workspace. Set `exportedAt` from the injected clock but preserve the domain document revision so import can validate it. On restore, the repository ignores the imported revision as a concurrency token and writes the imported domain slices using the current revision plus one.

Throw exact errors:

```ts
'backup-json' | 'backup-format' | 'backup-schema' | 'backup-reference'
```

- [ ] **Step 4: Replace Main-only backup orchestration**

Main management labels remain `백업 내보내기` and `백업 가져오기`, but descriptions/status make the whole-workspace scope explicit. Export loads the current workspace. Import:

1. reads text;
2. parses the full envelope;
3. confirms `모든 앱 데이터를 이 백업으로 바꿀까요?`;
4. calls one `replace()`;
5. reloads Main from the committed workspace;
6. reports success or an actionable no-change error.

Do not load imported Main as an unapplied Main draft; restore is an atomic workspace replacement.

- [ ] **Step 5: Run focused GREEN**

```bash
npx vitest run tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/MainApp.test.tsx
npm run check
```

- [ ] **Step 6: Add real-browser round-trip and failure coverage**

In `tests/main-react.spec.ts`:

- seed/setup all Phase-A slices through public UI or a validated workspace fixture;
- export and inspect the download;
- mutate current data;
- import with confirmation;
- assert all slices restore and the dashboard refreshes;
- import invalid and old Main-only files and assert raw workspace equality before/after;
- verify focus returns to `관리 메뉴`, status is announced, and 390px confirmation is contained.

Run:

```bash
npx playwright test tests/main-react.spec.ts --reporter=list
```

- [ ] **Step 7: Commit**

```bash
git add src/workspace/infrastructure/workspaceBackup.ts src/main/ui tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/MainApp.test.tsx tests/main-react.spec.ts
git commit -m "feat(workspace): back up the full workspace"
```

---

### Task 9: Phase-A Documentation and Complete Verification

**Files:**
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/plans/2026-08-06-shared-workspace-foundation.md`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/main-compat.spec.ts`
- Modify: `tests/step1.spec.ts`

**Interfaces:**
- Consumes: completed Phase-A code and fresh verification evidence.
- Produces: canonical documentation that calls Phase A current while keeping Account Map UI, connected Main cards, trophy room, and legacy extinction future.

- [x] **Step 1: Update canonical status without claiming future phases**

Document:

- one current workspace record and new-only data policy;
- shared investment locations and aggregate Portfolio scope;
- whole-workspace backup;
- Account Map still readiness-only until Phase B;
- Main result cards unchanged until Phase C;
- old runtime still present as temporary reference until Phase D.

Do not mark Account Map or repository-wide legacy extinction complete.

- [x] **Step 2: Run focused cross-app E2E**

```bash
npx playwright test \
  tests/app-journey.spec.ts \
  tests/main-react.spec.ts \
  tests/simulation.spec.ts \
  tests/portfolio.spec.ts \
  --reporter=list
```

Expected: connected routes, new workspace storage, location surface, reset, and backup pass.

- [x] **Step 3: Run complete required verification**

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
npm run build
git diff --check
```

Expected: all current checks pass. Warnings are reported separately and never summarized as failures or successes they do not represent.

- [x] **Step 4: Prove old stores are ignored but not yet deleted**

Run:

```bash
rg -n "isf-main-v2|isf-simulation-compound-v1|isf-portfolio-allocation-v1|isf-account-map-v1|isf-rebuild-v1" src tests apps shared public dist
```

Classify every result as:

- intentional Phase-A non-consumption test;
- legacy runtime retained for Phase D;
- unexpected new-product reference, which must be fixed before completion.

- [ ] **Step 5: Request independent code review (controller-owned after the implementer commit)**

Use `superpowers:requesting-code-review` with the Phase-A base and head SHAs. Fix every Critical and Important finding, then rerun the affected focused tests and the full required verification.

- [x] **Step 6: Mark this plan complete and commit documentation**

Add a status line with the exact fresh unit/E2E counts only after the final run.

```bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md README.md DESIGN.md docs/superpowers/plans/2026-08-06-shared-workspace-foundation.md
git commit -m "docs(workspace): complete shared foundation"
```

---

## Phase-A Completion Gate

Phase A is complete only when:

- all current apps load and save exclusively through `isf-workspace-v1`;
- old keys remain ignored and untouched pending Phase D;
- stale workspace writers cannot overwrite newer revisions;
- aggregate Portfolio behavior is unchanged;
- shared investment locations are visible from Portfolio without implying per-location allocation editing;
- whole-workspace backup replaces all validated slices in one commit and invalid import changes nothing;
- Account Map remains readiness-only and no Phase B UI is accidentally shipped;
- full type, unit, E2E, build, diff, and independent-review gates pass.

After this gate, write a separate implementation plan for Phase B Account Map using the concrete workspace, location, and Portfolio interfaces produced here. Do not start Phase C Main cards, Phase D legacy extinction, or the hidden trophy room from this plan.
