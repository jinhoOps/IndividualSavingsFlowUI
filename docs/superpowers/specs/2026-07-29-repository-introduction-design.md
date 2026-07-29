# Repository Introduction Design

## Goal

Separate the public repository introduction into two layers:

1. GitHub description: a natural one-sentence explanation of the product.
2. README opening: a fuller explanation of the planning concept and how present money flows connect to future asset decisions.

## GitHub Description

Use:

> 지금의 돈 흐름을 이해하고, 더 나은 미래 자산 계획을 세우는 개인 재무 플래닝 도구.

The description must avoid implementation terms, page names, and feature enumeration.

## README Opening

Add a `제품 컨셉` section near the beginning of README. It must explain that ISF:

- starts by making the user's current income, spending, savings, investment, and account flows understandable;
- uses explicit assumptions to compare how assets and cash flow may change over several years;
- connects that comparison to an actionable portfolio and account structure;
- is a planning aid, not a promise, prediction, or financial recommendation.

The existing Main, Simulation, Portfolio, and Account Map descriptions remain below as the concrete product structure.

## Acceptance Criteria

- The GitHub description reads naturally without technical terminology.
- The README explains both current financial-flow understanding and future expected-asset planning.
- Expected results are framed as assumption-based comparisons rather than guaranteed outcomes.
- Existing product boundaries and documentation links remain unchanged.
