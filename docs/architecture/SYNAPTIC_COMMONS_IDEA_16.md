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

The catalogue itself has no direct execute or activate operation. Diagnostics always report `executableCount: 0`. Import, compatibility, attestation and export never execute package payloads.

Every attested package may enter a local review path only after a fresh process-authentic `VerifiedSkillPromotionProposal` is constructed from locally signed `VerifiedOutcomeLedger` evidence. The proposal's `candidateMethod` must equal `synaptic-commons:<artifactFingerprint>`; JSON-roundtripped proposals and proposals for another package are rejected. The review candidate is stored in the *same canonical P23 candidate store owned by OrganismCore*; the server does not create a detached P23 engine/store. Review envelopes cannot enter the P23 resolver, generic shadow runner, or promotion API.

### Native P23 policy adapter

A deliberately narrow native adapter is implemented for one safe artifact type: a preference that biases one of NK1's seven existing policy actions in one exact six-dimensional need context. The accepted artifact must satisfy all of these constraints:

- `skill.kind = abstraction`, capability `neurocore.policy.preference`, `permissionClass = read-only`, `requiredCapabilities = ["neurocore.policy.preference"]`, `requiredTools = []`, and `allowedModes = ["assisted"]`.
- Definition format is `declarative-json-v1`; payload must have exactly four own keys and no extras: `schemaVersion: 1`, `schema: "nk1-policy-bias-v1"`, `action`, and `contextNeeds`.
- `action` is one of `respond`, `explore`, `verify`, `rest`, `reflect`, `wait`, or `defer`.
- `contextNeeds` must have exactly six numeric values in `[0,1]`: `energy`, `cognitiveLoad`, `uncertainty`, `novelty`, `goalPressure`, and `socialNeed`.

The shared `P23PolicyContext.ts` helper computes the same four-bucket context key used by live P23 matching; the adapter does not invent a second matching rule. The publisher cannot submit P23 metrics: validation sample count, pass rate, Wilson lower-bound confidence, and evidence provenance are derived from the fresh locally signed outcome proposal. The resulting `PolicySkillRecord` is staged as `candidate` in OrganismCore's canonical store and keeps artifact fingerprint, publisher, attestor, license review, source instance, source skill/version, local proposal, manifest, outcome and dataset fingerprints. Restore validates this provenance.

A native candidate is still **not active**. It cannot affect P23 action bias until the existing candidate lifecycle has accepted independently registered, signed shadow receipts and a separate authenticated promotion approval. The usual compare-and-swap, promotion authority verification, rollback and active-version protections remain in force. Materialization creates no ActionGateway tool, command runner, executable code, external capability grant, autonomous permission, or memory mutation. Other artifact kinds/capabilities remain review-only and cannot use this adapter.

The built-in proposal provider is enabled by `NEURO_SYNAPTIC_P23_OUTCOME_BUNDLE_PATH`, a server-owned path to a schema-v1 JSON bundle with a holdout-only manifest, baseline/candidate method IDs and independently Ed25519-signed outcomes. It rejects symlinks and files over 10 MiB, requires at least 8 tasks across 2 families, re-verifies each outcome against the exact manifest and `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`, rejects outcomes older than 30 days, and calls `proposeVerifiedSkillPromotion`. The proposal needs at least 8 paired tasks, 5 complete paired seeds and statistically supported improvement; admission also requires a fresh proposal no older than 15 minutes. Runtime/environment/capability/tool manifests are reread after the local evaluation, so policy drift invalidates the operation. The server requires configured trusted verifier and promotion-approval roots and reuses Core's canonical store. Without this opt-in both P23 routes fail closed with 503 and do not mutate P23 state.

The bridge has a built-in provider, enabled by `NEURO_SYNAPTIC_P23_OUTCOME_BUNDLE_PATH`, a server-owned local path to a schema-v1 JSON bundle containing a holdout-only manifest, baseline/candidate method IDs and independently Ed25519-signed outcomes. The built-in provider rejects symlinks and files over 10 MiB, requires at least 8 tasks across 2 families, verifies every artifact against the exact manifest and `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`, rejects outcomes older than 30 days, and builds the authentic proposal with `proposeVerifiedSkillPromotion`. The bundle's `candidateMethod` must be exactly `synaptic-commons:<artifactFingerprint>` and the proposal must show at least 8 paired tasks, 5 complete seeds and statistically supported gain. A trusted `NEURO_SYNAPTIC_P23_ADMISSION_PROVIDER_MODULE` may override the built-in provider for installations with a different local evaluator. It must contain at least 8 unique paired holdout tasks, at least 5 complete paired seeds, and be no older than 15 minutes when staging completes. Runtime, environment, capability and tool manifests are re-read after evaluation; any drift or expiry invalidates the stage. The module never receives authority to skip the signed shadow or promotion approval gate. The server reuses the existing compound-repair P23 store/engine when configured; otherwise it creates one canonical durable candidate store and trusted-run registry. Missing local verifier or approval roots prevents provider initialization. Without this opt-in, the P23 stage route responds 503 and does not mutate either catalogue or P23 state.

