# Phase 4 Legacy Retirement Design

**Date:** 2026-09-02

**Status:** Direction approved; written specification awaiting review

**Scope:** Retire repository-wide legacy runtime, routes, storage bridges, persisted compatibility fields, and obsolete tests while preserving a one-way current migration boundary for existing workspace data and backups.

Once approved, this specification supersedes current-state clauses that require ongoing preservation of `legacyPhaseA`, Account Map `layout`, location-scoped Portfolio records, workspace schema v2, or `isf-workspace-v1` as the writable canonical key. Historical specs and plans remain evidence of the contracts being retired.

## 1. Goal

Phase 4 removes the parallel legacy product rather than continuing to preserve it beside the four supported applications. The completed repository has one current React/Vite product path, one canonical workspace schema, one canonical storage key, and no legacy UI, global storage bridge, service worker, route implementation, or compatibility field in current persisted state.

Existing workspace data is not silently destroyed. A narrow versioned converter may read an older workspace or backup once and produce the current schema. The converter is current migration infrastructure, not a reusable legacy runtime: it cannot render old UI, write an old key, expose old globals, or preserve retired fields in current state.

## 2. Approved Product Boundaries

Phase 4 does not change the supported product meaning established by the Product PRD.

- Main remains the sole editor of the five monthly amounts.
- Simulation and Portfolio read the latest Main slice without writing it.
- Account Map reads Main and writes only current `locations` and `accountMap` state.
- Portfolio remains aggregate-only in the current UI.
- Account Map keeps its deterministic account-first map and does not restore a purpose/account layout choice.
- Whole-workspace import remains atomic: every retained slice and reference must validate before any current workspace write.
- Old standalone keys are never read, converted, overwritten, or deleted. They become unrecognized foreign records rather than a compatibility product.
- The current startup purge for `isf-journey-snapshot-v1` is removed with its test; Phase 4 does not keep code whose only purpose is touching a retired key.
- Phase 4 adds no legacy-data status banner, toast, or normal-flow management control.

## 3. Current Evidence

The baseline at commit `29938e1` establishes the following facts.

| Surface | Current evidence | Disposition |
| --- | --- | --- |
| Supported entries | `apps/main/index.html`, Simulation, Portfolio, and Account Map load React/TypeScript entries through Vite | Retain |
| Legacy Main runtime | `apps/main/app.js`, `apps/main/styles.css`, and 32 files in `apps/main/modules/` are absent from the production build graph | Delete after route-closure tests exist |
| Legacy storage bridge | `CompatibilityBridge`, `BackupService`, and `IsfStore` have no supported runtime importer; only the bridge and legacy tests consume them | Delete |
| Legacy shared browser layer | `shared/components`, `shared/storage`, `shared/pwa`, most of `shared/core`, `shared/styles`, and `shared/legacy/sw.js` are referenced only by the legacy Main graph and version script | Delete; retain `shared/brand/mainBrandGeometry.js` because the current brand icon imports it |
| PWA | Vite PWA generates `dist/sw.js`; `shared/legacy/sw.js` is not the deployed service worker | Remove the old SW and stop version synchronization to it |
| Browser tests | The full suite has 201 cases: 140 pass and 61 legacy cases skip. `tests/step1.spec.ts` still contributes active tests that import old modules directly | Replace supported external behavior coverage, then delete the file |
| Current compatibility state | The production bundle contains `legacyPhaseA`, Account Map `layout`, and Portfolio location scope | Remove through the current schema migration |
| Old standalone stores | Current Main isolation tests prove old Main/app keys remain untouched | Keep one compact negative isolation contract; remove legacy feature tests |
| Retired-key purge | Main still deletes `isf-journey-snapshot-v1` at startup | Delete the purge, call site, and unit test so retired keys are entirely untouched |

Baseline verification:

- `npm run check:ci`: 124 test files and 1,241 unit tests passed.
- `npx vite build`: production build and generated Vite PWA service worker passed.
- `npm run test:e2e -- --reporter=list`: 140 passed and 61 legacy cases skipped.

