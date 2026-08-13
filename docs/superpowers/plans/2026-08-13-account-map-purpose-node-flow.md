# Account Map Purpose-Node Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Account Map readiness route with a Phase B app that connects Main-derived purposes to stable financial locations and explains the many-to-many result as an accessible purpose-first node map without mutating Main, Simulation, or Portfolio.

**Architecture:** Upgrade the single workspace record to schema version 2 through a pure, lossless v1 migration before adding Account Map commands. Keep financial location identity in `workspace.locations`; keep custom purposes, links, drafts, layout preference, and compatibility payloads in `workspace.accountMap`. Build the React app in domain, application, infrastructure, and UI units; React owns state and Anime.js owns only measured visual transitions.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, CSS, Anime.js v4 ESM (`animate` and `createLayout`), localStorage workspace repository.

## Global Constraints

- Canonical spec: `docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md`.
- Account Map may write only `workspace.locations` and `workspace.accountMap`.
- Every Account Map write must preserve `main`, `simulation`, and `portfolio` by deep equality; Portfolio plans and draft must also preserve their serialized value.
- Main values are read-only references. Never auto-redistribute links after Main changes.
- Storage key remains `isf-workspace-v1`; document schema becomes version 2.
- Preserve Phase A instruments and flows in `accountMap.legacyPhaseA`; never infer Phase B links from them.
- Default map layout is purpose-first. Account-first changes geometry only, not nodes or links.
- Exact edge amounts appear only during node focus; system purpose references and overall state remain visible.
- Pointer, keyboard, and touch expose the same state transitions.
- `prefers-reduced-motion: reduce` removes movement and scaling without removing functionality.
- Required viewports: 390px, 768px, and desktop.
- Preserve unrelated working-tree changes and the untracked `artifacts/` directory.

---

## File Structure

### Shared workspace

- `src/workspace/domain/accountMapContract.ts`: legacy Phase A contract retained for migration.
- `src/workspace/domain/model.ts`: workspace v2 and Account Map slice types.
- `src/workspace/domain/migration.ts`: pure v1 parse and v1-to-v2 migration.
- `src/workspace/domain/validation.ts`: strict v2 parser, references, capacities, and remainder invariants.
- `src/workspace/infrastructure/workspaceRepository.ts`: version-aware load and atomic migration write.
- `src/workspace/infrastructure/workspaceBackup.ts`: v1 import migration and v2 round-trip.

### Account Map

- `src/account-map/domain/model.ts`: purpose, link, institution, state, and command types.
- `src/account-map/domain/reconciliation.ts`: targets, remainder, unassigned, excess, and overall remaining calculations.
- `src/account-map/domain/commands.ts`: pure create/edit/suspend/archive/restore/reset mutations with write allowlist.
- `src/account-map/infrastructure/accountMapRepository.ts`: save-lock/revision adapter and cross-slice invariants.
- `src/account-map/infrastructure/mainSourceRepository.ts`: read-only Main adapter.
- `src/account-map/application/bootstrap.ts`: gate, migration, draft resume, and applied bootstrap.
- `src/account-map/application/reducer.ts`: setup, map, selection, modal, pending, and feedback state machine.
- `src/account-map/ui/AccountMapApp.tsx`: route composition and persistence effects.
- `src/account-map/ui/AccountMapSetup.tsx`: purpose cards, institution picker, connection allocation, and review.
- `src/account-map/ui/AccountMapCanvas.tsx`: node graph, zoom, layout controls, and accessible linear table.
- `src/account-map/ui/AccountMapModal.tsx`: read/edit modal, archive/restore, and focus containment.
- `src/account-map/ui/AccountMapManagementMenu.tsx`: reset and compatibility status.
- `src/account-map/ui/mapLayout.ts`: deterministic purpose/account geometry.
- `src/account-map/ui/motion.ts`: Anime.js layout and shared-element adapters.
- `src/account-map/ui/account-map.css`: responsive geometry, state, modal, and reduced-motion styles.

---

### Task 1: Define and Parse Workspace v2

