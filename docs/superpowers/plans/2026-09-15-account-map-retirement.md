# Account Map Retirement Implementation Plan

**Goal:** Remove the Account Map product and update current product documentation without losing existing workspace data.

**Architecture:** Retire navigation, UI, commands and app repositories. Retain workspace v5 validation, migration, backup and recovery boundaries; old app URLs redirect to Main.

**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright.

**Spec:** [Account Map retirement](../specs/2026-09-15-account-map-retirement-design.md)

## Tasks

- [x] Add failing tests for three-app navigation and old-URL redirection with existing Account Map data.
- [x] Remove app entry, UI/application/repository and unused domain consumers; preserve workspace compatibility dependencies.
- [x] Update launcher, auth destination, PWA routes, build inputs and test entry configuration. Retire obsolete app behavior tests; retain storage compatibility tests.
- [x] Update README, PRD, DESIGN and AGENTS current support claims and retirement links.
- [x] Run type/unit/full browser checks, responsive screenshots, relative links and production build; inspect remaining references and review the diff.

[검증 결과와 초기 E2E 실패의 재검증](../evidence/2026-09-15-account-map-retirement.md)
