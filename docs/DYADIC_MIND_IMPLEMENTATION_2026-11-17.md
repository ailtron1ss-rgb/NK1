# Dyadic Mind — implementation report

**Date:** 2026-11-17  
**Source:** OmeStro, idea 02 — Dyadic Mind  
**Base:** \`workpass70-source\` at \`1e83a011fc677ff20f2348570322bd562181d9ff\`  
**Feature branch:** \`aspect/dyadic-mind-collaboration-layer-20261117\`  
**Verified implementation HEAD:** \`ca2af1eb9d84a6c17679df5b299be4edf64ee5b3\`  
**Pull request:** [#898 — Draft](https://github.com/ailtron1ss-rgb/NK1/pull/898)

## Delivery

Dyadic Mind is a bounded, persistent human–NK1 coordination workspace. It does not combine the human's personal state with NK1's self-state and does not create a second memory or project executor.

### Implemented

- Shared artifacts: goals, tasks, agreements, questions, success criteria and decisions.
- Author, lifecycle status, task progress, update source, timestamps and bounded event history.
- Human-authored items are accepted; system-authored items remain proposals until a human confirms or rejects them.
- Only a human can accept/reject a system proposal, correct a shared item, or mark a task completed.
- Duplicate evidence, stale updates, sensitive/unclassified input, credential-like text and capacity overflow fail closed.
- Accessor-safe snapshot restore and bounded data-only prompt projection.
- SelfSubsystemRuntime ownership; AdvancedDevelopmentFacet type; critical persistence projection.
- Checkpointed OrganismCore commands and serialized OrganismRuntime commands.
- Shared context enters existing cognitive prompts with proposals explicitly labelled as unconfirmed data.
- Bearer-authenticated HTTP host API: GET and POST /api/organism/dyadic-collaboration.
- HTTP redacts internal evidence references/events and ignores client-supplied actor, evidence/source references, sensitivity and tick.
- HTTP mutations require confirmed=true.
- Optional Idempotency-Key support: exact retries return the previous item (200, replayed=true); the same key with a different payload returns 409. Concurrent identical/conflicting requests are covered by a live HTTP test and use the existing serialized runtime/evidence ledger rather than a second persistence store.

## HTTP contract

Use the same bearer token as the other authenticated /api routes.

GET /api/organism/dyadic-collaboration returns summary and redacted items.

POST action=record:
\`\`\`json
{
  "action": "record",
  "kind": "task",
  "title": "Prepare the shared release checklist",
  "detail": "Collect the agreed validation evidence.",
  "confirmed": true
}
\`\`\`

POST action=confirm or action=reject resolves a pending system proposal by itemId.  
POST action=correct updates title/detail for an item by itemId.  
POST action=progress updates task progress to not-started, in-progress, blocked or completed.  
All POST mutations require confirmed=true. The host derives actor/evidence/tick/sensitivity itself.

Send an \`Idempotency-Key\` header to make retries safe. The key is hashed and not stored or returned in raw form.

## RED → GREEN and exact-head verification

- Workspace RED: test-only commit \`0cbfa202\` failed on the missing SelfSubsystemRuntime owner as expected.
- Initial typecheck errors in the runtime wrapper and restore type were fixed.
- Workspace security RED: an \`API token = …\` form was not detected; the credential filter was corrected.
- HTTP RED: test-only commit \`192f2508\` received 404 for the not-yet-implemented route.
- Idempotency RED: exact retry at \`8ea85dcc\` created a second record (201 instead of replay 200); HTTP idempotency was implemented.
- Concurrent idempotency regressions were added for two simultaneous identical writes and same-key conflicting writes.

**Final exact HEAD:** \`ca2af1eb9d84a6c17679df5b299be4edf64ee5b3\`

**WorkPass79 — [run 44044664279](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44044664279): SUCCESS**
- The complete job finished successfully, including all 25 workflow steps.
- The live Dyadic HTTP contract reported: unauthenticated GET 401; missing confirmation 400; create 201; exact replay 200 with \`replayed=true\`; same key/different payload 409; correction 200; completion 200; sensitive input 400; readback redacted.
- Concurrent identical requests produced exactly one 201 and one replay 200 with the same item ID.
- Concurrent same-key/different-payload requests produced one 201 and one 409 conflict.
- Dyadic workspace suite: 9 tests, 9 passed, 0 failed.
- UserModel evidence, runtime persistence, authenticated HTTP preference route, CognitiveEventFabric restore, memory residency, retrieval integrity, action/restart replay, provider boundary, server smoke and causal binding steps passed.

**Unified Organism Runtime — [run 44044664699](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44044664699): SUCCESS**
- Runtime TypeScript typecheck: PASS using the installed TypeScript compiler.
- Unified cognitive cycle, resource economy, autonomous cadence, planner restore/execution boundary, cognitive spine/world feedback, continuity integration and organism runtime smoke: PASS.

## Status

- **IMPLEMENTED:** yes — domain model, authorization rules and host API are present in the feature branch.
- **CONNECTED:** yes — canonical persistence, checkpoint/restore, serialized runtime API, cognitive prompt projection and authenticated host route are connected.
- **TESTED:** yes — RED conditions were reproduced and fixed; exact-head WorkPass79 and Unified Organism Runtime both passed at \`ca2af1eb\`.
- **RELEASED:** no — PR #898 remains Draft/open, not merged; no Release ZIP was changed or claimed. Published-release parity remains unverified.

## Explicit remaining boundary

This is the first working Dyadic Mind coordination layer and authenticated host contract. It records and presents shared intent; it does not itself execute external tools or silently promote a task into an autonomous action. Existing project/tool approval, execution and outcome-verification gates remain authoritative. A dedicated UI surface can consume this API in a separate client integration; no unauthenticated or parallel UI backend was added here.
