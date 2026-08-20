# Account Map Review Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Account Map PR review gate, remove Portfolio location management, preserve all protected product data, integrate latest `origin/main`, and promote Account Map from release candidate only after full verification.

**Architecture:** Portfolio becomes aggregate-only and stops writing the shared location registry. Account Map writes field-scoped commands against the latest workspace revision: temporal validation distinguishes synchronized state from later Main decreases, connection commands atomically add roles and links, custom-purpose lifecycle is reversible, and stale recovery rebuilds user intent against the latest workspace instead of replaying snapshots. React surfaces keep one compact modal shell and expose rare actions through one add icon and a title-row menu.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, Playwright, Anime.js, Vite, localStorage workspace schema v2.

## Global Constraints

- Product authority order is Product PRD, active 2026-08-13 Account Map spec, amended 2026-08-06 spec, then DESIGN.
- Main owns exactly five monthly amounts and Account Map never writes Main, Simulation, or Portfolio.
- Every Account Map command must preserve `JSON.stringify(main)`, `JSON.stringify(simulation)`, and `JSON.stringify(portfolio)` exactly.
- Portfolio removal must preserve `workspace.locations`, location-scoped plans, and dormant compatibility data.
- `sourceMainUpdatedAt > Main.updatedAt` is invalid; partial correction keeps the earlier source timestamp; complete correction advances it to current Main.
- Stale recovery may replay only field-scoped intent after base-value comparison; whole applied/draft snapshots must never overwrite latest state.
- All touch targets are at least 44px; modal focus trap, first-error focus, Escape, focus return, and reduced motion remain required.
- The existing untracked `artifacts/` directory remains untouched.
- Existing unrelated user changes are preserved and staged only in their owning task.

---

### Task 1: Complete the Portfolio Location Boundary Removal

**Files:**
- Modify: `src/portfolio/ui/PortfolioApp.tsx`
- Modify: `src/portfolio/ui/portfolio.css`
- Delete: `src/portfolio/ui/InvestmentLocations.tsx`
- Delete: `src/portfolio/infrastructure/locationRepository.ts`
- Modify: `tests/portfolio.spec.ts`
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Delete: `tests/unit/portfolio/InvestmentLocations.test.tsx`
- Delete: `tests/unit/portfolio/locationRepository.test.ts`
- Modify: `docs/superpowers/specs/2026-08-11-portfolio-focused-mobile-ux-design.md`
- Consume and retire: `docs/superpowers/plans/2026-08-13-portfolio-location-boundary-removal.md`

**Interfaces:**
- Consumes: `PortfolioRepository`, read-only Main source, existing `WorkspaceDocument.portfolio` and `WorkspaceDocument.locations`.
- Produces: `PortfolioApp` with no location repository dependency or location-management UI.

- [ ] **Step 1: Audit the existing uncommitted removal against its dedicated plan**

Run:

```bash
git diff -- src/portfolio tests/portfolio.spec.ts tests/unit/portfolio docs/superpowers/specs/2026-08-11-portfolio-focused-mobile-ux-design.md
rg -n "InvestmentLocations|locationRepository|portfolio-locations|투자 위치" src/portfolio tests/portfolio.spec.ts tests/unit/portfolio
```

Expected: only negative assertions may retain retired UI terms; no runtime import, prop, selector, or command adapter remains.

- [ ] **Step 2: Run focused tests proving preservation**

Run:

```bash
npx vitest run tests/unit/portfolio
npx playwright test tests/portfolio.spec.ts --grep "does not expose account or custody management" --reporter=list
```

Expected: tests pass and assert seeded `locations` plus location-scoped plans are deep-equal after aggregate editing.

- [ ] **Step 3: Commit only the Portfolio-owned change set**

```bash
git add src/portfolio/ui/PortfolioApp.tsx src/portfolio/ui/portfolio.css src/portfolio/ui/InvestmentLocations.tsx src/portfolio/infrastructure/locationRepository.ts tests/portfolio.spec.ts tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/InvestmentLocations.test.tsx tests/unit/portfolio/locationRepository.test.ts docs/superpowers/specs/2026-08-11-portfolio-focused-mobile-ux-design.md docs/superpowers/plans/2026-08-13-portfolio-location-boundary-removal.md
git diff --cached --check
git commit -m "refactor(portfolio): remove location management"
```

