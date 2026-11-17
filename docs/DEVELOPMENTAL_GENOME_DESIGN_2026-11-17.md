# Developmental Genome — design

**Date:** 2026-11-17  
**Approved architecture:** B — a genome coordinator over existing canonical owners  
**Repository/base:** ailtron1ss-rgb/NK1, workpass70-source at 1e83a011fc677ff20f2348570322bd562181d9ff

## Intent

Introduce a reproducible, versioned architecture manifest that explains how the current NeuroCore organism is assembled, which contracts it inherits, what dependencies are valid, and why a candidate configuration is or is not compatible. The genome is an engineering control plane, not a biological claim and not a second runtime.

## Existing owners that remain authoritative

- OrganismSystemContract remains the source for the seven physical-system contracts.
- OrganismSystemFabric remains the composition root and exposes the live derived genome.
- InvariantEngine remains the owner of persisted-organism validation and publishes the rule manifest used by the genome.
- ReleaseContract remains authoritative for runtime and state-schema version floors.
- StateMigrations.migratePersistedOrganism remains the only state-migration owner.
- P53DevelopmentalSelfModificationLab, P63DevelopmentalOperatingSystem, and UnifiedDevelopmentalCompiler retain their current responsibilities; the genome does not replace them.

## Goals

1. Generate a deterministic baseline genome directly from the seven live OrganismSystemContract records.
2. Record module contracts, capabilities, dependencies, release/state compatibility, invariant-rule ownership, generation, parent digest, and SHA-256 digest.
3. Validate the dependency graph (unknown dependencies, duplicates, self-edges and cycles) and the integrity of the genome digest.
4. Support inheritance of bounded configuration traits: only estimatedCost01 and cadenceCycles may vary in v1.
5. Provide a fail-closed Evolution Gate with APPROVED, BLOCKED, and NEEDS_REVIEW outcomes.
6. Surface the live genome through OrganismSystemFabric snapshots without adding a new persistence store or changing the state schema.

## Non-goals and anti-goals

- No runtime code generation, module loading, hot swapping, or automatic promotion.
- No creation, deletion, renaming, or re-wiring of the seven canonical systems.
- No mutation of module purpose, contract version, phase, dependencies, capabilities, release floors, migration owner, invariant definitions, evaluation code, or rollback authority.
- No second planner, memory owner, state migration engine, or lineage database.
- No state-schema bump and no change to the published Release ZIP in this feature branch.
- No consciousness or biological-genome claim.

## Approaches considered

- **A — standalone GenomeManager:** easy to add, but duplicates architecture and governance ownership. Rejected.
- **B — derived genome coordinator over canonical contracts:** one deterministic manifest plus bounded inheritance and a compatibility gate. Chosen because it fills the version/provenance gap while preserving current owners.
- **C — self-rewriting runtime architecture:** potentially more autonomous, but requires a separately proven patch sandbox, independent evaluator, sealed holdouts, rollback and release pipeline. Deferred; v1 must not execute code changes.

## Data and behavior contract

- Genome schema version: 1.
- Module set: exactly the seven names returned by organismSystemContracts().
- Dependency order: deterministic topological order of the live contract graph.
- Immutable module fields: name, contract version, purpose, phase, dependencies and capabilities.
- Inheritable fields in v1: finite estimatedCost01 in [0,1]; integer cadenceCycles in [1,64].
- Invariant manifest: sourced from InvariantEngine; a candidate cannot add, remove, weaken, or re-own rules.
- Runtime compatibility: pinned to RELEASE_CONTRACT, including current state schema and the existing migration owner/path.
- Lineage: generation, parent SHA-256 digest, and explicit old/new values for each permitted trait change.
- Digest: SHA-256 over canonical JSON, excluding only the digest field itself; timestamps are not used as identity.
- Approval means structurally compatible and eligible for human review only. Every candidate reports activation: NOT_APPLIED; runtime contracts remain unchanged.

## Failure handling

Malformed records, invalid values, unsupported schema versions, dependency errors, digest mismatches, changed immutable fields, broken lineage, and compatibility drift fail closed. Missing parent evidence or an unfamiliar but otherwise parseable contract is NEEDS_REVIEW, never an implicit approval.

## Verification

Behavioral tests cover the baseline generated from live contracts, deterministic digest, graph order and cycles, bounded inheritance, immutable-field attacks, altered invariants, forged digests, missing/incorrect lineage, serialization, and the runtime-fabric snapshot. The focused workflow also runs the runtime typecheck and architecture audit. Passing these checks proves the control-plane contract only; it does not prove that a candidate improves cognition or has been activated.
