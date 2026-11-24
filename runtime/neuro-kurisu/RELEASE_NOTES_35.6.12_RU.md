# Neuro-Kurisu 35.6.12 / B359

## Major change
Multi-episode compositional program plasticity with restart persistence, unseen-context transfer, and causal sham/ablation.

## Important correctness fix
When B276 revises the program order, `stepCredits01` are now permuted with the same structural mapping as the executable plan and neural nodes. This prevents stale credit attribution after the first revision.

## Evidence
5/5 independent seeds passed. Each seed produced two sequential structural revisions (10/10 total), preserved both revisions after restart, and achieved higher unseen-context transfer gain than matched sham.

## Regression status
B358 PASS. B357 PASS in full runner window. B356 functional output remains PASS but clean process termination is still OPEN under the short external runner.

## Explicit limitation
No claim is made that Brick 5 predictive planning is unlocked. The long-horizon clean-exit gate remains mandatory.
