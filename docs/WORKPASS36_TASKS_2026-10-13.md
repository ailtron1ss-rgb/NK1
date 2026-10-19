# WorkPass36 — operational tasks and progress — 2026-10-13

**Implementation progress:** 92/100  
**Weighted release readiness:** 72.9% (separate official measure; unchanged).

## Completed in this pass

- [x] Align embedded release contract with canonical runtime version 35.58.0 / schema 224; verify migration from schema 223.
- [x] Reuse compact WorkPass35 optimized base and transfer verified late WorkPass35 fixes.
- [x] Consolidate common FNV/cosine primitives while retaining behavior-specific numeric semantics.
- [x] Centralize shared action-cost policy and verify parity for seven actions.
- [x] Consolidate stable serialization/hashing across WILL/Letta/Lumina/Hexis/Conscio; preserve historical fingerprint bytes.
- [x] Consolidate Lumina/Conscio Unicode tokenization with explicit source-compatible separators.
- [x] Apply WILL before P69 and require verified outcomes for competence promotion.
- [x] Bound MemoryOS2 revision history, sanitize legacy snapshots and include revision bytes in memory budgeting.
- [x] Preserve Legacy memory lineage without unresolved canonical graph links.
- [x] Index memory relation candidates and compare results with previous semantics.
- [x] Repair source archive and historical snapshot manifests using immutable SHA-256 source blobs.
- [x] Retain unique source ZIPs, Legacy UI/avatar, sprites and Live2D assets.
- [x] Update changelog, architecture/status, integration matrix, scorecard and backlog.

## Still open; do not mark done on static evidence alone

- [ ] Install app dependencies in an environment where the install completes; run `npm run typecheck` and full production Vite build. Current attempt timed out at 120 seconds; `@types/node` and `vite/client` missing from the current environment.
- [ ] Complete true browser UI/Live2D clean-room E2E, including asset fallback and restart/recovery.
- [ ] Raise behavioral evidence for meaningful functions: current inventory is 5,876 functions, with 31 VERIFIED and 5,467 UNVERIFIED. Prioritize runtime/public paths and workflows; do not try to auto-execute unsafe methods indiscriminately.
- [ ] Run independent labelled temporal retrieval holdout and require evidence before retrieval promotion.
- [ ] Exercise real provider action → independent postcondition → reafference, including duplicate receipt, restart and exactly-once cases.
- [ ] Test real local model loading, latency, CPU/RAM/VRAM budget on target hardware.
- [ ] Run clean-room restore/rollback and a sustained resource soak; obtain release candidate sign-off.

Progress must only increase when an implementation deliverable or a meaningful end-to-end proof is completed. Green syntax/structural audits alone do not close behavioral requirements.
