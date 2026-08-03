# Current Integrations

ISF has no required server account, bank connection, or market-data integration.

## Browser Storage

- Main repository coordinates current and pending local state.
- `src/core/storage/IsfStore.ts` provides IndexedDB storage used by compatibility paths and history.
- LocalStorage remains part of startup and recovery compatibility.
- JSON import/export is an explicit user-controlled boundary.

## App Journey

- Main creates a minimal `JourneySnapshot`.
- Detailed Simulation reads current Main saving and investment directly through a read-only adapter on every entry; it does not write back.
- Detailed Portfolio reads current Main investment directly through a read-only adapter and keeps its allocation in Portfolio-only local keys.
- Account Map readiness owns no detailed import contract yet.

## PWA

The current React entry participates in existing manifest and service-worker routing. Route changes must verify both online navigation and installed/offline path behavior.

## Explicitly Absent

- no financial institution API
- no authentication service
- no remote user database
- no real-time quote provider
- no analytics requirement documented as part of the product contract
