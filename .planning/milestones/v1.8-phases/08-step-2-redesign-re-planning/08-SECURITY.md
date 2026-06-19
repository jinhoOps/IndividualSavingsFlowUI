---
phase: 08
slug: step-2-redesign-re-planning
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-19
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Step 1 storage -> Step 2 draft | Previously persisted Step 1 data enters editable Step 2 state | Local investment amounts and horizon values |
| Step 2 draft -> IndexedDB/LocalStorage | User/imported simulation data is persisted locally | Step 2 simulation state, ids, display names, strategy fields |
| LocalStorage fallback -> DataHub list | Fallback entries are later rendered and loaded by UI code | User-controlled simulation names and ids |
| Static market JSON -> strategy assumptions | Project data influences example ranges shown to users | Historical static index data and evidence keys |
| User-edited assumptions -> calculator | Editable rates alter future asset and cash-flow projections | Money amounts, horizon, rate assumptions |
| Projection model -> financial guidance copy | Calculated deltas influence interpretation of strategy tradeoffs | Strategy comparison outputs and benchmark deltas |
| Stored simulation list -> Shadow DOM | User-controlled names/ids appear inside DataHub | Simulation entry labels and action ids |
| Repository root -> runtime assets | Loose files can be mistaken for runtime data sources | Static CSV/data artifacts |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Tampering | `step1-connector.js` | mitigate | Step 1 payloads are normalized through Won utilities, source metadata is cached separately, and Step 2 draft edits do not write back to the Step 1 source. | closed |
| T-08-02 | Denial of Service | `storage-fallback.js` | mitigate | Step 2 save/list/load/delete first try the IndexedDB bridge, catch bridge failures, activate fallback mode, and continue through LocalStorage. | closed |
| T-08-03 | Repudiation | `feature-controllers.js` | mitigate | Storage paths return normalized entries with stable `id`/`name`; Phase 08 UAT verified save/list/load/delete and recognizable DataHub entries. | closed |
| T-08-04 | Tampering | `comparison-calculator.js` | mitigate | Calculator clamps years/rates, sanitizes money with shared utilities, keeps Won-unit calculations, and returns signed benchmark deltas. | closed |
| T-08-05 | Repudiation | `assumptions.js` | mitigate | Internal defaults are separate from display ranges, and user-facing copy labels assumptions as conservative examples, not guaranteed outcomes. | closed |
| T-08-07 | Repudiation | `renderers.js` | mitigate | KPI/cards/guidance show benchmark deltas, opportunity cost, cash-flow tradeoffs, and non-guarantee framing instead of absolute advice. | closed |
| T-08-08 | Tampering | `data-hub-modal.js` | mitigate | Simulation rows are backed by DataHub event flow and Phase 08 verification confirmed user-controlled names/ids are rendered safely with DOM APIs/text content rather than executable HTML. | closed |
| T-08-09 | Denial of Service | `styles.css` | mitigate | Phase 08 verification and UAT cover mobile order, document overflow, chart bounds, contained detail-table scroll, and stable responsive layout. | closed |
| T-08-10 | Repudiation | `public/data/indices/README.md` | mitigate | Market-data README documents `qqq.json`, `spy.json`, `schd.json`, and the boundary between static evidence and editable assumptions. | closed |
| T-08-11 | Tampering | root CSV cleanup | mitigate | Verification confirmed runtime paths do not reference loose root QQQ CSV files and the root CSV artifacts are absent. | closed |
| T-08-SC | Tampering | npm installs | accept | No package install was planned or required for Phase 08; dependency surface did not change. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-SC | Phase 08 did not require dependency installation, so npm supply-chain tampering was accepted as non-applicable for this phase. | GSD security verification | 2026-06-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-19 | 11 | 11 | 0 | Codex / gsd-secure-phase |

---

## Evidence

- Plan-time threat models were present in `08-01-PLAN.md`, `08-02-PLAN.md`, `08-03-PLAN.md`, and `08-04-PLAN.md`.
- Phase summaries reported no additional Threat Flags beyond the planned trust boundaries.
- `08-VERIFICATION.md` verified 22/22 must-haves, including storage fallback, Step 1 import/reset boundaries, calculator sanitization, safe DataHub rendering, mobile overflow checks, market-data documentation, and root CSV cleanup.
- `08-UAT.md` completed 7/7 user-observable checks with 0 issues.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-19
