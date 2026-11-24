# WorkPass41 — remaining tasks

## Done in this pass
- [x] Verify current cognitive cycle by six exact stage IDs, shared tick, and required causal edges.
- [x] Avoid global ring-buffer dangling refs affecting local current-cycle validity.
- [x] Sanitize restored cognitive-event snapshots without replacing legacy valid IDs.
- [x] Make memory retention use net utility, harm/redundancy and provenance regardless of overall byte pressure.
- [x] Add regression contracts and promote the formerly failing big-pass 164 retention assertion to PASS.
- [x] Align metadata to root WorkPass41 / runtime 35.63.0 / schema 225.

## Open P0
1. **UI release:** locked dependency install, full typecheck, React/Vite production build and real browser/Live2D E2E.
2. **External execution:** authoritative real provider/device receipts, reconnect/replay, ambiguity reconciliation and no-double-credit across every consumer.
3. **Recovery:** clean-room install → upgrade → injected partial commit fault → rollback → bytes/state invariants.

## Open P1
4. **Local inference:** run llama.cpp on the target GPU/CPU and measure latency, RAM/VRAM, cancellation and fallback.
5. **Memory quality:** independent labelled temporal holdout; current recall uplift is zero, so the candidate stays not-promoted.
6. **Function evidence:** behavioral evidence for critical runtime functions, not just syntax or typechecks.
7. **Endurance and licensing:** long-duration soak, repeated restarts/ledger growth and manual review of nested upstream LICENSE/NOTICE.

**Implementation progress:** 92/100. **Weighted release roadmap:** 78.0%. Neither score means release-ready.
