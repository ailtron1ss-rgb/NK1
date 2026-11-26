# G3 observation admission — fail-closed runtime slice

Checkpoint: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`  
Implementation branch: `aspect/g3-perceptual-evidence-admission-20261126`  
Tracking PR: #1209

## Implemented in this slice

- Removed the public `verified?: boolean` elevation path from `PerceptualEvidenceCompiler.recordExternalEvidence`. Unknown JavaScript fields do not change evidence status.
- External perceptual writes without a host-issued admission receipt are always `derived`; their metric influence remains bounded and non-observational.
- P41 world/sensor ingress and P41/epistemic/world restore paths downgrade caller-asserted or persisted `observed` labels unless a real host admission capability is present.
- `GroundedWorldState.integrateExternalOutcome` no longer accepts caller-supplied proof classes or numeric verified/independent scores. It requires the exact process-local executor result plus its exact verifier-issued token; copied JSON and hand-built `{verified:true}` payloads produce only receipt diagnostics.
- Persisted external-observed facts, divergence claims and process-local provenance are revoked on restore because the WeakMap capability cannot survive process restart.
- P41 semantic entities, relations and scene evidence cannot reintroduce an `observed` label through the compiler.
- Replayed identical external rows are idempotent and do not inflate update counters or smoothed grounding metrics.
- Restore validates each row through own data properties, bounds its fields, downgrades unverifiable persisted `observed` rows to `derived`, derives the update count and latest timestamp from accepted rows, resets unverifiable aggregate metrics, and recomputes the digest.
- `EmbodimentSubsystemRuntime.snapshot()` now includes the canonical PerceptualEvidenceCompiler state, and `restoreFromPersisted()` restores it. Previously that owner was neither included in the subsystem snapshot nor restored from its persisted facet.

## Explicitly not closed

This is a fail-closed safety slice, **not full G3 acceptance**. The current bridge uses an in-process WeakMap capability from the canonical `ExternalPostconditionVerifier`; it accepts only the exact frozen executor result and exact verifier token bound to that result. It is not a cryptographic host-signed receipt, does not survive process restart, and cannot establish an independently attested device identity by itself. P41 and restore paths remain fail-closed without that live capability.

Full G3 still requires a host-owned signer/verifier and live context binding for issuer/key ID, device/source, session, consent and revocation, nonce/replay, capture time/expiry, payload digest, schema version, plus restart verification of the signed receipt. The current in-process verifier token is an intermediate admission boundary, not a replacement for those requirements. The host adapter must provide the real key/session/consent authority; the organism must not trust a caller-supplied flag, model output, plugin claim, or self-asserted trust score as a substitute.

## Verification contract

The PR workflow runs the admission/restore regression, P41 + grounded-world provenance ingress/restore, P2840 reality boundary, P2841 postcondition/world-integrity, P2842 active-perception runtime, and the runtime typecheck on the PR head. No merge, release, or readiness-gate closure is implied by the branch itself.