---

### Task 2: Enforce Temporal Capacity and Source Timestamp Semantics

**Files:**
- Modify: `src/workspace/domain/migration.ts`
- Modify: `src/account-map/domain/commands.ts`
- Modify: `tests/unit/workspace/migration.test.ts`
- Modify: `tests/unit/workspace/validation.test.ts`
- Modify: `tests/unit/account-map/commands.test.ts`
- Modify: `tests/unit/workspace/workspaceBackup.test.ts`

**Interfaces:**
- Consumes: `AccountMapApplied | AccountMapDraft`, current `MainData.updatedAt`, parent references from `mainPurposeReferences`.
- Produces: `parsePurposeState(customValue, linkValue, sourceMainUpdatedAt, locations, main)` temporal validation and `withCurrentMainSource(candidate, current, main)` command normalization.

- [ ] **Step 1: Write failing parser and backup tests**

Add cases equivalent to:

```ts
it('rejects future Main sources and synchronized custom target excess', () => {
  expect(parseWorkspaceDocument(workspace({ sourceMainUpdatedAt: main.updatedAt + 1 }))).toBeNull();
  expect(parseWorkspaceDocument(workspace({
    sourceMainUpdatedAt: main.updatedAt,
    customTargetWon: main.monthlyLivingWon + 1,
  }))).toBeNull();
});

it('reads excess caused by a later Main decrease', () => {
  expect(parseWorkspaceDocument(workspace({
    sourceMainUpdatedAt: main.updatedAt - 1,
    customTargetWon: main.monthlyLivingWon + 1,
  }))).not.toBeNull();
});
```

Also assert whole-workspace import rejects the first two without changing raw storage.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run tests/unit/workspace/migration.test.ts tests/unit/workspace/validation.test.ts tests/unit/workspace/workspaceBackup.test.ts
```

Expected: future source and synchronized over-capacity cases currently pass parsing and fail assertions.

- [ ] **Step 3: Pass source timestamps into purpose-state validation**

Change parser signatures to:

```ts
function parsePurposeState(
  customValue: unknown,
  linkValue: unknown,
  sourceMainUpdatedAt: number,
  locations: FinancialLocation[],
  main: NonNullable<WorkspaceDocumentV1['main']['applied']>,
): Pick<AccountMapApplied, 'customPurposes' | 'links'> | null
```

Reject `sourceMainUpdatedAt > main.updatedAt`. When equal, require each active child target sum to be at most its parent reference. When earlier, retain structural validation but allow existing capacity excess.

- [ ] **Step 4: Write failing partial/full correction timestamp tests**

```ts
it('keeps stale source after partial correction and advances after full correction', () => {
  const partial = applyAccountMapCommand(staleExcessWorkspace(), partialCorrection, 20);
  expect(partial.ok).toBe(true);
  if (!partial.ok) return;
  expect(partial.workspace.accountMap.applied?.sourceMainUpdatedAt).toBe(1);
  const complete = applyAccountMapCommand(partial.workspace, fullCorrection, 21);
  expect(complete.ok && complete.workspace.accountMap.applied?.sourceMainUpdatedAt).toBe(10);
});
```

- [ ] **Step 5: Normalize source timestamps after every applied/draft write**

Add a pure helper:

```ts
function withCurrentMainSource<T extends AccountMapApplied | AccountMapDraft>(
  candidate: T,
  current: T | null,
  main: MainData,
): T
```

Advance to `main.updatedAt` only when all active custom child sums fit current parent references; otherwise retain `current?.sourceMainUpdatedAt ?? candidate.sourceMainUpdatedAt`.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/workspace tests/unit/account-map/commands.test.ts
npm run check
git add src/workspace/domain/migration.ts src/account-map/domain/commands.ts tests/unit/workspace tests/unit/account-map/commands.test.ts
git commit -m "fix(workspace): enforce Account Map source time"
```

