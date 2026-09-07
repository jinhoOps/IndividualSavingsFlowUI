# Account Map Planned Account Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Turn Account Map into a Main-assisted, user-confirmed monthly account-flow graph with fixed and sweep transfers, touch-first flow inspection, reusable financial-location editing, and an in-context Main editor.

**Architecture:** Workspace v4 is a new canonical storage generation that preserves workspace v3 as a read-only rollback source while allowing Account Map applied v2/v3 and draft v1/v2 during user-confirmed migration. Pure Account Map modules own transfer validation, suggestion, calculation, view-model, and layout; React renders those results and emits typed commands. A journey-owned overlay mounts a Main-owned editor controller over an inert Account Map and signals a reload after Main saves without giving Account Map Main write authority.

**Tech Stack:** React 18, TypeScript, Vitest, Playwright, Anime.js, Vite PWA, localStorage, BroadcastChannel/Web Locks-compatible workspace repository.

**Spec:** [Account Map Planned Account Flow Design](../specs/2026-09-04-account-map-planned-account-flow-design.md)

## Execution Outcome — 2026-09-07

Tasks 1–11 are implemented. The task checklists below retain the original execution procedure; this outcome records the completed implementation and final merge gate.

- Final reviewed implementation: `e3eca19`, including completed-map purpose/account management, transfer resume/delete, explicit conflict recovery, v2/v3 Main confirmation preservation, and pending-save focus/history protection.
- Independent final code review: PASS, with no outstanding Critical or Important findings. The review findings were fixed before integration.
- Browser follow-up fixed desktop direction inside the shared 48rem frame, touch dismissal, canonical keyboard order, invisible 44px transfer hit regions, readable mobile management controls, and first-click/Escape preview interception. The reproduced click/Escape regression passed three consecutive browser runs after correction.
- `npm run check:ci`: PASS — harness, source/unit TypeScript checks, 133 unit files / 1,225 tests.
- `ISF_E2E_PORT=5768 npx playwright test --reporter=dot`: PASS — 116 passed / 1 intentional skip. The normal Chromium project blocks service workers, so its dedicated PWA offline-revisit case is conditional rather than exercised here.
- `npx vite build`: PASS, including generated service worker. The direct production build avoids an additional release-version increment from the npm build lifecycle.
- `git diff --check`: PASS. Changed canonical Markdown documents and this spec/plan had 38 relative links checked with no missing targets.
- UI evidence: actual 390px, 768px, and 1280px browser captures inspected; document widths stayed within their viewports. Focus, overlay containment, touch controls, and visible visualization were covered by browser regressions.
- Earlier combined runs exposed a Main backup-dialog timing timeout and a Simulation scroll-position assertion; both passed isolated reruns without unrelated product changes, and the final complete run passed. Account Map failures were reproduced and corrected rather than waived.
- Integration decision: approved for local fast-forward merge into `main`; remote push and worktree removal are not part of this final-review request.

## Global Constraints

- Main owns monthlyNetIncomeWon, monthlyHousingWon, monthlyLivingWon, monthlySavingWon, and monthlyInvestmentWon. Account Map may read them but may write only workspace.locations and workspace.accountMap.
- Write only workspace schema version 4 to isf-workspace-v4. Preserve isf-workspace-v3 and the supported retired source byte-for-byte.
- Workspace v4 accepts Account Map applied v2/v3 and draft v1/v2. Viewing or migrating the envelope must not silently upgrade the Account Map sub-slice.
- The first user-confirmed transfer save upgrades the affected Account Map state. No suggestion is persisted automatically.
- The transfer allocation kind sweep means the nonnegative amount left at an account. Existing PurposeLocationLink.remainder keeps its separate purpose-capacity meaning.
- Active account transfers form a directed acyclic graph. Block self-links, duplicate active pairs, cycles, missing or archived endpoints, invalid fixed amounts, and multiple active sweeps from one source.
- Financial shortfall and unassigned money are warnings that may be saved; malformed topology is rejected.
- Account nodes appear once. Amount never changes ordinary node dimensions, edge thickness, or persisted geometry.
- The first click, tap, or keyboard activation pins related upstream and downstream flow and exposes explicit actions. Editing is never hidden behind a second activation.
- Anime.js runs only after deterministic layout. Reduced motion and every caught animation failure render the same final content immediately.
- At 390px, 768px, and desktop widths, the document, graph, detail, setup, location editor, transfer editor, and Main overlay must remain contained and usable with 44px touch targets.

---

## File Structure

- src/account-map/domain/model.ts: current and migration-input Account Map contracts, transfer types, and setup-step types.
- src/account-map/domain/accountMapVersioning.ts: read-only in-memory projections and user-confirmed v2/v1 to v3/v2 sub-slice upgrades.
- src/account-map/domain/accountFlowValidation.ts: pure transfer topology and reference validation.
- src/account-map/domain/accountFlowCalculator.ts: deterministic topological account-flow calculation.
- src/account-map/domain/accountFlowSuggestion.ts: conservative Main-assisted transfer suggestions.
- src/account-map/domain/accountFlowCommands.ts: add/edit/remove transfer and confirm-current-main commands.
- src/account-map/domain/accountFlowEditIntent.ts: safe single-field transfer rebase and explicit manual-conflict classification.
- src/workspace/domain/model.ts and validation.ts: workspace v4 envelope and nested Account Map version unions.
- src/workspace/infrastructure/workspaceV3Migration.ts: exact workspace-v3 parser and pure v3-to-v4 conversion.
- src/workspace/infrastructure/workspaceRepository.ts and workspaceSaveLock.ts: v4 canonical persistence, v3/v1 read-only fallback, and cross-generation locking.
- src/workspace/infrastructure/workspaceBackup.ts: backup format v3 and format v2/v1 import conversion.
- src/workspace/domain/locationCommands.ts: atomic kind, institution, and display-name updates.
- src/account-map/ui/FinancialLocationFields.tsx: shared controlled create/edit fields.
- src/components/common/FormattedMoneyInput.tsx: shared controlled formatted-won input.
- src/account-map/ui/AccountTransferEditor.tsx: fixed/sweep transfer editor.
- src/account-map/ui/AccountMapSetup.tsx and focused step components: centered basis, locations, transfers, and review flow.
- src/account-map/ui/accountFlowGraph.ts: account/purpose/transfer graph construction.
- src/account-map/ui/accountFlowViewModel.ts: labels, warnings, reachable focus, detail groups, and screen-reader rows.
- src/account-map/ui/accountFlowLayout.ts: deterministic responsive layered geometry.
- src/account-map/ui/AccountMapCanvas.tsx and AccountFlowDetail.tsx: rendering and touch/pointer/keyboard interaction.
- src/main/ui/dashboard/MainPlanEditor.tsx: reusable Main-owned plan fields.
- src/main/ui/useMainPlanEditorController.ts: Main-owned embedded editor state and persistence.
- src/journey/ui/MainPlanEditOverlay.tsx and mainPlanOverlayHistory.ts: modal lifecycle, history, focus, inert background, and motion.
- src/journey/ui/AccountMapJourney.tsx: Account Map plus Main editor overlay composition and reload signal.
- src/account-map/ui/account-map.css and src/journey/ui/journey.css: contained responsive presentation.
- tests/unit/account-map, tests/unit/workspace, tests/unit/main, tests/unit/journey, and tests/account-map.spec.ts: domain, storage, UI, motion, responsive, and end-to-end evidence.

