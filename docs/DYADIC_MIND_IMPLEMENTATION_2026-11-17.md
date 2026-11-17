# Dyadic Mind — implementation report

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — Dyadic Mind  
**Base:** \`workpass70-source\` at \`1e83a011fc677ff20f2348570322bd562181d9ff\`  
**Feature branch:** \`aspect/dyadic-mind-collaboration-layer-20261117\`  
**Verified code/test HEAD:** \`edf98a66c6a911c5ad83e51d483472df110269d7\`  
**Latest docs-only follow-up:** \`b4b2a2aa6ebede7363ce9ba1e82a45b5b64adcee\` (superseded by final test-fixture correction \`edf98a66\`)  
**Pull request:** [#898 — Draft](https://github.com/ailtron1ss-rgb/NK1/pull/898)

## Delivery

Dyadic Mind is a bounded, persistent human–NK1 collaboration workspace in the runtime and the existing React app. It keeps the human's personal state separate from NK1's self-state. It does not create a second memory store or project executor.

### Runtime and authority model

- Shared artifacts: goals, tasks, agreements, questions, success criteria and decisions.
- Author, lifecycle status, task progress, tick, evidence provenance and bounded event history.
- Human-authored items are accepted; system-authored items remain proposals until a human confirms or rejects them.
- Only a human may accept/reject a system proposal, correct a shared item, or mark a task completed.
- Duplicate evidence, stale updates, sensitive/unclassified input, credential-like content and capacity overflow fail closed.
- Snapshot restore reads own data properties only; malformed/accessor-backed state resets safely.
- Shared prompt projection is bounded and labelled as data, not executable instructions.

### Canonical integration

- SelfSubsystemRuntime owns the workspace and its snapshot/restore lifecycle.
- AdvancedDevelopmentFacet carries the typed state; PersistenceProjectionCoordinator persists it in the existing critical projection group.
- OrganismCore checkpoints successful mutations.
- OrganismRuntime serializes read/write operations through its existing queue.
- Existing cognitive prompts receive accepted shared context and clearly labelled proposals.
- MemoryOS2 remains the only canonical memory owner; existing project execution and external action approval gates remain authoritative.

### Authenticated host API

- \`GET /api/organism/dyadic-collaboration\`: redacted state, counts and item list.
- \`POST\` actions: \`record\`, \`confirm\`, \`reject\`, \`progress\`, \`correct\`.
- Reuses the existing bearer authorization and API rate limit.
- Every mutation requires \`confirmed=true\`.
- Host derives actor, tick, sensitivity classification and evidence/source IDs; client-supplied provenance is ignored.
- Responses omit internal evidence references and event ledger entries.
- Optional \`Idempotency-Key\`: exact retries replay the already committed item (200); same key with different payload returns 409. Concurrent identical/conflicting requests are covered by live-server tests.

### Existing React app integration

- Added \`DyadicCollaborationPanel\` to the existing Kurisu home route, not a second app.
- Panel displays accepted items, pending NK1 proposals and task progress.
- Users can create shared goals/tasks/agreements/questions/decisions with explicit confirmation; accept/reject NK1 proposals; edit accepted items; start/block/resume tasks; and confirm task completion as a separate explicit action.
- Panel uses the existing \`neuroApi\` transport and collaboration endpoint; no client-side token store, new auth secret or parallel backend was added.
- Each mutation includes an idempotency key. The API client retries one transient network/408/429/5xx failure once with the same key and exact same body; deterministic 4xx responses are not retried.

## HTTP usage

Use the same bearer/auth setup as the existing runtime API routes.

GET \`/api/organism/dyadic-collaboration\` returns the redacted summary and items.

POST record example:
\`\`\`json
{
  "action": "record",
  "kind": "task",
  "title": "Prepare the shared release checklist",
  "detail": "Collect the agreed validation evidence.",
  "confirmed": true
}
\`\`\`

POST \`confirm\` or \`reject\` resolves a pending proposal by \`itemId\`. POST \`correct\` updates title/detail. POST \`progress\` changes task progress. All mutations require \`confirmed=true\`.

For safe retries, send an \`Idempotency-Key\` header. The raw key is neither returned nor stored; the server persists a hash-linked reference in the existing bounded evidence ledger.

## RED → GREEN evidence

- Workspace RED: test-only commit \`0cbfa202\` failed on the missing SelfSubsystemRuntime owner as expected.
- Initial TypeScript errors in the runtime wrapper and restored event type were fixed.
- Credential-filter RED for \`API token = …\` was fixed.
- HTTP RED: test-only commit \`192f2508\` received 404 before the host route existed; the route was then added.
- Idempotency RED: exact retry at \`8ea85dcc\` created a second item; the endpoint was made idempotent.
- Concurrent identical and same-key/conflicting requests have live HTTP regression coverage.
- App API retry is tested for a dropped response, deterministic 409 non-retry, and no retry when no idempotency key is supplied.

## Exact-head verification

**Verified implementation HEAD:** \`edf98a66c6a911c5ad83e51d483472df110269d7\`

**App Integration — [run 44047148987](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44047148987): SUCCESS**
- App \`tsc --noEmit\`: PASS.
- Existing app regression suite: 55 tests, 55 passed, 0 failed.
- New Dyadic API retry suite: 3 tests, 3 passed, 0 failed.

**WorkPass79 — [run 44047148950](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44047148950): SUCCESS**
- Complete workflow passed all 27 numbered work steps.
- Existing app + Dyadic Mind app typecheck/test steps passed in the same workflow.
- Live Dyadic HTTP summary: unauthenticated GET 401; missing confirmation 400; record 201; exact replay 200 with \`replayed=true\`; same-key/different-payload 409; correction 200; completion 200; sensitive input 400; redacted readback.
- Dyadic workspace suite: 9 tests, 9 passed, 0 failed.
- UserModel, runtime persistence, HTTP preference route, CognitiveEventFabric restore, memory residency/retrieval, action/restart replay, provider boundary, server smoke, cancellation and causal binding regressions passed.

**Unified Organism Runtime — [run 44047148766](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44047148766): SUCCESS**
- Runtime TypeScript typecheck: PASS.
- Unified cognitive cycle, resource economy, autonomy cadence, planner restore/execution boundary, world feedback, continuity integration and organism runtime smoke: PASS.

## Status

- **IMPLEMENTED:** yes — domain model, authorization, host API, existing React panel and client retry are in the feature branch.
- **CONNECTED:** yes — canonical persistence/checkpoint/restore, serialized runtime API, cognitive prompt projection, authenticated host endpoint and existing app home route are connected.
- **TESTED:** yes — RED cases were reproduced and fixed; App Integration, WorkPass79 and Unified Organism Runtime passed on exact code/test HEAD \`edf98a66\`.
- **RELEASED:** no — PR #898 remains Draft/open, not merged. No Release ZIP was changed or claimed. Release parity remains unverified.

## Remaining boundary

Dyadic Mind coordinates intent and shared work; it does not independently execute external tools or grant tool permission. Existing project/task execution, action approvals and outcome verification remain authoritative. This is a software collaboration system, not a claim of shared consciousness or merged human/system identity.