---

### Task 3: Add Atomic Field-Scoped Account Map Commands

**Files:**
- Modify: `src/account-map/domain/commands.ts`
- Create: `src/account-map/domain/editIntent.ts`
- Modify: `src/account-map/infrastructure/accountMapRepository.ts`
- Modify: `tests/unit/account-map/commands.test.ts`
- Create: `tests/unit/account-map/editIntent.test.ts`
- Modify: `tests/unit/account-map/accountMapRepository.test.ts`

**Interfaces:**
- Produces command variants:

```ts
type AccountMapCommand =
  | { type: 'connect-location'; surface: 'draft' | 'applied'; purposeId: PurposeId; locationId: string; monthlyAmountWon?: number }
  | { type: 'create-and-connect-location'; surface: 'draft' | 'applied'; purposeId: PurposeId; location: FinancialLocation; monthlyAmountWon?: number }
  | { type: 'archive-custom-purpose'; purposeId: CustomPurpose['id'] }
  | { type: 'restore-custom-purpose'; purposeId: CustomPurpose['id']; targetMonthlyWon: number };

// Add these variants to the existing AccountMapCommand union without removing
// save-draft, apply-map, edit-map-node, location lifecycle, or reset-map.

interface FieldEdit<T> { base: T; next: T }
type EditableLinkFields = Pick<PurposeLocationLink, 'monthlyAmountWon' | 'status' | 'remainder'>;
type EditablePurposeFields = Pick<CustomPurpose, 'name' | 'targetMonthlyWon' | 'archivedAt'>;
type EditableLocationFields = Pick<FinancialLocation, 'shortName' | 'institution'>;
type AccountMapEditIntent =
  | { kind: 'link'; id: string; edit: FieldEdit<EditableLinkFields> }
  | { kind: 'add-link'; surface: 'draft' | 'applied'; purposeId: PurposeId; locationId: string; base: null; monthlyAmountWon?: number }
  | { kind: 'purpose'; id: CustomPurpose['id']; edit: FieldEdit<EditablePurposeFields> }
  | { kind: 'location'; id: string; edit: FieldEdit<EditableLocationFields> };

interface AccountMapRepository {
  load(): WorkspaceLoadResult;
  save(expectedRevision: number, command: AccountMapCommand): Promise<AccountMapWriteResult>;
  saveIntent(expectedRevision: number, intent: AccountMapEditIntent): Promise<AccountMapWriteResult>;
}
```

- [ ] **Step 1: Write RED command tests for atomic connection**

Test an existing spending-only location connected to investing. Assert one command adds `investing`, creates one unique link, increments neither protected slice nor unrelated location fields, and returns no partial role update when capacity or duplicate-pair validation fails.

- [ ] **Step 2: Implement `connect-location` inside one command candidate**

Resolve required role from purpose, clone the target location with add-only role, append/recalculate the link, validate role/purpose capacity and remainder, then call `successCandidate` once. Remove multi-save role/link sequencing from UI in Task 5.

- [ ] **Step 3: Write RED lifecycle tests for custom purposes**

Assert archive sets `archivedAt`, suspends related active links with `suspendedReason: 'user'`, clears remainder flags, and preserves locations/Portfolio. Assert restore clears only `archivedAt`, leaves links suspended, and rejects target capacity excess atomically.

- [ ] **Step 4: Implement custom-purpose archive and restore commands**

Use stable purpose ID lookup. Reject system IDs, missing IDs, already-matching lifecycle state, or invalid restore target. Apply source timestamp normalization from Task 2.

- [ ] **Step 5: Write RED intent rebase tests**

Cover four outcomes:

```ts
expect(rebaseIntent(latestUnrelatedChange, intent)).toMatchObject({ ok: true });
expect(rebaseIntent(latestSameFieldChange, intent)).toEqual({ ok: false, reason: 'field-conflict', field: 'monthlyAmountWon' });
expect(rebaseIntent(latestDeletedTarget, intent)).toMatchObject({ ok: false, reason: 'target-missing' });
expect(rebaseIntent(latestDuplicatePair, addIntent)).toMatchObject({ ok: false, reason: 'duplicate-link' });
```