**Files:**
- Create: `src/account-map/domain/model.ts`
- Create: `src/workspace/domain/migration.ts`
- Modify: `src/workspace/domain/accountMapContract.ts`
- Modify: `src/workspace/domain/model.ts`
- Modify: `src/workspace/domain/validation.ts`
- Create: `tests/unit/workspace/migration.test.ts`
- Modify: `tests/unit/workspace/validation.test.ts`

**Interfaces:**
- Produces: side-by-side `WorkspaceDocumentV1` and `WorkspaceDocumentV2`, `AccountMapApplied`, `AccountMapDraft`, `PurposeLocationLink`, `parseWorkspaceDocumentVersioned(value)`, and `migrateWorkspaceV1(legacy, now)`.
- Defers: changing the public `WorkspaceDocument` alias and `WORKSPACE_SCHEMA_VERSION` until Task 2, so current app consumers keep compiling after this task.
- Preserves: legacy `ConsumerInstrument` and `MonthlyFlow` parsers for `legacyPhaseA`.

- [ ] **Step 1: Write failing migration and invariant tests**

```ts
it('migrates v1 without changing protected slices', () => {
  const legacy = validWorkspaceV1();
  legacy.accountMap.flows = [validLegacyFlow];
  const migrated = migrateWorkspaceV1(legacy, 200);
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.main).toEqual(legacy.main);
  expect(migrated.simulation).toEqual(legacy.simulation);
  expect(migrated.portfolio).toEqual(legacy.portfolio);
  expect(migrated.accountMap.legacyPhaseA.flows).toEqual([validLegacyFlow]);
  expect(migrated.accountMap.applied).toBeNull();
});

it.each([
  ['duplicate link id', workspaceV2WithDuplicateLinkId()],
  ['active archived reference', workspaceV2WithActiveArchivedLocation()],
  ['two remainders', workspaceV2WithTwoActiveRemainders()],
  ['wrong role', workspaceV2WithRoleMismatch()],
])('rejects %s', (_name, value) => {
  expect(parseWorkspaceDocument(value)).toBeNull();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/workspace/migration.test.ts tests/unit/workspace/validation.test.ts`

Expected: FAIL because workspace v2 types and versioned parser do not exist.

- [ ] **Step 3: Add exact v2 types and pure migration**

```ts
export type SystemPurposeId =
  | 'system:income' | 'system:housing' | 'system:living'
  | 'system:saving' | 'system:investing';
export type PurposeId = SystemPurposeId | `custom:${string}`;

export interface PurposeLocationLink {
  id: string;
  purposeId: PurposeId;
  locationId: string;
  monthlyAmountWon: number;
  remainder: boolean;
  status: 'active' | 'suspended';
  suspendedReason?: 'location-archived' | 'user';
  createdAt: number;
  updatedAt: number;
}

export type VersionedWorkspaceParse =
  | { version: 1; workspace: WorkspaceDocumentV1 }
  | { version: 2; workspace: WorkspaceDocumentV2 };

export function migrateWorkspaceV1(
  legacy: WorkspaceDocumentV1,
  now: number,
): WorkspaceDocumentV2;
```

Keep v1 parsing exact. Add v2 checks for ID uniqueness, custom parent validity, safe integer amounts, location/purpose references, archived references, required roles, active/suspended reason shape, one active remainder, and capacities.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run tests/unit/workspace/migration.test.ts tests/unit/workspace/validation.test.ts`

Run: `npm run check`

Expected: migration and parser tests PASS; typecheck PASS because the public workspace alias remains v1 until Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/domain/model.ts src/workspace/domain/accountMapContract.ts src/workspace/domain/model.ts src/workspace/domain/migration.ts src/workspace/domain/validation.ts tests/unit/workspace/migration.test.ts tests/unit/workspace/validation.test.ts
git commit -m "feat(workspace): add account map v2 contract"
```

### Task 2: Integrate Atomic Migration and Backup

**Files:**
- Modify: `src/workspace/infrastructure/workspaceRepository.ts`
- Modify: `src/workspace/infrastructure/workspaceBackup.ts`
- Modify: `tests/unit/workspace/workspaceRepository.test.ts`
- Modify: `tests/unit/workspace/workspaceBackup.test.ts`
- Modify: `tests/unit/main/mainRepository.test.ts`
- Modify: `tests/unit/main/MainApp.test.tsx`
- Modify: `tests/unit/simulation/simulationRepository.test.ts`
- Modify: `tests/unit/portfolio/portfolioRepository.test.ts`
- Modify: workspace literals found by `rg -l "accountMap: \{ applied: null" tests src`

