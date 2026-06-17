# Runtime Market Evidence Data

`public/data/indices/` is the runtime evidence location for Step 2 conservative learning ranges.

- `qqq.json` is the Nasdaq/growth evidence file used for the QQQ benchmark context.
- `spy.json` is the S&P 500 evidence file used for the broad index benchmark context.
- `schd.json` is the dividend-growth evidence file used for the SCHD context.

These files support conservative example ranges for education and comparison. They are not live market feeds, current ETF quotes, or guaranteed return sources.

JEPI, QQQI, and DIVO do not have runtime historical JSON evidence files in this project. Their Step 2 values are resolved as editable conservative product assumptions in `apps/simulation/modules/assumptions.js`, including display ranges for cash-flow yield, distribution growth, and capital growth. Those assumptions are the boundary for covered-call/monthly-income examples until a future data-source phase intentionally adds a documented market-data pipeline.

The generation scripts write runtime market data back into this directory:

- `scripts/generate_qqq_data.py` generates `qqq.json`, `qld.json`, and `tqqq.json`.
- `scripts/generate_market_data.py` converts supported monthly JSON files in this directory to daily runtime JSON.

Step 2 runtime code must continue to use `public/data/indices/*.json` and `assumptions.js`; it should not depend on loose root-level CSV backdata files.
