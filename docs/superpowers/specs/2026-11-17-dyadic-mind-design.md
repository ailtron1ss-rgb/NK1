# Dyadic Mind — design

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — Dyadic Mind / Совместный интеллект человека и NK1  
**Status:** Implemented, connected and verified on exact HEAD \`ca2af1eb\`.

## Intent

Give a person and NK1 a persistent, inspectable shared view of their work without merging their personal states. The shared view carries goals, tasks, agreements, questions, success criteria and decisions across dialogue turns. Each artifact retains its author and source provenance internally.

## Goals

- Preserve a bounded collaboration record across runtime restart.
- Distinguish human-authored accepted context from system-authored proposals.
- Require explicit human confirmation before a system proposal becomes shared agreement.
- Keep task progress, authorship, evidence references and corrections auditable.
- Expose a small, labelled collaboration projection to cognitive prompts without treating it as instructions.
- Reuse the canonical self subsystem, checkpoint/restore pipeline and host authentication.
- Make the collaboration state accessible through an authenticated app/client API.

## Data and authorization model

- Artifact types: goal, task, agreement, question, success-criteria and decision.
- Author: human or system. Lifecycle: proposed, accepted, rejected.
- Human-authored records are accepted because the write is an explicit human act. System-authored records always start proposed.
- Only a human may accept/reject a proposal, correct a shared item, or mark a task completed.
- Every mutation has a non-empty source/evidence reference and a non-negative safe-integer tick.
- Duplicate evidence, stale transitions, sensitive/unclassified content and capacity overflow fail closed.
- HTTP host owns actor, evidence IDs, tick and sensitivity classification; client-provided metadata is ignored.
- HTTP mutations require \`confirmed=true\`.
- HTTP responses expose a redacted item projection; internal evidence references and event records are not returned.
- An optional Idempotency-Key is hashed with the canonical request. Exact retries are replayed; key reuse with a different payload conflicts. Regression tests cover concurrent identical and conflicting requests.

## Persistence and runtime integration

- SelfSubsystemRuntime owns the workspace and snapshot/restore lifecycle.
- AdvancedDevelopmentFacet carries the typed snapshot.
- PersistenceProjectionCoordinator writes it in the existing critical persistence group.
- OrganismCore checkpoints writes and includes the collaboration projection in the existing prompt context.
- OrganismRuntime serializes mutation and read operations through the existing queue.
- MemoryOS2 remains the sole canonical memory owner. Existing project planning/execution and approval gates remain authoritative; Dyadic Mind records coordination but does not execute external actions.

## Authenticated host API

- \`GET /api/organism/dyadic-collaboration\` returns a redacted summary and current items.
- \`POST\` actions: record, confirm, reject, progress and correct.
- The endpoint reuses the existing API bearer authorization and rate limit.
- Idempotency uses the existing bounded evidence/event ledger, not a second datastore.

## Verification

- WorkPass79 exact HEAD \`ca2af1eb\`: SUCCESS; live host API, concurrent idempotency, workspace, UserModel and restore regressions passed.
- Dyadic workspace tests: 9/9.
- Unified Organism Runtime exact HEAD \`ca2af1eb\`: SUCCESS; TypeScript typecheck, cognitive cycle, cadence, planner restore, continuity and runtime smoke passed.

This is a software collaboration record and workflow boundary, not a claim of shared consciousness or merged personal identity.