**Interfaces:**
- Consumes: `parseWorkspaceDocumentVersioned` and `migrateWorkspaceV1`.
- Produces: `WorkspaceLoadResult` with `needsMigration: boolean`; `WorkspaceRepository.migrate(expectedRevision)`; v1/v2 backup import returning a current `WorkspaceDocument`.
- Activates: `WorkspaceDocument = WorkspaceDocumentV2` and `WORKSPACE_SCHEMA_VERSION = 2`, then updates every compile-time consumer in this task.

- [ ] **Step 1: Write failing repository, backup, and slice-preservation tests**

```ts
it('atomically persists migration and preserves protected serialized slices', async () => {
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(validWorkspaceV1()));
  const before = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)!);
  const loaded = repository.load();
  expect(loaded.status).toBe('found');
  expect(loaded.needsMigration).toBe(true);
  const result = await repository.migrate(loaded.workspace.revision);
  expect(result.status).toBe('saved');
  const after = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)!);
  expect(JSON.stringify(after.main)).toBe(JSON.stringify(before.main));
  expect(JSON.stringify(after.portfolio)).toBe(JSON.stringify(before.portfolio));
});
```

Add tests for migration conflict, write failure restoring exact raw v1, v1 backup import, v2 backup round-trip, unknown schema rejection, and invalid reference atomic rejection.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/workspace/workspaceRepository.test.ts tests/unit/workspace/workspaceBackup.test.ts`

Expected: FAIL because `needsMigration` and `migrate` are absent.

- [ ] **Step 3: Implement migration-aware repository and backup**

```ts
export type WorkspaceLoadResult =
  | { status: 'found'; workspace: WorkspaceDocument; needsMigration: boolean }
  | { status: 'empty'; workspace: WorkspaceDocument; needsMigration: false }
  | { status: 'invalid'; raw: string }
  | { status: 'unavailable' };

export interface WorkspaceRepository {
  load(): WorkspaceLoadResult;
  migrate(expectedRevision: number): Promise<WorkspaceWriteResult>;
  // existing update/replace/resetInvalid/subscribe remain
}
```

`load()` normalizes v1 in memory but does not write. `migrate()` re-reads under the existing save lock, rejects stale revision, writes one v2 record with revision +1, verifies serialized storage, and restores the exact prior raw string on failure.

- [ ] **Step 4: Update all current workspace fixtures and consumers**

Use `createEmptyWorkspace()` or a shared fixture instead of hand-maintaining the v2 Account Map shape. Do not change expected Main, Simulation, Portfolio, or location behavior.

- [ ] **Step 5: Run shared regression**

Run: `npm run check`

Run: `npx vitest run tests/unit/workspace tests/unit/main/mainRepository.test.ts tests/unit/simulation/simulationRepository.test.ts tests/unit/portfolio/portfolioRepository.test.ts`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workspace tests/unit/workspace tests/unit/main/mainRepository.test.ts tests/unit/main/MainApp.test.tsx tests/unit/simulation/simulationRepository.test.ts tests/unit/portfolio/portfolioRepository.test.ts
git commit -m "feat(workspace): migrate records atomically"
```

Before committing, inspect `git diff --cached --name-only` and unstage unrelated test changes.

### Task 3: Implement Purpose Reconciliation and Institution Rules

**Files:**
- Create: `src/account-map/domain/reconciliation.ts`
- Create: `src/account-map/domain/institutions.ts`
- Create: `tests/unit/account-map/reconciliation.test.ts`
- Create: `tests/unit/account-map/institutions.test.ts`

**Interfaces:**
- Produces: `mainPurposeReferences(main)`, `reconcilePurpose(purposeId, applied, locations, main)`, `overallMainState(main)`, `recalculateRemainder(...)`, `institutionComparisonKey(location)`, and `findLocationDuplicate(...)`.

- [ ] **Step 1: Write failing calculation tests**

