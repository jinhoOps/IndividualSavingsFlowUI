# Phase 4 legacy `step1` test disposition

The approved Phase 4 retirement design retires the legacy Main renderer and its
sanitizer, Sankey, household-budget, financial-detail-modal, preset, and old
renderer behavior. Supported external behavior remains covered by the current
React Main, journey, and Account Map suites named below.

`rg -n "test(?:\.skip)?\(" tests/step1.spec.ts` returned 73 matches on
2026-09-03. The table has 73 rows: 71 declared Playwright cases and two
embedded source-audit regular expressions that the mandated command also
matches. The latter are explicitly marked as non-cases.

| legacy case | supported behavior | replacement evidence | disposition |
| --- | --- | --- | --- |
| Page header and layout loads correctly | Legacy renderer header | — | retired by approved spec; no replacement |
| Sankey diagram viewport height constraints | Legacy Sankey | — | retired by approved spec; no replacement |
| UI curvatures (border-radius) align with var(--rd-sm) | Legacy renderer styling | — | retired by approved spec; no replacement |
| Sankey view toggle height matches container spacing | Legacy Sankey | — | retired by approved spec; no replacement |
| Phase 07 panel hierarchy is stable on desktop and mobile | Current responsive Main layout | `tests/main-react.spec.ts` — `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` | replaced by current suite |
| Phase 07 mobile controls stay contained at 768px and 390px | Current responsive Main layout | `tests/main-react.spec.ts` — `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` | replaced by current suite |
| Phase 07 visualization tabs render nonblank SVGs after switching and resize | Legacy Sankey/network renderer | — | retired by approved spec; no replacement |
| Phase 07 gap closure keeps reset in-place and moves rates to settings | Legacy household budget controls | — | retired by approved spec; no replacement |
| Phase 07 rerun keeps Sankey detail metadata controls effective | Legacy Sankey | — | retired by approved spec; no replacement |
| Phase 07 rerun formats money fields and groups long item lists | Legacy financial-detail renderer | — | retired by approved spec; no replacement |
| Phase 10.6.1 legacy editor removal keeps controller modules modal-only | Legacy editor implementation | — | retired by approved spec; no replacement |
| embedded `bindControls` source-audit regex | Test helper, not a declared case | — | non-case included to match mandated `rg` count |
| embedded `join('|')` source-audit regex | Test helper, not a declared case | — | non-case included to match mandated `rg` count |
| Phase 07 group datalist options are DOM-built and safe for imported values | Legacy household-budget groups | — | retired by approved spec; no replacement |
| Phase 07 account select options escape imported account ids and names | Legacy account editor | — | retired by approved spec; no replacement |
| Phase 07 allocation groups move behind the integrated financial detail modal | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| repairs invalid account links and emits correction metadata | Legacy sanitizer | — | retired by approved spec; no replacement |
| builds simple Sankey links around mandatory total-income node without account nodes | Legacy Sankey | — | retired by approved spec; no replacement |
| keeps deficit pseudo-income outside total-income aggregation | Legacy Sankey | — | retired by approved spec; no replacement |
| [skip] Phase 09 keeps account correction controls out of the chart header | Legacy account correction UI | — | retired by approved spec; no replacement |
| [skip] Phase 09 basic Sankey starts at total-income while detail mode expands items | Legacy Sankey | — | retired by approved spec; no replacement |
| builds percentage preview rows with correction provenance | Legacy preset flow | — | retired by approved spec; no replacement |
| opens guided preset setup and normalizes editable percentages | Legacy preset flow | — | retired by approved spec; no replacement |
| shows confirmation provenance and commits preset through persistence | Legacy preset persistence | — | retired by approved spec; no replacement |
| formats high Korean money units with only one lower unit | Legacy money renderer | — | retired by approved spec; no replacement |
| builds and renders core metric cards plus editable outflow cards before Sankey | Legacy renderer/Sankey | — | retired by approved spec; no replacement |
| opens category modal for card detail editing and saves only after explicit confirm | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 09 financial modal compact editing keeps only the selected item expanded on mobile | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 09 financial modal group board supports custom groups and drag assignment | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| preserves manual transfer settings in source-account network flow | Legacy account-flow network | — | retired by approved spec; no replacement |
| [skip] shows only a lightweight Account Map entry on Main with the dedicated route | Current Account Map navigation | `tests/app-journey.spec.ts` — `keeps Account Map usable at mobile, tablet, and desktop widths` | replaced by current suite |
| [skip] routes Account Map through shared navigation without using Portfolio | Current Account Map navigation | `tests/app-journey.spec.ts` — `separates app navigation and the right-aligned management tool across viewports` | replaced by current suite |
| preserves restored account-flow metadata through sanitizer and Sankey | Legacy sanitizer/Sankey | — | retired by approved spec; no replacement |
| creates a new investment item in the savings-investment tab with final confirmation | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| renders merged Sankey tooltip details as line-broken safe text | Legacy Sankey tooltip renderer | — | retired by approved spec; no replacement |
| normalizes legacy allocation group paths before saving and rendering | Legacy sanitizer/group model | — | retired by approved spec; no replacement |
| repairs income allocation totals that exceed the income amount | Legacy sanitizer | — | retired by approved spec; no replacement |
| sanitizes household context defaults and variable actual spending only | Legacy household budget | — | retired by approved spec; no replacement |
| derives variable budget rows, status, projection, overview, and three summary metrics | Legacy household budget | — | retired by approved spec; no replacement |
| keeps the default screen light with one integrated detail entry before Sankey | Legacy renderer/Sankey | — | retired by approved spec; no replacement |
| keeps base assumptions in the controls panel and amount editing in the detail modal | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| opens the same integrated modal from the detail action and summary category cards | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| renders ordered tabs and keeps the compact cashflow summary rail visible | Legacy renderer | — | retired by approved spec; no replacement |
| wraps tabs and summary rail without page overflow | Current responsive width | `tests/main-react.spec.ts` — `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` | replaced by current suite |
| shows compact variable summaries and expands one editable average/range row | Legacy household budget | — | retired by approved spec; no replacement |
| renders an empty variable state and avoids 390px overflow | Current responsive width | `tests/reading-width.spec.ts` — `shares the exact reading frame across result apps at 390px` | replaced by current suite |
| shows derived automatic savings and navigates to savings in the same modal | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| blocks excess save until a choice is selected and applies the choice idempotently | Legacy household budget | — | retired by approved spec; no replacement |
| Phase 10.6 compact rows open cleanly without duplicated labels or pending state | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 account rows and add menu keep compact accessible polish | Legacy account editor | — | retired by approved spec; no replacement |
| Phase 10.6 row editing folds one row while preserving changed drafts across tabs | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 money controls enforce direct input, 10000 steppers, quick increases, and local errors | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 variable rows edit varianceAmount directly with exact quick buttons | Legacy household budget | — | retired by approved spec; no replacement |
| Phase 10.6 dirty state ignores modal open, row selection, tabs, and empty add row | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 pending bar applies and cancels draft changes in place | Current Main draft cancel | `tests/main-react.spec.ts` — `dashboard edit persists only the v2 scalar plan` | replaced by current suite |
| Phase 10.6 pending modal edits warn before page unload | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 add creates inline temporary rows that persist only on apply | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 delete keeps existing removals draft-only and discards empty temp rows immediately | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 close prompts only when pending changes exist for x overlay and escape | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 validation keeps pending bar open and expands first invalid row | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| Phase 10.6 mobile summary rail is four-cell and combines automatic savings | Legacy renderer | — | retired by approved spec; no replacement |
| Phase 10.6 mobile rows preserve amount visibility and pending bar safety | Current responsive width | `tests/main-react.spec.ts` — `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` | replaced by current suite |
| Phase 10.6 regression preserves no-couple sanitizer persistence and Sankey contracts | Legacy sanitizer/Sankey | — | retired by approved spec; no replacement |
| edits income destination allocations inside the modal and blocks mismatched allocation totals | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| persists savings maturity and one item yield while global fallback remains effective | Legacy financial-detail model | — | retired by approved spec; no replacement |
| routes surplus to the selected non-leading investment account | Legacy account-flow model | — | retired by approved spec; no replacement |
| keeps absorbed modal fields through apply, storage, import envelope, and Sankey refresh | Legacy Financial Detail Modal/Sankey | — | retired by approved spec; no replacement |
| audits source-first cleanup markers without treating dist as source | Legacy source audit | — | retired by approved spec; no replacement |
| protects integrated save/cancel, Sankey, sanitizer, duplicate, and responsive contracts | Legacy integrated renderer | — | retired by approved spec; no replacement |
| keeps every financial detail tab contained on desktop, tablet, and mobile | Legacy Financial Detail Modal | — | retired by approved spec; no replacement |
| keeps the live Main summary usable without horizontal overflow | Current Main cashflow overflow | `tests/main-react.spec.ts` — `live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports` | replaced by current suite |
| focuses restart setup and restores journey navigation after cancel | Current Main setup restart/cancel | `tests/main-react.spec.ts` — `Main brand intro restart preserves the applied plan and writes restart welcome progress` | replaced by current suite |
| keeps the review bar symmetric without an overflow gutter at 100% | Current responsive Main width | `tests/reading-width.spec.ts` — `keeps first and restart Main review frames correct at 390px` | replaced by current suite |

