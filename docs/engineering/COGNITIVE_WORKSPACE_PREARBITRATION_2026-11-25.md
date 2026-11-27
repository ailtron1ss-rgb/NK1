# NK1 — Global workspace pre-arbitration integration

Date: 2026-11-27
Canonical base: `workpass70-source@763631c5bc0add96cc2e0b1640e946ef4e8924ce`
Aspect PR: #1186 — existing cognitive-workspace aspect branch, transplanted onto the current source line.

## Defect

The operational cognitive cycle invoked `CognitiveKernelCoordinator.integrateAndArbitrate()` before running the global workspace competition. Consequently, P61/P64 could only receive the persisted consciousness ignition value from an earlier stage/cycle; the coalition computed for the current candidate set was produced later and could not influence that decision.

## Change

- Move the single global workspace competition to the point after governed decision candidates are formed and immediately before the coordinator arbitration.
- Feed the same-cycle `globalWorkspace.ignition01` directly to `integrationSignals.workspace01`.
- Apply a small coalition membership support only to selected governed candidates, with a per-candidate upper bound of 0.03.
- Keep the existing Memory `workspaceV2` separate and unchanged; no second workspace owner is introduced.
- Keep all downstream arbitration inside the existing CognitiveKernelCoordinator.

## Acceptance

The dedicated test instruments the real `OrganismCore.observe()` path and checks:
1. workspace competition occurs before P61/P64 arbitration;
2. exactly one global workspace competition runs;
3. the exact ignition scalar from that competition is consumed by arbitration;
4. selected candidates receive positive but bounded support, while non-selected candidates receive none.

This mechanism is an engineering implementation of a bounded global-workspace hypothesis. It does not detect or prove consciousness or subjective experience.

## Verification status

- Test-first checkpoint: `9139591c97798bde77fef23c53ee6d21aaa57439` (test/workflow/package wiring only; exact-head CI was started).
- Production change is in the subsequent commit on this aspect PR. Exact-head checks must complete before merge.
- No changes to `main` or Release tags/assets are included.


## Multi-domain attention and bounded admission

The existing **GlobalWorkspaceSubstrateV2** remains the single workspace owner. The current OrganismCore cycle now submits compact, typed summaries from:

- perception / prediction error / uncertainty;
- memory grounding;
- world-model alignment and reality gap;
- motivation / energy / cognitive load;
- social inference;
- self-model continuity;
- embodiment / thermal and energy state;
- governed decision candidates.

These summaries do not write factual memory, authorize actions, or create a second state store. The normal **CognitiveKernelCoordinator** remains the action-arbitration owner.

Candidate admission is bounded to a 512-row input scan and 64 unique ranked candidates. Repeated IDs collapse to the strongest row. A first-pass per-source quota protects represented domains; remaining slots are filled by global score. The final attention coalition is source-balanced as well, and explicitly preserves the leading decision row when one exists. Admission diagnostics expose input, unique, admitted, invalid, duplicate and overflow counts plus per-source counts.

## Decision-scoped feedback and persistence

The previous immediate workspace learner used the live selected coalition. That was unsafe for delayed feedback: a later observe() could replace the coalition before an earlier action result arrived.

The workspace now persists a bounded decision receipt against the exact OrganismDecisionTrace.id:

- decision ID, action, tick and timestamp;
- selected coalition IDs, source labels, normalized weights and decision-time features;
- candidate action provenance and eligibility;
- up to eight outcome IDs already applied to that decision.

OrganismCore.feedback() accepts optional decisionId and outcomeId fields. With an explicit decision ID it resolves that exact historical trace; an unknown ID fails closed rather than falling back to the newest trace. If omitted, the prior latest-trace behavior remains as the compatibility default.

The workspace learner uses only the decision-time receipt. It cannot borrow the most recent live coalition. Replaying the same outcome ID is idempotent, an outcome ID cannot be reassigned to another retained decision, an unknown decision is rejected, and a persisted eligibility bit is recomputed from the saved source and candidate action. The canonical temporal-credit authority receives the same outcome ID, preserving its exact-decision attribution and replay contract. Receipt and learning counters are part of the existing workspace snapshot, so restore continues to use the same canonical persistence owner.

The receipt buffer is capped at 64 decisions and each receipt at eight outcome IDs. If the buffer is full, eviction is counted in expiredDecisionReceipts; it does not silently create credit for another decision.

## Acceptance coverage added

The focused workspace test now covers:

1. current-cycle competition before P61/P64, exactly once, with the exact same-cycle ignition consumed by arbitration;
2. bounded, deterministic and duplicate-safe admission, including late high-salience candidates;
3. cross-source admission and final coalition representation;
4. decision-time coalition capture, snapshot/restore, and delayed reward after a newer competition;
5. outcome ID replay, cross-decision outcome ID reuse, unknown decision rejection, and invalid learning-rate safety;
6. tampered persisted eligibility / action provenance failing closed;
7. the actual OrganismCore delayed-feedback path selecting an earlier decision by ID.

## Verification and scope boundaries

The branch remains Draft / open / unmerged. The latest exact-head dedicated Actions run must complete before claiming these new contracts pass. Earlier successful runs on earlier heads are not inherited as proof for the current head.

No measured phone latency, Android/Termux power-loss durability, independent review, or end-to-end production acceptance is claimed. The workspace and credit receipts are bounded engineering mechanisms; they are not a consciousness detector and do not establish subjective experience. `main` and Release tags/assets remain untouched.

## Cross-tick CEF lineage and outcome finalization

Each decision trace now carries the CEF event IDs created by its own operational cycle: observation, prediction, appraisal, attention, memory, goal, plan and action. These IDs are copied into the decision trace before it is returned, so a later observation cannot replace the historical anchors.

For a delayed feedback call:

- the caller supplies the exact decisionId and stable outcomeId;
- the outcome event is appended at the actual feedback tick, but its parent links point to the original decision's prediction/action events;
- learning and self-update events are linked to that outcome and carry the same decision/outcome identities;
- the metacognitive episode retains both decisionTick and outcomeTick;
- a delayed outcome does not close, increment, or clear the newer active operational cycle.

The CEF metacognitive episode contract permits a later outcome/learning tick while requiring the action and original observation/prediction anchors to remain on the decision tick. Current-tick feedback still uses the strict full-cycle verification path.

**Replay contract:** an outcome event ID and a separate feedback-finalization event ID are deterministic from (decisionId, outcomeId). Replaying an already finalized outcome with the same input fingerprint returns before re-running feedback learners. Reusing an outcome ID for a different decision or changing the content under an existing identity is rejected. The finalization marker is written only after the feedback projections complete, and the CEF snapshot is persisted with it.

The replay guard is bounded by the retained CEF/event and workspace receipt windows; this is not an unlimited global idempotency database. Cross-process exactly-once behavior beyond retained checkpoints and independent Android power-loss testing remain separate acceptance gates.
