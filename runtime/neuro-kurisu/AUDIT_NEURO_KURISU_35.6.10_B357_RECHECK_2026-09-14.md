# Neuro-Kurisu — Strict Recheck Audit 35.6.10 / B357

Дата: 2026-09-14
База: 35.6.9 / B356

## 1. Mandatory gate
B356 required proof that compositional programs learn from consequences and transfer to unseen contexts before Brick 5.

## 2. Implementation
- B276 stores consequenceEMA01, adaptationCount, stepCredits01 and actionConsequenceCredits01.
- `observeExecutionOutcome()` is called from OrganismCore after an actual program primitive reaches the organism outcome loop.
- Transfer gain now includes learned generalization evidence.
- Diagnostics expose active program consequence state.

## 3. B357 evidence
5/5 independent seeds PASS.
- baseline primitive bias mean: 0.032703
- trained primitive bias mean: 0.040643
- trained consequence EMA: 0.819568
- sham consequence EMA: 0.618288
- trained transfer gain mean: 0.621179
- sham transfer gain mean: 0.418990

Every trained program transferred to an unseen context and exceeded its matched sham.

Core integration: 3/3 PASS. In real OrganismCore runs, the selected primitive advanced the execution cursor and subsequent feedback increased consequence EMA from 0.5704 to 0.71445344.

## 4. Regression
B351 current rerun PASS: DIT criteria all true; lesion-vs-normal L1 0.337522; sham-vs-normal L1 0.000808.
B353 current rerun PASS: causal L1 0.078021; sham L1 0.017803; ratio 4.38248.
B355 current rerun PASS.
B356 current rerun PASS.
B354 heavy replicated benchmark was not reaccepted from a fresh run because the fresh host execution exceeded the available test window. Previous verified B354 evidence remains stored unchanged in `B354_CAUSAL_REPLICATION_EVIDENCE_RU.md`; B357 does not modify B269.

## 5. First implementation failure retained
The initial B357 unseen-transfer test failed because the transfer path underweighted learned consequence evidence. The acceptance threshold was not lowered. The transfer mechanism was revised and the same 5-seed test then passed.

## 6. Progress
Brick 0 100% CLOSED.
Brick 1 100% PASS.
Brick 2 host 100%; physical Android/Termux OPEN.
Brick 3 host replication CLOSED.
Brick 4 multi-step execution PASS; consequence learning + unseen transfer PASS.
Brick 5 ~25%.
Brick 6 ~25%.
Brick 7 ~20%.
Brick 8 ~40%; phenomenal consciousness UNKNOWN.

Brain/identity branch: ~62% by current declared milestone path.
Autonomous organism on real medium Android/Termux: ~41%; physical device gate remains OPEN.

## 7. Next mandatory gate
Do not move to Brick 5 yet. Brick 4 still needs proof that consequence learning can revise program structure or primitive preference across repeated episodes, with matched program ablation/sham, restart continuity and long-horizon execution.