### Task 1: Add versioned Account Map transfer contracts

**Files:**
- Modify: src/account-map/domain/model.ts
- Create: src/account-map/domain/accountMapVersioning.ts
- Create: src/account-map/domain/accountFlowValidation.ts
- Test: tests/unit/account-map/accountMapVersioning.test.ts
- Test: tests/unit/account-map/accountFlowValidation.test.ts

**Interfaces:**
- Additively produces AccountTransferAllocation, AccountTransferLink, AccountMapAppliedV3, AccountMapDraftV2, StoredAccountMapApplied, and StoredAccountMapDraft while the existing AccountMapApplied v2 and AccountMapDraft v1 writers remain unchanged until Task 5.
- Produces projectAccountMapAppliedForView and projectAccountMapDraftForView, which add empty transfers and current steps in memory without writing.
- Produces upgradeAccountMapAppliedForTransferSave and upgradeAccountMapDraftForTransferSave, used only from explicit flow-save commands.
- Produces validateAccountTransfers(transfers, locations): AccountFlowValidationResult.

- [ ] **Step 1: Write failing contract and parser tests**

Add exact-shape fixtures and assert:

~~~ts
expect(parseStoredAccountMapApplied(appliedV2)).not.toBeNull();
expect(parseStoredAccountMapApplied(appliedV3)).not.toBeNull();
expect(parseStoredAccountMapDraft(draftV1)).not.toBeNull();
expect(parseStoredAccountMapDraft(draftV2)).not.toBeNull();
expect(parseStoredAccountMapApplied(appliedWithTwoActiveSweeps)).toBeNull();
expect(parseStoredAccountMapApplied(appliedWithUnknownTransferAllocation)).toBeNull();
~~~

In accountMapVersioning.test.ts, assert projection returns schemaVersion 3 with transfers: [] while the source object remains byte-equal. Assert the upgrade functions preserve customPurposes, links, timestamps, and add only the supplied transfer data/current step.

- [ ] **Step 2: Run tests to prove the current contract lacks transfers**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountMapVersioning.test.ts tests/unit/account-map/accountFlowValidation.test.ts
~~~

Expected: FAIL because the versioned types, transfer parser, and projection functions do not exist.

- [ ] **Step 3: Implement exact versioned types**

Use discriminated active/suspended transfer states:

~~~ts
export type AccountTransferAllocation =
  | { kind: 'fixed'; monthlyAmountWon: number }
  | { kind: 'sweep' };

type AccountTransferBase = {
  id: string;
  sourceLocationId: string;
  targetLocationId: string;
  allocation: AccountTransferAllocation;
  createdAt: number;
  updatedAt: number;
};

export type AccountTransferLink =
  | (AccountTransferBase & { status: 'active' })
  | (AccountTransferBase & {
      status: 'suspended';
      suspendedReason: 'location-archived' | 'user';
    });

export type AccountMapSetupStep = 'basis' | 'locations' | 'transfers' | 'review';
~~~

Keep explicit migration-input types rather than making fields optional. Do not change the existing v2/v1 write constants in this additive task. AccountMapAppliedV3 is schemaVersion 3 with transfers; AccountMapDraftV2 is schemaVersion 2 with transfers and AccountMapSetupStep. StoredAccountMapApplied and StoredAccountMapDraft are the only unions.

- [ ] **Step 4: Implement strict nested parsing and pure projections**

Parse applied v2/v3 and draft v1/v2 by exact keys inside accountMapVersioning.ts. Validate unique transfer IDs, safe nonnegative fixed amounts, distinct endpoints, active endpoint references, duplicate active pairs, one active sweep per source, and acyclicity through validateAccountTransfers. Suspended links remain structurally readable even when an endpoint is archived.

Projection helpers clone input and never mutate or persist it:

~~~ts
export function projectAccountMapAppliedForView(
  value: StoredAccountMapApplied,
): AccountMapApplied;

export function projectAccountMapDraftForView(
  value: StoredAccountMapDraft,
): AccountMapDraft;
~~~

- [ ] **Step 5: Run focused tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountMapVersioning.test.ts tests/unit/account-map/accountFlowValidation.test.ts
~~~

Expected: PASS for every accepted version, exact-key rejection, transfer reference rule, source immutability, and no-write projection.

- [ ] **Step 6: Commit the nested contract**

~~~bash
git add src/account-map/domain/model.ts src/account-map/domain/accountMapVersioning.ts src/account-map/domain/accountFlowValidation.ts tests/unit/account-map/accountMapVersioning.test.ts tests/unit/account-map/accountFlowValidation.test.ts
git commit -m "feat(account-map): add planned transfer contract"
~~~

### Task 2: Introduce workspace v4 as a rollback-safe generation

**Files:**
- Modify: src/workspace/domain/model.ts
- Create: src/workspace/infrastructure/workspaceV3Migration.ts
- Modify: src/workspace/infrastructure/retiredWorkspaceMigration.ts
- Create: docs/adr/0003-workspace-v4-account-flow-generation.md
- Test: tests/unit/workspace/workspaceV3Migration.test.ts
- Test: tests/unit/workspace/retiredWorkspaceMigration.test.ts

**Interfaces:**
- Additively produces WORKSPACE_V4_SCHEMA_VERSION = 4, WORKSPACE_V4_STORAGE_KEY = isf-workspace-v4, PREVIOUS_WORKSPACE_STORAGE_KEY = isf-workspace-v3, and WorkspaceDocumentV4 without yet changing the existing WorkspaceDocument v3 alias or active repository constants.
- Produces convertWorkspaceV3Document(value, migratedAt): WorkspaceV4SourceConversionResult.
- Adds convertRetiredWorkspaceToV4 as a composition over the supported v1/v2 converter without changing the active v3 repository in this task.

- [ ] **Step 1: Write failing v3-to-v4 conversion tests**

Use an exact workspace-v3 fixture containing Account Map applied v2 and draft v1. Assert:

~~~ts
const result = convertWorkspaceV3Document(source, 500);
expect(result.status).toBe('converted');
if (result.status === 'converted') {
  expect(result.workspace.schemaVersion).toBe(4);
  expect(result.workspace.accountMap).toEqual(source.accountMap);
  expect(result.workspace.main).toEqual(source.main);
}
expect(source).toEqual(originalSource);
~~~

Add invalid schema, invalid reference, future timestamp, applied-v2, draft-v1, null Account Map, and deterministic repeat cases. Add a retired v1/v2 conversion assertion whose final result is workspace v4 but whose original bytes are unchanged.

