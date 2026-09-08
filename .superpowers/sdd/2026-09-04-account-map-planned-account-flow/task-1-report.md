# Task 1 report: versioned Account Map transfer contracts

## Changed files

- `src/account-map/domain/model.ts`
  - Preserved the existing v2 applied and v1 draft contracts and their writer constants.
  - Added transfer allocation/link types, setup steps, v3 applied/v2 draft types, and stored unions.
- `src/account-map/domain/accountMapVersioning.ts`
  - Added exact-key parsers for applied v2/v3 and draft v1/v2.
  - Added strict nested transfer parsing, structural validation integration, pure view projections, and explicit-save upgrades.
- `src/account-map/domain/accountFlowValidation.ts`
  - Added pure validation for endpoint references, archived active endpoints, self-links, duplicate IDs/pairs, invalid fixed amounts, multiple sweeps, and cycles.
- `tests/unit/account-map/accountMapVersioning.test.ts`
  - Added accepted-version, malformed-transfer, projection immutability, and upgrade-preservation coverage.
- `tests/unit/account-map/accountFlowValidation.test.ts`
  - Added valid topology and structural rejection coverage, including archived suspended links.

## Commit

- `bb65138789ca3e05424ca495899f05b1c6f7bcd4` — `feat(account-map): add planned transfer contract`

## Verification

- `npx vitest run tests/unit/account-map/accountMapVersioning.test.ts tests/unit/account-map/accountFlowValidation.test.ts` (before implementation): failed as expected because both new modules were absent.
- `npm run check`: passed (`check:source` and `check:unit`).
- `npx vitest run tests/unit/account-map/accountMapVersioning.test.ts tests/unit/account-map/accountFlowValidation.test.ts`: passed, 2 files / 13 tests.
- `npx vitest run tests/unit/account-map`: passed, 25 files / 296 tests.
- `git diff --check`: passed before commit.
- Post-commit worktree contains no unrelated package-lock changes.

## Self-review

- Existing runtime writers and repository persistence were not changed.
- Parser output is reconstructed from exact-key inputs; projections and upgrades deep-clone nested state and do not mutate or persist source objects.
- Active transfer topology is validated as a DAG; suspended links may reference archived locations when location context is supplied.
- Account Map v2/v1 compatibility remains available through the stored unions and in-memory projection boundary.

## Concerns

- This additive task intentionally does not wire the new unions into workspace persistence or current Account Map runtime writers; Tasks 2–5 own those integration boundaries.
- `projectAccountMapDraftForView` maps legacy `connect` to the new `locations` step, preserving legacy `review` as `review`.
