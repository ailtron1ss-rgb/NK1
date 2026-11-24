# Neuro-Kurisu 35.6.9 / B356 — Release Notes

## B356 — causal compositional trajectory
B355 proved a first committed compositional step. B356 upgrades this to a repeated causal trajectory gate with restart continuity and a matched OFF counterfactual.

### Functional changes
- B276 persists a bounded execution history of completed program steps.
- B276 program bias is now tied to the current execution cursor instead of leaking influence from later steps.
- Added `test:big-pass-356:compositional-trajectory`.

### Evidence
- 5 independent seeds: PASS.
- 15/15 ordered primitive commitments: PASS.
- 15/15 restart-resumed steps: PASS.
- 5/5 persisted completions: PASS.
- 5/5 OFF cursor-protection checks: PASS.
- 5/5 OFF counterfactual first-action divergences: PASS.
- Brick 3 B353 causal SNN baseline remains PASS after B356 changes.
- Brick 1 B351 DIT remains PASS after B356 changes.

### Remaining work
Brick 4 is not fully complete. The next mandatory gate is program-level consequence learning and unseen-context transfer with a matched ablation/sham test, while preserving restart continuity and the existing B269 causal baseline.
Physical Android/Termux remains an OPEN gate.
