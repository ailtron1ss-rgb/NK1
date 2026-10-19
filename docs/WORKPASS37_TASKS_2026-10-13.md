# WorkPass 37 task ledger — 2026-10-13

## Completed in this pass

- [x] `WP37-01` Persist idempotency receipts before and after canonical tool effects; fail closed on uncertain/recovery-required states.
- [x] `WP37-02` Reuse stable deterministic child idempotency keys across compound skill steps and expose request keys through project APIs.
- [x] `WP37-03` Route verified independent postconditions through `ExternalObserverFabric` and exact decision-linked temporal credit, in the same core finalization checkpoint as receipts.
- [x] `WP37-04` Add missing-shape, conflict, concurrent replay, restore, oversized response and failed receipt persistence regressions (13/13 focused cases).
- [x] `WP37-05` Align ReleaseContract, runtime manifest and package/lock version to 35.59.0/schema 225; migrate 223 and 224 states, preserve/default ledger.
- [x] `WP37-06` Fix retrieval benchmark timestamp mismatch; hold promotion because synthetic recall uplift is zero.
- [x] `WP37-07` Update one-command root/runtime audit and current integration/report/task evidence.

## P0 — next implementation pass

- [ ] `WP37-N01` Exercise provider/device action execution with independently issued remote receipts, reconnect and replay; document exactly-once boundary per provider.
- [ ] `WP37-N02` Run fixed independently labelled temporal memory holdout against BM25/fuzzy baseline, then evaluate semantic reranking without data leakage.
- [ ] `WP37-N03` Use `npm run install:all` in dependency-enabled environment, fix actual app type/build errors, run React/Vite build and browser E2E with actual Live2D interaction.
- [ ] `WP37-N04` Build clean-room restore/rollback test across schema 224 → 225 with interrupted pending side effect and reconciliation workflow.
- [ ] `WP37-N05` Audit provider transport idempotency, rate limits and auth for tool/project/step/skill APIs.
- [ ] `WP37-N06` Improve semantic verification coverage for critical functions; do not equate liveness/syntax audits with verified behavior.
- [ ] `WP37-N07` Complete multi-hour memory/resource-growth soak and final SBOM/license/source provenance sign-off.

## Progress

Implementation pass: **85/100**. Weighted roadmap release score: **73.7%**. Retrieval candidate remains unpromoted. Production build and browser/Live2D E2E remain open.
