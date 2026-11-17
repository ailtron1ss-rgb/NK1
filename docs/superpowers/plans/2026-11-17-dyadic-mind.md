# Dyadic Mind Implementation Plan

**Status:** Implemented, connected and verified on exact HEAD \`ca2af1eb9d84a6c17679df5b299be4edf64ee5b3\`.  
**Branch:** \`aspect/dyadic-mind-collaboration-layer-20261117\`  
**Base:** \`workpass70-source\`  
**PR:** [#898 — Draft](https://github.com/ailtron1ss-rgb/NK1/pull/898)

**Goal:** Add persistent, evidence-bound collaboration for human + NK1 while preserving separate personal states and explicit human authority.

**Architecture:** A bounded workspace is owned by SelfSubsystemRuntime. Its typed snapshot flows through the existing critical persistence projection. OrganismCore checkpoints writes, OrganismRuntime serializes mutations, and the existing server exposes a bearer-authenticated host adapter. MemoryOS2 and project execution remain unchanged.

## Guardrails

- [x] One canonical memory owner: MemoryOS2.
- [x] One canonical self-subsystem persistence owner: SelfSubsystemRuntime.
- [x] System proposals never become accepted without human confirmation.
- [x] System cannot mark a shared task completed.
- [x] Client cannot author as system or choose evidence, source, sensitivity or tick metadata.
- [x] No external database, public unauthenticated route, new secret or release.
- [x] No actions/tools execute merely because an item becomes accepted.

## Task 1 — Behavioral contract and red phase

- [x] Add workspace behavior tests before production integration.
- [x] Observe missing-owner RED in WorkPass79 at \`0cbfa202\`.
- [x] Wire the test into the existing WorkPass79 workflow.

## Task 2 — Bounded collaboration domain

- [x] Add goals, tasks, agreements, questions, success criteria and decisions.
- [x] Preserve actor, evidence, status, progress and bounded event history.
- [x] Require human confirmation for system proposals, corrections and task completion.
- [x] Reject duplicate evidence, credential-like content, sensitive/unclassified input, stale transitions and capacity overflow.
- [x] Add accessor-safe restore and bounded data-only prompt projection.

## Task 3 — Runtime and persistence integration

- [x] Own workspace through SelfSubsystemRuntime.
- [x] Add AdvancedDevelopmentFacet snapshot typing.
- [x] Include it in the existing critical persistence projection.
- [x] Add checkpointed OrganismCore operations.
- [x] Add serialized OrganismRuntime operations and snapshot read.
- [x] Include collaboration context in existing cognitive prompt paths without replacing personal UserModel context.
- [x] Verify restart persistence with OrganismRuntime.

## Task 4 — Authenticated host adapter

- [x] Add GET \`/api/organism/dyadic-collaboration\`.
- [x] Add POST record / confirm / reject / progress / correct actions.
- [x] Reuse existing bearer authentication and API rate limiting.
- [x] Derive actor, tick and evidence refs server-side; redact internal provenance from responses.
- [x] Require explicit \`confirmed=true\` for all mutations.
- [x] Add live HTTP tests for auth, explicit confirmation, human authorship, create, correction, progress, readback, redaction and secret rejection.
- [x] Add idempotent retries: identical key+payload replays; changed payload with same key conflicts.
- [x] Add concurrent same-key identical/conflicting request tests.

## Task 5 — Verification and delivery

- [x] Observe RED for missing workspace owner, missing HTTP route and missing idempotency.
- [x] Fix runtime type errors and the credential-classification gap.
- [x] Inspect the compare diff against the source base.
- [x] WorkPass79 exact HEAD \`ca2af1eb\`: SUCCESS; all steps passed.
- [x] Dyadic workspace tests: 9/9.
- [x] Unified Organism Runtime exact HEAD \`ca2af1eb\`: SUCCESS; typecheck and full runtime integration passed.
- [x] Update the implementation report and changelog with evidence and release boundaries.
- [x] Keep PR #898 Draft; no merge or Release ZIP publication.
