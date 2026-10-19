# Active Roadmap — 35.6.10 / B357

## Current gate status
1. Brick 0 — SPINE_ONLY: CLOSED.
2. Brick 1 — DIT: PASS; endogenous learning, restart continuity, distributional identity change, B299 ablation and sham criteria all PASS.
3. Brick 2 — Cheap cycle / long horizon: CLOSED on host mobile-profile; physical Android/Termux remains OPEN.
4. Brick 3 — Causal SNN: REPLICATION CLOSED on host. B269 structural lesion remains causally active across 5 independent training trajectories × 4 contexts with restart continuity.
5. Brick 4 — compositional action programs: PROGRAM CONSEQUENCE LEARNING + UNSEEN TRANSFER PASS on host.

## B356 — compositional trajectory causal gate
The previous B355 gate proved only one committed program step. B356 upgrades the acceptance criterion to a trajectory-level test.

Required checks and results:
- 5 independent program initializations: PASS.
- Each verified program has 3–8 primitives: PASS.
- Every primitive in every tested trajectory is selected in the exact persisted order: 15/15 steps PASS.
- Restart between every step: 15/15 steps PASS.
- Completion state persists after the final restart: 5/5 PASS.
- Execution OFF leaves cursor unchanged: 5/5 PASS.
- Counterfactual OFF selected a different first action in 5/5 seeds: PASS.
- Constitutional/external governance remains dominant: preserved in the core execution gate.

The causal interpretation is stronger than B355: the program is not only stored and counted; its next primitive changes the actual selected action, survives restart, and continues the multi-step trajectory. OFF removes that execution effect.

## B356 implementation hardening
- B276 execution now records a bounded persistent execution history (64 events).
- B276 action bias is cursor-aware: only the currently executable primitive receives program bias, preventing future steps from leaking into the current decision.
- Release bumped to 35.6.10.
- The B356 trajectory test is registered as `test:big-pass-356:compositional-trajectory`.

## B357 — consequence learning and unseen-context generalization
B356 proved multi-step execution with restart, but did not prove that a program learns from its own consequences. B357 adds an explicit execution-outcome plasticity path in B276 and connects it to the organism outcome loop.

Required checks and results:
- 5 independent program seeds: PASS.
- Positive execution consequences increase current-primitive causal bias: 5/5 PASS.
- Learned action consequence credit exceeds 0.65 in all 5 seeds: PASS.
- Program consequence EMA after positive outcomes: 0.819568 in all 5 matched trajectories.
- Matched sham consequence EMA: 0.618288.
- Transfer to an unseen context succeeds in 5/5 trained cases.
- Trained unseen-context transfer gain exceeds matched sham in 5/5 cases.
- Mean trained transfer gain: 0.62118. Mean sham transfer gain: 0.41899.
- B351/B353/B355/B356 targeted regression remains PASS.

Implementation changes:
- B276 programs now keep consequenceEMA01, bounded step credits and action-level consequence credits.
- Real execution outcomes in OrganismCore feed the currently executed primitive back into B276.
- Transfer gain now includes learned consequence/generalization evidence instead of relying only on latent similarity.
- B276 diagnostics expose active program learning state for reproducible evidence.

A first implementation attempt failed the unseen-transfer assertion because the transfer path underweighted learned consequence evidence. That result was retained as methodological evidence; the mechanism was strengthened and the unchanged acceptance criterion then passed 5/5.

## Next mandatory step: Brick 4 — learned program revision / causal ablation
Before moving to Brick 5, the next gate must prove that consequence learning can revise program structure or primitive preferences over repeated episodes, not only strengthen scalar confidence. It must include matched program-ablation/sham, restart continuity and long-horizon execution.