- [ ] **Step 2: Run migration tests and observe failure**

Run:

~~~bash
npx vitest run tests/unit/workspace/workspaceV3Migration.test.ts tests/unit/workspace/retiredWorkspaceMigration.test.ts
~~~

Expected: FAIL because workspace v4 and the v3 converter are absent.

- [ ] **Step 3: Implement the exact v3 parser and v4 converter**

Do not loosen the current v4 validator. workspaceV3Migration.ts owns the historical exact v3 shape and reuses slice parsers only through explicit version-aware functions. Return schema or reference failure without constructing a partial candidate.

The successful additive result is:

~~~ts
{
  status: 'converted',
  sourceVersion: 3,
  workspace: {
    ...validatedV3,
    schemaVersion: 4,
    updatedAt: migratedAt,
  },
}
~~~

Preserve the nested Account Map version and all non-envelope slice data.
Do not switch createEmptyWorkspace, WORKSPACE_SCHEMA_VERSION, WORKSPACE_STORAGE_KEY, BrowserWorkspaceRepository, or backup export in this task; Task 3 performs that cutover as one deployable gate.

- [ ] **Step 4: Record the generation and rollback decision**

Create ADR 0003 with accepted status. Record why a nested Account Map change cannot reuse the v3 key, why v3 stays untouched, why invalid v4 cannot fall back, how v3/v4 writers are isolated, and how backup format v3 follows workspace v4.

- [ ] **Step 5: Run migration tests**

Run:

~~~bash
npx vitest run tests/unit/workspace/workspaceV3Migration.test.ts tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts
~~~

Expected: PASS with byte-preserved v3/v1 sources and valid additive WorkspaceDocumentV4 outputs while all existing repository tests still use v3.

- [ ] **Step 6: Commit workspace v4 domain and migration**

~~~bash
git add src/workspace/domain/model.ts src/workspace/infrastructure/workspaceV3Migration.ts src/workspace/infrastructure/retiredWorkspaceMigration.ts docs/adr/0003-workspace-v4-account-flow-generation.md tests/unit/workspace/workspaceV3Migration.test.ts tests/unit/workspace/retiredWorkspaceMigration.test.ts tests/unit/workspace/validation.test.ts
git commit -m "feat(workspace): add v4 migration boundary"
~~~

### Task 3: Move repository locks and backups to workspace v4

**Files:**
- Modify: src/workspace/infrastructure/workspaceSaveLock.ts
- Modify: src/workspace/infrastructure/workspaceRepository.ts
- Modify: src/workspace/infrastructure/workspaceBackup.ts
- Modify: src/workspace/domain/model.ts
- Modify: src/workspace/domain/validation.ts
- Modify: src/main/application/mainBackupCommands.ts
- Test: tests/unit/workspace/workspaceSaveLock.test.ts
- Test: tests/unit/workspace/workspaceRepository.test.ts
- Test: tests/unit/workspace/workspaceBackup.test.ts
- Test: tests/unit/workspace/validation.test.ts
- Test: tests/unit/main/mainBackupCommands.test.ts
- Test: tests/retired-storage-isolation.spec.ts

**Interfaces:**
- Promotes WorkspaceDocumentV4 to WorkspaceDocument, WORKSPACE_SCHEMA_VERSION to 4, and WORKSPACE_STORAGE_KEY to isf-workspace-v4 in the same change that activates v4 repository loading.
- BrowserWorkspaceRepository loads v4 first, then v3, then the supported v1/v2 source; only migrate/update/replace writes v4.
- WorkspaceLoadResult continues to expose needsMigration without mutating storage.
- WorkspaceBackupEnvelope formatVersion becomes 3 and contains workspace v4.

- [ ] **Step 1: Write failing repository generation tests**

Cover v4 precedence, invalid-v4 no-fallback, v3 read-only load, v3-to-v4 migrate, v1/v2 fallback only when v4/v3 are absent, write failure rollback, and an already-open v3 writer changing v3 while v4 migration is acquiring locks. Assert v3 raw text is byte-equal after every v4 operation.

- [ ] **Step 2: Write failing backup format tests**

Assert export emits formatVersion 3/workspace schemaVersion 4. Assert format 3 imports exactly, format 2 converts workspace v3, format 1 uses the retained retired converter, unknown formats fail, and invalid or partially referenced inputs perform zero repository writes.

- [ ] **Step 3: Run storage tests to prove the generation is not wired**

Run:

~~~bash
npx vitest run tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/mainBackupCommands.test.ts
~~~

Expected: FAIL on v4 key, generation precedence, and format version assertions.

- [ ] **Step 4: Implement v4 locking and canonical persistence**

Add distinct v4 and v3 lock namespaces. Initial v3 conversion acquires the v3 source lock, snapshots and rechecks the source, then acquires the v4 destination lock and writes verified v4. Ordinary v4 updates acquire only the v4 lock. Never remove or overwrite v3/v1.

Loading order must be:

~~~ts
if (v4Raw !== null) return parseV4Only(v4Raw);
if (v3Raw !== null) return convertV3InMemory(v3Raw);
if (retiredRaw !== null) return convertRetiredInMemory(retiredRaw);
return createEmptyV4();
~~~

- [ ] **Step 5: Implement backup format 3**

Keep format 2 and format 1 as read-only import branches. Convert before calling replace so replace always receives a valid workspace v4 candidate. Preserve current confirmation, failure mapping, and atomic replacement behavior.

- [ ] **Step 6: Run storage and isolation tests**

Run:

~~~bash
npx vitest run tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/mainBackupCommands.test.ts
npx playwright test tests/retired-storage-isolation.spec.ts --reporter=list
~~~

Expected: PASS, including source-byte preservation, cross-generation writer isolation, and invalid-v4 no-fallback.

- [ ] **Step 7: Commit repository and backup generation**

~~~bash
git add src/workspace/domain/model.ts src/workspace/domain/validation.ts src/workspace/infrastructure/workspaceSaveLock.ts src/workspace/infrastructure/workspaceRepository.ts src/workspace/infrastructure/workspaceBackup.ts src/main/application/mainBackupCommands.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceSaveLock.test.ts tests/unit/workspace/workspaceRepository.test.ts tests/unit/workspace/workspaceBackup.test.ts tests/unit/main/mainBackupCommands.test.ts tests/retired-storage-isolation.spec.ts
git commit -m "feat(workspace): persist rollback-safe v4 records"
~~~

### Task 4: Build pure account-flow calculation and suggestions

**Files:**
- Create: src/account-map/domain/accountFlowCalculator.ts
- Create: src/account-map/domain/accountFlowSuggestion.ts
- Create: tests/unit/account-map/accountFlowCalculator.test.ts
- Create: tests/unit/account-map/accountFlowSuggestion.test.ts

**Interfaces:**
- Produces calculateAccountFlow(input): AccountFlowCalculation.
- Produces suggestAccountTransfers(input): readonly AccountTransferSuggestion[].
- AccountFlowCalculation contains deterministic account rows, calculated transfer amounts, global warnings, and topologicalOrder.

