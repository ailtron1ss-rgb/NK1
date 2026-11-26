# NK1 — Global workspace pre-arbitration integration

Date: 2026-11-26
Canonical base: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
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
- No changes to the canonical source branch, `main`, releases, or the immutable `gearonone.zip` baseline are included.


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

No measured phone latency, Android/Termux power-loss durability, independent review, or end-to-end production acceptance is claimed. The workspace and credit receipts are bounded engineering mechanisms; they are not a consciousness detector and do not establish subjective experience. main, Release tags/assets and immutable gearonone.zip remain untouched.
