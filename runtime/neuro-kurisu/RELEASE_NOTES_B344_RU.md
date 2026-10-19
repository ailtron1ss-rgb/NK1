# RELEASE NOTES B344

B344 закрывает late-arbitration seam между B297 personality executive influence и финальным candidate field `OrganismCore`.

Изменено:
- `OrganismCore`: bounded endogenous-only personality carryover после B297/B291/pre-selection stages;
- carryover зависит от learned B297 personality authority/reliability + B299 consolidation/generalization;
- personality lesion полностью убирает B299 часть carryover;
- добавлен regression test `tests/big-pass-344-personality-decision-carryover.mjs`;
- добавлен npm script `test:big-pass-344:personality-decision-carryover`.

Verified:
- full-Core controlled personality-vs-lesion candidate distribution shift: PASS;
- `verify` score delta `+0.08605`;
- candidate-distribution L1 `0.16883`;
- restart personality bias persistence: PASS;
- typecheck/core ownership/architecture/integrity/release contract: PASS.

Known open evidence:
- B342 live unseen-context endogenous holdout remains OPEN;
- B341 full Core long run remains OPEN/TIMEOUT;
- post-B344 executable syntax audit exceeded local execution budget and is not claimed PASS.

No consciousness or human-level personality claim is made.