- [ ] **Step 1: Write failing calculator tests**

Build the approved example with 3,100,000 won entering salary, fixed transfers to living and brokerage, and a living sweep to brokerage. Assert for each account:

~~~ts
expect(result.accountsById['salary']).toMatchObject({
  externalIncomeWon: 3_100_000,
  inboundTransferWon: 0,
  outboundFixedWon: 1_900_000,
});
expect(result.transfersById['living-sweep'].amountWon).toBe(expectedLivingRemainder);
expect(result.workspaceTotals.externalIncomeWon).toBe(3_100_000);
~~~

Add multiple source/destination, zero sweep still present, custom-purpose sink, shortfall, unassigned amount, suspended transfer, and reversed-storage-order determinism cases.

- [ ] **Step 2: Write failing suggestion tests**

Assert suggestions exist only when exactly one active location receives the full income allocation, aggregate outflow allocations by destination, omit the income account itself, use fixed allocation, and return none for multiple income locations, unresolved purpose destinations, or any existing declared transfer.

- [ ] **Step 3: Run the new tests and observe missing modules**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowCalculator.test.ts tests/unit/account-map/accountFlowSuggestion.test.ts
~~~

Expected: FAIL because neither pure module exists.

- [ ] **Step 4: Implement deterministic calculation**

Use Kahn topological ordering with location ID as the final tie-breaker. For each active location calculate:

~~~ts
availableWon = externalIncomeWon + inboundFixedWon + inboundSweepWon;
remainderBeforeSweepWon = availableWon - localAllocationWon - outboundFixedWon;
sweepWon = hasSweep ? Math.max(remainderBeforeSweepWon, 0) : 0;
unassignedWon = hasSweep ? 0 : Math.max(remainderBeforeSweepWon, 0);
shortfallWon = Math.max(-remainderBeforeSweepWon, 0);
~~~

Purpose-location links supply external income and local allocation only. Account transfers are internal and never increase workspace-wide Main totals.

- [ ] **Step 5: Implement conservative suggestions**

Return ephemeral suggestions without IDs or timestamps:

~~~ts
export interface AccountTransferSuggestion {
  sourceLocationId: string;
  targetLocationId: string;
  allocation: { kind: 'fixed'; monthlyAmountWon: number };
  contributingPurposeIds: PurposeId[];
}
~~~

Do not suggest sweep transfers and do not persist from this function.

- [ ] **Step 6: Run pure domain tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowCalculator.test.ts tests/unit/account-map/accountFlowSuggestion.test.ts
~~~

Expected: PASS with exact per-account arithmetic and storage-order-independent output.

- [ ] **Step 7: Commit calculation and suggestion modules**

~~~bash
git add src/account-map/domain/accountFlowCalculator.ts src/account-map/domain/accountFlowSuggestion.ts tests/unit/account-map/accountFlowCalculator.test.ts tests/unit/account-map/accountFlowSuggestion.test.ts
git commit -m "feat(account-map): calculate planned account flows"
~~~

### Task 5: Add transfer commands, conflict handling, and Main confirmation

**Files:**
- Create: src/account-map/domain/accountFlowCommands.ts
- Create: src/account-map/domain/accountFlowEditIntent.ts
- Modify: src/account-map/domain/commands.ts
- Modify: src/account-map/domain/editIntent.ts
- Modify: src/account-map/infrastructure/accountMapRepository.ts
- Modify: src/workspace/domain/locationCommands.ts
- Modify: src/account-map/application/bootstrap.ts
- Modify: src/account-map/application/reducer.ts
- Test: tests/unit/account-map/accountFlowCommands.test.ts
- Test: tests/unit/account-map/accountFlowEditIntent.test.ts
- Test: tests/unit/account-map/commands.test.ts
- Test: tests/unit/account-map/accountMapRepository.test.ts
- Test: tests/unit/account-map/bootstrap.test.ts
- Test: tests/unit/account-map/reducer.test.ts
- Test: tests/unit/workspace/locationCommands.test.ts

**Interfaces:**
- Adds add-transfer, edit-transfer, remove-transfer, confirm-current-main, and update-location-details commands.
- Produces AccountFlowEditIntent for safe fixed-amount/status rebase. Source/target, deletion, sweep changes, and topology collisions use manual recovery.
- Adds mapNeedsMainConfirmation(applied, main): boolean.

- [ ] **Step 1: Write failing command tests**

Assert add-transfer upgrades only the selected applied/draft sub-slice, preserves every other slice by deep equality, and rejects each structural error. Assert edit fixed amount rebases only when the same field did not change upstream. Assert source/target changes, removal, and fixed-to-sweep changes require manual latest-state review.

Add archive tests that suspend every incident purpose and transfer link. Restore must restore only the location and explicitly selected links; it never automatically reactivates a transfer.

- [ ] **Step 2: Write failing Main confirmation tests**

With sourceMainUpdatedAt older than Main, assert mapNeedsMainConfirmation is true. confirm-current-main must recalculate existing PurposeLocationLink.remainder values, reject fixed-purpose excess without writes, preserve every AccountTransferLink byte-for-byte, set sourceMainUpdatedAt to Main.updatedAt, and clear the derived stale state.

- [ ] **Step 3: Write failing location detail update tests**

Assert updateLocationDetails changes shortName, kind, and institution atomically; cash removes institution; active duplicate name/institution combinations fail; invalid bank/brokerage UI input is rejected; roles and all incident links remain unchanged.

- [ ] **Step 4: Run focused command tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowCommands.test.ts tests/unit/account-map/accountFlowEditIntent.test.ts tests/unit/account-map/commands.test.ts tests/unit/account-map/accountMapRepository.test.ts tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts tests/unit/workspace/locationCommands.test.ts
~~~

Expected: FAIL because the commands and stale confirmation contract are absent.

- [ ] **Step 5: Implement command and rebase boundaries**

Keep accountFlowCommands pure and call it from the existing Account Map command dispatcher. Every success passes through parseWorkspaceDocument before repository persistence. Return explicit rejection reasons:

~~~ts
type AccountFlowCommandError =
  | 'self-transfer'
  | 'duplicate-transfer'
  | 'cycle'
  | 'multiple-sweeps'
  | 'endpoint-not-found'
  | 'endpoint-archived'
  | 'invalid-amount'
  | 'purpose-fixed-excess';
~~~

Do not turn financial shortfall into a command error.

- [ ] **Step 6: Integrate bootstrap and reducer state**

Project stored v2/v1 Account Map states for view without saving. Add a map-level mainConfirmationRequired flag derived from sourceMainUpdatedAt. Add typed reducer events for transfer save, manual conflict, confirmation success/failure, and external workspace refresh. Remove the old second-activation-to-open-modal transition; pin and explicit edit requests are separate events.

