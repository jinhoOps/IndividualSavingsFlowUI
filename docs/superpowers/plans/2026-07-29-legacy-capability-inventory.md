# Legacy Capability Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce verified, capability-first evidence for every legacy Main module and cross-app v1 data dependency without deleting or migrating runtime code.

**Architecture:** Treat the Bedrock Main runtime as the current product baseline and `apps/main/**/*.js` as temporary evidence. Trace actual Vite entries, module consumers, storage keys and tests; then classify each capability as `이관`, `폐기`, `판정 대기` or `현재 제품` with an explicit removal gate.

**Tech Stack:** Vite static MPA, React, TypeScript, Tailwind CSS, Vite PWA, JavaScript compatibility modules, Markdown, ripgrep, Git.

## Global Constraints

- Bedrock means Vite static MPA, React, TypeScript, Tailwind CSS and Vite PWA.
- Desktop and PWA mobile are one product baseline.
- Web standards and local-first behavior remain primary contracts.
- Legacy code is temporary capability evidence, not a supported path or implementation foundation.
- Do not delete, migrate or reconnect runtime code in this plan.
- Do not classify Simulation, Portfolio or Account Map as legacy merely because their implementation is JavaScript.
- Preserve `isf-main-v2` and all recovery keys unchanged.
- Preserve v1 data and snapshot compatibility until each consumer has a replacement adapter.

---

