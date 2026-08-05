# Current Integrations

ISF has no required server account, bank connection, or market-data integration.

## Browser Storage

- Main repository coordinates current and pending local state.
- `src/core/storage/IsfStore.ts` provides IndexedDB storage used by compatibility paths and history.
- LocalStorage remains part of startup and recovery compatibility.
- Main removes `isf-journey-snapshot-v1` on startup without reading, parsing, or migrating it; removal is best-effort.
- JSON import/export is an explicit user-controlled boundary.

## App Journey

- Launcher links and CTAs perform URL navigation only and persist no transfer payload.
- Detailed Simulation reads the latest Main saving and investment directly through a read-only adapter on every entry; it does not write back.
- Detailed Portfolio reads the latest Main investment directly through a read-only adapter and keeps its allocation in Portfolio-only local keys.
- Account Map alone is readiness-only and reads or stores no Main or transfer data.

This boundary is approved in the [Journey Snapshot Retirement Spec](../../docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md).

## PWA

The current React entry participates in existing manifest and service-worker routing. Route changes must verify both online navigation and installed/offline path behavior.

## Explicitly Absent

- no financial institution API
- no authentication service
- no remote user database
- no real-time quote provider
- no analytics requirement documented as part of the product contract