- [ ] **Step 6: Implement pure `rebaseAccountMapIntent`**

Read stable IDs from latest workspace, compare only fields captured in `base`, preserve unrelated latest fields, and emit a new field-scoped command. Never accept an applied/draft snapshot as intent.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/unit/account-map/commands.test.ts tests/unit/account-map/editIntent.test.ts tests/unit/account-map/accountMapRepository.test.ts
npm run check
git add src/account-map/domain/commands.ts src/account-map/domain/editIntent.ts src/account-map/infrastructure/accountMapRepository.ts tests/unit/account-map
git commit -m "feat(account-map): add scoped workspace commands"
```

---

### Task 4: Model Stale Recovery Without Losing User Input

**Files:**
- Modify: `src/account-map/application/reducer.ts`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/AccountMapSetup.tsx`
- Modify: `src/account-map/ui/AccountMapModal.tsx`
- Modify: `tests/unit/account-map/reducer.test.ts`
- Modify: `tests/unit/account-map/AccountMapApp.test.tsx`
- Modify: `tests/unit/account-map/AccountMapSetup.test.tsx`
- Modify: `tests/unit/account-map/AccountMapModal.test.tsx`

**Interfaces:**
- Consumes: `AccountMapEditIntent`, `AccountMapRepository.load()`, `rebaseAccountMapIntent`.
- Produces:

```ts
type RecoveryState =
  | { status: 'none' }
  | { status: 'stale'; latest: WorkspaceDocument; intent: AccountMapEditIntent }
  | { status: 'collision'; latest: WorkspaceDocument; intent: AccountMapEditIntent; field: string; reason: string };
```

- [ ] **Step 1: Write RED reducer tests**

Assert `save-conflicted` stores latest workspace and intent without replacing modal/setup inputs. Assert `reapply-succeeded` adopts latest saved workspace and clears recovery. Assert collision retains intent and exposes field metadata.

- [ ] **Step 2: Add explicit recovery events and state**

Add `save-conflicted`, `reapply-requested`, `reapply-collided`, and `reapply-succeeded`. Keep `SaveState` for transport errors; do not collapse conflict into generic failure.

- [ ] **Step 3: Write RED app tests for reload and explicit replay**

Use a memory repository where first save returns `{ status: 'conflict' }`, `load()` returns a newer unrelated change, and second field-scoped command succeeds. Assert no second save happens until user presses `최신 상태에서 다시 적용`.

- [ ] **Step 4: Implement conflict handling in one app helper**

```ts
async function saveIntent(expectedRevision: number, intent: AccountMapEditIntent) {
  const result = await repository.saveIntent(expectedRevision, intent);
  if (result.status !== 'conflict') return result;
  const latest = repository.load();
  dispatch({ type: 'save-conflicted', latest: latest.workspace, intent });
  return result;
}
```

On explicit replay, call `rebaseAccountMapIntent(latest.workspace, intent)`, show collision locally, or save the rebuilt command using `latest.workspace.revision`.

- [ ] **Step 5: Render accessible stale recovery controls**

Inside the active setup or modal surface show status copy, `최신 상태에서 다시 적용`, and `최신 값 유지`. Connect collision text with `aria-describedby`; focus the first conflicting input or action. Keep all typed values until user cancels or succeeds.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/account-map/reducer.test.ts tests/unit/account-map/AccountMapApp.test.tsx tests/unit/account-map/AccountMapSetup.test.tsx tests/unit/account-map/AccountMapModal.test.tsx
npm run check
git add src/account-map/application/reducer.ts src/account-map/ui/AccountMapApp.tsx src/account-map/ui/AccountMapSetup.tsx src/account-map/ui/AccountMapModal.tsx tests/unit/account-map
git commit -m "fix(account-map): recover stale edits explicitly"
```

---

### Task 5: Complete the Compact Node Modal

**Files:**
- Create: `src/account-map/ui/AccountMapLocationPicker.tsx`
- Modify: `src/account-map/ui/AccountMapModal.tsx`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`
- Modify: `src/account-map/ui/AccountMapApp.tsx`
- Modify: `src/account-map/ui/AccountMapManagementMenu.tsx`
- Modify: `src/account-map/ui/account-map.css`
- Modify: `tests/unit/account-map/AccountMapModal.test.tsx`
- Modify: `tests/unit/account-map/AccountMapCanvas.test.tsx`
- Modify: `tests/unit/account-map/AccountMapManagementMenu.test.tsx`
- Modify: `tests/unit/account-map/AccountMapApp.test.tsx`