## 4. Considered Approaches

### 4.1 Immediate hard cutoff

Delete every old parser, field, key reference, and runtime in one change. This gives the smallest repository but makes a browser that still contains the current workspace record appear empty or invalid and makes existing whole-workspace backups unreadable. It also gives a source rollback no usable pre-migration record. Rejected.

### 4.2 Permanent dual-schema compatibility

Keep `legacyPhaseA`, Account Map `layout`, location-scoped Portfolio values, old global bridges, and old storage readers indefinitely. This avoids migration work but leaves the parallel contracts Phase 4 exists to remove. Rejected.

### 4.3 One-way current converter and a new canonical record

Keep old source bytes untouched, convert them into a new current schema and write only the new canonical key. Remove every legacy implementation and remove compatibility fields from current domain types. Accept older backups through the same narrow converter. Adopted.

## 5. Target Data Contract

### 5.1 Canonical workspace

The current workspace becomes schema version 3 and is stored under `isf-workspace-v3`. The schema version and key use the same number so future debugging does not confuse storage-generation and document-generation labels.

The top-level slices remain Main, Simulation, Portfolio, locations, and Account Map. Current schema v3 removes only retired compatibility representation:

- `accountMap.legacyPhaseA` is absent;
- `AccountMapApplied.layout` is absent and the Account Map applied schema version advances;
- Portfolio `plans` contains at most the current aggregate plan;
- Portfolio `draft` is either aggregate or `null`;
- current validators and serializers cannot produce a location-scoped Portfolio value;
- current backup export contains only workspace v3.

The Account Map instruments/flows preserved in `legacyPhaseA` are not converted into current purpose links because no approved deterministic mapping exists and the current product never used them. Location-scoped Portfolio plans and drafts are not guessed into aggregate allocation. They are deliberately omitted from v3 while their original bytes remain in the untouched source record.

### 5.2 Retired source record

The existing `isf-workspace-v1` key becomes a read-only retirement source.

- When `isf-workspace-v3` exists, the repository reads it exclusively.
- An invalid v3 record is reported as invalid; the repository must not hide corruption by falling back to v1.
- When v3 is absent, the repository may read v1, validate it as a supported retired workspace version, convert it in memory, and report `needsMigration: true`.
- Migration writes and verifies v3 only. It never changes or deletes v1.
- All later update, replace, reset, save-lock, and cross-tab notification behavior uses v3.
- The Web Locks name and fallback lease prefix advance to a v3 namespace. Initial conversion acquires the existing v1 save lock while it snapshots the retired source, then commits through the v3 save path; this prevents an old writer from changing the source during conversion.
- A source failure or write failure leaves v1 byte-for-byte unchanged and leaves no accepted partial v3 state.

This key separation is the data rollback mechanism. Reverting to the previous deployment reads the untouched v1 record. Returning to the Phase 4 deployment reads the newer v3 record again. Data created under either deployment remains present, although a rolled-back build naturally shows its own older snapshot until the forward deployment returns.

After v3 exists it remains canonical. A later write from an already-open pre-Phase-4 tab may update only the retired v1 record and is not silently merged into v3. The PWA update reload remains the normal upgrade boundary; tests must prove that source changes cannot overwrite or downgrade an existing v3 record.

### 5.3 One-way converter

The retired-source converter is isolated under the workspace infrastructure boundary and has no dependency on deleted JavaScript modules or global APIs.

It accepts only the exact historical workspace shapes explicitly supported at Phase 4 start:

- workspace schema v1 with Phase A `instruments` and `flows`;
- workspace schema v2 with `legacyPhaseA`;
- Account Map applied schema v1 with `layout`;
- Portfolio schema v2 values containing aggregate or location scope;
- Simulation draft versions already accepted by the current typed simulation parser.

Conversion behavior is deterministic:

