# WorkPass38 tasks — 2026-10-14

## Completed
- [x] Sidecar append-only action receipt archive with SHA-256 validation, fsync and indexed reads.
- [x] FileStateStore/OrganismCore startup integration.
- [x] Refuse keyed execution without durable persistence.
- [x] Move in-flight reservation before async archive reads; serialize capacity admission.
- [x] Stop silently evicting keys and slicing restored snapshots; detect snapshot conflicts.
- [x] Stress 40 actions through two archive batches and restart; no side-effect replay.
- [x] Recover incomplete final line; fail closed on completed-line checksum corruption.
- [x] Synchronize runtime package/lock/version contract to 35.60.0/schema 225.

## Newly completed integration gates
- [x] Runtime TypeScript typecheck and `/api/health` ledger metrics smoke.
- [x] Release metadata 34/34 and contract 6/6.
- [x] Browser-smoke verdict contract 51/51; app script tests 212/212.
- [x] UI/API linkage, assets, server imports, architecture, source hygiene and executable syntax audits.
- [x] Memory compatibility, ActionCostPolicy, StableSerialization, outcome verification and Lumina/Hexis/Letta/Conscio/WILL adapters.
- [x] Retrieval benchmark rerun with matched temporal semantics; no positive uplift, so candidate remains not-promoted.

## Open — next pass priorities
- [ ] Add real provider/device-specific `queryOutcome` reconciliation for pending receipts; `unknown` must stay fail-closed.
- [ ] Finish production dependency install and Vite build (currently blocked because `app/node_modules` is absent; `vite` executable is unavailable), then browser Live2D E2E.
- [ ] Run clean-room restore/upgrade/rollback with archive sidecars included in backup/restore tooling.
- [ ] Independent labeled temporal retrieval holdout and model/provider inference evidence; no retrieval candidate promotion until positive results.
- [ ] Long-running soak with archive growth, compaction/recovery and file permission/disk-full conditions.
- [ ] Reduce semantic UNVERIFIED backlog via high-value behavior proofs, not just static checks.
