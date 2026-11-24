# Project Progress — 35.6.11 / B358

## Completed in this pass
1. Re-checked B357 state and roadmap.
2. Added persistent program-structure revision to B276.
3. Revision occurs only at sequence boundaries after repeated consequence evidence.
4. Added structure revision diagnostics and persistence.
5. Added B358 independent causal ablation/restart test.
6. Verified 5/5 seeds.
7. Preserved an explicit timeout/open status for the older B356 regression instead of masking it.

## Current gate status
Brick 4 execution: PASS.
Brick 4 consequence learning + transfer: PASS.
Brick 4 learned structural revision + ablation: PASS.
Brick 4 long-horizon regression: OPEN/TIMEOUT pending clean runtime window.
Brick 5 predictive planning: CLOSED until Brick 4 long-horizon gate is clean.
