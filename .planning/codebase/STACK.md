# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.5 - Modern core logic, storage services, and PWA management in `src/`.

**Secondary:**
- JavaScript (ES Modules) - Legacy application logic and UI controllers in `apps/` and `shared/`.
- Python 3.x - Market data generation and processing scripts in `scripts/`.

## Runtime

**Environment:**
- Browser (Modern Evergreen Browsers)
- Node.js (Build-time & Development)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19 - Modern UI components and state management (Incremental introduction).
- Vanilla JS - Legacy core modules for Step 1, 2, and 3 apps.

**Testing:**
- Vitest 4.1 - Unit and integration testing for core logic and components.

**Build/Dev:**
- Vite 5 - Primary build tool and development server.
- Tailwind CSS 4 (Alpha) - Utility-first CSS framework with native Vite integration.

## Key Dependencies

**Critical:**
- `react` / `react-dom` 19 - UI library for modernized features.
- `vite-plugin-pwa` - PWA (Progressive Web App) infrastructure and Service Worker generation.

**Infrastructure:**
- `@tailwindcss/vite` - Modern styling engine.
- `@types/node` / `typescript` - Development type safety.

## Configuration

**Environment:**
- No environment variables required (Local-First Architecture).
- Application versioning synced via `scripts/sync-version.js` from `package.json`.

**Build:**
- `vite.config.ts`: Multi-page application (MPA) setup with PWA configuration.
- `tsconfig.json`: TypeScript compiler settings for modern browser targets.

## Platform Requirements

**Development:**
- Node.js 20+
- Python 3.x (Optional, for data script execution)

**Production:**
- Static Hosting (e.g., GitHub Pages)
- HTTPS required for PWA and Service Worker functionality.

---

*Stack analysis: 2026-05-12*
