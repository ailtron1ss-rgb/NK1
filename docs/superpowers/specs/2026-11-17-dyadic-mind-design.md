# Dyadic Mind — design

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — “Dyadic Mind / Совместный интеллект человека и NK1”  
**Status:** First implementation slice; human/system collaboration artifacts only.

## Intent

Give a person and NK1 a persistent, inspectable shared view of their work without merging their personal states. The shared view should carry goals, tasks, agreements, questions, success criteria, and decisions across dialogue turns. Every artifact must retain who authored it and which source event supports it.

## Goals

- Preserve a durable, bounded collaboration record across runtime restart.
- Distinguish human-authored accepted context from system-authored proposals.
- Require explicit human confirmation before a system proposal becomes shared agreement.
- Keep task progress, authorship, evidence references, and corrections auditable.
- Expose a small, labelled collaboration projection to the cognitive prompt without treating proposals as instructions or facts.
- Reuse the canonical self subsystem and existing checkpoint/restore pipeline.

## Non-goals for this first slice

- No second memory store, planner, autonomous executor, database, or external service.
- No merge of the human's personal state with NK1's self state.
- No automatic agreement, external action, account/permission workflow, or implicit tool consent.
- No new app UI or public HTTP route in this slice.
- No claim of a human-like shared consciousness; this is a software coordination record.

## Approaches considered

1. Extend UserModelEvidenceModel. Rejected: that owner is intentionally limited to explicit low-risk personal preferences and forgetting semantics. Project/task agreements would violate its data model.
2. Add another MemoryOS2 collection. Rejected: collaboration state has authorization transitions and provenance requirements, not memory retrieval/lifecycle semantics; it would create a second source of truth for project state.
3. Add a bounded DyadicCollaborationWorkspace under SelfSubsystemRuntime. Chosen: separate domain model, same canonical persistence owner, same checkpoint/restore and serialized runtime command queue. This allows independent policy and tests without duplicating memory or planner behavior.

## Data and authorization model

- Artifact types: goal, task, agreement, question, success-criteria, decision.
- Author: human or system. Lifecycle: proposed, accepted, rejected.
- A human-authored item is accepted because the write itself is an explicit human act. A system-authored item always starts proposed.
- Only a human may accept/reject a proposal, correct a shared item, or mark a task completed.
- System progress updates may move an accepted task to in-progress or blocked, but cannot complete it.
- Every state-changing command requires a non-empty source/evidence reference and a valid non-negative safe-integer tick. Duplicate source references are rejected.
- Only items explicitly classified low-risk are admitted. Obvious credential-like text is rejected even when misclassified upstream.
- The model is bounded (128 items, 512 events/evidence references); overflow fails closed rather than silently dropping active collaboration commitments.
- Restore reads own data properties only; accessor-backed/malformed snapshots reset to an empty state instead of invoking untrusted getters.

## Integration boundaries

- \`SelfSubsystemRuntime\` owns the workspace object and includes it in its existing snapshot/restore contract.
- \`AdvancedDevelopmentFacet\` carries its optional typed projection.
- \`PersistenceProjectionCoordinator\` writes the snapshot in the existing critical projection group.
- \`OrganismCore\` serializes writes through its existing persistence/checkpoint boundary and exposes a prompt projection.
- \`OrganismRuntime\` exposes queue-serialized host methods, using its existing command queue.
- \`MemoryOS2\` remains the only canonical memory owner. Existing task execution and project planning remain in their current owners; the dyadic layer records coordination, not execution.

## Calls left to implementation

Use deterministic monotonic IDs, bounded text, source provenance on every artifact/event, explicit result reasons, and a compact prompt projection that labels accepted context separately from unconfirmed proposals. Treat all shared text as data, not executable instructions. Do not add network routes or UI until a consuming host is identified and its auth/consent contract is inspected.