```ts
it('separates purpose excess from overall Main deficit', () => {
  const main = mainData({ income: 2_000_000, housing: 800_000, living: 900_000, saving: 300_000, investing: 200_000 });
  expect(overallMainState(main)).toEqual({ remainingWon: -200_000, kind: 'deficit' });
  expect(reconcilePurpose('system:living', appliedWithLivingLinks(1_100_000), locations, main))
    .toMatchObject({ targetWon: 900_000, unassignedWon: 0, excessWon: 200_000 });
});

it('subtracts child targets from the parent direct target', () => {
  expect(reconcilePurpose('system:living', appliedWithChild('통신비', 60_000), locations, mainData()).targetWon)
    .toBe(940_000);
});
```

Add cases for Main increase/decrease without link mutation, suspended exclusion, explicit remainder recalculation, custom target capacity, known/custom/institutionless duplicate keys, NFC/space/case normalization, and archived duplicate restore.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/reconciliation.test.ts tests/unit/account-map/institutions.test.ts`

Expected: FAIL because domain functions do not exist.

- [ ] **Step 3: Implement pure calculations and catalog**

```ts
export const INSTITUTIONS = [
  ['kb-kookmin', 'KB국민은행'], ['shinhan', '신한은행'],
  ['hana', '하나은행'], ['woori', '우리은행'],
  ['nh-nonghyup', 'NH농협은행'], ['ibk', 'IBK기업은행'],
  ['kdb', 'KDB산업은행'], ['toss-bank', '토스뱅크'],
  ['kakao-bank', '카카오뱅크'],
] as const;

export interface PurposeReconciliation {
  targetWon: number;
  activeAllocatedWon: number;
  unassignedWon: number;
  excessWon: number;
}
```

Pure functions must never mutate `main`, `applied`, links, or locations.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/unit/account-map/reconciliation.test.ts tests/unit/account-map/institutions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/domain/reconciliation.ts src/account-map/domain/institutions.ts tests/unit/account-map
git commit -m "feat(account-map): add purpose reconciliation"
```

### Task 4: Add Account Map Commands and Repository Invariants

**Files:**
- Create: `src/account-map/domain/commands.ts`
- Create: `src/account-map/infrastructure/accountMapRepository.ts`
- Create: `src/account-map/infrastructure/mainSourceRepository.ts`
- Create: `tests/unit/account-map/commands.test.ts`
- Create: `tests/unit/account-map/accountMapRepository.test.ts`
- Create: `tests/unit/account-map/mainSourceRepository.test.ts`

**Interfaces:**
- Produces: pure `applyAccountMapCommand(workspace, command, now)`; `AccountMapRepository.load/save/migrate/reset`; `AccountMapMainSourceRepository.load()`.
- Guarantees: allowlisted writes and protected-slice equality.

- [ ] **Step 1: Write failing command and invariance tests**

```ts
it.each(['create-location', 'save-draft', 'apply-map', 'archive-location', 'restore-location', 'reset-map'] as const)(
  '%s preserves protected slices', async (kind) => {
    const before = seededWorkspaceV2();
    const result = await runCommand(kind, before);
    expect(result.main).toEqual(before.main);
    expect(result.simulation).toEqual(before.simulation);
    expect(result.portfolio).toEqual(before.portfolio);
    expect(JSON.stringify(result.portfolio)).toBe(JSON.stringify(before.portfolio));
  },
);
```

Add tests for role add-only behavior, duplicate creation, link add/edit/remove/suspend/resume, atomic remainder switch, archive suspension, selective restore, stale revision, invalid mutation, storage failure, and reset preserve matrix.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/commands.test.ts tests/unit/account-map/accountMapRepository.test.ts tests/unit/account-map/mainSourceRepository.test.ts`

Expected: FAIL because command and repository APIs do not exist.

- [ ] **Step 3: Implement discriminated commands and allowlist guard**

```ts
export type AccountMapCommand =
  | { type: 'save-draft'; draft: AccountMapDraft }
  | { type: 'apply-map'; applied: AccountMapApplied }
  | { type: 'create-location'; location: FinancialLocation }
  | { type: 'update-location'; locationId: string; institution: InstitutionRef; shortName: string; addRoles: FinancialRole[] }
  | { type: 'archive-location'; locationId: string; replacementRemainderByPurpose: Record<string, string | null> }
  | { type: 'restore-location'; locationId: string; restoreLinkIds: string[]; remainderByPurpose: Record<string, string | null> }
  | { type: 'reset-map' };
