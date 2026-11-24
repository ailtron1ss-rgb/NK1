# B358 — Learned Program Revision / Restart / Ablation Evidence

Release: 35.6.11 / B358

## Gate
Brick 4 now requires more than scalar consequence learning: repeated outcomes must be able to change the persistent executable program structure. The gate requires independent seeds, restart continuity and matched program ablation.

## Implementation
B276 now accumulates per-step consequence credits and, at a sequence boundary after sufficient evidence, reorders the persistent execution plan by learned step utility. The revision is structural: `executionPlan` and the aligned node sequence change, `structureRevisionCount` increments, and the revision is persisted in the state snapshot. Mid-action rewriting is prohibited.

## Evidence
- 5/5 independent seeds PASS.
- 5/5 programs changed execution order after learning.
- 5/5 revised plans survived restart exactly.
- 5/5 matched program-ablation conditions restored the unrevised plan.
- 5/5 trained next-step preference differed from ablated next-step preference.

## Example
`rest → respond → explore` became `respond → explore → rest` after differentiated consequence evidence and remained so after restart; ablation restored `rest → respond → explore`.

## Interpretation
This is evidence that consequence learning can modify the organism's persistent compositional policy structure, not only scalar confidence. It is not yet proof of full autonomous program invention or long-horizon planning.

## Outstanding
Brick 4 still requires longer multi-episode revision, program-level causal ablation across new contexts, and a clean long-horizon runtime profile. Brick 5 must remain closed until those gates pass.