### Task 1: Verify Bedrock runtime boundaries

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md`
- Verify: `vite.config.ts`
- Verify: `apps/main/index.html`
- Verify: `apps/simulation/index.html`
- Verify: `apps/portfolio/index.html`
- Verify: `apps/account-map/index.html`
- Verify: `src/entries/`

**Interfaces:**
- Consumes: Vite Rollup input map and each HTML module entry.
- Produces: authoritative current-entry list and evidence that legacy Main modules are not Main runtime entries.

- [ ] **Step 1: List Vite and HTML entries**

Run:

```bash
rg -n "rollupOptions|input:|resolve\\(__dirname|<script[^>]+type=\"module\"" \
  vite.config.ts apps/*/index.html
```

Expected:

- Main loads `src/main/main.tsx`.
- Simulation loads `src/entries/step2.ts`.
- Portfolio loads `src/entries/step3.ts`.
- Account Map loads `src/entries/account-map.ts`.

- [ ] **Step 2: Trace entry-wrapper runtime imports**

Run:

```bash
rg -n "^import " src/entries src/main/main.tsx
```

Expected: non-Main wrappers load their current JavaScript apps; Main does not load `apps/main/app.js`.

- [ ] **Step 3: Record evidence in the approved spec**

Update the `기준선` section only when command output differs from existing claims. Keep Bedrock ownership explicit:

- React owns declarative UI and screen state.
- TypeScript owns domain, application and infrastructure boundaries.
- Tailwind CSS owns presentation.
- Vite PWA owns current service-worker generation.

- [ ] **Step 4: Verify documentation diff**

Run:

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 5: Commit runtime-boundary corrections if any**

```bash
git add docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
git diff --cached --check
git commit -m "docs: verify Bedrock runtime boundary"
```

Skip the commit when the verification produced no document change.

### Task 2: Complete module-to-capability coverage

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md`
- Verify: `apps/main/app.js`
- Verify: `apps/main/modules/*.js`
- Verify: `shared/legacy/sw.js`
- Verify: `scripts/sync-version.js`

**Interfaces:**
- Consumes: every legacy Main module export and build-time legacy reference.
- Produces: complete capability rows with no unclassified module.

- [ ] **Step 1: Enumerate legacy Main modules and exports**

Run:

```bash
for file in apps/main/modules/*.js; do
  printf '%s\n' "$file"
  rg -n "^export " "$file" || true
done
```

Expected: every module can be assigned to shell/UI, editing, calculation, visualization, compatibility, storage or onboarding.

- [ ] **Step 2: Find legacy build and service-worker references**

Run:

```bash
rg -n "apps/main/modules|shared/legacy/sw|legacy/sw" \
  vite.config.ts package.json scripts shared public src apps tests
```

Expected: direct references are limited to compatibility consumers, legacy tests, version sync or legacy precache.

- [ ] **Step 3: Enforce complete filename coverage**

Run:

```bash
spec=docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
for file in apps/main/modules/*.js; do
  name=$(basename "$file")
  rg -q -F "$name" "$spec" || printf 'missing: %s\n' "$name"
done
```

Expected: no output.

- [ ] **Step 4: Correct missing or misplaced capability rows**

For each missing module, add its filename to one existing capability row or create a new row. Every row must contain:

- capability or data contract;
- source module;
- current consumer or replacement;
- one classification;
- explicit follow-up gate.

- [ ] **Step 5: Commit coverage corrections if any**

```bash
git add docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
git diff --cached --check
git commit -m "docs: complete legacy module inventory"
```

Skip the commit when no correction was required.

### Task 3: Inventory cross-app v1 fields and APIs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md`
- Verify: `apps/simulation/modules/step1-connector.js`
- Verify: `apps/portfolio/modules/step1-connector.js`
- Verify: `apps/account-map/modules/step1-connector.js`
- Verify: `apps/account-map/modules/draft-builder.js`
- Verify: `src/core/storage/CompatibilityBridge.ts`
- Verify: `shared/storage/hub-storage.js`

**Interfaces:**
- Consumes: `isf-rebuild-v1`, historical Step 1 snapshots and `IsfStorageHub`.
- Produces: exact consumer-field and API-method inventory for future typed adapters.

- [ ] **Step 1: List v1 storage consumers**

Run:

```bash
rg -n "isf-rebuild-v1|STEP1_PRIMARY_STORAGE_KEY|STEP1_LOCAL_STORAGE_KEY" \
  apps src shared tests --glob '!tests/step1.spec.ts'
```

Expected: Account Map, Simulation, Portfolio and compatibility tests remain visible.

- [ ] **Step 2: Extract fields read by each connector**

Review:

```bash
sed -n '1,260p' apps/simulation/modules/step1-connector.js
sed -n '1,220p' apps/portfolio/modules/step1-connector.js
sed -n '1,240p' apps/account-map/modules/step1-connector.js
rg -n "mainInputs\\.|inputs\\.|payloadData\\.|localInputs\\.|data\\." \
  apps/account-map/modules/draft-builder.js \
  apps/account-map/modules/step1-connector.js \
  apps/portfolio/modules/step1-connector.js \
  apps/simulation/modules/step1-connector.js
```

Record exact fields by consumer in the spec’s `데이터 계약 Inventory` section. Do not infer unused fields from old schemas.

- [ ] **Step 3: List global storage API methods**

Run:

```bash
rg -o "IsfStorageHub\\??\\.[A-Za-z0-9_]+|window\\.IsfStorageHub\\??\\.[A-Za-z0-9_]+" \
  apps src shared --glob '!apps/main/**' | sort -u
```

Record each called method and owning consumer. Separate required methods from fallback-only methods.

- [ ] **Step 4: Define adapter boundaries**

Expand the follow-up section with three non-overlapping interfaces:

- Main read projection for Simulation and Portfolio;
- Account Map import adapter for relationship-shaped legacy data;
- typed storage facade for snapshot/list/save/delete/backup methods.

Do not specify implementation code before each adapter receives its own approved Superpowers spec.

- [ ] **Step 5: Commit field and API inventory**

```bash
git add docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
git diff --cached --check
git commit -m "docs: map legacy data consumers"
```

### Task 4: Validate classifications and removal gates

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md`
- Verify: `docs/superpowers/specs/2026-07-28-main-react-rebuild-design.md`
- Verify: `docs/superpowers/specs/2026-07-29-main-quick-setup-ux-design.md`
- Verify: `docs/superpowers/specs/2026-07-29-main-visual-system-design.md`
- Verify: current `src/main/`

**Interfaces:**
- Consumes: approved Bedrock Main specs and observed runtime.
- Produces: reviewed classifications that do not depend on stale GSD status or outdated PRD feature claims.

- [ ] **Step 1: Verify current Main capabilities**

Run:

```bash
rg -n "Financial Detail|Sankey|Account Map|ScalarEditor|isf-main-v2" \
  src/main apps/main/index.html \
  docs/superpowers/specs/2026-07-28-main-react-rebuild-design.md \
  docs/superpowers/specs/2026-07-29-main-quick-setup-ux-design.md
```

Expected: runtime uses `ScalarEditor` and v2; older scope text may describe capabilities not present in runtime.

- [ ] **Step 2: Review each classification**

Use these rules:

- `폐기`: current replacement exists or Bedrock Main explicitly excludes the feature.
- `이관`: a current product consumer still depends on legacy code or data.
- `판정 대기`: product intent and runtime disagree, or no approved owner exists.
- `현재 제품`: current Vite entry executes the code.

Never promote a `판정 대기` capability to `이관` solely because an outdated document mentions it.

- [ ] **Step 3: Review each removal gate**

Every `폐기` or `이관` row must identify:

- runtime import removal;
- storage or snapshot compatibility requirement;
- replacement test;
- service-worker/build reference cleanup when applicable.

- [ ] **Step 4: Scan for ambiguous language**

Run:

```bash
rg -n "TBD|TODO|FIXME|XXX|적절한|나중에|필요하면" \
  docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
```

Expected: no output.

- [ ] **Step 5: Commit classification corrections if any**

```bash
git add docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
git diff --cached --check
git commit -m "docs: validate legacy removal gates"
```

Skip the commit when no correction was required.

### Task 5: Final inventory verification and handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-legacy-capability-inventory.md`
- Verify: `docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md`

**Interfaces:**
- Consumes: completed runtime, module, field, API and classification evidence.
- Produces: verified inventory and ordered follow-up spec queue.

- [ ] **Step 1: Run final coverage checks**

```bash
spec=docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md
for file in apps/main/modules/*.js; do
  name=$(basename "$file")
  rg -q -F "$name" "$spec" || exit 1
done
rg -n "\\| (이관|폐기|판정 대기|현재 제품) \\|" "$spec"
git diff --check
```

Expected: all module checks succeed, classified rows print and diff check exits 0.

- [ ] **Step 2: Confirm no runtime files changed**

Run:

```bash
git diff --name-only main...HEAD
```

Expected: only Superpowers spec and plan documents.

- [ ] **Step 3: Confirm ordered follow-up specs**

The approved order must remain:

1. Cross-app Main read adapter.
2. Account Map sanitizer extraction.
3. Storage bridge migration.
4. Legacy Main test replacement.
5. Legacy Main runtime removal.

Product-decision items remain outside this queue until separately approved.

- [ ] **Step 4: Mark completed checklist items**

Update this plan’s checkbox state only for commands and evidence actually completed.

- [ ] **Step 5: Commit verification record**

```bash
git add \
  docs/superpowers/specs/2026-07-29-legacy-capability-inventory-design.md \
  docs/superpowers/plans/2026-07-29-legacy-capability-inventory.md
git diff --cached --check
git commit -m "docs: record legacy inventory plan"
```

Report changed files, verification commands, unresolved product decisions and the first follow-up spec owner.
