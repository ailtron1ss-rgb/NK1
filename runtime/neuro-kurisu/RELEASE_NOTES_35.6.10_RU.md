# Release 35.6.10 / B357

Дата: 2026-09-14

B357 closes the next causal Brick 4 gate: compositional programs now receive explicit execution-consequence plasticity and use that learned evidence in unseen-context transfer.

## Functional
- B276 consequence EMA and step/action credit added.
- OrganismCore outcome loop feeds the executed primitive's result back to B276.
- Transfer generalization includes learned consequence evidence.
- New regression: `test:big-pass-357:program-learning`.

## Evidence
- 5/5 independent seeds.
- 5/5 trained unseen-context transfers.
- 5/5 trained-vs-sham transfer comparisons PASS.
- B351 DIT PASS.
- B353 causal SNN PASS.
- B355 compositional execution PASS.
- B356 restart trajectory PASS.

## Engineering boundary
Physical Android/Termux remains OPEN. Phenomenal consciousness remains UNKNOWN.

A full B354 replicated-SNN rerun was not used as a fresh PASS in this release because its heavy host benchmark exceeded the available execution window; the prior verified B354 evidence remains unchanged and the B269 source was not modified by B357.

Core integration check: 3/3 PASS; real `OrganismCore.observe()` selection followed by `feedback()` increased B276 consequence EMA in all three cases.
