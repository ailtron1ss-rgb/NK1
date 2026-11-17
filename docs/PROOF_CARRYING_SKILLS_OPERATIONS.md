# Proof-Carrying Skills — host integration and operations

Status: Draft implementation guide
Target base: workpass70-source

## Trust model

A competence proof is a signed statement about one exact P23 candidate version and one narrow execution envelope. It does not mean general competence, does not automatically promote a skill, and does not replace ActionGateway policy, approval, idempotency, output validation or outcome verification.

Keep three authorities independent:

1. Outcome verifier: signs task-level holdout outcome artifacts.
2. Shadow verifier and trusted run registry: authenticate that the exact candidate ran in the registered shadow context.
3. Competence attestor: signs the proof only after reviewing candidate payload, holdout outcomes, shadow evidence and execution contract.

Do not reuse the private key of the holdout or shadow verifier as the competence attestor. NK1 receives only the competence attestor's Ed25519 public keys. Keep private signing material in an external signing service or offline custody.

## Host configuration

The canonical OrganismCore accepts these optional settings:

- NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON: JSON object mapping stable attestor IDs to Ed25519 public PEM strings.
- NEURO_SKILL_COMPETENCE_RUNTIME_VERSION: immutable build/runtime identity. Prefer the exact build SHA plus runtime release identifier.
- NEURO_SKILL_COMPETENCE_ENVIRONMENT_FINGERPRINT: 64-character lowercase SHA-256 fingerprint of deployment configuration and privilege boundary.
- OrganismConfig.skillCompetenceConditionEvaluator: host-owned callback for named preconditions and constraints. A missing callback denies proofs that declare conditions.

Equivalent OrganismConfig values can be injected at construction. The runtime version is converted to a canonical fingerprint using skillCompetenceRuntimeFingerprint(version). The environment setting must already be a 64-hex SHA-256 fingerprint. Missing or malformed identities resolve to null and fail closed.

Example shape only; replace placeholders using deployment-managed configuration:

```sh
NEURO_SKILL_COMPETENCE_RUNTIME_VERSION="<immutable-build-id>"
NEURO_SKILL_COMPETENCE_ENVIRONMENT_FINGERPRINT="<64-char-sha256>"
NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON='{"release-attestor":"-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"}'
```

Only public keys belong in NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON. Never place a private signing key in NK1 source, runtime environment, logs, or diagnostics.

## Candidate contract

A P23 candidate opts in explicitly by carrying both proofCarryingSkill=true and a competenceContract. The contract binds exact tool ID, capability, permission class, input/output contract fingerprints, runtime/environment fingerprints, stable precondition and constraint IDs, and allowed execution modes.

The contract is included in the candidate payload fingerprint. A code, schema, tool, runtime, environment or mode change requires a fresh candidate evaluation and new proof.

## Attestation and promotion sequence

1. Create an authentic VerifiedSkillPromotionProposal from signed, independently verified holdout outcome artifacts. It must pass task coverage, complete-seed coverage, family-regression and positive confidence-interval gates.
2. Stage the exact proof-carrying payload in VersionedSkillCandidateStore.
3. Execute at least three independent successful shadow runs. Each signed receipt must bind candidate ID/version, payload fingerprint, proposal outcome fingerprint, holdout manifest, run identity and runtime version.
4. Call store.createCompetenceProofPayload(...) using the exact staged candidate and contract. The store itself verifies the shadow receipts against its trusted run registry.
5. Send the payload to the external competence attestor. The external authority signs the canonical payload. NK1 does not hold or expose a production signing helper or private key.
6. Attach the signed artifact using store.attachCompetenceProof(...). This verifies the signature and exact candidate/evidence bindings.
7. Promote only through the existing authenticated human/approval authority. approveAndPromote refuses proof-carrying candidates without a current valid proof.
8. Register the resulting active skill/tool with requiresSkillCompetenceProof=true and the signed proof. The ActionGateway resolver must point to the same versioned P23 store used by OrganismCore.

A new shadow receipt changes the evidence-set digest and automatically invalidates the previous proof. Rebuild and re-attest; never silently renew or reuse it.

## Admission semantics

Before executor entry, ActionGateway verifies:

- a valid Ed25519 signature from a configured trusted attestor;
- exact active P23 candidate ID, skill ID/version and payload fingerprint;
- exact tool ID, capability and permission class;
- exact input and output contract fingerprints;
- current runtime and environment fingerprints;
- a valid, unexpired proof interval and finite host clock;
- requested assisted/autonomous mode is explicitly authorized;
- every signed precondition and constraint is resolved by the host callback and returns true.

Any missing, malformed, unsigned, expired, stale or out-of-scope proof returns competence-insufficient before the executor is entered. Existing availability, policy, approval, idempotency, output-contract and outcome-verification gates remain active.

## Rollout rules

- Start with one low-risk read-only skill and allowedModes=[assisted].
- Do not mark legacy skills proof-carrying until authentic holdout evidence and independent shadow receipts exist.
- ProceduralSkillLibrary counters, model confidence, self-report and a successful trace are not competence certificates.
- Do not enable autonomous mode by default. Attest and test it separately for the exact action scope.
- Rotate attestor keys through a bounded overlap; re-attest proofs before removing the old key.
- Keep PR #899 Draft until proof end-to-end, existing P23 lifecycle regressions, ActionGateway governance and runtime typecheck pass on the exact PR head. Never auto-merge or create a Release.