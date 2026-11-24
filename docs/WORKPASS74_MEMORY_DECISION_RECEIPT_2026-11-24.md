# WorkPass74 — Memory decision evidence receipt

**Date:** 24 November 2026  
**Repository:** `ailtron1ss-rgb/NK1`  
**Aspect branch:** `aspect/autonomy-verified-agency-outcome-loop-20261124-r2`  
**Integration PR:** [#1168 — Verify agency credit against executed outcomes](https://github.com/ailtron1ss-rgb/NK1/pull/1168)  
**Source base:** `workpass70-source` @ `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`

## Problem

Memory retrieval and memory-to-world-model application were visible in their respective subsystem snapshots, but the selected `OrganismDecisionTrace` did not retain an exact read receipt for the memories consumed in its own tick. The memory/world causal projection was tick-bound, not decision-bound. This made it harder to answer a fundamental audit question: *which exact memories were available to this decision, and which memory/world-model application was associated with it?*

## Implementation

### Decision-owned read receipt

`DecisionMemoryEvidenceReceipt` is an optional field on the canonical `OrganismDecisionTrace`. For each full-path decision it stores:

- a per-read receipt ID and tick;
- SHA-256 of the query, without persisting the raw query text;
- query origin class (`observation-text`, `active-goal-fallback`, or `context-fallback`);
- whether retrieval was skipped, empty, or produced results;
- the bounded retrieved canonical memory IDs and count;
- whether the retrieved evidence was applied to the world model;
- the matching memory/world causal link ID and its internal counterfactual delta/influence.

The receipt records the actual `advancedRetrieved` output selected for that tick; it does not infer retrieval from old cached projections. The same record remains attached to the decision trace through the Core snapshot/restore path.

### Decision-bound causal link

`MemoryWorldCausalBridge.bindDecision(linkId, decisionId)` binds the existing memory/world projection to the exact selected decision. The bridge remains a projection/diagnostic owner; it does not create a second memory store or action ledger. The optional `decisionId` survives bridge restore. Rebinding one link to a different decision is rejected.

The shared `decisionId` is the correlation key used by the existing SelfAuthorship pending ledger, ActionGateway receipt, and CEF receipt projection. The memory receipt itself remains owned by the decision trace rather than being copied into each subsystem.

### Interpretation boundary

`influenceBasis='internal-counterfactual-world-model'` explicitly identifies the reported delta as an internal model counterfactual. It is **not** independent external evidence that memory caused a real-world transition, and it is not a proof of metaphysical free will or consciousness. The existing compatibility status fields on the bridge were not redefined in this pass.

## Verification

Exact-head workflow:

- [WorkPass74 memory decision evidence receipt](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45423414242) — **SUCCESS**
- `MEMORY_DECISION_RECEIPT_WORKPASS74=PASS`: tick 7, one retrieved memory, decision binding present, Core restore preserved the receipt and link.
- `BIG_PASS_205_MEMORY_WORLD_CAUSAL=PASS`: existing memory/world projection and restart regression remains green.
- `metacognitive-episode-runtime: PASS`: canonical metacognitive episode and MemoryOS2 persistence still pass.

Agency/action recovery workflow:

- [Agency outcome closure integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45423433057) — **SUCCESS**
- Existing verified SelfAuthorship, spine-only parity, ActionGateway lost-ACK recovery, CEF decision-reference, intrinsic goal genesis, motivation/consent, planner/gateway and B273 goal lifecycle regressions passed.

## Status and limits

- Implemented on the existing aspect branch; PR #1168 remains Draft/open and unmerged.
- `main`, `workpass70-source`, and Release assets were not modified.
- This pass closes the traceability seam from retrieved memory to a specific selected decision and its existing memory/world counterfactual. It does not establish independent retrieval uplift, 10k/100k scale, physical Android/provider behavior, or full Prototype 0.1 readiness.
