# Dyadic Mind — design

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — Dyadic Mind / Совместный интеллект человека и NK1  
**Status:** Implemented, connected and verified on exact code/test HEAD \`edf98a66\`.

## Intent

Give a person and NK1 a persistent, inspectable shared view of their work without merging their personal states. The shared view carries goals, tasks, agreements, questions, success criteria and decisions across dialogue turns. Each artifact retains its author and source provenance internally.

## Data and authority

- Artifact types: goal, task, agreement, question, success-criteria and decision.
- Author: human or system. Lifecycle: proposed, accepted, rejected.
- Human-authored records are accepted; system-authored records remain proposals until explicitly confirmed or rejected.
- Only a human may resolve a proposal, correct a shared item or mark a task completed.
- Every mutation has a non-empty source/evidence reference and monotonic tick.
- Duplicate evidence, stale transitions, sensitive/unclassified content, credential-like strings and capacity overflow fail closed.
- Restore uses own data properties only and fails closed on malformed/accessor-backed data.

## Runtime and persistence

- SelfSubsystemRuntime owns the workspace and snapshot/restore lifecycle.
- AdvancedDevelopmentFacet carries typed state; PersistenceProjectionCoordinator includes it in the existing critical projection group.
- OrganismCore checkpoints successful writes; OrganismRuntime serializes mutations and reads through its existing queue.
- Existing cognitive prompts receive a bounded shared projection, with proposals explicitly labelled as unconfirmed data.
- MemoryOS2 remains the single memory owner; project execution and action approvals remain in existing components.

## Authenticated host API

- \`GET /api/organism/dyadic-collaboration\` returns a redacted summary and item list.
- \`POST\` actions: record, confirm, reject, progress and correct.
- Existing bearer authentication and API rate limit are reused.
- All POST mutations require \`confirmed=true\`.
- Host owns actor, tick, source/evidence ID and sensitivity; the client cannot forge them.
- Evidence refs and internal event ledger are never returned by the HTTP projection.
- Idempotency key is hashed with canonical payload: exact retries replay, changed payload under the same key conflicts. Concurrent same-key writes are tested.

## Existing React app

- The current Kurisu home route includes a collapsible Dyadic Mind panel.
- It consumes the typed \`neuroApi\` client and the authenticated host endpoint.
- Human can add shared records, accept/reject NK1 proposals, correct records and progress tasks. Completion uses a second explicit confirmation.
- A transient network failure can be retried once using the same Idempotency-Key/body. Deterministic 4xx responses are not retried.
- No new browser token store, independent API or separate backend is introduced.

## Verification

At exact code/test HEAD \`edf98a66\`:
- App Integration: SUCCESS; \`tsc --noEmit\`, 55 existing tests and 3 retry/idempotency tests pass.
- WorkPass79: SUCCESS; all 27 work steps pass, including HTTP route and 9/9 Dyadic workspace tests.
- Unified Organism Runtime: SUCCESS; TypeScript, cognitive cycle, planner restore, continuity and runtime smoke pass.

This is a software coordination and shared-work interface, not a claim of shared consciousness or merged personal identity.
