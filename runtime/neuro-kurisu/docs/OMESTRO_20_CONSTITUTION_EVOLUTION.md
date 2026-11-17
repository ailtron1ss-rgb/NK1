# OmeStro #20 — Constitution Evolution

## Goal

A controlled, versioned process for improving NK1 operating rules without allowing an agent or a proposal to rewrite foundational guarantees.

## Runtime ownership and persistence

`ConstitutionEvolutionEngine` is owned by `GovernanceSubsystemRuntime`. Its typed snapshot is written by both critical and hot paths in `PersistenceProjectionCoordinator` to `facets.advanced.constitutionEvolution`, then restored by `GovernanceSubsystemRuntime.restoreFromPersisted`. The runtime does not put a second governance database beside the canonical organism checkpoint.

Existing `P69ConstitutionalArbiter` remains the final runtime decision membrane and is not rewritten. Approved constitutional rules are governance metadata; they do not patch P69, ActionGateway, host policy or executable code.

## Protected baseline

The compiled baseline is SHA-256 anchored and contains ten deeply frozen invariants: safety/security, law and host policy, user authority and consent, privacy, evidence provenance, truthful reporting, evidence-bounded identity/consciousness claims, architectural layer separation, auditable rollback, and reviewer/approver independence.

Only five domains are mutable in this first version: `workflow`, `quality`, `performance`, `resource`, and `operations`. Rule IDs cannot enter the `core.` namespace. A conservative phrase detector rejects obvious attempts to weaken protected controls; this is defense in depth, not a semantic proof.

## Lifecycle

1. **Propose:** bind author, active base version, change kind, target rule, motivation, scope, counterexample, risk/mitigations, and test plan into a candidate digest.
2. **Review:** the reviewer must be different from the author; each attestation is HMAC-bound to the exact proposal digest, reviewer, decision, test evidence, holdout evidence, rationale and timestamp. Approval requires every planned test to pass, protected-invariant checks, and at least one passing holdout. High/critical risk requires two distinct reviewers.
3. **Ratify:** the engine requests a one-shot ticket from the existing `ActionGateway`. The ticket is bound to the exact proposal ID and candidate digest. The UI/host resolves the ticket; the engine consumes it atomically before changing the proposal status. A caller-supplied `explicitHumanApproval: true` or arbitrary approval reference is not accepted as authority.
4. **Activate:** the engine re-checks the base version and appends a new revision and audit event. Stale candidates cannot silently apply.
5. **Rollback:** a second one-shot ActionGateway ticket is bound to the current version, target version and rollback reason. Rollback appends a new revision pointing to the restored version; it does not erase the superseded history.

## Cryptographic integrity and host authority

Non-baseline mutation requires a host-controlled signing key of at least 32 bytes, supplied through `NEURO_CONSTITUTION_HMAC_KEY` (or explicit constructor injection for tests). Never commit the secret, place it in a Release ZIP, or log it. Production secret delivery remains a host/deployment responsibility.

The complete snapshot is HMAC-SHA-256 authenticated. Reviewer attestations, ratification receipts and audit events have their own HMACs; audit entries form a bounded hash-linked chain with a persisted anchor when old events are compacted. The snapshot is restored only when the key, protected baseline, active revision, proposal lineage, review attestations, approval receipts and audit chain validate. Missing key permits only the pristine compiled baseline; malformed or unauthenticated non-baseline state resets fail-closed to that baseline with a diagnostic.

ActionGateway persists approval tickets, binds them to exact payload/decision identity, and consumes them once. It returns the actor label stored at approval resolution. The API/UI host must populate that actor label from the authenticated session and restrict approval resolution to the authorized owner; the ActionGateway method itself is not an identity provider. The constitution engine does not authenticate people, execute arbitrary test plans, or establish that evidence references are genuine. CI/host control planes must actually run tests and holdouts and issue the evidence references.

## Bounds and failure behaviour

Revision history is bounded to 64, proposals to 128 and audit events to 512 (with an anchor digest across compaction). A stale proposal cannot activate against a changed base. Failed signature, missing host key or corrupted persistence returns the engine to the compiled baseline rather than accepting partially trusted state.

## Validation

Focused CI runs runtime typecheck, constitutional lifecycle tests, runtime persistence/recovery tests and the existing P69–P73 persistence regression. The P69–P73 regression also checks that the new snapshot is carried through the organism checkpoint. Only an Actions run on the exact current PR head counts as validation evidence.

## Boundary of this delivery

This feature provides a controlled constitutional version ledger and approval lifecycle, not unrestricted self-modification, legal compliance certification or evidence of consciousness. Future consumers must explicitly interpret approved mutable domains and keep the protected baseline outside their control.
