# WorkPass134 — bind outcome evidence to the exact task manifest
Date: 2026-10-21

## Summary

This pass closes two trust-boundary gaps in the learning-evaluation pipeline. It does not change the learner's update rule or claim better learning performance.

## Code changes

1. `VerifiedOutcomeArtifact.ts`
   - Before validating a signed outcome, reconstructs the caller-supplied manifest through the canonical manifest validator and compares its fingerprint to the ledger's manifest fingerprint.
   - Rejects malformed manifests and manifests that differ from the ledger before signature acceptance or ledger mutation.
   - This prevents the ingestion boundary from using a side manifest with changed task split/family/prompt metadata while the signature references the ledger's manifest.

2. `VerifiedOutcomeLedger.ts`
   - Runtime validation now requires non-empty string task IDs, family names, versions and verifier IDs.
   - Runtime validation now restricts split to `train`, `validation`, or `holdout` and requires a SHA-256 prompt fingerprint string.
   - This prevents malformed split labels from silently falling outside expected train/holdout coverage and creating misleading evaluation results.

3. Regression coverage
   - Signed-artifact authentication tests now reject manifest substitution and malformed/duplicate-task manifests.
   - Seed-clustered outcome tests now reject unknown split labels and whitespace-only family names.

## Files changed

- `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeArtifact.ts`
- `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeLedger.ts`
- `runtime/neuro-kurisu/tests/p23-verified-outcome-artifact-authentication.mjs`
- `runtime/neuro-kurisu/tests/p23-seed-clustered-outcome-comparison.mjs`
- `docs/RESEARCH_INTAKE_LEDGER.md`
- `CHANGELOG.md`

The existing continual-learning workflow already includes both modified implementation files and both regression paths.

## Research relationship

This is an evidence-integrity adaptation consistent with the manifest-bound evaluation discipline used in SkillLearnBench-style controlled comparisons and signed-artifact provenance patterns. No third-party code or dataset was copied. The change improves the trust boundary for interpreting measurements; it is not evidence of a higher task success rate.

## Verification status

- GitHub file updates were committed to `workpass124-learning-evidence-hardening`.
- **Not verified:** runtime test execution, TypeScript typecheck and exact-head GitHub Actions. Prior Actions jobs were returned without usable step logs; source edits are not equivalent to passing tests.
- **Not measured:** online learning uplift, transfer, hard-reset retention or repair gains.
- PR #12 remains draft and unmerged.

## Next priorities

1. Obtain an actionable runner-backed CI run and execute the exact-head tests/typecheck.
2. Continue the production trust chain: trusted verifier-key lifecycle/revocation, trusted run-context resolver, and authenticated approval authority.
3. Audit all candidate-store constructors and activation paths for bypasses.
4. Run matched multi-seed task-family experiments for online learning, replay, transfer, repair and hard-process-reset retention.
