# Account Map PR Review Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Account Map PR review blockers after the latest `origin/main` merge.

**Architecture:** Keep Account Map as the only owner of shared financial locations. Extend the existing shared `AccountMapLocationPicker` so setup and modal creation both support supported location kinds, then tighten node accessible names in `AccountMapCanvas` without changing graph layout or persistence schema.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-08-14-account-map-pr-review-closure-design.md`

## Global Constraints

- Account Map reads latest Main five monthly amounts as read-only input.
- Account Map may update only `workspace.locations` and `workspace.accountMap`.
- Main, Simulation and Portfolio must not receive Account Map write-back.
- `FinancialLocationKind` remains the existing union: `bank | brokerage | cash`.
- Bank creation keeps the nine quick institutions and direct input.
- Brokerage creation uses direct institution input and a display name.
- Cash creation uses no institution and a display name only.
- Do not touch or stage `artifacts/`.
- Keep changes scoped; no Portfolio location UI, account number, balance, transaction, telemetry or schema expansion.

---

### Task 1: Location Picker Kinds

**Files:**
- Modify: `tests/unit/account-map/AccountMapModal.test.tsx`
- Modify: `tests/unit/account-map/AccountMapSetup.test.tsx`
- Modify: `src/account-map/ui/AccountMapLocationPicker.tsx`

**Interfaces:**
- Consumes: `FinancialLocationKind = 'bank' | 'brokerage' | 'cash'`
- Produces: `AccountMapLocationPicker` calls `onCreate(location, amount)` with `location.kind` matching the selected kind and institution rules:
  - `bank`: selected known institution or custom institution
  - `brokerage`: custom institution
  - `cash`: no `institution`

- [ ] **Step 1: Write modal RED tests**

Add tests that enter connect create mode, select `증권`, fill `기관 이름` and `표시 이름`, submit, and assert:

```tsx
expect(onCreateAndConnectLocation).toHaveBeenCalledWith(expect.objectContaining({
  shortName: 'ISA',
  institution: { name: '미래증권' },
  kind: 'brokerage',
}), undefined);
```

Add a second test that selects `현금`, fills `표시 이름`, submits, and asserts:

```tsx
expect(onCreateAndConnectLocation).toHaveBeenCalledWith(expect.objectContaining({
  shortName: '금현물',
  kind: 'cash',
}), undefined);
expect(onCreateAndConnectLocation.mock.calls[0][0]).not.toHaveProperty('institution');
```

- [ ] **Step 2: Run modal tests to verify RED**

Run:

```bash
npx vitest run tests/unit/account-map/AccountMapModal.test.tsx --runInBand
```

Expected: new tests fail because only bank creation exists.

- [ ] **Step 3: Implement minimal picker kind selector**

In `AccountMapLocationPicker.tsx`, add `locationKind` state:

```tsx
const [locationKind, setLocationKind] = useState<FinancialLocation['kind']>('bank');
```

Render a compact `fieldset` before institution selection:

```tsx
<fieldset>
  <legend>위치 종류</legend>
  <div className="account-map-institutions">
    {[
      ['bank', '은행'],
      ['brokerage', '증권'],
      ['cash', '현금'],
    ].map(([kind, label]) => (
      <button type="button" aria-pressed={locationKind === kind} className={locationKind === kind ? 'is-selected' : ''} disabled={disabled} onClick={() => setLocationKind(kind as FinancialLocation['kind'])}>{label}</button>
    ))}
  </div>
</fieldset>
```

Update preview construction:

```tsx
const institution = locationKind === 'cash'
  ? undefined
  : knownInstitution === undefined
    ? { id: locationKind === 'bank' ? `custom:${id}` : undefined, name: customInstitution.trim() }
    : { id: knownInstitution[0], name: knownInstitution[1] };

return {
  id: `location:${id}`,
  shortName: shortName.trim(),
  ...(institution === undefined ? {} : { institution }),
  kind: locationKind,
  roles: [],
  createdAt: now,
  updatedAt: now,
};
```

Show quick institutions only for `bank`; force direct institution for `brokerage`; hide institution input for `cash`.

- [ ] **Step 4: Run modal tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/account-map/AccountMapModal.test.tsx --runInBand
```

