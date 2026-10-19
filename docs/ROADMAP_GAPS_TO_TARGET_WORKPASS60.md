# Roadmap gaps — after WorkPass60

1. **P0: authoritative receipt revision.** Add a versioned append-only evidence revision/supersession contract so a real provider `found` receipt can strengthen verification for the original `executionId` without mutating the original tool receipt or creating a duplicate action node. Idempotent replay must not append the revision twice.
2. **P0: restart recovery with a live adapter.** Simulate process termination after side effect and after receipt commit; restart from durable storage; read the provider state; never blindly retry an ambiguous mutation.
3. **P1: project cursor and work product integration.** Confirm project cursor/checkpoint resume does not advance step or consume budget until outcome is resolved; expose waiting/reconciliation state in the existing UI.
4. **P1: independent outcome evidence.** Validate source class/provenance/independence before outcome projection and learning credit.
5. **P1: real browser/provider E2E.** Vite/browser/Live2D, actual device/provider postconditions, reconnect and cancellation.
6. **P2: remaining release gates.** Independent memory holdout (current retrieval `recallDelta=0` and `not-promoted` remains unchanged), target-hardware inference, clean-room rollback, license sign-off and soak.

WorkPass60 is complete for its scoped code deliverables (8/8). Overall weighted roadmap score is 78.8%; release gates remain open.
