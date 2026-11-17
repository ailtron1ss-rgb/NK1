# Dyadic Mind — design

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — Dyadic Mind / Совместный интеллект человека и NK1  
**Status:** Runtime + authenticated host API implementation; exact-head CI pending.

## Intent

Give a person and NK1 a persistent, inspectable shared view of their work without merging their personal states. The shared view carries goals, tasks, agreements, questions, success criteria and decisions across dialogue turns. Each artifact retains its author and source provenance internally.

## Goals

- Preserve a bounded collaboration record across runtime restart.
- Distinguish human-authored accepted context from system-authored proposals.
- Require explicit human confirmation before a system proposal becomes shared agreement.
- Keep task progress, authorship, evidence references and corrections auditable.
- Expose a small, labelled collaboration projection to the cognitive prompt without treating it as instructions.
- Reuse the canonical self subsystem, checkpoint/restore pipeline and host authentication.
- Make the collaboration state accessible to an authenticated app client.

## Non-goals

- No second memory store, planner, autonomous executor, database or external service.
- No merge of the human's personal state with NK1's self state.
- No automatic agreement, external action or implicit tool consent.
- No client-controlled author, sensitivity label, timestamp or evidence reference.
- No claim of a human-like shared consciousness; this is a software coordination record.

## Approaches considered

1. Extend UserModelEvidenceModel. Rejected: that owner is intentionally limited to explicit low-risk personal preferences and forgetting semantics.
2. Add another MemoryOS2 collection. Rejected: collaboration state has authorization transitions and provenance requirements, not memory retrieval/lifecycle semantics.
3. Add a bounded DyadicCollaborationWorkspace under SelfSubsystemRuntime. Chosen: separate domain model, same canonical persistence owner, existing checkpoint/restore and serialized runtime command queue.
4. Add a new database or collaboration backend. Rejected: unnecessary duplication and new operational secrets.

## Data and authorization model

- Artifact types: goal, task, agreement, question, success-criteria and decision.
- Author: human or system. Lifecycle: proposed, accepted, rejected.
- Human-authored records are accepted because the write itself is an explicit human act. System-authored records always start proposed.
- Only a human may accept/reject a proposal, correct a shared item, or mark a task completed.
- Every mutation requires a non-empty evidence reference and a valid non-negative safe-integer tick.
- Duplicate evidence, stale transitions, sensitive/unclassified inputs and capacity overflow fail closed.
- The HTTP host derives actor=human, source/evidence IDs, tick and low-risk classification; client-supplied provenance fields are ignored.
- HTTP writes require confirmed=true for every mutation.
- HTTP responses expose a redacted item projection only; internal evidence references and event records are not returned.
- Restore reads own data properties only; malformed/accessor-backed snapshots reset safely.

## Integration boundaries

- SelfSubsystemRuntime owns the workspace and snapshot/restore lifecycle.
- AdvancedDevelopmentFacet carries the optional typed snapshot.
- PersistenceProjectionCoordinator writes the snapshot in the existing critical projection group.
- OrganismCore checkpoints writes and joins the collaboration projection with existing user prompt context.
- OrganismRuntime serializes mutation and read operations through its existing queue.
- Existing cognitive language prompt paths receive accepted context and explicitly labelled unconfirmed proposals.
- The authenticated server endpoint is /api/organism/dyadic-collaboration and uses the existing authorizeApiRequest policy, rate limit and bearer token.
- MemoryOS2 remains the sole canonical memory owner. Existing project planning/execution remains authoritative; Dyadic Mind records coordination and does not execute actions.

## HTTP contract

- GET returns a redacted summary and current items.
- POST action=record creates a human-authored item.
- POST action=confirm or action=reject resolves a pending system proposal.
- POST action=correct edits an accepted item with a new human evidence event.
- POST action=progress updates an accepted task; completed requires the human's explicit confirmation.
- All POST actions require confirmed=true. The server never trusts client-supplied actor, tick, sensitivity, sourceRef or evidenceRef.