```

Before returning a candidate, assert protected slices equal the source and only `locations`/`accountMap` differ. Repository converts thrown domain errors to explicit result codes without closing UI state.

- [ ] **Step 4: Run tests and shared regression**

Run: `npx vitest run tests/unit/account-map tests/unit/workspace`

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/domain/commands.ts src/account-map/infrastructure tests/unit/account-map
git commit -m "feat(account-map): add isolated workspace commands"
```

### Task 5: Build Bootstrap and UI State Machine

**Files:**
- Create: `src/account-map/application/bootstrap.ts`
- Create: `src/account-map/application/reducer.ts`
- Create: `tests/unit/account-map/bootstrap.test.ts`
- Create: `tests/unit/account-map/reducer.test.ts`

**Interfaces:**
- Produces: `bootstrapAccountMap(mainResult, workspaceResult)` and `accountMapReducer(state, event)`.
- State modes: `main-required`, `migrating`, `setup`, `map`, `invalid`, `unavailable`.
- Interaction state: `transientNodeId`, `pinnedNodeId`, `modalNodeId`.

- [ ] **Step 1: Write failing bootstrap and transition tests**

```ts
it('does not create state without applied Main', () => {
  expect(bootstrapAccountMap({ status: 'missing' }, foundWorkspace())).toMatchObject({ mode: 'main-required' });
});

it('pins before opening the same node modal', () => {
  const hovered = reduce(mapState(), { type: 'node-hovered', nodeId: 'system:living' });
  const pinned = reduce(hovered, { type: 'node-invoked', nodeId: 'system:living' });
  expect(pinned.interaction).toMatchObject({ pinnedNodeId: 'system:living', modalNodeId: null });
  const opened = reduce(pinned, { type: 'node-invoked', nodeId: 'system:living' });
  expect(opened.interaction.modalNodeId).toBe('system:living');
});
```

Cover migration, draft resume, Main-changed draft reconciliation, review/apply, cancel-preserves-draft, setup-cancel-clears-only-draft, Escape, outside press, focus blur, save pending, conflict, and retry.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts`

Expected: FAIL because application functions do not exist.

- [ ] **Step 3: Implement pure bootstrap and reducer**

```ts
export interface MapInteractionState {
  transientNodeId: string | null;
  pinnedNodeId: string | null;
  modalNodeId: string | null;
}

export type AccountMapEvent =
  | { type: 'node-hovered'; nodeId: string }
  | { type: 'node-blurred'; nodeId: string }
  | { type: 'node-invoked'; nodeId: string }
  | { type: 'map-background-invoked' }
  | { type: 'modal-closed' }
  | { type: 'layout-changed'; layout: 'purpose' | 'account' }
  | { type: 'save-requested' }
  | { type: 'save-failed'; reason: AccountMapSaveFailure };
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/application tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts
git commit -m "feat(account-map): add app state machine"
```

### Task 6: Replace Readiness with First-Run Setup

**Files:**
- Create: `src/account-map/ui/AccountMapApp.tsx`
- Create: `src/account-map/ui/AccountMapSetup.tsx`
- Create: `src/account-map/ui/AccountMapManagementMenu.tsx`
- Create: `src/account-map/ui/account-map.css`
- Modify: `src/journey/accountMap.tsx`
- Modify: `src/journey/ui/appNavigation.ts`
- Modify: `apps/account-map/index.html`
- Create: `tests/unit/account-map/AccountMapApp.test.tsx`
- Create: `tests/unit/account-map/AccountMapSetup.test.tsx`
- Modify: `tests/unit/journey/entryIsolation.test.ts`

**Interfaces:**
- Consumes: bootstrap, reducer, repositories, institution catalog, commands.
- Produces: Main gate, setup cards, account picker, allocation editor, resumable review, and applied result handoff.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('uses purpose copy and requires only resolved income', async () => {
  render(<AccountMapApp repositories={fixtureRepositories()} />);
  expect(screen.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '수입' })).toBeVisible();
  expect(screen.getByRole('button', { name: '연결' })).toBeVisible();
  expect(screen.queryByText(/source|destination|출발|도착/)).not.toBeInTheDocument();
});
```