1. Validate the envelope and every retained product slice before producing a candidate.
2. Preserve Main, Simulation, current Financial Locations, current Account Map custom purposes/links, and the aggregate Portfolio plan or draft.
3. Apply the existing Simulation draft upgrade rules.
4. Drop Phase A instruments/flows, Account Map layout, and location-scoped Portfolio records.
5. Produce a fully validated workspace v3 candidate without mutating storage.
6. Let the repository perform the guarded write and read-back verification.

Unknown workspace, backup, Account Map, Portfolio, or Simulation versions are rejected. A partially valid input is never merged into the current workspace.

## 6. Backup and Import

Current export advances the backup envelope to format version 2 and contains workspace v3 only.

Import behavior:

- format version 2 accepts only a valid workspace v3;
- format version 1 is passed through the same one-way converter used for the retired source record;
- invalid JSON, unknown versions, invalid retained slices, invalid references, capacity failures, duplicate identifiers, and future timestamps perform zero workspace writes;
- an imported legacy file remains the user's original rollback artifact; the application does not rewrite that file;
- a successful import writes only `isf-workspace-v3` and never mutates old standalone keys or `isf-workspace-v1`.

The current import confirmation, focus return, error messages, and raw-current-workspace preservation remain unchanged unless wording must distinguish an unsupported historical format from malformed current data.

## 7. Runtime, Route, and Asset Retirement

Deletion is based on supported route closure rather than filename age.

### 7.1 Remove

- `apps/main/app.js`
- `apps/main/styles.css`
- `apps/main/modules/**`
- `shared/legacy/sw.js`
- legacy-only `shared/components/**`
- legacy-only `shared/storage/**`
- legacy-only `shared/pwa/**`
- legacy-only `shared/core/**`
- legacy-only `shared/styles/**`
- `src/core/storage/CompatibilityBridge.ts`
- legacy-only `src/core/storage/BackupService.ts` and `IsfStore.ts`
- legacy-only `src/core/types/models.ts` and `src/core/types/money.ts`
- `src/main/infrastructure/retiredStorage.ts`, its Main entry call, and its unit test
- version synchronization and package-script references whose only targets are deleted assets
- legacy-only browser and unit tests after their valid external contracts are moved

### 7.2 Retain

- `shared/brand/mainBrandGeometry.js`, because current React branding and icon generation consume it;
- the current workspace converter and its fixtures;
- compact negative tests proving supported routes do not load deleted assets and current repositories do not touch retired standalone keys;
- historical design and plan documents as records. Current-state summaries must be updated, but historical execution documents are not rewritten to pretend the old implementation never existed.

### 7.3 Route closure

All five Vite inputs remain unchanged: root launcher plus Main, Simulation, Portfolio, and Account Map. No replacement route is added for deleted Main modules. Build and source tests must prove:

- every supported HTML entry reaches only current source/CSS assets;
- deleted files are absent from the production output;
- no manifest, service worker precache, route helper, selector test, or package script names a deleted path;
- direct legacy implementation URLs are not part of the built GitHub Pages artifact.

## 8. Test Retirement and Replacement

`tests/step1.spec.ts` is deleted only after classifying each active case.

- Old sanitizer, Sankey, household-budget, Financial Detail Modal, preset, renderer, and account-correction behavior is intentionally retired rather than copied.
- Current Main setup, restart/cancel, overflow, Account Map navigation, storage isolation, and responsive behavior stays covered by current React, journey, reading-width, tooltip, motion, and Account Map suites.
- Any active legacy-suite assertion that uniquely protects a supported external behavior moves to the owning current suite before deletion.
- The first two supported assertions in `tests/main-compat.spec.ts` become a narrowly named retired-storage isolation suite.
- Its legacy sanitizer/Sankey assertion is deleted.
- `IsfStore` and legacy shared-module tests are deleted with their implementation.
- The Portfolio route-isolation test is generalized to supported route closure if that produces one clearer repository-level guard; its synthetic parser fixtures remain only if they still test the generalized guard.