Checked row count: 73, matching the mandated command output. The two
non-case rows exist solely because the broad required regular expression also
matches helper regular expressions in the legacy file; all 71 executable
`test`/`test.skip` declarations are listed with their exact titles.

## Phase 4 replacement and deletion evidence

The final supported replacement tests are:

- `tests/unit/workspace/workspaceRepository.test.ts` — `migrates through guarded v3 write/readback while preserving retired bytes`, `reports invalid v3 JSON without reading or falling back to retired v1`, and `keeps v3 canonical after an old tab writes a newer retired source`.
- `tests/unit/workspace/workspaceBackup.test.ts` — `exports the current workspace in an exact format-v2 envelope` and the parameterized `imports a format-v1 retired %s workspace through the converter` cases for v1 and v2.
- `tests/unit/workspace/retiredWorkspaceMigration.test.ts` — `converts exact v2 data field-by-field and drops every retired value` and `converts exact v1 data while dropping Phase A and location-scoped Portfolio values`.
- `tests/retired-storage-isolation.spec.ts` — `React Main ignores retired standalone data and leaves each record untouched` and `React Main workspace save leaves retired standalone records untouched`.
- `tests/app-journey.spec.ts` — `retired journey snapshot survives Main startup and a current edit`.
- `tests/unit/journey/supportedRouteClosure.test.ts` — `physically retires classified legacy paths while retaining current brand geometry`.