## Host configuration

All trust roots and compatibility manifests are server-owned environment settings. Do not accept any of these values from an API request.

- NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON: JSON object mapping publisher key IDs to Ed25519 public PEM strings.
- NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON: JSON object mapping evidence-attestor IDs to Ed25519 public PEM strings.
- NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON: JSON array of exact 64-character review fingerprints explicitly approved by the receiving host; an absent or unlisted fingerprint blocks import.
- NEURO_SYNAPTIC_COMMONS_RUNTIME_VERSION: local semantic runtime version (for example 1.2.0). The environment fingerprint must change whenever runtime, capabilities, tools, or relevant execution environment changes.
- NEURO_SYNAPTIC_COMMONS_ENVIRONMENT_FINGERPRINT: exact 64-character lowercase SHA-256 environment fingerprint.
- NEURO_SYNAPTIC_COMMONS_SUPPORTED_CAPABILITIES_JSON: JSON array of locally supported capability IDs.
- NEURO_SYNAPTIC_COMMONS_PERMITTED_TOOLS_JSON: JSON array of locally permitted tool IDs.
- `NEURO_SYNAPTIC_P23_OUTCOME_BUNDLE_PATH`: opt-in path to the local signed holdout bundle described above. The file must be maintained by the host's independent evaluator.
- `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`: Ed25519 public keys used to re-verify each local outcome artifact (also consumed by the P23 shadow evidence gate).
- `NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON`: Ed25519 public keys for the existing authenticated promotion authority. The local bridge is not initialized without at least one trusted verifier key and one trusted approval key.
- `NEURO_SYNAPTIC_P23_ADMISSION_PROVIDER_MODULE`: optional trusted JS module override. When absent, the built-in signed-outcome bundle provider is used if `NEURO_SYNAPTIC_P23_OUTCOME_BUNDLE_PATH` is set.

Only public keys may be stored in the two trust-key settings. Private signing keys remain in a separate signing service or offline custody and must never enter NK1 runtime configuration, source files, artifacts, logs, or diagnostics. An absent or invalid compatibility manifest blocks the HTTP compatibility transition.

## Authenticated HTTP surface

- GET /api/organism/synaptic-commons — bounded, read-only records and aggregate diagnostics.
- POST /api/organism/synaptic-commons/import — requires confirmed: true and a publisher-signed artifact.
- POST /api/organism/synaptic-commons/:fingerprint/compatibility — requires confirmed: true; compatibility inputs come only from server environment.
- POST /api/organism/synaptic-commons/:fingerprint/attestation — requires confirmed: true and an independently signed evidence receipt.
- POST /api/organism/synaptic-commons/:fingerprint/reject — requires confirmed: true and a bounded reason.
- POST /api/organism/synaptic-commons/:fingerprint/revoke — requires confirmed: true and a bounded revocation reason; only attested records can be revoked.
- GET /api/organism/synaptic-commons/:fingerprint/export — exports only a non-expired attested artifact after rechecking the live host runtime version, environment fingerprint, supported capability list, tool allowlist, publisher trust and licence review allowlist. Runtime/environment drift requires fresh compatibility and attestation.
- POST /api/organism/synaptic-commons/:fingerprint/p23-stage — requires confirmed: true and the opt-in local P23 provider; creates only a durable local staged review candidate after a fresh authentic local proposal bound to this exact artifact fingerprint. Missing provider returns 503.
- POST /api/organism/synaptic-commons/:fingerprint/p23-adapt — requires confirmed: true, the same local signed-outcome provider and a compatible/attested exact fingerprint; materializes only the allowlisted `nk1-policy-bias-v1` abstraction as a canonical P23 `PolicySkillRecord` candidate. No execution or activation occurs; ordinary signed shadow receipts and separate authenticated promotion approval are still required.

Every route is subject to the existing API authorization and rate-limit boundary. There is intentionally no route to execute or activate a shared skill.

## Verification

From runtime/neuro-kurisu:

- node --experimental-strip-types tests/synaptic-commons-contract.mjs
- node --experimental-strip-types tests/synaptic-commons-runtime-integration.mjs
- node tests/synaptic-commons-http-route.mjs (checks both P23 routes fail closed without the local provider)
- npm run test:synaptic-commons-p23-admission (review + native DSL positive/negative + Core persistence + no pre-promotion resolver impact)
- npm run typecheck

The dedicated workflow includes offline publisher, contract/privacy, runtime restart, authenticated HTTP, local P23 admission and full typecheck gates. It runs on the feature branch and pull requests targeting canonical `workpass70-source`. This PR is based directly on `workpass70-source`, not stacked on an Open Loop Radar prerequisite. Local P23 admission remains default-deny: a portable receipt is not itself an authentic local P23 proposal, independent evaluation, or signed promotion approval.
