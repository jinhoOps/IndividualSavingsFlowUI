# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.5.2 - Core application logic and type definitions in `src/`
- JavaScript (ES6+) - Legacy modules and shared utilities in `apps/` and `shared/`

**Secondary:**
- Python 3.x - Data generation scripts in `scripts/` (e.g., `scripts/generate_market_data.py`)
- CSS (Tailwind CSS 4.0 alpha) - Styling throughout the application

## Runtime

**Environment:**
- Browser - Modern web browsers (Chrome, Edge, Safari, Firefox)
- Node.js 20.x+ - Build environment and development tools

**Package Manager:**
- npm - Version 10.x+
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.5 - UI component framework
- Vite 5.3.1 - Build tool and development server

**Testing:**
- Vitest 4.1.5 - Unit and integration testing framework

**Build/Dev:**
- @tailwindcss/vite 4.0.0-alpha.13 - Styling engine
- vite-plugin-pwa 0.21.1 - PWA generation and management

## Key Dependencies

**Critical:**
- `react` 19.2.5 - Component library
- `vite` 5.3.1 - Build orchestrator

**Infrastructure:**
- `IsfStorageHub` - Custom IndexedDB wrapper for local state persistence (`shared/storage/hub-storage.js`)
- `IsfShare` - Custom LZ-based state compression and sharing utility (`shared/core/share-utils.js`)

## Configuration

**Environment:**
- Client-side configuration via `vite.config.ts`
- `__APP_VERSION__` defined during build for runtime version checks

**Build:**
- `vite.config.ts` - Main build configuration
- `tsconfig.json` - TypeScript compiler settings
- `scripts/sync-version.js` - Post-version-bump synchronization script

## Platform Requirements

**Development:**
- Node.js, npm, Python 3.x

**Production:**
- Static file hosting (GitHub Pages)
- PWA-compatible environment (Service Worker support)

---

*Stack analysis: 2026-05-12*
