# NK1 — patch-bound independent P36 outcome admission

**Status:** implemented as a host-injected candidate-pool admission path and covered by exact-head CI. Not yet wired to the live Core production composition root, signer service or a live sandbox patch runner. No autonomous code execution or promotion is enabled.

## Why this boundary exists

A valid Ed25519 patch receipt proves that a trusted signer attested to particular patch bytes, paths, line ranges and a source revision. It does not prove that the change works, is useful, is safe, or improves downstream behavior.

NK1 already has a separate P36 verified-outcome ledger. It admits rows only after a signed outcome artifact has been ingested against a host-pinned task manifest and verifier key registry. A per-process authenticated-evidence reference is required by the evaluator; a serialized, restored, or manually inserted ledger row is not sufficient. P36 requires paired baseline/treatment measurements on holdout tasks and at least four independent seeds. It explicitly refuses delayed-retention claims.

## Exact identity binding

P36 treatment identity is now derived from both:

- the exact 40-character host-pinned source/base Git SHA; and
- the SHA-256 digest of the exact UTF-8 patch bytes already verified by `PatchReceiptGuard`.

The method label has the form:

```text
nk1-source-sha1:<baseSha>:patch-sha256:<patchSha256>
```

The candidate cannot choose or override the treatment-method label. Signed P36 outcome artifacts must have been produced by the host evaluator after executing that exact patch against that exact base tree. An artifact from the same patch digest against a different base SHA cannot be reused.

## Admission paths

The candidate pool now distinguishes three classes:

| Class | Source of the ranking signal | Meaning |
|---|---|---|
| `metrics-only` | Candidate-supplied paired observations | In-memory exploration/ranking only. Not patch authorization or independent evidence. |
| `signed-patch-receipt` | Host-pinned Ed25519 keyring + exact patch diff | Provenance/integrity gate passed. Does not prove utility. |
| `host-verified-holdout-outcome` | Host-injected P36 authority over authenticated signed ledger artifacts | Exact patch and base identity have authenticated paired holdout evidence. Still not permission to execute/promote. |

`submitVerifiedOutcome(...)` performs the following sequence:

1. Normalize the candidate while deliberately not reading its `observations` field.
2. Verify the patch receipt against the host-pinned source SHA, target-file list and evolve-block ranges.
3. Ask the host-injected P36 authority to measure the candidate ID, verified base SHA and verified patch digest.
4. Recheck the returned evidence shape and all identity fields; require the derived treatment identity, host manifest fingerprint, baseline, task family, at least four paired seeds, authenticated evidence references and point-in-time-only scope.
5. Apply the independent holdout gain floor and structural self-modification guard.
6. Store the independently measured downstream gain. `proxyGain` and `divergence` remain `null` because P36 has not measured them. The danger model adds an explicit `proxy-divergence-unmeasured` factor rather than fabricating a zero divergence.

The candidate's declared observations cannot override or inflate the P36 score. A missing P36 authority, missing holdout evidence, wrong treatment method, wrong base SHA, wrong patch digest, malformed evidence or evidence without authenticated receipt refs fails closed.

## Host composition contract

The host obtains the P36 authority through `createP36PatchOutcomeEvidenceAuthority(hostConfig)`. The factory validates the host config, clones and freezes the task manifest, verifies its fingerprint against the supplied `VerifiedOutcomeLedger`, and closes over the host-owned baseline/evaluator identity and source SHA. It returns a narrow `measure(request)` capability. The signing private key is never passed to this factory or stored in NK1.

The `SelfImprovementCandidatePool` receives that authority as its fourth constructor argument, after the existing policy, danger thresholds and host patch receipt trust configuration. This argument belongs exclusively to the trusted application composition root. It must never come from a candidate, LLM response, tool result or ordinary runtime-writable memory.

The host must separately provision signed P36 artifacts using an evaluator that:
- fetches the exact base tree by SHA;
- applies the receipt-bound patch in a clean isolated environment;
- verifies the resulting code and full task specification, not just candidate-visible tests;
- runs fixed task manifest entries on paired baseline and treatment arms over independent seeds;
- records outcomes in holdout only, with no candidate access to expected outputs or verifier controls;
- signs each outcome artifact with a host-held verifier key outside NK1; and
- ingests the signed artifacts into the process-local P36 ledger through the verified artifact ingestion path.

This runner/signer is a future integration gate. The current CI fixture produces test keys and signed artifacts only to exercise the pipeline; those test fixtures are not production authority.

## Research basis

- Roesner and Kohno, *Reflections on Trusting Trust, Revisited: Contaminating Self-Modifying AI Coding Agents with Poisoned Benchmarks* (arXiv:2609.17817v1, 15 Sep 2026): demonstrates that poisoned benchmark inputs can influence self-modifying coding agents and persist into neutral held-out tasks. NK1 response: independent host-owned verifier, signed task evidence and immutable evaluator boundary. https://arxiv.org/abs/2609.17817
- Wang et al., *Do Androids Dream of Breaking the Game? Systematically Auditing AI Agent Benchmarks with BenchJack* (arXiv:2605.12673v1, 12 May 2026): reports exploitable flaws across 10 agent benchmarks and proposes adversarial benchmark audits. NK1 response: evaluator integrity tests, signed artifacts, process-local authentication and explicit self-modification protection. https://arxiv.org/abs/2605.12673
- Zhao et al., *SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents* (arXiv:2605.21384v1, 20 May 2026): measures the gap between visible validation and hidden compositional tests, with the gap increasing on longer tasks. NK1 response: hidden paired holdout evidence separate from candidate-visible observations. https://arxiv.org/abs/2605.21384

These papers motivate defensive engineering; they do not prove that NK1 is conscious, autonomous in a human sense, or empirically improved.

## Remaining gates

1. Provision a production host signer and verifier keyring outside NK1.
2. Build the isolated evaluator/runner that executes the exact patch against the exact base SHA and emits signed P36 artifacts.
3. Wire the factory and host trust configuration into the real Core composition root; test cold restart, key rotation, manifest versioning and revocation.
4. Add a staging-only executor that applies the same receipt-bound patch in a disposable worktree/container, checks exact post-tree SHA and proves rollback.
5. Only after independent paired-seed holdout uplift, a separate reviewer and an operator approval may any candidate be promoted. Longitudinal retention needs a separate delayed evaluator; this point-in-time P36 route cannot claim it.

No production private key, third-party dependency, persisted schema migration or Release ZIP update is introduced by this implementation.