Skipped legacy cases are not carried forward as skips. Each is either replaced by current external behavior coverage or removed with an explicit disposition in the implementation record.

## 9. Error Handling and Atomicity

- Invalid v3 never falls back to old data.
- Invalid retired source data does not create v3.
- A failed converter does not write either key.
- A failed v3 write restores the previous v3 bytes using the existing guarded-write behavior; it never modifies the source key.
- A stale revision remains a conflict and cannot be hidden by migration.
- Cross-tab notification publishes only after v3 read-back matches the serialized candidate.
- Import validation completes before confirmation can replace the current workspace.
- Unknown extra fields remain invalid instead of being silently accepted.

## 10. Delivery Order and Rollback Gates

Phase 4 is implemented as independently reviewable commits in this order.

1. Add current route-closure, retired-storage isolation, and legacy-test disposition evidence without deleting runtime files.
2. Add workspace v3 types, strict validation, backup format v2, and pure v1/v2-to-v3 conversion tests.
3. Move the browser repository to the v3 key with read-only v1 fallback and prove failure/rollback behavior.
4. Advance the save-lock namespace, remove retired-key purge behavior, and prove cross-version source changes cannot replace v3.
5. Remove `legacyPhaseA`, Account Map layout, and location scope from current application/domain consumers.
6. Delete legacy Main, storage bridge, shared browser layer, old SW/version targets, and obsolete tests.
7. Update Product PRD, README, DESIGN, the repository-wide refactor status, and current-state documentation.
8. Run repository-wide reference searches and full verification from the final deletion state.

Each gate can be source-reverted independently. The storage-key split makes deployment rollback non-destructive because the previous build's source key remains intact and the new build's v3 key is not erased by rollback.

## 11. Verification

Every deletion gate records its exact source paths, replacement evidence, and remaining references. Final verification includes:

- `npm run check`
- `npm run test:unit`
- focused workspace migration, repository, backup, Main import, Portfolio preservation/removal, and Account Map tests
- `npm run test:e2e -- --reporter=list`
- `npm run build`
- `git diff --check`
- supported-route closure scan for runtime imports, HTML assets, CSS imports, selectors, and generated PWA precache entries
- storage scan for old standalone keys, old workspace writes, global bridges, and compatibility paths
- save-lock tests for the v3 namespace, conversion under the v1 lock, and post-migration v1 changes leaving v3 untouched
- source and build scan for deleted Main/shared paths and globals
- backup fixtures covering v1/v2 conversion, v3 round-trip, unknown-version rejection, invalid-reference atomic rejection, and exact source-key preservation
- 390px, 768px, and desktop checks for the import/recovery surfaces affected by repository state changes

Allowed historical references are limited to archived specs/plans and explicit negative or migration fixtures. They must not be reachable from a supported runtime entry except through the versioned converter when v3 is absent or an older backup is explicitly imported.

## 12. Acceptance Criteria

- Supported routes and production assets contain no legacy Main, global storage bridge, old service worker, or legacy shared browser implementation.
- Current workspace v3 contains no `legacyPhaseA`, Account Map layout preference, or location-scoped Portfolio state.
- Current product data writes only `isf-workspace-v3` and the Portfolio view-preference record; workspace coordination writes only the v3 lock/lease namespace.
- Existing v1/v2 workspaces and format-v1 backups convert deterministically into valid v3 without mutating their source bytes.
- Retired standalone app keys are never read, written, migrated, or deleted.
- Invalid current or retired data causes no partial write.
- The previous deployment can read its untouched source record after rollback, and returning forward reveals the preserved v3 record.
- All skipped legacy browser cases are removed; supported external behavior remains covered by current suites.
- Product PRD, README, DESIGN, and the repository-wide refactor design describe Phase 4 and the final storage boundary consistently.
- Full type, unit, E2E, production build, reference search, and whitespace verification pass with fresh evidence.