- [ ] **Step 7: Run focused command tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowCommands.test.ts tests/unit/account-map/accountFlowEditIntent.test.ts tests/unit/account-map/commands.test.ts tests/unit/account-map/accountMapRepository.test.ts tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts tests/unit/workspace/locationCommands.test.ts
~~~

Expected: PASS with cross-slice deep equality and explicit stale/conflict behavior.

- [ ] **Step 8: Commit application commands**

~~~bash
git add src/account-map/domain/accountFlowCommands.ts src/account-map/domain/accountFlowEditIntent.ts src/account-map/domain/commands.ts src/account-map/domain/editIntent.ts src/account-map/infrastructure/accountMapRepository.ts src/workspace/domain/locationCommands.ts src/account-map/application/bootstrap.ts src/account-map/application/reducer.ts tests/unit/account-map/accountFlowCommands.test.ts tests/unit/account-map/accountFlowEditIntent.test.ts tests/unit/account-map/commands.test.ts tests/unit/account-map/accountMapRepository.test.ts tests/unit/account-map/bootstrap.test.ts tests/unit/account-map/reducer.test.ts tests/unit/workspace/locationCommands.test.ts
git commit -m "feat(account-map): command account transfer plans"
~~~

### Task 6: Reuse financial-location and formatted-money fields

**Files:**
- Create: src/components/common/FormattedMoneyInput.tsx
- Create: src/account-map/ui/FinancialLocationFields.tsx
- Create: src/account-map/ui/AccountTransferEditor.tsx
- Modify: src/account-map/ui/AccountMapLocationPicker.tsx
- Modify: src/account-map/ui/AccountMapModal.tsx
- Create: tests/unit/components/FormattedMoneyInput.test.tsx
- Create: tests/unit/account-map/FinancialLocationFields.test.tsx
- Create: tests/unit/account-map/AccountTransferEditor.test.tsx
- Modify: tests/unit/account-map/AccountMapLocationPicker.test.tsx
- Modify: tests/unit/account-map/AccountMapModal.test.tsx

**Interfaces:**
- FormattedMoneyInput accepts valueWon, onValueWonChange, zeroDisplay, disabled, aria-describedby, and adjustment buttons through ordinary input props.
- FinancialLocationFields accepts value: FinancialLocationFieldsValue and onChange; it owns no persistence.
- AccountTransferEditor emits a validated AccountTransferEditorValue but owns no repository.

- [ ] **Step 1: Write failing controlled-input tests**

Assert comma formatting and caret preservation for insertion/deletion, empty input, zero, Korean IME composition, paste, and disabled state. Reuse normalizeMoneyEdit and parseWonInput; do not fork parsing logic.

- [ ] **Step 2: Write failing location-field parity tests**

Render the same FinancialLocationFields in create and edit modes. Assert identical bank/brokerage/cash choices, institution quick selection, custom institution, display name, cash clearing, and accessible errors. Existing stored bank/brokerage locations without institution must render and allow repair, while a new save without institution remains disabled.

- [ ] **Step 3: Write failing transfer-editor tests**

Assert source and target cannot match, archived locations are unavailable, fixed exposes FormattedMoneyInput, sweep hides the amount field, status is announced, and save emits:

~~~ts
{
  sourceLocationId: 'salary',
  targetLocationId: 'brokerage',
  allocation: { kind: 'sweep' },
  status: 'active',
}
~~~

- [ ] **Step 4: Run component tests and observe failure**

Run:

~~~bash
npx vitest run tests/unit/components/FormattedMoneyInput.test.tsx tests/unit/account-map/FinancialLocationFields.test.tsx tests/unit/account-map/AccountTransferEditor.test.tsx tests/unit/account-map/AccountMapLocationPicker.test.tsx tests/unit/account-map/AccountMapModal.test.tsx
~~~

Expected: FAIL because the shared controlled components do not exist and edit lacks kind/institution.

- [ ] **Step 5: Implement and integrate the controlled components**

FinancialLocationFields normalizes presentation only. Commands remain the authority for duplicates and stored validation. AccountMapLocationPicker uses it for creation; AccountMapModal uses it for account editing and dispatches one update-location-details command. Replace Account Map money inputs in scope with FormattedMoneyInput.

- [ ] **Step 6: Run component tests**

Run:

~~~bash
npx vitest run tests/unit/components/FormattedMoneyInput.test.tsx tests/unit/account-map/FinancialLocationFields.test.tsx tests/unit/account-map/AccountTransferEditor.test.tsx tests/unit/account-map/AccountMapLocationPicker.test.tsx tests/unit/account-map/AccountMapModal.test.tsx
~~~

Expected: PASS for controlled behavior, create/edit parity, and accessible errors.

- [ ] **Step 7: Commit shared Account Map fields**

~~~bash
git add src/components/common/FormattedMoneyInput.tsx src/account-map/ui/FinancialLocationFields.tsx src/account-map/ui/AccountTransferEditor.tsx src/account-map/ui/AccountMapLocationPicker.tsx src/account-map/ui/AccountMapModal.tsx tests/unit/components/FormattedMoneyInput.test.tsx tests/unit/account-map/FinancialLocationFields.test.tsx tests/unit/account-map/AccountTransferEditor.test.tsx tests/unit/account-map/AccountMapLocationPicker.test.tsx tests/unit/account-map/AccountMapModal.test.tsx
git commit -m "refactor(account-map): share financial edit fields"
~~~

### Task 7: Replace setup with the centered four-step flow

**Files:**
- Modify: src/account-map/ui/AccountMapSetup.tsx
- Create: src/account-map/ui/setup/AccountMapBasisStep.tsx
- Create: src/account-map/ui/setup/AccountMapLocationsStep.tsx
- Create: src/account-map/ui/setup/AccountMapTransfersStep.tsx
- Create: src/account-map/ui/setup/AccountMapReviewStep.tsx
- Modify: src/account-map/ui/AccountMapApp.tsx
- Modify: src/account-map/ui/motion.ts
- Modify: src/account-map/ui/account-map.css
- Modify: tests/unit/account-map/AccountMapSetup.test.tsx
- Modify: tests/unit/account-map/AccountMapApp.test.tsx
- Modify: tests/unit/account-map/motion.test.ts

**Interfaces:**
- AccountMapSetup receives onRequestMainEdit(target), onSaveDraft, onAddTransfer, onEditTransfer, and onApply.
- Each step receives controlled domain values and callbacks; no step imports a repository.
- animateSetupStep(root, direction, reducedMotion) always leaves opacity 1 and translate 0.

- [ ] **Step 1: Write failing setup journey tests**

Assert the order basis → locations → transfers → review. Basis groups the five Main values as incoming, spending, and saving/investing and exposes 이 금액으로 계속 and Main 금액 수정. Locations reuses FinancialLocationFields. Transfers shows reviewable suggestions and never stores them until accepted. Review renders the same calculated totals and warnings used by the completed map.

Assert Back restores the previous step with all content visible and transform reset after normal motion, reduced motion, synchronous Anime.js throw, cancellation, and rerender.

- [ ] **Step 2: Run setup tests to prove the old grid remains**