Deletion is recorded in `cb6d23d` (`refactor: delete retired legacy runtime`). It removes the classified legacy Main runtime, storage bridge, shared browser tree, old service worker, and obsolete `step1` suite. `shared/brand/mainBrandGeometry.js` is deliberately retained as the only file from that former shared browser tree; Vite PWA owns the deployed service worker.

The final reference search recorded for the deletion was:

```bash
rg -n --glob '!docs/superpowers/specs/**' \
  --glob '!docs/superpowers/plans/**' \
  --glob '!docs/superpowers/evidence/**' \
  "apps/main/(?:app\\.js|styles\\.css|modules/)|shared/(?:legacy|components|storage|pwa|core|styles)/|CompatibilityBridge|IsfStore|BackupService" \
  .
```

It found 16 intentional negative-closure references confined to `tests/unit/journey/supportedRouteClosure.test.ts` and its synthetic fixture. Re-running the same search while excluding those two test locations returned no matches (the expected `rg` no-match exit status).

Allowed remaining historical or migration-fixture references are confined to historical specs/plans/evidence, the retired workspace converter and its unit/backup/repository tests, browser isolation tests, and the explicit retired journey sentinel. They describe v1/v2 input or untouched foreign records; no current production route reads, writes, converts, or deletes standalone old keys or the retired journey snapshot. Task 8 owns the final repository-wide verification and is not claimed by this evidence update.

## Task 8 final repository verification (2026-09-03)

Final disposition: **PASS** at `6e1f641`. The worktree was clean before
verification. The verifier made no product implementation change. The build's
expected generated version bump from `0.11.94` to `0.11.95` was restored to the
tracked `0.11.94` in `package.json` and `public/manifest.webmanifest` before this
evidence-only commit.

### Final reference audit

```bash
rg -n --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/evidence/**' \
  "legacyPhaseA|apps/main/(?:app\.js|styles\.css|modules/)|shared/(?:legacy|components|storage|pwa|core|styles)/|CompatibilityBridge|IsfStore|BackupService|isf-journey-snapshot-v1" \
  src apps shared scripts tests package.json public README.md DESIGN.md docs/ways-of-work
```

Result: exit 0, 37 classified lines. They consist of one current PRD negative
contract, the three-line retired converter parser, explicit converter/format-v1
backup/current-schema rejection fixtures, untouched journey and standalone-key
isolation assertions, and the synthetic route-closure guard. There is no
supported-runtime import, deleted asset path, global bridge implementation, or
current UI selector among the matches.

```bash
rg -n "isf-workspace-v1|isf-workspace-v3|isf-workspace-v[13]-save|isf-main-v1|isf-main-v2|isf-rebuild-v1" src tests
```

Result: exit 0, 176 classified lines. Current fixtures, writes, read-back,
storage events, and notifications use v3. Workspace v1 appears only in the
retired-source constant/lock, named Account Map and Simulation migration tests,
Main invalid-retired recovery, and storage-isolation tests. Standalone keys
appear only in byte-preservation/no-read/no-write tests and the synthetic route
closure token. No ordinary Main browser journey seeds or asserts workspace v1.