Add tests for no-Main gate, 9 institutions plus direct input, existing location selection, duplicate restore offer, first link full amount, another-account remainder, custom child purpose, review/apply, draft resume, Main change warning, and failed save input retention.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/AccountMapSetup.test.tsx`

Expected: FAIL because the route still renders `ReadinessApp`.

- [ ] **Step 3: Implement setup UI and route wiring**

```tsx
createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <AccountMapApp />
    </MainErrorBoundary>
  </StrictMode>,
);
```

Use `AppShell currentApp="account-map"`. Remove `준비 중` availability from navigation only after the detailed route mounts. Keep controls at least 44px and contain account creation in the setup surface.

- [ ] **Step 4: Run tests and required widths smoke check**

Run: `npx vitest run tests/unit/account-map tests/unit/journey`

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/ui src/journey/accountMap.tsx src/journey/ui/appNavigation.ts apps/account-map/index.html tests/unit/account-map tests/unit/journey/entryIsolation.test.ts
git commit -m "feat(account-map): add purpose-first setup"
```

### Task 7: Build Deterministic Node Map and Linear Alternative

**Files:**
- Create: `src/account-map/ui/mapLayout.ts`
- Create: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/account-map.css`
- Create: `tests/unit/account-map/mapLayout.test.ts`
- Create: `tests/unit/account-map/AccountMapCanvas.test.tsx`

**Interfaces:**
- Produces: `layoutAccountMap(graph, layout, viewport, zoom): PositionedGraph` and accessible graph/table rendering.
- Zoom: `overview | default | detail`; layout: `purpose | account`.

- [ ] **Step 1: Write failing geometry and accessibility tests**

```ts
it.each([
  [390, 'top-to-bottom'], [768, 'top-to-bottom'], [1280, 'left-to-right'],
])('keeps deterministic nodes inside %ipx', (width, direction) => {
  const first = layoutAccountMap(graphFixture(), 'purpose', { width, height: 700 }, 'default');
  const second = layoutAccountMap(graphFixture(), 'purpose', { width, height: 700 }, 'default');
  expect(first).toEqual(second);
  expect(first.direction).toBe(direction);
  expect(first.nodes.every(nodeInsideViewport)).toBe(true);
});
```

Component tests must assert purpose layout default, account layout preserves node/link IDs, overview reduction, detail expansion, `+/-` controls, visible system references, hidden edge amounts before focus, and synchronized screen-reader table reading order.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/mapLayout.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx`

Expected: FAIL because map units do not exist.

- [ ] **Step 3: Implement graph projection and SVG/HTML nodes**

```ts
export interface PositionedGraph {
  direction: 'left-to-right' | 'top-to-bottom';
  nodes: Array<GraphNode & { x: number; y: number }>;
  edges: GraphEdge[];
}
```

Render edges as non-interactive SVG paths and nodes as semantic buttons over the same coordinate surface. Render a visually hidden but focusable table with layout-specific columns; do not use the SVG as the sole accessible representation.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/account-map/mapLayout.test.ts tests/unit/account-map/AccountMapCanvas.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/ui/mapLayout.ts src/account-map/ui/AccountMapCanvas.tsx src/account-map/ui/AccountMapApp.tsx src/account-map/ui/account-map.css tests/unit/account-map
git commit -m "feat(account-map): add accessible node map"
```

### Task 8: Add Anime.js Focus, Layout, and Shared-Element Modal

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/account-map/ui/motion.ts`
- Create: `src/account-map/ui/AccountMapModal.tsx`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/account-map.css`
- Create: `tests/unit/account-map/motion.test.ts`
- Create: `tests/unit/account-map/AccountMapModal.test.tsx`

**Interfaces:**
- Produces: `animateMapLayout`, `animateNodeToModal`, `animateModalToNode`, and modal read/edit states.
- Uses official Anime.js v4 ESM imports: `import { animate, createLayout } from 'animejs'`.

- [ ] **Step 1: Install Anime.js and write failing motion/modal tests**

Run: `npm install animejs`

```tsx
it('opens only after invoking an already pinned node', async () => {
  render(<AccountMapCanvas {...props} />);
  const node = screen.getByRole('button', { name: /생활비/ });
  fireEvent.click(node);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(node);
  expect(screen.getByRole('dialog', { name: /생활비 상세/ })).toBeVisible();
});