Run:

~~~bash
npx vitest run tests/unit/account-map/AccountMapSetup.test.tsx tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts
~~~

Expected: FAIL because setup still uses connect/review and the purpose-card grid.

- [ ] **Step 3: Implement focused step components**

AccountMapSetup owns only the current step shell and navigation. Persist draft step changes through explicit Account Map commands. Accepting a suggestion creates a normal fixed transfer through add-transfer. Adding sweep always requires explicit source and target choice.

- [ ] **Step 4: Implement contained step motion**

Use useAnimeScope and shared tokens. Before starting, clear stale inline opacity/transform. On catch, cancellation, dependency change, Back, and unmount call one final-state helper:

~~~ts
export function setSetupStepFinalState(root: HTMLElement): void {
  root.style.opacity = '1';
  root.style.transform = 'translateY(0px)';
}
~~~

- [ ] **Step 5: Replace grid CSS with one centered surface**

Use width: min(100% - 2rem, 48rem) for the setup content inside the shared app frame. Keep the existing top app navigation unaffected. At mobile widths the 1rem side margins are touch guardrails; no step or footer may create document overflow.

- [ ] **Step 6: Run setup tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/AccountMapSetup.test.tsx tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts
~~~

Expected: PASS for four steps, explicit suggestion acceptance, preserved Back state, and all motion final-state branches.

- [ ] **Step 7: Commit guided setup**

~~~bash
git add src/account-map/ui/AccountMapSetup.tsx src/account-map/ui/setup/AccountMapBasisStep.tsx src/account-map/ui/setup/AccountMapLocationsStep.tsx src/account-map/ui/setup/AccountMapTransfersStep.tsx src/account-map/ui/setup/AccountMapReviewStep.tsx src/account-map/ui/AccountMapApp.tsx src/account-map/ui/motion.ts src/account-map/ui/account-map.css tests/unit/account-map/AccountMapSetup.test.tsx tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts
git commit -m "feat(account-map): guide account flow setup"
~~~

### Task 8: Build deterministic account-flow graph, view-model, and layout

**Files:**
- Create: src/account-map/ui/accountFlowGraph.ts
- Create: src/account-map/ui/accountFlowViewModel.ts
- Create: src/account-map/ui/accountFlowLayout.ts
- Create: tests/unit/account-map/accountFlowGraph.test.ts
- Create: tests/unit/account-map/accountFlowViewModel.test.ts
- Create: tests/unit/account-map/accountFlowLayout.test.ts

**Interfaces:**
- buildAccountFlowGraph(calculation, applied, locations, main) returns account, purpose, transfer, and warning nodes/edges.
- buildAccountFlowViewModel(graph, selection) returns visible labels, dimming, reachable IDs, detail groups, and canonical table rows.
- layoutAccountFlow(graph, viewport, zoom) returns deterministic positioned nodes and routed edges.

- [ ] **Step 1: Write failing graph and reachability tests**

Assert each account appears once in the salary/living/brokerage example, transfer edges are directed, purpose edges remain non-transfer connections, and the external income anchor appears once. Selecting living must include salary upstream, brokerage downstream, the two incident transfers, and living purpose allocations while dimming unrelated nodes.

- [ ] **Step 2: Write failing deterministic layout tests**

At 1280×900 assert left-to-right topological ranks; at 390×844 and 768×1024 assert top-to-bottom ranks. Reverse input arrays and assert byte-equal positions, routed edges, canonical focus order, and no node overlap. Assert node dimensions and ordinary edge thickness remain equal across small and large amounts.

- [ ] **Step 3: Run pure graph tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowGraph.test.ts tests/unit/account-map/accountFlowViewModel.test.ts tests/unit/account-map/accountFlowLayout.test.ts
~~~

Expected: FAIL because the planned-flow graph boundary does not exist.

- [ ] **Step 4: Implement graph and view-model boundaries**

Graph construction may consume AccountFlowCalculation but performs no financial arithmetic. Reachability follows active transfer direction in both upstream and downstream traversals from the selected account. The detail model groups incoming transfers, local purpose allocations, outgoing transfers, unassigned, and shortfall without producing a mixed account total.

Canonical screen-reader rows use:

~~~ts
interface AccountFlowTableRow {
  sourceLabel: string;
  targetLabel: string;
  kind: 'external-income' | 'purpose' | 'fixed' | 'sweep';
  amountWon: number;
  statusLabel: string;
}
~~~

- [ ] **Step 5: Implement deterministic responsive layout**

Rank accounts using the active transfer DAG. Place income anchors before source accounts and purpose anchors after their linked accounts. Use stable barycentric crossing reduction with normalized label then ID as final tie-breakers. Fit the whole transfer topology at default zoom and never persist coordinates.

- [ ] **Step 6: Run pure graph tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/accountFlowGraph.test.ts tests/unit/account-map/accountFlowViewModel.test.ts tests/unit/account-map/accountFlowLayout.test.ts
~~~

Expected: PASS for topology, reachable focus, canonical table order, deterministic geometry, and amount-invariant styling metadata.

- [ ] **Step 7: Commit graph boundaries**

~~~bash
git add src/account-map/ui/accountFlowGraph.ts src/account-map/ui/accountFlowViewModel.ts src/account-map/ui/accountFlowLayout.ts tests/unit/account-map/accountFlowGraph.test.ts tests/unit/account-map/accountFlowViewModel.test.ts tests/unit/account-map/accountFlowLayout.test.ts
git commit -m "feat(account-map): model deterministic flow graph"
~~~

### Task 9: Render the touch-first completed map and explicit editors

**Files:**
- Modify: src/account-map/ui/AccountMapCanvas.tsx
- Create: src/account-map/ui/AccountFlowDetail.tsx
- Modify: src/account-map/ui/AccountMapModal.tsx
- Modify: src/account-map/ui/AccountMapApp.tsx
- Modify: src/account-map/ui/motion.ts
- Modify: src/account-map/ui/account-map.css
- Delete after replacement: src/account-map/ui/accountMapCanvasModel.ts
- Delete after replacement: src/account-map/ui/accountMapGraph.ts
- Delete after replacement: src/account-map/ui/accountMapLayout.ts
- Delete after replacement: src/account-map/ui/mapLayout.ts
- Delete after replacement: src/account-map/ui/accountMapConnectionDetail.ts
- Delete after replacement: tests/unit/account-map/accountMapCanvasModel.test.ts
- Modify: tests/unit/account-map/AccountMapCanvas.test.tsx
- Modify: tests/unit/account-map/AccountMapModal.test.tsx
- Modify: tests/unit/account-map/AccountMapApp.test.tsx
- Modify: tests/unit/account-map/motion.test.ts

**Interfaces:**
- AccountMapCanvas consumes AccountFlowViewModel and PositionedAccountFlow; it emits pin, clear, edit-location, add-transfer, and edit-transfer intents.
- AccountFlowDetail renders incoming, local, outgoing, unassigned, and shortfall groups with explicit actions.
- animateFocusedFlow(root, reducedMotion) reveals direction once and always restores final visible styles.

