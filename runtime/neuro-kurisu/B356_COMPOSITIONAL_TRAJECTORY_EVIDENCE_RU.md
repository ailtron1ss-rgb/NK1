# B356 — Causal Compositional Trajectory Evidence

## Test
`tests/big-pass-356-compositional-trajectory-restart.mjs`

## Design
Five independent program initializations were created from distinct context/latent inputs. Each program was explicitly verified through the B276 trial gate, then persisted to a snapshot. Execution resumed from a fresh `OrganismCore` before every individual primitive.

## Results
- Seeds: 5/5 PASS.
- Program depth: 3 primitives in every tested seed (within required 3–8 range).
- Exact ordered commitments: 15/15 PASS.
- Restart continuity: 15/15 PASS.
- Completion persistence: 5/5 PASS.
- Execution OFF cursor protection: 5/5 PASS.
- Counterfactual first-action divergence: 5/5 PASS.

Observed trajectories:
- seed 1: verify → explore → reflect
- seed 2: explore → respond → reflect
- seed 3: respond → explore → reflect
- seed 4: wait → respond → explore
- seed 5: reflect → respond → explore

Counterfactual OFF first actions were respectively:
- wait
- wait
- rest
- explore
- wait

Thus ON selected the program primitive while the matched OFF condition selected a different action in all five seeds and did not advance the execution cursor.

## Engineering hardening
B276 now persists `executionHistory` (bounded to 64 events) and `actionBias()` is cursor-aware: only the current executable primitive receives compositional program bias.

## Evidence boundary
This is a causal host-runtime compositional-execution result. It does not establish open-ended planning, arbitrary program synthesis, program-level reinforcement learning, physical Android/Termux execution, or phenomenal consciousness.
