# NK1 — host-owned self-improvement admission boundary
**Updated:** 2026-11-24  
**Status:** signed patch + independently signed holdout preflight admission implemented in the aspect branch; live code mutation executor deliberately not enabled.

## Trusted host composition
The host constructs `SelfImprovementPatchAdmissionService` with:
- exact 40-character source commit SHA;
- complete repo-relative source file snapshot at that SHA;
- SHA-256 of the canonical path/content inventory;
- Ed25519 public keys for patch receipts;
- a separate Ed25519 public-key registry for independent outcome evaluators.

Private signing keys must remain outside NK1 (for example in a protected CI signer or operator-controlled secret manager). Keys and source digest are copied and frozen during construction. Model output, candidate input, tool results and runtime-writable memory cannot update the trust root.

## Admission sequence
1. The host snapshot is normalized (unique repo-relative file paths, bounded file count and byte budget), fingerprinted and matched to the pinned source SHA/digest.
2. The service builds a structural SourceGraph from the host snapshot. The graph and candidate pool remain private; the model cannot supply or replace them.
3. The exact UTF-8 unified diff is verified against the host-pinned base SHA, patch digest, actual changed files/line ranges, candidate targets and declared evolve blocks.
4. SelfModificationGuard refuses writes to protected evaluator, holdout, identity, action, approval, source-graph, receipt-verifier and workflow owners. DangerModel applies blast-radius, sensitivity, rollback and measurement gates.
5. At least five Ed25519-signed holdout artifacts are independently verified. Every artifact is bound to exact candidate ID and patch SHA, has a unique evidence ID and seed, uses the `holdout` split, and is signed by a host-pinned evaluator key. At least two verifier IDs and two environment IDs are required.
6. Only those verified observations are passed to ProxyDivergenceGuard and DangerModel. Candidate-supplied observations are not read on the verified path.
7. The resulting ranked record is tagged `signed-patch-receipt` and carries patch/evidence fingerprints. Metrics-only ranking remains separately tagged `metrics-only`.

## Important limits
This component is **preflight/admission only**. It does not write source files, create branches, run arbitrary patches, merge, or publish releases. A signed patch receipt proves source binding and signer provenance; independent signed holdout artifacts prove that configured evaluators produced the bound measurements. Neither is permission to execute.

No production host signer/evaluator configuration is present in the NK1 runtime. No private keys are added. The current Core self-modification scalar call remains fail-closed without paired evidence. The new service does not open that gate and does not enable self-editing. A future execution stage still needs host-operated isolated apply, independent post-apply tests, rollback verification, review/approval and an exact base-SHA lease.

## Failure behavior
Missing/too few outcomes, wrong candidate or patch digest, duplicate evidence ID/seed, invalid signature, unknown verifier, insufficient verifier/environment diversity, stale source SHA/digest, protected target, malformed diff, incomplete evolve blocks, excessive snapshot budget or missing rollback all refuse admission. There is no fallback to candidate-supplied metrics.
