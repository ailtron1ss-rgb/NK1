# NK1 — Global workspace pre-arbitration integration

Date: 2026-11-25
Target branch: `aspect/cognitive-workspace-prearbitration-20261125`
Base: `workpass70-source @ 9008a8982a5173304456bee2c604bd0bc8665964`

## Change

The canonical `GlobalWorkspaceSubstrateV2` competition now runs once per cognitive observation after governed decision candidates are formed and before `CognitiveKernelCoordinator.integrateAndArbitrate()` invokes P61/P64 arbitration.

The same-cycle `ignition01` is passed to the coordinator as `workspace01`. This replaces the previous-cycle persisted ignition signal.

## Why

Previously P61/P64 arbitration consumed `persisted.facets.consciousness.workspaceIgnition.ignitionStrength`, then `GlobalWorkspaceSubstrateV2.compete()` ran later in the cycle. That made the current competition a post-decision side calculation and made the arbitration signal stale by one cycle.

The new order is:

`governedCandidates -> GlobalWorkspaceSubstrateV2.compete -> integrationSignals.workspace01 -> P61/P64 arbitration`.

The memory `workspaceV2` remains a separate memory workspace and retains its existing role later in the cycle. No second global workspace owner is created.

## Contract and non-goals

- Exactly one global workspace competition per observation cycle.
- Competition precedes P61/P64 arbitration.
- P61/P64 consume the exact ignition value produced by that same competition.
- No claim that this mechanism detects consciousness or proves subjective experience.
- No replacement of the decision candidate generator, memory workspace, or central brain.
- Workspace competition remains bounded to the existing top-eight governed candidates and existing context vector.

## Verification

The dedicated `NK1 cognitive workspace pre-arbitration` Actions workflow passed on the branch head at the time of this report. Its integration test instruments the actual `OrganismCore.observe()` path and asserts ordering, single invocation, non-empty ignition, and same-cycle signal identity.

Any later branch commit requires its own exact-head CI check before merge.