it('skips Anime.js when reduced motion is requested', () => {
  animateNodeToModal(node, modal, { reducedMotion: true });
  expect(animate).not.toHaveBeenCalled();
});
```

Add focus-return, archived-node fallback to map heading, Escape, outside focus prevention, duplicate-input lock, and same-modal read-to-edit tests.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/motion.test.ts tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapCanvas.test.tsx`

Expected: FAIL because adapters and modal do not exist.

- [ ] **Step 3: Implement measured motion adapters**

```ts
export interface MotionOptions {
  reducedMotion: boolean;
  onComplete(): void;
}

export function animateNodeToModal(
  nodeRect: DOMRect,
  modal: HTMLElement,
  options: MotionOptions,
): AnimationHandle;
```

React decides state before calling motion. Measure source/destination rectangles, animate transform/opacity only, clear inline styles on completion/cancel, and expose a synchronous no-motion path. Use `createLayout().record()/animate()` only for layout reordering.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/unit/account-map/motion.test.ts tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapCanvas.test.tsx`

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/account-map/ui tests/unit/account-map
git commit -m "feat(account-map): animate node detail transitions"
```

### Task 9: Complete Archive, Restore, Reset, and Recovery UX

**Files:**
- Modify: `src/account-map/ui/AccountMapModal.tsx`
- Modify: `src/account-map/ui/AccountMapManagementMenu.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/account-map.css`
- Modify: `tests/unit/account-map/AccountMapModal.test.tsx`
- Create: `tests/unit/account-map/AccountMapManagementMenu.test.tsx`

**Interfaces:**
- Consumes: archive/restore/reset commands and reconciliation.
- Produces: impact confirmation, replacement remainder selection, selective restore, compatibility notice, and exact reset preserve behavior.

- [ ] **Step 1: Write failing management tests**

```tsx
it('shows suspended impact and requires a replacement remainder', async () => {
  render(<AccountMapModal node={remainderLocationNode()} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '보관' }));
  expect(screen.getByText('생활비 700,000원 연결이 중지됩니다')).toBeVisible();
  expect(screen.getByRole('combobox', { name: '새 나머지 계좌' })).toBeRequired();
});

it('reset preserves registry and every protected slice', async () => {
  const before = seededWorkspaceV2();
  await resetThroughMenu(before);
  expect(saved.locations).toEqual(before.locations);
  expect(saved.main).toEqual(before.main);
  expect(saved.portfolio).toEqual(before.portfolio);
  expect(saved.accountMap.legacyPhaseA).toEqual(before.accountMap.legacyPhaseA);
});
```

Cover no-link archive, suspended exclusion, selective restore, restore excess correction, custom purpose archive, failed command recovery, stale conflict, and focus fallback.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapManagementMenu.test.tsx`

Expected: FAIL because management paths are incomplete.

- [ ] **Step 3: Implement management and recovery states**

Keep archive/restore inside the same node modal. Use a separate destructive confirmation only for `월 연결 다시 만들기`. Never offer Portfolio deletion. Preserve user input on unavailable/conflict results and show a retry or reload-current action.

- [ ] **Step 4: Run all Account Map unit tests**

Run: `npx vitest run tests/unit/account-map`

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/ui tests/unit/account-map
git commit -m "feat(account-map): add reversible map management"
```

### Task 10: Replace Legacy Reference Tests and Verify End-to-End

**Files:**
- Replace: `tests/account-map.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/main-react.spec.ts`
- Delete: `apps/account-map/app.js`
- Delete: `apps/account-map/modules/dom.js`
- Delete: `apps/account-map/modules/draft-builder.js`
- Delete: `apps/account-map/modules/map-renderer.js`
- Delete: `apps/account-map/modules/state.js`
- Delete: `apps/account-map/modules/step1-connector.js`
- Delete: `apps/account-map/styles.css`
- Delete: `src/entries/account-map.ts`
- Modify: `README.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`

**Interfaces:**
- Produces: supported Account Map Playwright suite, removal evidence for unused legacy runtime, and current product documentation.

