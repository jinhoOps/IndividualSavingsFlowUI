# Current Integrations

ISF has no required server account, bank connection, or market-data integration.

## Browser Storage

- Main repository coordinates current and pending local state.
- `src/core/storage/IsfStore.ts` provides IndexedDB storage used by compatibility paths and history.
- LocalStorage remains part of startup and recovery compatibility.
- JSON import/export is an explicit user-controlled boundary.

## App Journey

- Main creates a minimal `JourneySnapshot`.
- Simulation readiness reads the snapshot and can refresh it from Main.
- Portfolio readiness receives the same minimum contract.
- Account Map readiness owns no detailed import contract yet.

## PWA

The current React entry participates in existing manifest and service-worker routing. Route changes must verify both online navigation and installed/offline path behavior.

## Explicitly Absent

- no financial institution API
- no authentication service
- no remote user database
- no real-time quote provider
- no analytics requirement documented as part of the product contract
