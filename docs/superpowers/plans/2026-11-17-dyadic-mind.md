# Dyadic Mind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add a persistent, evidence-bound collaboration layer for human + NK1 work while preserving separate personal states and explicit human authority.

**Architecture:** A bounded domain object is owned by \`SelfSubsystemRuntime\`; its typed state is projected through the existing persistence coordinator and exposed through \`OrganismCore\` / the serialized \`OrganismRuntime\` queue. Existing memory and task execution owners remain authoritative for their own domains.

**Tech Stack:** TypeScript ESM, Node.js type stripping tests, current runtime checkpoint/restore, GitHub Actions.

**Spec:** \`docs/superpowers/specs/2026-11-17-dyadic-mind-design.md\`

## Global Constraints

- Canonical implementation remains \`runtime/neuro-kurisu\`.
- One canonical memory owner: \`MemoryOS2\`.
- One canonical self-subsystem persistence owner: \`SelfSubsystemRuntime\`.
- System proposals never become accepted without human confirmation.
- System cannot mark a shared task completed.
- No sensitive/unclassified collaboration payloads; no secrets; evidence reference required.
- No public release or merge as part of the feature branch work.

## Review Focus

- A replayed source reference must not create duplicate artifacts — duplicate evidence test.
- A system proposal must not appear as agreement — proposal/confirmation prompt test.
- System cannot complete an accepted task — progress gate test.
- A malicious accessor in persisted state must not execute — fail-closed restore test.
- A restart must retain shared items and their authority state — runtime persistence test.

---

### Task 1: Establish observable collaboration contract

**Files:**
- Modify: \`runtime/neuro-kurisu/tests/dyadic-collaboration-workspace.mjs\`
- Modify: \`runtime/neuro-kurisu/package.json\`
- Modify: \`.github/workflows/workpass79-cognitive-regression.yml\`

**Interfaces:** Tests expect \`SelfSubsystemRuntime.dyadicCollaboration\` with \`recordItem\`, \`confirmProposal\`, \`rejectProposal\`, \`updateTaskProgress\`, \`correctItem\`, \`snapshot\`, \`restore\`, and \`promptContext\`.

- [x] Write behavior tests before production code.
- [x] Observe the exact-head CI red assertion against the test-only commit (`0cbfa202`; WorkPass79 run `44040512284`, step 14: expected missing-owner AssertionError).
- [ ] Keep the same test command as the focused green check.

### Task 2: Implement bounded collaboration domain

**Files:**
- Create: \`runtime/neuro-kurisu/src/organism/system/DyadicCollaborationWorkspace.ts\`
- Test: \`runtime/neuro-kurisu/tests/dyadic-collaboration-workspace.mjs\`

**Interfaces:** \`DyadicCollaborationWorkspace\` provides validated artifact recording, human confirmation/rejection/correction, task progress, bounded snapshot/restore, summary, and labelled prompt context.

- [ ] Implement source-ref deduplication and bounded IDs/events.
- [ ] Enforce human/system lifecycle and task completion authority.
- [ ] Reject sensitive, unclassified, empty, malformed, or over-capacity inputs.
- [ ] Ensure restore never invokes accessors and fails closed.
- [ ] Run the focused behavior test.

### Task 3: Connect canonical persistence and runtime API

**Files:**
- Modify: \`runtime/neuro-kurisu/src/organism/core/SelfSubsystemRuntime.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/core/types.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/core/PersistenceProjectionCoordinator.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/core/OrganismCore.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts\`
- Test: \`runtime/neuro-kurisu/tests/dyadic-collaboration-workspace.mjs\`

**Interfaces:** The subsystem snapshot/restore owns the state; Core checkpoint writes it; Runtime methods enqueue all mutations; the prompt context distinguishes accepted entries from proposals.

- [ ] Persist/restore via the existing self subsystem and critical projection group.
- [ ] Add serialized Runtime methods for record, confirm, reject, correct and progress updates.
- [ ] Add a compact, data-labelled prompt projection.
- [ ] Add an end-to-end restart persistence assertion.

### Task 4: Verify and document

**Files:**
- Modify: \`CHANGELOG.md\`
- Create: \`docs/DYADIC_MIND_IMPLEMENTATION_2026-11-17.md\`

- [ ] Run focused test, relevant UserModel/restore regressions, runtime typecheck and exact-head Actions.
- [ ] Inspect changed paths and final diff.
- [ ] Record implemented / connected / tested / released status separately.
- [ ] Leave PR Draft and do not merge or release automatically.
