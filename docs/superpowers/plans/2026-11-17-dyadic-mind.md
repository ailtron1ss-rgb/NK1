# Dyadic Mind Implementation Plan

**Status:** Implemented, connected and verified on exact code/test HEAD \`edf98a66c6a911c5ad83e51d483472df110269d7\`.  
**Branch:** \`aspect/dyadic-mind-collaboration-layer-20261117\`  
**Base:** \`workpass70-source\`  
**PR:** [#898 — Draft](https://github.com/ailtron1ss-rgb/NK1/pull/898)

**Goal:** Add persistent, evidence-bound collaboration for human + NK1 while preserving separate personal states and explicit human authority.

**Architecture:** A bounded workspace is owned by SelfSubsystemRuntime. Its state flows through the existing critical persistence projection. OrganismCore checkpoints mutations, OrganismRuntime serializes writes, the existing server provides the authenticated host API, and the existing React app exposes the workspace. MemoryOS2 and project execution remain unchanged.

## Guardrails

- [x] One canonical memory owner: MemoryOS2.
- [x] One canonical self-subsystem persistence owner: SelfSubsystemRuntime.
- [x] System proposals never become accepted without human confirmation.
- [x] System cannot mark a shared task completed.
- [x] Client cannot author as system or choose evidence/source/sensitivity/tick.
- [x] No external database, public unauthenticated route, new secret or release.
- [x] No external action executes merely because a shared item is accepted.

## Task 1 — Behavioral contract and red phase

- [x] Add workspace tests before production integration.
- [x] Observe missing-owner RED in WorkPass79 at \`0cbfa202\`.
- [x] Wire tests into WorkPass79.

## Task 2 — Bounded collaboration domain

- [x] Add goals, tasks, agreements, questions, success criteria and decisions.
- [x] Preserve author, evidence, status, progress and bounded event history.
- [x] Enforce human confirmation, correction and completion authority.
- [x] Reject duplicate evidence, credential-like content, sensitive/unclassified input, stale transitions and overflow.
- [x] Add accessor-safe restore and bounded data-only prompt projection.

## Task 3 — Runtime and persistence integration

- [x] Own workspace through SelfSubsystemRuntime.
- [x] Add AdvancedDevelopmentFacet state typing.
- [x] Persist through the existing critical projection group.
- [x] Add checkpointed Core operations and serialized Runtime APIs.
- [x] Include shared context in existing cognitive prompts without replacing personal UserModel context.
- [x] Verify runtime restart persistence.

## Task 4 — Authenticated host API

- [x] Add GET \`/api/organism/dyadic-collaboration\`.
- [x] Add POST record / confirm / reject / progress / correct.
- [x] Reuse existing bearer authentication and API rate limit.
- [x] Derive actor, tick and evidence server-side; redact internal provenance.
- [x] Require \`confirmed=true\` for mutations.
- [x] Add live HTTP tests for auth, consent, human authorship, correction, progress, readback and sensitive-input rejection.
- [x] Add idempotency replay/conflict and concurrent same-key tests.

## Task 5 — Existing app integration

- [x] Add typed Dyadic Mind API methods to the existing \`neuroApi\`.
- [x] Add the collapsible shared-work panel to the current Kurisu home route.
- [x] Support create, accept, reject, edit, task start/block/resume and two-step completion confirmation.
- [x] Use the existing API transport and same authentication path; no token storage added to the client.
- [x] Add transient mutation retry with the same Idempotency-Key and exact same body.
- [x] Add app typecheck and regression checks to CI.
- [x] App typecheck passed; 55 existing app tests and 3 new idempotency tests passed.

## Task 6 — Verification and delivery

- [x] Reproduce RED for owner, HTTP route, idempotency and app TypeScript type issues.
- [x] Correct each observed failure without weakening behavior tests.
- [x] WorkPass79 exact code/test HEAD \`edf98a66\`: SUCCESS, all 27 work steps passed.
- [x] Unified Organism Runtime exact HEAD \`edf98a66\`: SUCCESS.
- [x] App Integration exact HEAD \`edf98a66\`: SUCCESS.
- [x] Dyadic workspace tests: 9/9.
- [x] App regression tests: 55/55 plus idempotency retry: 3/3.
- [x] Update report and changelog with exact evidence.
- [x] Keep PR #898 Draft; do not merge or publish Release ZIP.