- [ ] **Step 1: Write failing interaction and content tests**

Assert the default map shows every account transfer without a mixed location total or all edge amounts. First click/tap/Enter pins the complete reachable flow and opens AccountFlowDetail. Hover/focus exposes equivalent information without pinning or opening an editor. Background/Escape clears pin. Explicit 계좌 정보 편집, 연결 추가, and 흐름 편집 buttons open the respective editor on their first activation.

Assert a zero sweep remains visible with 남은 금액 전부 and 계획상 0원, plus 실제 잔액·거래와 다를 수 있음.

- [ ] **Step 2: Write failing accessibility and motion tests**

Assert the linear table includes source, target, rule/amount, and status in deterministic graph order. Verify accessible names do not rely on color. Mock Anime.js synchronous throw and cancellation and assert nodes, edges, labels, and detail remain visible with no stale transform/opacity. Reduced motion must not call moving animation paths.

- [ ] **Step 3: Run completed-map component tests**

Run:

~~~bash
npx vitest run tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/motion.test.ts
~~~

Expected: FAIL because the current canvas uses purpose-location composition and second activation.

- [ ] **Step 4: Implement the completed map and editors**

Render transfer direction with arrow markers and a textual fixed/sweep cue. Purpose connections use a distinct non-arrow cue. Related edge amounts render only in transient or pinned detail. The account node itself shows name and state, never income plus outflow summed together.

Wire AccountTransferEditor through typed application commands. Keep AccountMapModal for purpose/location lifecycle only and use explicit detail actions instead of node reactivation.

- [ ] **Step 5: Implement focused-flow motion and contained CSS**

Keep final SVG path and text in the DOM before animation. Animate only opacity or dash-offset once per newly pinned ID. Clamp AccountFlowDetail inside the canvas on desktop and render it as an inset full-width panel on mobile. Avoid black tooltip surfaces. Ensure SVG/canvas width uses its owning surface, never viewport width.

- [ ] **Step 6: Remove superseded graph modules**

After all imports use accountFlowGraph, accountFlowViewModel, and accountFlowLayout, delete the four replaced modules and their obsolete tests. Search for their symbols and remove only unreachable compatibility code:

~~~bash
rg -n "accountMapGraph|accountMapLayout|mapLayout|accountMapConnectionDetail|second.*activation" src tests
~~~

Expected: no runtime or test imports of the deleted modules.

- [ ] **Step 7: Run completed-map tests**

Run:

~~~bash
npx vitest run tests/unit/account-map
~~~

Expected: PASS for map arithmetic consumers, interaction, editing, archive/restore, accessibility, and motion.

- [ ] **Step 8: Commit completed-map UI**

~~~bash
git add src/account-map/ui tests/unit/account-map
git commit -m "feat(account-map): render touch-first account flows"
~~~

### Task 10: Add the Main-owned in-context editor overlay

**Files:**
- Create: src/main/ui/dashboard/MainPlanEditor.tsx
- Create: src/main/ui/useMainPlanEditorController.ts
- Modify: src/main/ui/dashboard/SummaryDashboard.tsx
- Create: src/journey/ui/mainPlanOverlayHistory.ts
- Create: src/journey/ui/MainPlanEditOverlay.tsx
- Create: src/journey/ui/AccountMapJourney.tsx
- Modify: src/journey/accountMap.tsx
- Modify: src/account-map/ui/AccountMapApp.tsx
- Modify: src/journey/ui/journey.css
- Create: tests/unit/main/MainPlanEditor.test.tsx
- Create: tests/unit/main/useMainPlanEditorController.test.tsx
- Create: tests/unit/journey/mainPlanOverlayHistory.test.ts
- Create: tests/unit/journey/MainPlanEditOverlay.test.tsx
- Create: tests/unit/journey/AccountMapJourney.test.tsx
- Modify: tests/unit/main/SummaryDashboard.test.tsx

**Interfaces:**
- MainPlanEditor is controlled presentation and accepts draft, issues, saving, initialFocusPath, onChange, and onRequestClose.
- useMainPlanEditorController owns Main bootstrap, draft, validation, conflict/failure, save, and cancel through MainRepository.
- AccountMapApp emits onRequestMainEdit(target) and accepts refreshSignal; it never receives a Main save function or Main draft.
- AccountMapJourney owns overlay visibility and increments refreshSignal after a successful Main save.

- [ ] **Step 1: Write failing extraction tests**

Assert SummaryDashboard and MainPlanEditOverlay render the same MainPlanEditor field labels, adjustment controls, validation messages, and initial focus behavior. Saving through the embedded controller must call MainRepository and never AccountMapRepository.

- [ ] **Step 2: Write failing history and dirty-close tests**

Assert open pushes one same-URL marker. Repeated open does not nest markers. In-app close, Escape, successful save, and browser Back converge on one popstate close path. Dirty Back/Escape asks for confirmation; decline re-pushes one marker and preserves inputs; accept discards and restores invoking focus. Unmount removes listeners.

- [ ] **Step 3: Write failing journey ownership tests**

Render AccountMapJourney with memory repositories. Open Main editing from the basis step and completed-map stale banner. Assert the real Account Map stays mounted under inert and aria-hidden, the sheet/dialog is labelled and focus-trapped, Account Map writes remain zero, and a successful Main save increments refreshSignal and yields map-level 확인 필요 after reload.

- [ ] **Step 4: Run overlay tests**

Run:

~~~bash
npx vitest run tests/unit/main/MainPlanEditor.test.tsx tests/unit/main/useMainPlanEditorController.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/journey/mainPlanOverlayHistory.test.ts tests/unit/journey/MainPlanEditOverlay.test.tsx tests/unit/journey/AccountMapJourney.test.tsx
~~~

Expected: FAIL because the editor is private to SummaryDashboard and the journey overlay does not exist.

- [ ] **Step 5: Extract Main-owned presentation and controller**

Move ScalarEditor fields into MainPlanEditor without changing Main dashboard behavior. The embedded controller calls existing Main validation and save commands, retains input on validation/storage/conflict failure, and returns a typed saved result to the journey host.

- [ ] **Step 6: Implement history, focus, inert background, and motion**

The marker shape is namespaced and tokenized:

~~~ts
interface MainPlanOverlayHistoryState {
  isfOverlay: 'main-plan';
  token: string;
}
~~~

Move focus into the overlay only after it mounts, trap Tab, and restore the invoking element after close animation completes. Mobile uses a bottom sheet; desktop uses a bottom-origin dialog limited to the shared reading width. useAnimeScope handles open/close, reduced motion, throw, cancellation, and final-state cleanup.

- [ ] **Step 7: Wire AccountMapJourney**

Wrap the mounted AccountMapApp in one background container. Toggle inert and aria-hidden only after focus has moved into the overlay. On saved, close through history, increment refreshSignal, and let AccountMapApp reload both workspace and Main from its read-only source. Do not pass Main data or persistence callbacks from Account Map to the editor.

