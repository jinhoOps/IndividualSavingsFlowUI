---
phase: 08-step-2-redesign-re-planning
plan: 04
subsystem: data
tags: [step2, market-data, static-data, cleanup, documentation]

requires:
  - phase: 08-step-2-redesign-re-planning
    provides: Conservative strategy assumptions from Plan 02
provides:
  - Runtime market-data evidence documentation for Step 2 conservative learning ranges
  - Generator script notes that runtime market JSON belongs under public/data/indices
  - Removal of stale root-level QQQ CSV backdata clutter
affects: [phase-08-step2-redesign, static-market-data, data-hygiene]

tech-stack:
  added: []
  patterns:
    - Static market JSON evidence stays under public/data/indices
    - Covered-call examples use editable assumptions.js ranges rather than live runtime data

key-files:
  created:
    - public/data/indices/README.md
  modified:
    - scripts/generate_qqq_data.py
    - scripts/generate_market_data.py
  deleted:
    - qqq_raw.csv
    - qqq_daily_raw.csv
    - qqq_daily_stooq.csv

key-decisions:
  - "Step 2 runtime market evidence is documented as public/data/indices/*.json, with qqq.json, spy.json, and schd.json as the active evidence files."
  - "JEPI, QQQI, and DIVO remain editable conservative assumptions in assumptions.js instead of runtime historical JSON or live market fetches."
  - "Loose root QQQ CSV files were deleted after runtime path scanning found no dependency."

patterns-established:
  - "Data hygiene cleanup verifies runtime paths before deleting stale root artifacts."
  - "Static evidence documentation separates historical JSON evidence from editable product assumptions."

requirements-completed: [UI-03]

duration: 13 min
completed: 2026-06-17
---

# Phase 08 Plan 04: Static Market Data Hygiene Summary

**Step 2 now documents its static JSON evidence base and removes stale root QQQ CSV backdata from runtime-adjacent project clutter.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-17T08:12:45Z
- **Completed:** 2026-06-17T08:25:41Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- Added `public/data/indices/README.md` documenting `qqq.json`, `spy.json`, and `schd.json` as Step 2 runtime evidence files for conservative learning ranges.
- Documented that JEPI, QQQI, and DIVO use editable conservative assumptions and display ranges from `apps/simulation/modules/assumptions.js`.
- Added generator docstrings clarifying that generated runtime market data belongs under `public/data/indices/`.
- Verified runtime paths under `apps`, `src`, `shared`, and `tests` do not reference loose root QQQ CSV files.
- Deleted `qqq_raw.csv`, `qqq_daily_raw.csv`, and `qqq_daily_stooq.csv` from the repository root.

## Task Commits

Each task was committed atomically:

1. **Task 1: Data source documentation and generator notes** - `ece530b` (feat)
2. **Task 2: Root QQQ CSV cleanup** - `2fb2d48` (chore)

## Files Created/Modified

- `public/data/indices/README.md` - Documents runtime market evidence files, conservative assumption boundaries, generator ownership, and the no-root-CSV runtime rule.
- `scripts/generate_qqq_data.py` - Adds a module docstring naming `public/data/indices/` as the runtime output target.
- `scripts/generate_market_data.py` - Adds a module docstring naming `public/data/indices/` as the runtime daily-data conversion target.
- `qqq_raw.csv` - Deleted stale root-level CSV artifact.
- `qqq_daily_raw.csv` - Deleted stale root-level CSV artifact.
- `qqq_daily_stooq.csv` - Deleted stale root-level CSV artifact.

## Decisions Made

- Kept Step 2 market data static and local-first; no live market fetching was added.
- Treated `public/data/indices/*.json` as runtime evidence and `assumptions.js` as the editable conservative assumption boundary for covered-call examples.
- Deleted the root CSV files rather than archiving them because the runtime dependency scan found no dependency under `apps`, `src`, `shared`, or `tests`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial sandboxed Git staging could not create `.git/index.lock` because of repository permission restrictions. The same task commit was rerun with approved escalated Git access.
- `python -m py_compile` created `scripts/__pycache__/`; the generated cache directory was removed and was not committed.

## Verification

- `python -m py_compile scripts/generate_qqq_data.py scripts/generate_market_data.py` - PASS
- `node -e "const fs=require('fs'); const readme=fs.readFileSync('public/data/indices/README.md','utf8'); for (const token of ['qqq.json','spy.json','schd.json','assumptions.js']) { if (!readme.includes(token)) { console.error(token); process.exit(1); } }"` - PASS
- `node -e "const fs=require('fs'),path=require('path'); const roots=['apps','src','shared','tests']; const hits=[]; const re=/qqq_raw|qqq_daily_raw|qqq_daily_stooq/; function walk(dir){ if(!fs.existsSync(dir)) return; for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,entry.name); if(entry.isDirectory()) walk(p); else if(re.test(fs.readFileSync(p,'utf8'))) hits.push(p); } } roots.forEach(walk); if(hits.length){ console.error(hits.join('\n')); process.exit(1); }"` - PASS
- `node -e "const fs=require('fs'); const bad=['qqq_raw.csv','qqq_daily_raw.csv','qqq_daily_stooq.csv'].filter((f)=>fs.existsSync(f)); if (bad.length) { console.error(bad.join('\n')); process.exit(1); }"` - PASS
- `git status --short` - PASS for this plan scope; no 08-04 code changes remained after task commits.

## Known Stubs

None. Stub scan found no placeholder markers in the files created or modified by this plan. Existing local accumulator arrays in the generator scripts are implementation variables, not UI or data-source stubs.

## Threat Flags

None. This plan added documentation and removed stale root artifacts; it introduced no new network endpoints, auth paths, file access patterns, or runtime trust boundaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 08 now has documented static market evidence and no root-level QQQ CSV runtime ambiguity. With Plan 08-03 also completed, the phase is ready for verification and milestone-level review.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/08-step-2-redesign-re-planning/08-04-SUMMARY.md`.
- Task commits exist in git: `ece530b` and `2fb2d48`.
- Created/modified files exist: `public/data/indices/README.md`, `scripts/generate_qqq_data.py`, and `scripts/generate_market_data.py`.
- Deleted root CSV files are absent: `qqq_raw.csv`, `qqq_daily_raw.csv`, and `qqq_daily_stooq.csv`.

---
*Phase: 08-step-2-redesign-re-planning*
*Completed: 2026-06-17*
