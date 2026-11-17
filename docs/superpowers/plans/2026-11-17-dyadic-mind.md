# Dyadic Mind Implementation Plan

**Status:** Implementation and host integration committed to feature branch; final exact-head CI verification pending.  
**Branch:** aspect/dyadic-mind-collaboration-layer-20261117  
**Base:** workpass70-source  
**PR:** #898 (Draft)

**Goal:** Add persistent, evidence-bound collaboration for human + NK1 while preserving separate personal states and explicit human authority.

**Architecture:** A bounded workspace is owned by SelfSubsystemRuntime. Its typed snapshot flows through the existing critical persistence projection. OrganismCore checkpoints writes, OrganismRuntime serializes mutations, and the existing server exposes a bearer-authenticated host adapter. MemoryOS2 and project execution remain unchanged.

## Guardrails

- One canonical memory owner: MemoryOS2.
- One canonical self-subsystem persistence owner: SelfSubsystemRuntime.
- System proposals never become accepted without human confirmation.
- System cannot mark a shared task completed.
- Client cannot author as system or choose evidence, source, sensitivity or tick metadata.
- No external database, public unauthenticated route, new secret or release.
- No actions/tools are executed merely because an item becomes accepted.

## Task 1 — Behavioral contract and red phase

- [x] Add workspace behavior tests before production integration.
- [x] Observe missing-owner RED in WorkPass79 at commit 0cbfa202; exact missing SelfSubsystemRuntime owner assertion.
- [x] Wire test into the existing WorkPass79 workflow.

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
- [x] Include collaboration context in existing prompt context without replacing personal UserModel context.

## Task 4 — Authenticated host adapter

- [x] Add GET /api/organism/dyadic-collaboration.
- [x] Add POST record / confirm / reject / progress / correct actions.
- [x] Reuse existing bearer authentication and API rate limiting.
- [x] Derive actor, tick and evidence refs server-side; redact internal provenance from responses.
- [x] Add live HTTP tests for auth, explicit confirmation, human authorship, create, correction, progress, secret rejection and readback.
- [ ] Confirm the same HTTP test passes on the exact current HEAD in GitHub Actions.

## Task 5 — Verification and delivery

- [x] Observe RED for workspace owner and for missing HTTP route.
- [x] Fix the two initial runtime type errors and the API-token classification hole.
- [x] Inspect compare diff against the source base.
- [ ] Confirm focused workspace test and live HTTP route test pass on current HEAD.
- [ ] Confirm runtime typecheck and Unified Organism Runtime pass on current HEAD.
- [ ] Refresh implementation report with exact run IDs and outcomes.
- [ ] Keep PR Draft; do not merge or publish without a separate user decision.
