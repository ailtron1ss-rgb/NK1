# Synaptic Commons — OmeStro idea 16

## Purpose

Synaptic Commons distributes small, portable skill manifests between isolated NeuroCore instances. It is a capability catalogue and evidence exchange boundary, not a shared user-memory store and not an executor.

The current implementation deliberately transfers declarative JSON skill descriptions only. It rejects executable source fields and obvious personal identifiers, secrets, dialogue, transcript, and memory-shaped fields. No episodic memories, conversations, UserModel claims, identity state, credentials, or raw runtime snapshots are part of the artifact format.

## Offline publisher workflow

The publisher utility is deliberately separate from the runtime and never persists private keys in NK1 configuration or state.

From `runtime/neuro-kurisu`:

```bash
npm run synaptic:sign-artifact -- <unsigned-artifact.json> <publisher-private-key.pem> <publisher-key-id> <output-package.json>
```

The input must be schema-v1 unsigned artifact JSON without a `signature` field. The signer requires an Ed25519 private-key PEM in a dedicated file with owner-only permissions (`0600` on POSIX), validates the artifact schema and privacy bounds before signing, signs only its canonical SHA-256 fingerprint, writes output with exclusive-create semantics and mode `0600`, and prints only the artifact fingerprint. The receiving NK1 instance stores only the corresponding public key in its publisher trust map. Publishing does not confer receiving-host compatibility or attestation; imported packages still start quarantined.

## Runtime ownership and persistence

- The domain engine is runtime/neuro-kurisu/src/organism/learning/SynapticCommons.ts.
- OrganismRuntime owns one instance and serializes every mutating operation through its existing runtime queue.
- Durable state is stored in the sidecar <stateFile>.synaptic-commons.json, separate from canonical autobiographical memory and the P23 skill candidate store.
- Each accepted mutation is persisted before its result is returned. A failed write restores the prior in-memory snapshot.
- Restore revalidates artifact fingerprints, trusted publisher signatures, compatibility state, and attestor receipts. Invalid state fails closed rather than being silently normalized into trusted records.
- The registry is bounded to 256 artifacts. It does not silently evict records.

## Trust and lifecycle

imported → quarantined → compatible → attested → revoked (terminal)

A package must pass every stage:

1. **Publisher identity.** The complete artifact is SHA-256 fingerprinted and must carry a valid Ed25519 signature from a publisher key configured by the host. An unknown publisher is rejected.
2. **Schema and privacy.** Only schema-v1 declarative JSON packages are accepted. Accessors, prototype-bearing objects, executable/script/code fields, obvious direct identifiers, credential-like values, and memory/dialogue field names are rejected. Artifact payloads are bounded to 48 KiB, depth 8, and 2,048 JSON nodes.
3. **License and provenance.** A package must identify its source instance/runtime and source artifact digest. Redistribution must be explicitly allowed and accompanied by a 64-hex review fingerprint. NOASSERTION, UNLICENSED, or an unreviewed artifact is not eligible for import.
4. **Local compatibility.** The host checks minimum runtime version, the primary capability, every required capability/tool, exact environment fingerprint (when the publisher binds one), and the permission envelope. Destructive skills are never compatible in this version.
5. **Independent evidence.** An Ed25519 attestor receipt binds the exact artifact fingerprint, runtime, environment, test-suite digest, and holdout digest. It requires at least five independent seeds, at least five holdout samples, positive candidate-over-baseline improvement, and at least 80% candidate holdout success. Receipts expire within 30 days.

A repeated exact fingerprint is idempotent. Reusing the same skill ID/version for different content is a conflict. A failed compatibility check leaves the record quarantined. Rejection requires a bounded reason. An attested artifact can be revoked by an authenticated operator: revocation is terminal and durable, preserves signed package and evidence for audit, blocks compatibility re-entry and export, and is exposed as `revocationReason` plus `revokedAt`. Expired evidence remains cryptographically verifiable during restart so old records do not prevent runtime recovery; expiration still blocks export.

## Execution boundary

The catalogue intentionally has no execute, activate, or promote operation. Diagnostics always report executableCount: 0.

Even an attested package is only eligible for a separate local review/admission process. The optional in-process bridge requires a fresh process-authentic `VerifiedSkillPromotionProposal` created from locally signed `VerifiedOutcomeLedger` evidence. The proposal's `candidateMethod` must equal `synaptic-commons:<artifactFingerprint>`; a JSON-roundtripped proposal or a proposal for another package is rejected. The bridge creates a durable, versioned P23 candidate with the signed portable artifact and local evidence lineage, but its payload is deliberately a review envelope, not a native `PolicySkillRecord`. It cannot affect `effectiveSkills()`, model weights, ActionGateway policy, autonomy permissions, canonical memory, or skill execution. Shadow receipts may be collected for local review, but `VersionedSkillCandidateStore.approveAndPromote` explicitly blocks this envelope until a future native P23 adapter has transformed it into a locally evaluated PolicySkillRecord candidate. A portable certificate is evidence input, not local competence or authorization.

