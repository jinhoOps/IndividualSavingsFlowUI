# Account Flow Belongs to the Portfolio Boundary

Step 1 is the ordinary household cash-flow input surface. Its primary model and Sankey visualization show income flowing to living expense, savings, and investment categories. Step 1 must not restore account tabs, account selectors, income allocation editors, account-transfer controls, network-map controls, or automatic account correction as normal user paths.

Richer account-flow behavior belongs at the Portfolio destination boundary for Phase 10.7. Step 1 may guide users to Portfolio when preserved account-flow handoff data exists or when they need destination-level account-flow review, but that guidance is navigation only. It must not expose detailed legacy account labels in Step 1 or make Step 1 the live account-flow editor again.

Phase 10.7 chooses Portfolio instead of a separate account-flow page because Portfolio is already a separately routed destination with state, storage, and allocation-oriented workflows. Creating a fourth page would require a new route, entry bridge, navigation, state/storage, styles, and E2E coverage during a corrective simplification phase. A separate page can be reconsidered later only if a future UX spec proves Portfolio cannot own the domain.

Legacy account, allocation, transfer, and correction data is a compatibility sidecar named `accountFlowHandoff`. The sidecar is handoff-only data for Portfolio/destination code. Step 1 can preserve it through sanitize/import/share/local persistence, but Step 1 primary fields must remain simplified and must not rehydrate sidecar data back into live account fields.

Future bidirectional account-flow editing belongs in Portfolio or destination-owned code. Any future implementation that needs to write back to Step 1 must do so through an explicit contract that preserves the Step 1 simplified model rather than reviving account-flow editing in ordinary Step 1.
