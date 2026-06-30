---
status: complete
quick_id: 260630-fm9
date: 2026-06-30
commit: 30a4315
---

# Quick Task Summary

Main now keeps the lightweight `계좌 관리 맵` entry immediately after `월 가계 흐름` in both DOM and CSS grid order.

The Main-only `계좌 간 수동 이체 설정` editor section was removed, while existing manual-transfer data compatibility remains covered through the source-account network flow regression test.

Verification:
- `npm run check`
- `npx playwright test tests/step1.spec.ts -g "Phase 09 source account automatic flow|Phase 10.8 Account Map Main entry and compatibility"`
