# NK1 — host-owned patch receipt trust boundary

**Status:** host-trust admission implemented in the candidate pool; runtime/Core bootstrap wiring and independent outcome evidence remain future gates.

## Contract

`SelfImprovementCandidatePool` accepts an optional third constructor argument:

```ts
new SelfImprovementCandidatePool(policy, dangerThresholds, {
  baseSha: '<40-character source commit SHA>',
  trustedPublicKeys: {
    'nk1-release-signer-v1': '<Ed25519 SubjectPublicKeyInfo PEM>',
  },
});
```

This argument belongs to the trusted deployment/composition root. It must come from operator-controlled, read-only deployment configuration or a host-owned authority bootstrap. It must never be populated from model output, candidate metadata, a tool result, ordinary runtime-writable memory, or the candidate proof.

The pool validates the full source SHA, key identifiers, key sizes and Ed25519 public-key type. It copies and freezes the key map at construction. The pinned SHA and key registry are therefore unaffected by later mutation of the caller's original config object.

If trust is not configured, `submitVerified` refuses with `patch-receipt:host-trust-unconfigured`. Candidate proofs contain only `patchText` and `receipt`. Any accompanying `expectedBaseSha` or `trustedPublicKeys` fields are not read and cannot override the host-owned values.

## Admission classes

Every accepted pool entry exposes one explicit class:

- `metrics-only`: candidate observations were evaluated for ranking. This is not patch authorization.
- `signed-patch-receipt`: exact patch bytes, source SHA, changed files/line ranges and an Ed25519 receipt were verified against the host-pinned trust configuration.

The ranked record preserves the receipt key ID, pinned base SHA and patch SHA-256 so downstream components can distinguish the two paths and correlate them to the exact artifact.

Neither class is permission to stage or execute code. A signed patch receipt proves only the patch's integrity and trusted signer provenance. It does not prove that a change is useful, safe, or independently evaluated.

## Remaining gates before any live self-rewrite

1. A host-owned signer must issue receipts outside the NK1 model/runtime trust domain; the signing private key must never be stored in NK1.
2. A host-owned evaluator must issue independent signed outcome artifacts bound to the exact candidate, task manifest, environment, seeds and holdout split. Candidate-supplied observations alone are not evidence.
3. The independent holdout and evaluator must be immutable to candidate self-modification. The structural self-modification guard now protects `PatchReceiptGuard` as well as the candidate pool and other evaluator owners.
4. Only a separate promotion authority may move an evaluated candidate into a staging lane. Staging must apply the exact receipt-bound patch in a clean sandbox and verify rollback before any operator-reviewed promotion.
5. A new pool instance is required when the pinned source revision changes; receipts for a prior SHA cannot authorize a new tree.

## Verification

CI exercises candidate self-appointed keys, host-key snapshot immutability, attempts to override the base SHA/key registry, malformed trust configuration, invalid signatures, out-of-evolve-block edits, the metrics-only/signed-patch class distinction, self-protection of the verifier, live self-agency and runtime typechecking.

No private key, dependency, database migration, or release artifact is introduced by this change.
