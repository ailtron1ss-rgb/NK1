# WorkPass40 — remaining work — 2026-10-14

## Closed in this pass
- [x] Safe state restore uses atomic maintenance lock and exact file-set replacement.
- [x] Restore rejects symlink/traversal entries and retains rollback staging after failed commit.
- [x] SBOM/provenance inventory generated for locked npm packages and embedded source archives.
- [x] Optional loopback-only llama.cpp chat provider wired into P40 Model Ecology; old snapshots safely merge provider profiles; CapabilityRegistry uses `configured-unverified` until request evidence proves reachability.
- [x] Runtime/package/release metadata aligned to 35.62.0 / schema 225 / WorkPass40.

## Open P0/P1
1. **P0 — real UI build:** run `npm run install:all`, app typecheck and `npm run build` with locked dependencies; then run browser E2E against an actual server with Live2D.
2. **P0 — external side effects:** reconcile uncertain actions against authoritative provider/device receipts and test reconnect/replay; keep unknown outcome fail-closed.
3. **P0 — recovery drill:** clean-room backup → upgrade → partial commit fault → rollback → byte/state verification.
4. **P1 — local model:** run the configured llama.cpp server on target hardware; measure latency, RAM/VRAM, cancellation, cooldown, and no-model fallback.
5. **P1 — memory quality:** independent labelled temporal holdout; current synthetic recall uplift is zero, so no promotion.
6. **P1 — function evidence:** increase semantic verification of critical runtime functions, not just source/syntax scans.
7. **P1 — endurance:** long-duration soak, repeated restart and ledger/archive growth test.
8. **P1 — licensing:** manual review of nested licenses/NOTICE files and provenance of retained upstream snapshots.

## Progress measure
Implementation progress recorded for WorkPass40: 85/100. Weighted roadmap: 77.2%. Build/E2E, target inference, external receipts, independent retrieval holdout and soak remain release blockers.
