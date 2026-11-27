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


## Extended restore-hardening pass — 2026-11-26

The same G3 branch now hardens the full persisted perception chain rather than only the evidence compiler:

- \`GroundedWorldState.restore()\` validates top-level and nested records using the shared restore sanitizer, rejects accessors/Proxy containers without evaluating them, bounds entities/relations/events/facts/provenance, clamps numeric ranges, requires a coordinate frame for world positions, revokes unverifiable external-observation markers, and recomputes its digest.
- External-outcome event identity is now the executor \`executionId\` rather than timestamp + action. Duplicate deliveries do not advance world revision or append a second event; an untrusted diagnostic may be upgraded once only when the exact live verifier capability is later supplied.
- \`P41SemanticPerceptionEngine.restore()\` reconstructs each entity, relation, event, snapshot and pending query from own data fields; invalid row shapes are discarded, evidence labels are downgraded, numeric gauges and modality reliability are bounded, and caller-supplied \`lastHash\` is discarded.
- \`PerceptualContinuityModel.restore()\` and \`PerceptualEpistemicGraph.restore()\` reject hostile containers, validate nested rows and rebuild confidence/contradiction/resolution/corroboration summaries from retained accepted claims rather than trusting saved aggregate gauges.
- \`PerceptualEpistemicGraph.add()\` and \`PerceptualEvidenceCompiler.recordExternalEvidence()\` reject Proxy/accessor inputs before reading producer-controlled properties. Caller-supplied \`observed\` is always demoted in the epistemic graph.
- Regression coverage includes hostile nested getters, top-level and nested Proxy payloads, malformed scalar gauges, invalid coordinate frames, bogus digests, replayed executor IDs, P41 owner restore, and bounded continuity/epistemic counters.
- G3 CI installs pinned TypeScript 5.8.3 and Node type declarations in the runner only, so the runtime typecheck can use semantic \`tsc\`; no project dependency or lockfile is modified by this verifier step.

These changes improve restore/admission integrity; they do not convert the in-process verifier into a cryptographic attestation service. Device identity, consent/revocation, signed receipts, restart-surviving replay protection, Android/Termux soak and independent holdout remain open.


## Signed host admission and strict restore pass — 2026-11-27

The branch now contains a host-injected admission authority and a canonical Core/Runtime entry path:

- `SignedObservationAdmissionAuthority` validates an exact schema-versioned receipt, rejects unknown fields and hostile object shapes, enforces issuer/key ID and host-configured device ID, checks capture/issue/expiry windows, verifies Ed25519, RSA-SHA256 or ECDSA-SHA256 signatures, checks the exact consent ticket/revision/device/modality/capture binding, and atomically consumes the issuer/device/session/nonce tuple through an injected store.
- A successful check creates a frozen, process-local capability in a private WeakSet. Copies and JSON-restored tokens are not accepted by the evidence compiler.
- `OrganismConfig.observationAdmissionAuthority` allows a trusted host to inject the authority. `OrganismCore.admitObservationReceipt()` verifies the receipt, passes the exact capability to the canonical Embodiment owner, updates the persisted embodiment evidence facet, and checkpoints. `OrganismRuntime.admitObservationReceipt()` exposes the path through the runtime queue.
- `revokeAdmittedObservation()` is exposed at Embodiment, Core and Runtime layers. It demotes the selected observed row to unresolved, clears the dependent aggregate trust metrics, and checkpoints the downgrade.
- Host-admitted rows have a bounded expiry and are discarded from the live observation set after expiry. Ordinary external input remains derived; a caller-supplied `verified`, `signature` or `observed` field does not create authority.
- Strict restore helpers now distinguish runtime saturation from persisted trust validation. Out-of-range confidence/uncertainty/quality values fall back to their conservative defaults; counters outside each owner's explicit budget are rejected to defaults rather than saturated into invented activity. Applied across Grounded World, P41 semantic perception, continuity, epistemic graph and perceptual evidence compiler.
- G3 tests now use a real generated Ed25519 key pair and cover signed admission, payload tampering, wrong device, revoked consent, stale capture, malformed confidence, duplicate nonce, accessor/Proxy inputs, owner integration, persisted downgrade and revocation. A Core-level integration regression also checks canonical facet checkpointing and replay denial.

### Production integration boundary still open

The code path and injected contracts exist, but **production host attestation is not yet device-verified**:

- The application host must supply its provisioned public-key resolver and real key-rotation/revocation policy; the branch does not contain a production private key.
- The host must supply a canonical consent authority that checks current ticket state/revision, including revocation and modality scope.
- The host must supply a durable, cross-process atomic nonce store. The in-memory `Set` in the regression is test-only and does not qualify as production replay protection.
- The host capture service must compute the capture digest from the actual captured bytes and sign the exact receipt; the signed digest is currently treated as an issuer assertion, not independently recomputed from a local media blob.
- Persisted observation rows are deliberately downgraded on restore today. A subsequent restart-rehydration path must re-verify the persisted signed envelope against the host key/consent authorities and the durable nonce ledger before restoring observed status; no persisted WeakSet capability is trusted.
- Android/Termux cold-start, process-kill/restart, storage-loss and real camera/audio capture soak remain outstanding, as do independent RU/EN holdout and device latency measurements.

Accordingly, this work closes several caller-controlled and malformed-restore routes and builds the host admission seam; it does **not** close G3 or prove real-device trust until those concrete host providers and device tests are connected and independently verified.