**Interfaces:**
- Consumes: Task 3 commands and Task 4 intent-saving path.
- Produces: compact modal modes `read | edit | connect | archive-location | restore-location | archive-purpose | restore-purpose` and management entry for archived purposes.

- [ ] **Step 1: Write RED modal tests for the compressed actions**

Assert edit mode shows one 44px `연결 추가` icon action rather than a row of equal-weight buttons. Clicking it changes content inside the same `role="dialog"`. Assert custom-purpose title menu contains `목적 보관`, while common system purpose and location nodes do not.

- [ ] **Step 2: Reuse the setup connection picker as focused content**

Create `src/account-map/ui/AccountMapLocationPicker.tsx` and move the existing location/institution selection content from `AccountMapSetup.tsx` into it:

```ts
interface LocationPickerProps {
  locations: FinancialLocation[];
  linkedLocationIds: Set<string>;
  onSelect(locationId: string, amount?: number): void;
  onCreate(location: FinancialLocation, amount?: number): void;
}
```

Show every active unlinked location regardless of role. Keep quick institutions and direct input. Modal save calls atomic `connect-location`.

- [ ] **Step 3: Remove sequential role and draft saves**

Replace `commitConnection`'s `update-location` followed by `save-draft` sequence with one `connect-location` command for existing locations. Replace `create-location` followed by `save-draft` with one `create-and-connect-location` command. Both variants derive the required role from the purpose and write the location plus link as one candidate or write nothing.

- [ ] **Step 4: Add custom-purpose archive and restore UI**

Archive uses the title-row menu and confirmation in the same modal. `AccountMapManagementMenu` receives archived custom purposes and exposes `보관된 목적 N개`; selecting one opens the same modal shell in restore mode. Restore displays parent and target, allows target correction, and never auto-resumes suspended links.

- [ ] **Step 5: Preserve motion and focus contracts**

Opening connect/archive/restore does not remount the dialog. Closing an archived purpose whose node disappeared returns focus to map heading. Opening restore from management returns focus to the management trigger. Reduced motion completes immediately.

- [ ] **Step 6: Add layout and touch styling**

Keep modal controls single-column at 390px, contained at 768px, footer visible in short height, and `.account-map-modal__secondary-action` at least 44×44px. Do not add a persistent text toolbar to the map.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapCanvas.test.tsx tests/unit/account-map/AccountMapManagementMenu.test.tsx tests/unit/account-map/AccountMapApp.test.tsx
npm run check
git add src/account-map/ui tests/unit/account-map
git commit -m "feat(account-map): complete compact map editing"
```

---

### Task 6: Add Release-Gate Browser and Backup Coverage

**Files:**
- Modify: `tests/account-map.spec.ts`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/main-react.spec.ts`
- Modify: `tests/unit/workspace/workspaceBackup.test.ts`
- Modify: `tests/unit/account-map/commands.test.ts`

**Interfaces:**
- Consumes: finished Account Map UI and workspace commands.
- Produces: externally observable proof for every unchecked Phase B gate.

- [ ] **Step 1: Add stale recovery E2E**

Open an edit, mutate a different workspace field through `page.evaluate`, save, assert stale notice and preserved input, explicitly reapply, then assert both the concurrent change and user edit survive. Add a same-field variant that blocks replay and focuses the conflicting control.

- [ ] **Step 2: Add many-to-many connection E2E**

