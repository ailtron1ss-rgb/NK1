# Release Notes B342 — Personality Generalization

## Functional change
B299 now maintains context-independent personality trait traces (`traitFast11`, `traitSlow11`, `traitEvidence01`) and uses a bounded generalized trait signal in action bias.

## Evidence
Controlled unseen-context holdout passed:
- baseline bias `0`;
- holdout bias `0.0434950065`;
- exact restart preservation;
- personality lesion removes the effect.

Live Core unseen-context holdout remains OPEN because endogenous action selection did not produce enough target-action experiences during the bounded 120-observation run.

## Quality checks
- typecheck: PASS
- core ownership: PASS
- architecture: PASS
- integrity: PASS
- B338/B339/B340/B341 regressions: PASS
- B342 controlled holdout: PASS
- B342 live Core holdout: OPEN

## Interpretation
B342 is a functional deepening of the existing personality substrate, not a new isolated personality subsystem.
