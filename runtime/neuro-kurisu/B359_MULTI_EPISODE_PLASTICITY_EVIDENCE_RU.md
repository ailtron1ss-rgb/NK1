# B359 / 35.6.12 — Multi-Episode Program Plasticity Evidence

## Purpose
Close the next mandatory Brick 4 gate after B358: prove that learned compositional structure can revise more than once, preserve credit alignment, survive restart, and transfer to unseen context with causal ablation/sham.

## Implementation change
`B276LatentActionProgramSynthesizer` now reorders `stepCredits01` together with `executionPlan` and `nodes` whenever a structural revision occurs. This removes stale index-to-credit attribution after the first revision.

## Evidence
- 5 independent seeds.
- 2 sequential structural revisions per seed.
- 10/10 revision events observed.
- Revised program order persisted after restart in all 5 seeds.
- Step-credit arrays after restart exactly matched the revised in-memory state.
- Unseen-context transfer gain exceeded matched sham in all 5 seeds.

## Representative results
- Seed 1: original `[rest, respond, explore]` -> revision 1 `[respond, explore, rest]` -> revision 2 `[respond, rest, explore]`; transfer 0.6303 vs sham 0.4349.
- Seed 2: original `[explore, respond, verify]` -> revision 1 `[respond, verify, explore]` -> revision 2 `[respond, explore, verify]`; transfer 0.6140 vs sham 0.4181.
- Seed 3: transfer 0.6130 vs sham 0.4179.
- Seed 4: transfer 0.6066 vs sham 0.4117.
- Seed 5: transfer 0.5945 vs sham 0.4084.

## Regression
- B358 structural revision/restart/ablation: PASS.
- B357 consequence learning/unseen transfer/Core loop: PASS in the full 175s runner window.
- B356 long-horizon trajectory: functional output previously reported `pass=true` for all 5 seeds, but the process did not terminate inside the short external runner window. This remains an engineering runtime OPEN item until clean exit is demonstrated.

## Gate decision
**PASS for multi-episode structural plasticity.**
Brick 5 predictive planning remains locked until the B356 long-horizon clean-exit/runtime gate is closed and a repeated multi-episode holdout is added.