Seed one location with `spending`, connect it to investing from the applied-map modal, and assert the same location ID gains `investing` plus a new link in one revision while protected slices remain exact.

- [ ] **Step 3: Add custom-purpose lifecycle E2E**

Create a custom purpose, archive it from its modal menu, assert it disappears from active map and appears in `보관된 목적`, restore with corrected target, and assert suspended links remain suspended.

- [ ] **Step 4: Add backup and Portfolio preservation E2E**

Round-trip a workspace containing applied Account Map, archived custom purpose, suspended links, locations, aggregate plan, location-scoped plan, and Portfolio draft. Assert invalid future-source and synchronized capacity-excess imports leave exact raw storage unchanged.

- [ ] **Step 5: Complete interaction parity**

At 390px, verify pointer hover and keyboard focus expose the same edge amounts; tap once pins, tap again opens detail; Escape/background clears; reduced motion eliminates transition wait; all actionable rectangles are at least 44px and no body overflow exists at 390, 768, and 1280.

- [ ] **Step 6: Run focused release gates and commit**

```bash
npx vitest run tests/unit/account-map tests/unit/workspace
npx playwright test tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/portfolio.spec.ts --reporter=list
npm run check
git add tests/account-map.spec.ts tests/app-journey.spec.ts tests/main-react.spec.ts tests/portfolio.spec.ts tests/unit/account-map tests/unit/workspace
git commit -m "test(account-map): cover review closure flows"
```

---

### Task 7: Integrate Main, Promote the Product, and Run Final Verification

**Files:**
- Resolve only actual conflicts after fetching `origin/main`.
- Modify: `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`
- Modify: `DESIGN.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md`

**Interfaces:**
- Consumes: all completed feature commits and latest `origin/main`.
- Produces: merge-ready branch whose PR diff contains only approved Account Map and Portfolio-boundary changes.

- [ ] **Step 1: Confirm clean ownership before integration**

```bash
git status --short
git fetch origin
git merge-base origin/main HEAD
git rev-list --left-right --count origin/main...HEAD
```

Expected: no uncommitted implementation files; `artifacts/` may remain untracked and untouched.

- [ ] **Step 2: Merge latest main without rewriting published history**

```bash
git merge --no-ff origin/main
```

Resolve conflicts by preserving latest Main/Simulation/Portfolio motion and reading-width behavior while applying workspace v2 and Account Map changes. Never choose an entire side for `package.json`, lockfile, shared workspace, or cross-app tests without field-level comparison.

- [ ] **Step 3: Prove the final PR scope**

```bash
git diff --name-status origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: no unrelated reverse deletions, retired motion-system restoration, or accidental documentation rollback.

- [ ] **Step 4: Run fresh full verification**

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
npx vite build
git diff --check
```

Expected: zero failures. Record intentional skips separately; do not report them as passes.

- [ ] **Step 5: Perform responsive visual QA**

Verify Account Map setup, map focus, connect modal, custom-purpose archive/restore, stale collision, and management state at 390×844, 768×1024, and 1280×900. Check overflow, overlay containment, focus ring, touch target, edge visibility, and reduced motion.

- [ ] **Step 6: Request final code review**

Review `origin/main..HEAD` against Product PRD and active Account Map spec. Fix every Critical and Important finding with focused regression coverage, then rerun affected and full gates.

- [ ] **Step 7: Promote Account Map only after evidence exists**

In one documentation commit:

- change Account Map from `출시 후보` to current supported product;
- mark all Phase B review closure criteria `[x]`;
- remove closure-before temporary Portfolio exception wording;
- set active spec status to implemented/approved;
- ensure README, DESIGN, PRD, and runtime say the same thing.

```bash
git add README.md DESIGN.md docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md docs/superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md
git diff --cached --check
git commit -m "docs(account-map): promote supported product"
```

- [ ] **Step 8: Re-run documentation and branch gates, then push**

```bash
git diff --check origin/main...HEAD
npm run check
git push origin jinhoOps/connected-account-map-design
```

Do not create or update a PR until the remote branch contains the merge commit, promotion commit, and latest verification evidence.
