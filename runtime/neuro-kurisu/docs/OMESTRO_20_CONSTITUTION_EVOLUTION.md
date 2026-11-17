# OmeStro #20 — Constitution Evolution

## Goal

A controlled, versioned process for improving NK1 operating rules without allowing an agent or a proposal to rewrite foundational guarantees.

## Runtime ownership

`ConstitutionEvolutionEngine` is owned by `GovernanceSubsystemRuntime`. Its complete snapshot is included in the governance persistence projection and restored through `advanced.constitutionEvolution`. Existing `P69ConstitutionalArbiter` remains the final runtime decision membrane and is not rewritten.

## Protected baseline

The compiled baseline is SHA-256 anchored and contains ten invariants: safety/security, law and host policy, user authority and consent, privacy, evidence provenance, truthful reporting, evidence-bounded identity/consciousness claims, architectural layer separation, auditable rollback, and reviewer/approver independence.

Only these five domains are mutable in this first version: `workflow`, `quality`, `performance`, `resource`, and `operations`. Rule IDs cannot enter the `core.` namespace. A conservative phrase detector rejects obvious attempts to weaken protected controls; it is defense in depth, not a semantic proof.

## Lifecycle

1. **Propose:** bind author, active base version, change kind, target rule, motivation, scope, counterexample, risk/mitigations, and test plan into a candidate digest.
2. **Review:** the reviewer must be different from the author; attestations are digest-bound. Approval requires every planned test to pass, protected-invariant checks, and at least one passing holdout. High/critical risk requires two distinct reviewers.
3. **Ratify:** an explicit human approval reference is required from an actor distinct from the author and all reviewers.
4. **Activate:** the engine re-checks the base version and appends a new revision and audit event. Stale candidates cannot silently apply.
5. **Rollback:** approval is bound to the target version and reason. Rollback appends a new revision pointing to the restored version; it does not erase the superseded history.

## Trust boundary

The ledger checks actor identifiers for separation, digests, evidence references, and declared test outcomes. It does **not** authenticate people, cryptographically sign approvals, execute arbitrary tests, or establish that a supplied evidence URL is genuine. The host/control plane must authenticate actors, run tests/holdouts, and issue the approval reference. API/UI layers must not treat a caller-provided `explicitHumanApproval` boolean as proof of consent or identity.

## Persistence and failure

Snapshots carry the schema version, protected-baseline digest, active revision, bounded revision/proposal history, and bounded audit events. A malformed or tampered snapshot fails closed to the compiled baseline and records a diagnostic. Hashes are integrity checks, not signatures against an attacker who can rewrite the complete store.

## Boundary of this delivery

Approved mutable rules remain governance data. They do not patch P69, ActionGateway, host policy, safety controls, or runtime configuration automatically. Any future consumer must explicitly interpret approved domains and retain the immutable baseline. This feature adds controlled constitutional versioning, not unrestricted self-modification.
