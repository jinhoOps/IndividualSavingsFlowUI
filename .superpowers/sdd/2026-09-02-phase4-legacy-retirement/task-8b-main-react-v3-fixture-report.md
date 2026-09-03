# Corrective Gate 8B — Main Browser Fixtures Use Workspace v3 Report

Status: DONE_WITH_CONCERNS

## Outcome

Ordinary Main browser flows now seed and inspect only the canonical
`isf-workspace-v3` record with valid v3 slices. This covers brand-intro
progress and restart, setup-motion/review fixtures, dashboard reduced-motion,
backup-control accessibility, interrupted setup persistence, and the money
editor. The quick-setup persistence assertion now checks the v3 Account Map
shape (`{ applied: null, draft: null }`) rather than the retired compatibility
field.

No production source, schema, route, storage boundary, PRD, plan, package,
lockfile, manifest, generated file, or unrelated test changed. Main retains
ownership of its five monthly values.

## Changed files

- `tests/main-react.spec.ts`: replaces ordinary v1 seeds and reads with valid
  current-v3 fixtures and assertions.

## TDD evidence

Initial status:

```text
$ git status --short
(no output)
```

Focused RED before the fixture change:

```text
$ npx playwright test tests/main-react.spec.ts --reporter=list -g 'new user applies the v2 quick setup and refreshes into matching dashboard totals'
1 failed
```

The stale assertion waited for `isf-workspace-v1` and received `null`; the
supported product had persisted the completed setup to v3.

Focused GREEN after converting that assertion and the ordinary fixtures:

```text
$ npx playwright test tests/main-react.spec.ts --reporter=list -g 'new user applies the v2 quick setup and refreshes into matching dashboard totals'
1 passed
```

## Residual `isf-workspace-v1` classification

The required scan has exactly three key occurrences, all inside the explicitly
named `downloads and explicitly resets an invalid workspace before a durable
apply` test:

- line 637 seeds malformed v1 as the invalid-retired recovery source.
- line 654 reads it after reset to prove byte-for-byte retired-source
  preservation while the replacement current record is v3.
- line 687 rechecks it after a later durable Main apply to prove that current
  v3 writes never mutate the rollback source.

These are the Gate 8A invalid-retired recovery exception, not normal Main
product fixtures. The test also verifies creation and subsequent persistence
through `isf-workspace-v3`.

## Final verification

```text
$ npx playwright test tests/main-react.spec.ts --reporter=list
35 passed
1 failed
```

```text
$ npx playwright test tests/retired-storage-isolation.spec.ts tests/main-react.spec.ts --reporter=list
37 passed
1 failed
```

In both full commands, every Gate 8B-converted Main flow and both
retired-storage-isolation tests passed. The only failure is the unrelated
`Main brand intro captures timed phases at 390px and resumes without replay`
at `tests/main-react.spec.ts:701`: the test times out at line 399 after the
intro node has already been removed. The same test passes by itself:

```text
$ npx playwright test tests/main-react.spec.ts --reporter=list -g 'Main brand intro captures timed phases at 390px and resumes without replay'
1 passed
```

The source timing evidence is outside this fixture-only gate:

- `src/main/ui/MainWelcomeIntro.tsx:66-82` builds the Anime timeline with
  `onComplete: finish`. Its visible durations conclude at roughly 1,490ms
  (background 180ms; staggered bars ending about 630ms; 40ms gap plus 560ms
  trend ending about 1,230ms; final 260ms hold).
- `tests/main-react.spec.ts:276-280` captures the final frame at 1,950ms and
  expects normal completion at 2,200ms.
- `src/main/ui/MainWelcomeIntro.tsx:8,103` independently schedules the
  2,200ms fallback timer, but the Anime completion can unmount the intro
  first.

Thus the full-run failure exposes an existing brand-intro product/timing
contract mismatch, not a v3 fixture failure. This gate deliberately does not
change production code or weaken that capture assertion.

```text
$ npm run check
tsc --noEmit
tsc --noEmit -p tsconfig.unit.json
exit 0

$ git diff --check
(no output; exit 0)

$ rg -n -C 1 'isf-workspace-v1' tests/main-react.spec.ts
3 occurrences; all classified above
```

Playwright emitted the existing `module.register()` deprecation and
`NO_COLOR`/`FORCE_COLOR` warnings. They did not affect the focused Green or
type-check results.

## Commits

- `3e4bb2b test: seed Main browser flows with workspace v3`
- This report is committed separately so it can name the implementation commit
  without a circular report-commit hash.

## Concern

Task 8 cannot claim a green full E2E result until the independently owned
390px Main brand-intro timing defect is repaired. Gate 8B is otherwise limited
to, and complete for, the required current-v3 browser-fixture conversion.
