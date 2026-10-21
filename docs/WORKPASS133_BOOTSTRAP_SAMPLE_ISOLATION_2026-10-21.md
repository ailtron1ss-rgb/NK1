# WorkPass133 — bootstrap sample isolation
Date: 2026-10-21

## Summary

WorkPass133 closes a reproducibility flaw in the seed-clustered bootstrap confidence interval. The interval already resampled only complete paired seed-level outcome deltas, but the deterministic random stream identity included all observed seed IDs, including incomplete seeds excluded from the estimate. Consequently, adding an irrelevant incomplete seed could alter the sampled percentile interval even though the actual complete paired sample did not change.

The stream identity now uses only the sorted seed IDs that contributed complete baseline/candidate coverage. The estimate remains deterministic and paired at the seed level.

## Code changes

- `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeLedger.ts`
  - Each accepted seed-level aggregate retains its seed identity.
  - Bootstrap identity is built from `paired.map(row => row.seed)`, not all keys seen in the raw evidence map.
  - Incomplete seed coverage is still excluded as a whole; no partial-task fallback was introduced.
- `runtime/neuro-kurisu/tests/p23-seed-clustered-outcome-comparison.mjs`
  - Added a second ledger containing the same complete paired sample but no incomplete seed rows.
  - Asserts the bootstrap interval is identical between that ledger and the original ledger that includes an incomplete seed.
- `docs/RESEARCH_INTAKE_LEDGER.md`
  - Added a research refresh for retention-bench and AgentMemoryBench, including bounded adaptation decisions and data/code non-copying boundary.
- `CHANGELOG.md` and `NEUROCORE_START_HERE.md`
  - Updated durable work history and continuation checkpoint.

## Research consulted

- SkillLearnBench repository: https://github.com/cxcscmu/SkillLearnBench — separates skill artifact quality, execution trajectory and verified task outcome. NK1 uses this as evaluation design guidance; upstream task code and data were not copied. See the upstream repository and benchmark description: https://cxcscmu.github.io/SkillLearnBench/
- retention-bench: https://github.com/symbolfarm/retention-bench — emphasizes a hard process-kill reset and distinguishes surviving stored state from integrated capability. NK1's existing reset-retention evaluator should be exercised through a real subprocess harness, not treated as validated by in-process tests alone.
- AgentMemoryBench: https://github.com/solomoon313/AgentMemoryBench — describes separate offline, online, replay, transfer and repair modes. NK1 should report these separately rather than collapsing them into a single learning score.

No external implementation or benchmark dataset was copied or vendored in this pass. This pass integrates a protocol insight into the NK1 evidence path and records two follow-up evaluation candidates; it does not implement a full external benchmark runner.

## Verification status

- GitHub source updates returned commit SHAs for the ledger and regression test.
- Runtime execution: **not confirmed**.
- TypeScript typecheck: **not confirmed**.
- Exact-head GitHub Actions: **not confirmed**.
- Live learning uplift, retention, transfer and repair gain: **not measured**.

The confidence interval is a sensitivity estimate over a small set of independent seeds. Bootstrap does not cure tiny sample sizes, selection bias, untrusted outcomes or a non-representative task suite. The existing Student-t gate remains in place; this pass does not relax promotion safeguards.

## Status and next work

**Completed in this pass:** deterministic bootstrap identity uses complete paired seeds; regression for irrelevant incomplete evidence; research intake and durable checkpoint updated.

**Still open / P0:** production trusted-run resolver and verifier-key registry; authenticated approval authority; audit all skill activation constructors and bypasses; restore actionable CI job logs and run the relevant tests/typecheck; run real process-reset retention, cross-family transfer and repair experiments on matched task/seed budgets.

PR #12 remains draft and unmerged. Main branch is unchanged.
