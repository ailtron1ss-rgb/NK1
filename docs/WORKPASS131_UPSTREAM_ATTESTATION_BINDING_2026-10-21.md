# WorkPass131 — upstream-inspired execution-attestation binding

**Date:** 2026-10-21  
**Branch:** `workpass124-learning-evidence-hardening` (stacked draft PR #12)  
**Scope:** verified skill-learning evidence only; no changes to the live skill resolver or activation authority.

## Research used

- [in-toto Attestation Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) describes binding authenticated claims to explicit subjects and typed predicates.
- [in-toto Attestation Framework](https://github.com/in-toto/attestation/blob/main/spec/README.md) separates predicate, statement, envelope and bundle. NK1 borrows only the binding principle; it does not claim format compatibility or conformance.
- [The Update Framework security model](https://theupdateframework.github.io/security.html) emphasizes that a valid signature alone does not provide freshness/rollback protection. NK1's existing durable revalidation remains necessary.

No upstream source code was copied and no dependency was added. The adaptation is deliberately small and reversible.

## Code change

`runtime/neuro-kurisu/src/organism/learning/VerifiedSkillShadowEvidence.ts`

- Extended `TrustedShadowExecutionContext` to require `runId`, `taskId`, and `seed` in addition to `manifestFingerprint` and `runtimeVersion`.
- `createContextBoundSkillShadowEvidenceVerifier` now rejects missing/malformed context and compares all five fields against the signed payload after cryptographic signature and candidate identity validation.
- The resolver contract explicitly requires independently trusted supervisor/run-ledger data, not fields copied from the receipt.

This closes a specific gap in the prior context-bound verifier: previously, it compared manifest/runtime but did not independently bind the signed claim to the actual run, task and random seed.

## Regression coverage

`runtime/neuro-kurisu/tests/p23-versioned-skill-candidate-store.mjs`

The restart test persists a signed receipt, reconstructs the store from durable JSON and verifies that promotion is denied when trusted context differs by:
1. run ID;
2. task ID;
3. seed;
4. manifest fingerprint;
5. runtime version.

The matching trusted context remains the positive path. The checks execute during promotion, not just at ingestion, so a persisted snapshot is not treated as trusted merely because it parsed.

## Commits

- `10905afb9040c3c7929b1d1b81d62cadd75562ad` — bind receipt to trusted run/task/seed.
- `b14c844c315261577e8d31167ac7ea2e8ab28d04` — add mismatch regression matrix.
- `9d7b53395a825e8741c6ed81b07ee7e0f09233a2` — research intake ledger.
- `44a1e0443db867f8a70d4696176001b3868ad22a` — changelog.
- `d08c900547aacfcd56d5e7588d124003f9d582b5` — persistent handover.

## Status

- **IMPLEMENTED:** verifier contract and regression source are committed.
- **NOT VERIFIED:** tests, typecheck and Actions on the final exact branch head have not been confirmed successful in this pass. Do not label this change as CI-proven.
- **P0 OPEN:** production resolver must read authoritative run records; trusted verifier-key registry/bootstrap and authenticated approval authority still need wiring.
- **P0 OPEN:** audit all `VersionedSkillCandidateStore` constructor sites and every skill activation path, including `OrganismCore.ts`; this pass does not prove bypasses are closed.
- **P0 OPEN:** diagnose the earlier Actions failures with readable logs and obtain a successful exact-head run.

## Next implementation steps

1. Find every store construction site on this branch and trace its dataflow to the production bootstrap.
2. Implement one canonical trusted run-context adapter that obtains run/task/seed/manifest/runtime from supervisor-owned records.
3. Wire production public-key trust and authenticated approval authority; keep default-deny behavior until both are present.
4. Add tests proving no alternate activation route bypasses the gate.
5. Run the focused shadow-evidence and candidate-store tests plus runtime typecheck, then inspect exact-head Actions job steps/logs.
6. Only after those gates pass, expand the same provenance discipline to delayed learning-credit ingestion and checkpoint replay.

**Scientific boundary:** this pass improves the integrity of learning evidence. It does not demonstrate improved transfer, generalization, or learning quality.