- [ ] **Step 1: Inventory legacy references before deletion**

Run:

```bash
rg -n "apps/account-map/(app|modules|styles)|src/entries/account-map|accountMapCanvas|isf-account-map-v1" . --glob '!node_modules/**' --glob '!.git/**' --glob '!.codegraph/**'
```

Record each runtime, selector, storage key, compatibility path, and test reference in the task notes. Do not delete a referenced compatibility behavior until the v1 migration or new test covers it.

- [ ] **Step 2: Write the new E2E suite before deleting legacy files**

```ts
test('creates a purpose-first map without mutating Main or Portfolio', async ({ page }) => {
  await seedWorkspaceV1(page);
  await page.goto('apps/account-map/');
  const protectedBefore = await readProtectedSlices(page);
  await connectIncome(page, 'KB국민은행', '급여');
  await page.getByRole('button', { name: '지도 만들기' }).click();
  await expect(page.getByRole('heading', { name: '월 자금 지도' })).toBeVisible();
  expect(await readProtectedSlices(page)).toEqual(protectedBefore);
});
```

Add E2E cases for no-Main gate, draft resume, 9 institutions/direct input, another-account remainder, custom purpose, purpose/account layout, semantic zoom, hover/focus/tap parity, second invoke modal, modal edit, archive/restore, reset, reduced motion, migration, v2 backup round-trip, invalid restore, stale save, and protected slices after every mutation.

- [ ] **Step 3: Enable the supported suite and verify RED/GREEN transition**

Remove `**/account-map.spec.ts` from `testIgnore`. Run before implementation cleanup to confirm old selectors fail:

Run: `npx playwright test tests/account-map.spec.ts --reporter=list`

Expected before final wiring: FAIL on the first new Phase B assertion.

After wiring, expected: all new Account Map tests PASS.

- [ ] **Step 4: Delete retired runtime and verify references**

Delete only the listed unused legacy files. Then run the inventory command again.

Expected remaining references: approved migration constants/tests and current React route only; no runtime import, retired selector, or old storage write.

- [ ] **Step 5: Run full verification**

Run: `npm run check`

Run: `npm run test:unit`

Run: `npx playwright test tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/portfolio.spec.ts --reporter=list`

Run: `npm run test:e2e -- --reporter=list`

Run: `git diff --check`

Expected: zero failures.

- [ ] **Step 6: Perform visual and interaction QA**

At 390px, 768px, and 1280px verify:

- no horizontal overflow;
- setup actions and modal controls stay inside viewport;
- purpose map remains in the first viewport;
- mobile top-to-bottom and desktop left-to-right geometry;
- exact edge amounts hidden until focus;
- pointer hover, keyboard focus, first tap/click pin, second tap/click modal;
- modal grows from and returns to the selected node;
- reduced motion changes state immediately;
- pan does not trap page scroll;
- screen-reader table exposes the same relationships.

Capture screenshots for result, focused node, and modal at all three widths under `artifacts/account-map-qa/` only if that directory is already the approved artifact destination; otherwise use `/tmp` and leave the existing untracked `artifacts/` untouched.

- [ ] **Step 7: Update current-state documentation**

Mark Phase B Account Map supported only after all verification passes. Keep Phase C Main connected-result cards and Portfolio-location linking as future work.

- [ ] **Step 8: Commit**

```bash
git add tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts playwright.config.ts apps/account-map src/entries/account-map.ts README.md .planning/ROADMAP.md .planning/STATE.md
git commit -m "feat(account-map): ship purpose-node workspace"
```

Inspect staged deletions and confirm no unrelated `artifacts/` or Portfolio work is staged.

---

## Final Review Gate

- [ ] Compare every acceptance criterion in `docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md` with a passing unit, integration, E2E, or visual check.
- [ ] Request code review over the full implementation range.
- [ ] Resolve every Critical and Important finding.
- [ ] Re-run `npm run check`, `npm run test:unit`, full E2E, and `git diff --check` after the last fix.
- [ ] Confirm Main, Simulation, and Portfolio protected-slice equality evidence is from the final run.
- [ ] Use `superpowers:finishing-a-development-branch` only after final verification passes.