Expected: modal location creation tests pass.

- [ ] **Step 5: Add setup coverage and verify**

Add equivalent setup RED/GREEN coverage in `tests/unit/account-map/AccountMapSetup.test.tsx` using the setup sheet. Assert the completed setup input contains `newLocation.kind === 'brokerage'` and `newLocation.kind === 'cash'` for newly created locations.

Run:

```bash
npx vitest run tests/unit/account-map/AccountMapSetup.test.tsx --runInBand
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/account-map/ui/AccountMapLocationPicker.tsx tests/unit/account-map/AccountMapModal.test.tsx tests/unit/account-map/AccountMapSetup.test.tsx
git commit -m "feat(account-map): create location kinds"
```

### Task 2: Node Amount Accessibility

**Files:**
- Modify: `tests/unit/account-map/AccountMapCanvas.test.tsx`
- Modify: `src/account-map/ui/AccountMapCanvas.tsx`

**Interfaces:**
- Consumes: `PositionedNode.amountWon` and `PositionedNode.connectionCount`
- Produces: location/status accessible names that describe the amount as active monthly link sum, not balance.

- [ ] **Step 1: Write RED test**

Update the existing visible node assertions so the location node accessible name is:

```tsx
name: '계좌·보관처 · 생활비통장 · 활성 월 연결 합계 700,000원 · 활성 연결 1개 · 연결 완료'
```

Keep purpose wording stable unless the source amount is a purpose target/reference.

- [ ] **Step 2: Run canvas test to verify RED**

Run:

```bash
npx vitest run tests/unit/account-map/AccountMapCanvas.test.tsx --runInBand
```

Expected: fails on old `생활비통장 · 700,000원` accessible name.

- [ ] **Step 3: Update accessible name formatter**

Change `nodeAccessibleName`:

```tsx
const amount = node.amountWon === undefined
  ? '금액 없음'
  : node.kind === 'location' || node.kind === 'status'
    ? `활성 월 연결 합계 ${formatWon(node.amountWon)}`
    : formatWon(node.amountWon);
```

- [ ] **Step 4: Run canvas test to verify GREEN**

Run:

```bash
npx vitest run tests/unit/account-map/AccountMapCanvas.test.tsx --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/account-map/ui/AccountMapCanvas.tsx tests/unit/account-map/AccountMapCanvas.test.tsx
git commit -m "fix(account-map): clarify node amount semantics"
```

### Task 3: Full Gates, Responsive QA, PR

**Files:**
- Modify only if gates reveal a real defect.

- [ ] **Step 1: Run source and unit gate**

```bash
npm run check
npm run test:unit
```

- [ ] **Step 2: Run E2E gate**

```bash
npm run test:e2e -- --reporter=list
```

- [ ] **Step 3: Run production build**

```bash
npx vite build
```

- [ ] **Step 4: Run 390/768/desktop Account Map QA**

Use Playwright on Account Map setup and map flows at:

```text
390x844
768x1024
1280x900
```

Verify no horizontal overflow, dialogs stay contained, focus is visible, touch targets are at least 44px, node labels remain visible, and new bank/brokerage/cash creation paths are reachable.

- [ ] **Step 5: Final diff checks**

```bash
git diff --check origin/main...HEAD
git status --short
```

- [ ] **Step 6: Push and create PR**

```bash
git push -u origin jinhoOps/connected-account-map-design
gh pr create --base main --head jinhoOps/connected-account-map-design --title "Promote Account Map supported product" --body-file /tmp/account-map-pr.md
```

## Self-Review

- Spec coverage: latest main merge and AGENTS alignment are already completed; remaining tasks cover location kind creation, accessible amount semantics, gates, responsive QA and PR creation.
- Placeholder scan: no `TBD`, `TODO`, `implement later` or unspecified test command remains.
- Type consistency: all code snippets use existing `FinancialLocation`, `AccountMapLocationPicker`, `AccountMapCanvas`, `onCreate`, `onCreateAndConnectLocation` and `PositionedNode` names.
