# Shared Foundation Responsive QA Evidence

## Run provenance

On 2026-08-24, a one-off Playwright API smoke harness ran against a local Vite server at the exact required viewports: 390×844, 768×1024, and 1280×900. It seeded the supported Main, Simulation, and Portfolio workspace state. For Account Map it followed the supported UI to create the named income account and then opened the account-map surface. The harness set `reducedMotion: 'reduce'`, measured `getBoundingClientRect()` after layout settled, checked `scrollWidth === innerWidth`, stepped focus with three real `Tab` presses, and counted visible buttons with missing accessible names or a visible 44px-short dimension.

`x/w/r` below means `x / width / right` in CSS pixels. Every row was visually inspected in the live browser during this run. The temporary screenshots used for that inspection were deliberately not treated as durable evidence; this tracked log contains the reproducible measured result.

| App / route | Viewport | Frame x/w/r | Card x/w/r | Stage x/w/r | Scroll | Launcher | Buttons (visible / unnamed / undersized) | First three Tab focus targets | Reduced-motion observation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Main `/apps/main/` | 390×844 | 16/358/374 | 16/358/374 | 99/192/291 | 390=390 | outside frame | 14 / 0 / 0 | `a:자금 흐름 (Main), 현재 위치` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Simulation `/apps/simulation/` | 390×844 | 16/358/374 | 16/358/374 | 33/324/357 | 390=390 | outside frame | 7 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation), 현재 위치` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Portfolio `/apps/portfolio/` | 390×844 | 16/358/374 | 16/358/374 | 16/358/374 | 390=390 | outside frame | 2 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio), 현재 위치` | reduced; visible final state |
| Account Map `/apps/account-map/` map | 390×844 | 16/358/374 | 17/356/373 | 17/356/373 | 390=390 | outside frame | 12 / 0 / 0 | `button:목적 중심` → `button:계좌 중심` → `button:축소` | reduced; visible final state |
| Main `/apps/main/` | 768×1024 | 16/736/752 | 16/736/752 | 288/192/480 | 768=768 | outside frame | 14 / 0 / 0 | `a:자금 흐름 (Main), 현재 위치` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Simulation `/apps/simulation/` | 768×1024 | 16/736/752 | 16/736/752 | 40/688/728 | 768=768 | outside frame | 7 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation), 현재 위치` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Portfolio `/apps/portfolio/` | 768×1024 | 16/736/752 | 16/736/752 | 16/736/752 | 768=768 | outside frame | 2 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio), 현재 위치` | reduced; visible final state |
| Account Map `/apps/account-map/` map | 768×1024 | 16/736/752 | 17/734/751 | 17/734/751 | 768=768 | outside frame | 12 / 0 / 0 | `button:목적 중심` → `button:계좌 중심` → `button:축소` | reduced; visible final state |
| Main `/apps/main/` | 1280×900 | 256/768/1024 | 256/768/1024 | 544/192/736 | 1280=1280 | outside frame | 14 / 0 / 0 | `a:자금 흐름 (Main), 현재 위치` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Simulation `/apps/simulation/` | 1280×900 | 256/768/1024 | 256/768/1024 | 289/702/991 | 1280=1280 | outside frame | 7 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation), 현재 위치` → `a:투자 배분 (Portfolio)` | reduced; visible final state |
| Portfolio `/apps/portfolio/` | 1280×900 | 256/768/1024 | 256/768/1024 | 256/768/1024 | 1280=1280 | outside frame | 2 / 0 / 0 | `a:자금 흐름 (Main)` → `a:미래 성장 (Simulation)` → `a:투자 배분 (Portfolio), 현재 위치` | reduced; visible final state |
| Account Map `/apps/account-map/` map | 1280×900 | 256/768/1024 | 257/766/1023 | 257/766/1023 | 1280=1280 | outside frame | 12 / 0 / 0 | `button:목적 중심` → `button:계좌 중심` → `button:축소` | reduced; visible final state |

### Selector mapping

- Main: frame `[data-testid="main-dashboard-frame"]`; card `main .ui-surface`; stage `.cashflow-donut__chart`.
- Simulation: frame `[data-testid="simulation-page-frame"]`; card `.growth-chart`; stage `.growth-chart__canvas`.
- Portfolio: frame `[data-testid="portfolio-page-frame"]`; card `.portfolio-summary`; stage `.portfolio-allocation-list`.
- Account Map: frame `main.account-map-page`; card `.account-map-canvas`; stage `.account-map-canvas__content`.

The per-app selectors name the representative visible frame/card/stage for the recorded supported state; they do not assert that all product cards share markup. Focus sequences are literal accessible role/name observations from the live page, not inferred tab-order claims.
