# Current Stack

- React 19.2
- TypeScript 5.5
- Vite 5.3
- Tailwind CSS 4 alpha through the Vite plugin
- Vitest 4 with Testing Library and jsdom
- Playwright 1.60
- IndexedDB and LocalStorage for local-first persistence
- Vite PWA plugin and retained service-worker compatibility

Required commands:

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
```

`npm run build` mutates versioned manifest/service-worker files through `scripts/bump-version.js` and `sync-version`; inspect those effects before using it as a documentation-only verification.

Legacy vanilla JavaScript remains under `apps/` and `shared/legacy/`. Its presence does not make it part of the supported stack for new features.
