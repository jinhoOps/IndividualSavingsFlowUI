# System Integrations

## Browser APIs
- **Storage**:
  - `IndexedDB`: Primary storage for snapshots, backups, and inter-step data (`isf-hub-db-v1`).
  - `LocalStorage`: Fallback for basic settings and state persistence.
- **PWA**:
  - `Service Worker`: Offline support and caching (`sw.js`).
  - `Web App Manifest`: Installation and mobile integration (`manifest.webmanifest`).
- **URL API**:
  - `URLSearchParams` & `Hash`: Used for shareable state links.

## External Libraries
- **None (Vanilla JS)**: The project avoids external dependencies to maintain a "No-Build" environment.
- **Custom Implementations**:
  - **Sankey**: Custom SVG builder in `sankey-builder.js`.
  - **Compression**: Custom LZ-based algorithm in `share-utils.js`.

## Inter-Step Communication
- **Bridge Pattern**: Step 1 writes a "bridge payload" to a shared IndexedDB store which Step 2 reads to initialize its portfolio simulation.