- [ ] **Step 8: Run overlay tests**

Run:

~~~bash
npx vitest run tests/unit/main/MainPlanEditor.test.tsx tests/unit/main/useMainPlanEditorController.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/journey/mainPlanOverlayHistory.test.ts tests/unit/journey/MainPlanEditOverlay.test.tsx tests/unit/journey/AccountMapJourney.test.tsx
~~~

Expected: PASS for reuse, ownership, dirty history, focus, refresh, and final-state motion.

- [ ] **Step 9: Commit the Main overlay**

~~~bash
git add src/main/ui/dashboard/MainPlanEditor.tsx src/main/ui/useMainPlanEditorController.ts src/main/ui/dashboard/SummaryDashboard.tsx src/journey/ui/mainPlanOverlayHistory.ts src/journey/ui/MainPlanEditOverlay.tsx src/journey/ui/AccountMapJourney.tsx src/journey/accountMap.tsx src/account-map/ui/AccountMapApp.tsx src/journey/ui/journey.css tests/unit/main/MainPlanEditor.test.tsx tests/unit/main/useMainPlanEditorController.test.tsx tests/unit/main/SummaryDashboard.test.tsx tests/unit/journey/mainPlanOverlayHistory.test.ts tests/unit/journey/MainPlanEditOverlay.test.tsx tests/unit/journey/AccountMapJourney.test.tsx
git commit -m "feat(journey): edit Main within Account Map"
~~~

### Task 11: Align product documentation and prove the complete experience

**Files:**
- Modify: docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md
- Modify: DESIGN.md
- Modify: README.md
- Modify: docs/superpowers/specs/2026-08-06-connected-account-map-workspace-design.md
- Modify: docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md
- Modify: docs/superpowers/specs/2026-08-25-account-map-meaningful-layout-design.md
- Modify: tests/account-map.spec.ts
- Modify: tests/app-journey.spec.ts
- Modify: tests/main-react.spec.ts
- Modify: tests/motion-system.spec.ts
- Modify: tests/reading-width.spec.ts

**Interfaces:**
- Produces current product documentation for workspace v4 and planned account flows.
- Produces browser evidence for the approved salary/living/brokerage flow, Main overlay, migration, recovery, accessibility, and responsive containment.

- [ ] **Step 1: Add the full Account Map browser journey**

Seed or create salary, living, and brokerage accounts. Confirm:

~~~text
salary -> living fixed
salary -> brokerage fixed
living -> brokerage 남은 금액 전부
~~~

Assert the default graph shows the whole topology; pinning living shows upstream/downstream amounts; zero sweep remains visible; explicit actions edit flow and account institution; Main overlay save returns to the same mounted map and produces 확인 필요; confirm-current-main clears it without changing transfer records.

- [ ] **Step 2: Add responsive and input-modality coverage**

Run the complete flow at 390×844, 768×1024, and 1280×900. At each size assert document.scrollWidth <= document.clientWidth, graph/detail/editor/overlay rectangles remain inside their owning surfaces, the visualization remains in the first usable view, controls are at least 44px, and focus order matches the canonical table.

Add touch tap versus pan, pointer hover, keyboard Enter/Escape, screen-reader table content, reduced motion, and forced synchronous Anime.js failure cases.

- [ ] **Step 3: Add storage and rollback browser coverage**

Start from workspace v3 and assert the app reads it, writes v4 only on an authorized save, and leaves v3 raw bytes unchanged. Start with valid v4 plus changed v3 and assert v4 wins. Start with invalid v4 plus valid v3 and assert recovery rather than fallback. Import format 2 and export format 3 through Main backup UI.

- [ ] **Step 4: Run focused browser tests**

Run:

~~~bash
npx playwright test tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/motion-system.spec.ts tests/reading-width.spec.ts --reporter=list
~~~

Expected: PASS for every supported viewport and interaction mode.

- [ ] **Step 5: Update canonical product documents**

Update Product PRD data contract, Account Map journey, storage/backup versions, non-goals, and acceptance criteria. Update DESIGN Account Map, overlay, motion, focus, responsive, and accessibility clauses. Update README product/storage descriptions and verification commands. Add a superseded pointer to this spec in the three older Account Map designs without rewriting their historical decisions.

- [ ] **Step 6: Run repository-wide compatibility searches**

Run:

~~~bash
rg -n "isf-workspace-v3|schema version 3|schema v3|formatVersion: 2|PurposeLocationLink.*remainder|kind: 'remainder'|second activation|두 번째 선택" src tests README.md DESIGN.md docs
rg -n "accountMapGraph|accountMapLayout|mapLayout|accountMapConnectionDetail" src tests
~~~

Expected: v3/format-2 references remain only in migration, rollback, fixtures, and historical evidence; purpose remainder references describe purpose allocation only; deleted UI modules have no imports; supported-product docs describe first-activation explicit actions.

- [ ] **Step 7: Run complete verification**

Run:

~~~bash
npm run check
npm run test:unit
npx playwright test --reporter=list
npm run build
git diff --check
~~~

Expected: every command exits 0. Record exact test counts and any intentional PWA skip. After npm run build, inspect git status and include only expected version/build metadata changes according to repository policy.

- [ ] **Step 8: Commit documentation and end-to-end evidence**

~~~bash
git add docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md DESIGN.md README.md docs/superpowers/specs/2026-08-06-connected-account-map-workspace-design.md docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md docs/superpowers/specs/2026-08-25-account-map-meaningful-layout-design.md tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/motion-system.spec.ts tests/reading-width.spec.ts
git commit -m "docs(account-map): ship planned flow experience"
~~~

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover Account Map and workspace versioning, rollback, backup, locks, and no-write migration. Tasks 4–5 cover calculation, suggestions, structural validation, archive/restore, concurrency, map-level Main confirmation, and write ownership. Tasks 6–7 cover shared inputs, full account editing, guided setup, and Back/motion final state. Tasks 8–9 cover deterministic layout, whole-topology default, reachable touch focus, explicit actions, accessibility, and contained rendering. Task 10 covers Main-owned overlay, history, focus, failure, and refresh. Task 11 covers canonical docs and full responsive/browser verification.
- Placeholder scan: every task names its files, interfaces, failing observation, minimal implementation behavior, verification command, expected result, and commit boundary. No deferred feature or unspecified error-handling step remains.
- Type consistency: AccountTransferAllocation uses fixed or sweep everywhere. PurposeLocationLink.remainder remains separate. WorkspaceDocument is v4 while nested Account Map stored versions remain unions until explicit flow save. sourceMainUpdatedAt drives one map-level confirmation state. AccountMapApp emits only an edit request and refreshes from repositories; it never receives Main persistence.
- Scope control: the plan changes shared workspace generation only because rollback safety requires it. Simulation and Portfolio receive compatibility verification but no feature or write-boundary changes. Legacy contracts remain isolated migration evidence rather than runtime feature foundations.
