# Roadmap gaps to target — WorkPass54 (2026-10-17)

## Implemented in code this pass

1. **No single UI path to resolve all API approval challenges.** Added `ActionApprovalCenter` at the root app route; API calls that receive a structured 403 `approvalRequired` now await a visible owner decision rather than throwing into unrelated component-specific handlers.
2. **Approval could be granted without resuming its originating action.** `api.ts` captures the exact method/path/body in a closure and, after canonical resolve succeeds, resends that original JSON request once with the approved one-time ticket. The preview is display-only and is never used to reconstruct action input.
3. **Competing resolver buttons could race.** Runtime Atlas no longer directly resolves pending tickets. It remains a read-only status/history view; only the global center can resolve live API calls in the current tab.
4. **Sensitive request bodies could be persisted in browser state if the queue were made durable.** The continuation remains in module memory only; UI subscriptions expose only the canonical server-provided redacted preview. No localStorage/sessionStorage write was introduced.
5. **Missing/failed owner decision could accidentally re-run an operation.** A declined, expired, duplicate or failed continuation rejects the originating promise and does not automatically retry. The single-use ticket remains owned by ActionGateway. Malformed/far-future expiry values and non-replayable/non-object request bodies are rejected before the UI offers a continuation.
6. **Approval behavior was isolated to only a few hand-coded surfaces.** The request wrapper recognizes the shared structured challenge contract across POST-based tool, project, research, voice, outbound and chat routes, rather than introducing another endpoint-specific permission owner. Existing specialized components stay compatible as fallback.
7. **Source governance pattern not connected to live interaction.** Adapted the fail-closed no-approver-means-no-consent principle in retained Hexis `core/tools/policy.py` and `tests/core/test_approval_gate.py`; intentionally did not reuse its implicit CHAT-approval exception. The MIT license is retained with immutable source.

## Remaining functional gaps

1. **Orphaned approval lifecycle:** after a tab reload, the server may retain a pending ticket while the memory-only continuation is lost. Reissuing the same exact action can rebind to the still-pending fingerprint; otherwise the five-minute server TTL expires it. Make this recovery discoverable without persisting sensitive request inputs and never auto-resume a side effect after reload.
2. **True browser acceptance:** install from app lockfile, build Vite production assets, then test approve, decline, expiry, altered request, and provider errors in a real browser on mobile/desktop.
3. **Action challenge diversity:** audit each protected route for stable challenge shape and exact fingerprint parity on resubmission, especially compound actions that can require a second approval after the first operation succeeds.
4. **Real provider/device receipts:** local action approvals do not prove external postconditions. Need live integration/device trials, timeouts, reconnect and ambiguous-state reconciliation.
5. **Embodied speech:** replace approximate word-boundary mouth updates with actual audio time/envelope or phoneme/viseme timing and ensure interruption resets the renderer.
6. **Memory retrieval:** keep current algorithm unpromoted until a frozen independent labelled holdout beats the BM25 baseline with stable Recall@k/MRR, latency and false-recall results. Existing broad recallDelta remains 0.
7. **Release durability:** clean-room restore/rollback, complete nested source/license audit and multi-hour soak. Official weighted score remains 78.0%.

## Rules preserved

- One durable permission owner: `ActionGateway`.
- No tool body or private fingerprint in UI/public API.
- Browser continuation is ephemeral by design; approval only authorizes one matching attempt, never success.
- Legacy, UI, Live2D, source archives and all baseline files are preserved.
