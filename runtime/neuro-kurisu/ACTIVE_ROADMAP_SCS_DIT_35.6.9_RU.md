# Active Roadmap — 35.6.12 / B359

## Current gate status
1. Brick 0 — SPINE_ONLY: CLOSED.
2. Brick 1 — DIT: PASS; endogenous learning, restart continuity, distributional identity change, B299 ablation and sham criteria all PASS.
3. Brick 2 — Cheap cycle / long horizon: CLOSED on host mobile-profile; physical Android/Termux remains OPEN.
4. Brick 3 — Causal SNN: REPLICATION CLOSED on host. B269 structural lesion remains causally active across 5 independent training trajectories × 4 contexts with restart continuity.
5. Brick 4 — compositional action programs: MULTI-STEP CAUSAL TRAJECTORY PASS on host.

## B359 — compositional trajectory causal gate
The previous B355 gate proved only one committed program step. B359 upgrades the acceptance criterion to a trajectory-level test.

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

## B359 implementation hardening
- B276 execution now records a bounded persistent execution history (64 events).
- B276 action bias is cursor-aware: only the currently executable primitive receives program bias, preventing future steps from leaking into the current decision.
- Release bumped to 35.6.12.
- The B359 trajectory test is registered as `test:big-pass-356:compositional-trajectory`.

## Evidence boundary
This closes the first causal compositional-execution subgate on host. It does NOT yet prove open-ended planning, arbitrary program discovery, multi-step reward optimization, physical Android execution, or consciousness.

## Next mandatory step: Brick 4 — causal program learning/generalization
Before moving to Brick 5, the next gate must test whether verified programs become better through consequences and transfer to unseen contexts rather than merely executing once verified. The program-level learning signal must have its own matched ablation/sham criterion, with restart and long-horizon execution retained.


## B359 / 35.6.12 — multi-episode program plasticity
- PASS: 5/5 independent seeds.
- Two structural revisions per seed: 10/10 revision events.
- Revised order persists across restart in every seed.
- Step credits are permuted together with program structure; stale index attribution is prevented.
- Unseen-context transfer gain exceeds matched sham in all 5 seeds.
- Previous B356 long-horizon benchmark produced `pass=true` for all 5 trajectories but did not terminate cleanly under the short external runner timeout; treat clean process-exit as an engineering OPEN item, not as a functional failure.
- Brick 5 remains locked until long-horizon clean-exit/runtime gate is closed.