The bridge is opt-in through `NEURO_SYNAPTIC_P23_ADMISSION_PROVIDER_MODULE`, a trusted server-side module exporting `createSynapticP23AdmissionProvider({ engine, candidateStore, trustedRunRegistry, stateDirectory, currentHostCompatibilityTarget })`. Its factory must return `createLocalPromotionProposal({ artifactFingerprint, candidateMethod, skillId, admissionBundle })`. The returned proposal must be created in-process by NK1's authentic `proposeVerifiedSkillPromotion` path after ingesting independently signed local outcomes. The module never receives authority to skip the signed shadow or promotion approval gate. The server reuses the existing compound-repair P23 store/engine when configured; otherwise it creates one canonical durable candidate store and trusted-run registry. Missing local verifier or approval roots prevents provider initialization. Without this opt-in, the P23 stage route responds 503 and does not mutate either catalogue or P23 state.

## Host configuration

All trust roots and compatibility manifests are server-owned environment settings. Do not accept any of these values from an API request.

- NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON: JSON object mapping publisher key IDs to Ed25519 public PEM strings.
- NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON: JSON object mapping evidence-attestor IDs to Ed25519 public PEM strings.
- NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON: JSON array of exact 64-character review fingerprints explicitly approved by the receiving host; an absent or unlisted fingerprint blocks import.
- NEURO_SYNAPTIC_COMMONS_RUNTIME_VERSION: local semantic runtime version (for example 1.2.0). The environment fingerprint must change whenever runtime, capabilities, tools, or relevant execution environment changes.
- NEURO_SYNAPTIC_COMMONS_ENVIRONMENT_FINGERPRINT: exact 64-character lowercase SHA-256 environment fingerprint.
- NEURO_SYNAPTIC_COMMONS_SUPPORTED_CAPABILITIES_JSON: JSON array of locally supported capability IDs.
- NEURO_SYNAPTIC_COMMONS_PERMITTED_TOOLS_JSON: JSON array of locally permitted tool IDs.

Only public keys may be stored in the two trust-key settings. Private signing keys remain in a separate signing service or offline custody and must never enter NK1 runtime configuration, source files, artifacts, logs, or diagnostics. An absent or invalid compatibility manifest blocks the HTTP compatibility transition.

## Authenticated HTTP surface

- GET /api/organism/synaptic-commons — bounded, read-only records and aggregate diagnostics.
- POST /api/organism/synaptic-commons/import — requires confirmed: true and a publisher-signed artifact.
- POST /api/organism/synaptic-commons/:fingerprint/compatibility — requires confirmed: true; compatibility inputs come only from server environment.
- POST /api/organism/synaptic-commons/:fingerprint/attestation — requires confirmed: true and an independently signed evidence receipt.
- POST /api/organism/synaptic-commons/:fingerprint/reject — requires confirmed: true and a bounded reason.
- POST /api/organism/synaptic-commons/:fingerprint/revoke — requires confirmed: true and a bounded revocation reason; only attested records can be revoked.
- GET /api/organism/synaptic-commons/:fingerprint/export — exports only a non-expired attested artifact after rechecking the live host runtime version, environment fingerprint, supported capability list, tool allowlist, publisher trust and licence review allowlist. Runtime/environment drift requires fresh compatibility and attestation.
- POST /api/organism/synaptic-commons/:fingerprint/p23-stage — requires confirmed: true and the opt-in local P23 provider; creates only a durable local staged review candidate after a fresh authentic local proposal bound to this exact artifact fingerprint. Missing provider returns 503; no activation is possible through this route.

Every route is subject to the existing API authorization and rate-limit boundary. There is intentionally no route to execute or activate a shared skill.

## Verification

From runtime/neuro-kurisu:

- node --experimental-strip-types tests/synaptic-commons-contract.mjs
- node --experimental-strip-types tests/synaptic-commons-runtime-integration.mjs
- node tests/synaptic-commons-http-route.mjs
- npm run test:synaptic-commons-p23-admission
- npm run typecheck

The dedicated workflow includes offline publisher, contract/privacy, runtime restart, authenticated HTTP, local P23 admission and full typecheck gates. It runs on the feature branch and pull requests targeting canonical `workpass70-source`. This PR is based directly on `workpass70-source`, not stacked on an Open Loop Radar prerequisite. Local P23 admission remains default-deny: a portable receipt is not itself an authentic local P23 proposal, independent evaluation, or signed promotion approval.