The production output contains 26 files. `dist/sw.js` exists, while
`dist/apps/main/app.js` and `dist/apps/main/styles.css` do not. The deleted-path,
bridge, old-service-worker, standalone-key, and retired-journey scan has no
production match. The only historical contract tokens in the shared bundle are
the approved converter boundary: `isf-workspace-v1` three times and
`legacyPhaseA` four times. Current `isf-workspace-v3` appears three times.

### Focused high-risk verification

```bash
npx vitest run \
  tests/unit/journey/supportedRouteClosure.test.ts \
  tests/unit/workspace/retiredWorkspaceMigration.test.ts \
  tests/unit/workspace/validation.test.ts \
  tests/unit/workspace/workspaceSaveLock.test.ts \
  tests/unit/workspace/workspaceRepository.test.ts \
  tests/unit/workspace/workspaceBackup.test.ts \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/portfolio \
  tests/unit/account-map
```

Result: exit 0; **44 test files and 549 tests passed**.

```bash
npx playwright test tests/retired-storage-isolation.spec.ts tests/main-react.spec.ts --reporter=list
```

Result: exit 0; **39 tests passed**: the expected 37 current Main cases and two
retired-storage isolation cases, with no skips. This includes invalid retired-v1
recovery, byte preservation, the 390/768/1280 intro timing captures, all skip and
reduced-motion paths, and returning through every initial setup step with visible
and actionable final-state content.

### Full verification matrix

```bash
npm run check
```

Result: exit 0. Both `tsc --noEmit` and
`tsc --noEmit -p tsconfig.unit.json` passed.

```bash
npm run test:unit
```

Result: exit 0; **123 test files and 1,187 tests passed** in 6.95s.

```bash
npm run test:e2e -- --reporter=list
```

Result: exit 0; **130 passed and one skipped** out of 131 in 2.2 minutes. The
only skip is `tests/motion-system.spec.ts`'s documented normal-Chromium PWA
offline case because that project blocks service workers; the reciprocal preview
project owns that capability check. The former 61 legacy skips are absent.

```bash
npm run build
```

Result: exit 0; Vite transformed **2,014 modules**. Vite PWA generated
`dist/sw.js` and `dist/workbox-fd0ffb34.js` with **31 precache entries / 717.18
KiB**.

```bash
git diff --check
```

Result: exit 0 with no output. The canonical current-document relative-link
check also exited 0.

### Responsive Main import and recovery QA

A temporary read-only Playwright QA probe was removed after execution. It ran
nine independent cases at 390×844, 768×900, and 1280×900:

- current-v3 whole-workspace import confirmation;
- invalid current-v3 recovery;
- invalid retired-v1 recovery.

Final result: **9 passed**. At every width, the document had no horizontal
overflow, the confirmation/recovery surface stayed inside the viewport, all
visible actions and the file control were at least 44×44px, keyboard navigation
showed a visible focus indicator, confirmation returned focus to `관리 메뉴`,
and restore/recovery status remained visible. The dashboard cashflow SVG had
non-zero geometry and full opacity before and after import. Both recovery paths
created a durable empty v3 workspace; retired-v1 recovery preserved its original
raw bytes exactly.

### Acceptance self-review

- `convertRetiredWorkspaceDocument`, workspace schema/key v3, backup format v2,
  and current/retired lock namespaces have one consistent interface and call
  path.
- Exact current validators reject `legacyPhaseA`, Account Map `layout`, extra
  fields, retired Simulation versions, and location-scoped Portfolio values
  rather than stripping them.
- Focused repository tests prove v1 byte preservation for successful conversion,
  invalid source, failed/unverified v3 writes, invalid-retired reset, competing
  v3 arrival, source mutation, and later old-tab writes.
- Invalid v3 JSON and invalid v3 schema tests prove no retired-source read or
  fallback. Import tests prove full validation before one replacement and zero
  mutation on invalid/reference/capacity failures.
- Portfolio and Account Map suites pass their slice-ownership and Main
  read-only contracts. Source writes are limited to the v3 workspace/lock
  namespace and the separately approved Portfolio view-preference record.
- Rollback documentation describes preserved parallel source snapshots and does
  not promise cross-version merging.
- The Phase 4 diff adds no `TODO`, `FIXME`, broad TypeScript `any`, placeholder,
  or unclassified skip. The two conditional skip statements are the documented
  reciprocal PWA project gates.

All Phase 4 design acceptance criteria now have fresh source, compatibility,
type, unit, browser, production-build, responsive, and whitespace evidence. The
branch is ready for the required full-range code review and subsequent integration
decision.
