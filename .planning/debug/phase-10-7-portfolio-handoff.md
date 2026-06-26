---
status: verifying
trigger: "Fix Phase 10.7 verification gap: Portfolio connector must consume the actual accountFlowHandoff sidecar shape produced by sanitizeInputs."
created: 2026-06-26T18:42:28.6430603+09:00
updated: 2026-06-26T19:02:00.0000000+09:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "Portfolio reports sanitizer-produced account-flow sidecars as incomplete because normalizeAccountFlowHandoff only counts sidecar.incomeAllocations and sidecar.itemAccounts, fields sanitizeInputs does not emit."
  confirming_evidence:
    - "buildAccountFlowHandoff returns incomes/expenseItems/savingsItems/investItems in apps/main/modules/input-sanitizer.js."
    - "normalizeAccountFlowHandoff reads only incomeAllocations/itemAccounts in apps/portfolio/modules/step1-connector.js."
    - "tests/step3.spec.ts seeds incomeAllocations/itemAccounts directly, so it never exercises the sanitizer-produced shape."
  falsification_test: "If a sanitized Step 1 snapshot with accountFlowHandoff.incomes and expenseItems/investItems still produces counts incomeAllocations=1 and itemAccounts=2 after the connector patch, the hypothesis is wrong or incomplete."
  fix_rationale: "Counting allocations from sidecar.incomes[].allocations and item links from sidecar expense/savings/invest items aligns Portfolio consumption to the existing sanitizer sidecar without changing Step 1 primary data."
  blind_spots: "Existing UI/state only exposes aggregate count keys, so this fix does not model full future Portfolio editing semantics."
next_action: "Stage apps/portfolio/modules/step1-connector.js and tests/step3.spec.ts, then commit with a message containing 10.7-gap."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Portfolio detects and counts account-flow allocation/link data from the actual accountFlowHandoff sidecar emitted by sanitizeInputs."
actual: "Portfolio connector currently counts only incomeAllocations and itemAccounts; tests use that connector-specific fake shape, masking mismatch."
errors: "Verification report status gaps_found for Phase 10.7."
reproduction: "Run Phase 10.7 verifier or seed Portfolio import with sanitizer-produced accountFlowHandoff containing incomes, expenseItems, savingsItems, investItems."
started: "Found during Phase 10.7 verification."

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-26T18:44:10.0000000+09:00
  checked: ".planning/phases/10.7-account-flow-extraction-and-portfolio-boundary/10.7-VERIFICATION.md and CodeGraph exploration for sanitizeInputs/buildAccountFlowHandoff"
  found: "Verification gap says sanitizer produces accountFlowHandoff.incomes, expenseItems, savingsItems, investItems while Portfolio reads incomeAllocations/itemAccounts. CodeGraph confirmed buildAccountFlowHandoff returns version, accounts, incomes, expenseItems, savingsItems, investItems, splitIncomeAccounts, surplusTransferAccountId, transfers, accountCorrections."
  implication: "This is a Data Shape/API Contract mismatch; the next test should inspect Portfolio consumption and regression fixture shape."

- timestamp: 2026-06-26T18:48:30.0000000+09:00
  checked: "apps/portfolio/modules/step1-connector.js and tests/step3.spec.ts"
  found: "normalizeAccountFlowHandoff reads sidecar.incomeAllocations and sidecar.itemAccounts only. Step 3 test fixture also seeds those fields directly and does not call sanitizeInputs."
  implication: "Root cause is confirmed: producer and consumer sidecar contracts diverged, and regression coverage used the consumer-only contract."

- timestamp: 2026-06-26T18:56:00.0000000+09:00
  checked: "npx playwright test tests/step3.spec.ts --reporter=list"
  found: "2 passed. The updated Step 3 test generates accountFlowHandoff through sanitizeInputs and Portfolio reports available=true with expected counts."
  implication: "Targeted Portfolio handoff regression passes against the actual sanitizer sidecar shape."

- timestamp: 2026-06-26T18:59:00.0000000+09:00
  checked: "npx playwright test tests/step1.spec.ts tests/step3.spec.ts --reporter=list"
  found: "74 passed."
  implication: "Step 1 account-flow removal boundaries and Step 3 Portfolio handoff behavior still pass together."

- timestamp: 2026-06-26T19:02:00.0000000+09:00
  checked: "npm run check"
  found: "tsc --noEmit completed successfully."
  implication: "TypeScript/project check passes after the connector and test changes."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Portfolio connector consumed a connector-specific accountFlowHandoff shape (incomeAllocations/itemAccounts) while Step 1 sanitizeInputs produces the preserved handoff under incomes/expenseItems/savingsItems/investItems. Step 3 tests used the consumer-only fixture, so the mismatch was not covered."
fix: "apps/portfolio/modules/step1-connector.js now counts sanitizer-produced sidecar.incomes allocations and expense/savings/invest item account links, falling back to legacy incomeAllocations/itemAccounts. tests/step3.spec.ts now calls sanitizeInputs() to generate accountFlowHandoff before Portfolio loads."
verification: "npx playwright test tests/step3.spec.ts --reporter=list: 2 passed; npx playwright test tests/step1.spec.ts tests/step3.spec.ts --reporter=list: 74 passed; npm run check: passed."
files_changed: ["apps/portfolio/modules/step1-connector.js", "tests/step3.spec.ts"]
