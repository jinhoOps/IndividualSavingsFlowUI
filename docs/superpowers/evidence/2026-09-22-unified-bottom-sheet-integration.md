# Unified dialog integration — 2026-09-22

## Included work

- The [shared surface plan](../plans/2026-09-22-unified-bottom-sheet.md) and [spec](../specs/2026-09-22-unified-bottom-sheet-design.md): native dialogs for Main, Simulation, Portfolio, management settings and result preview; mobile Anime.js sheets and desktop centered modals.
- Orca child workspace dependency task: restore Vite `^6.4.3` and Vitest/UI `^4.1.11` in both package manifests. The child terminal and installed packages showed these changes, but the committed manifests still used the old versions. A clean installation now reproduces the intended dependency tree.
- Premerge review fixes: keep canceled mobile drags visible, put account read-only boundaries inside Main and Simulation portals, and restore Portfolio focus after React removes the result area's `inert` attribute.
- Journey/motion browser tests now follow native modal semantics, wait for entrance completion, and use the current editor entry/close flow. Simulation's spec and plan retain existing autosave, consistent with their non-goal of changing persistence contracts.

## Verification

| Command | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Clean install passed; audit reported 0 vulnerabilities. Postinstall was skipped to avoid creating a CodeGraph index during integration. |
| `npm run check:ci` | Harness and both TypeScript checks passed; 128 unit files / 1,103 tests passed. |
| `npm run test:e2e -- --workers=2 --reporter=dot` | 224 passed, 1 skipped in 5.2 minutes. |
| `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npx vite build` | Production build and service-worker generation passed with fixture configuration, without bumping the version. |
| `git diff --check` | Passed. |

The skipped test requires the separate `pwa-chromium` project; the normal E2E configuration blocks service workers. Physical iOS/Android devices and screen readers were not tested in this integration pass.

The first full run exposed stale journey/motion tests and two reload-related failures while files were changing. A subsequent run was stopped after review found real drag/offline-lock defects. Five new or strengthened regression cases failed on the original behavior (opacity 0 after drag; four enabled financial editors after going offline). All five passed after the fixes; the existing Portfolio repeated-drag focus case also passed after correcting restoration timing. The final full run above supersedes these diagnostic runs.

## Local work preservation

The child workspace's ignored execution ledger, task briefs, dependency terminal record and test evidence are preserved under `.superpowers/sdd/2026-09-22-unified-bottom-sheet-archive/` in the main checkout. All product changes and restored dependency changes are included in PR #18. No workspace schema, server protocol, retained Account Map data or production database changes are included.
