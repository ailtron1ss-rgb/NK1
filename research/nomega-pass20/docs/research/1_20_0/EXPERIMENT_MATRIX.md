# NΩ 1.20 — Planned Experimental Matrix

All future high-impact changes should be evaluated using the same task splits, seeds and
compute budget whenever mechanisms are compared.

## Factor A: generation

- retrieval only
- template / deterministic baseline
- neural proposal
- neural + retrieval
- neural + retrieval + counterexample search
- neural + retrieval + value model

## Factor B: verification

- single TinyVM execution
- TinyVM + HVM agreement
- independent test set
- independent test set + generated adversarial set

## Factor C: learning

- supervised task-family training
- execution-feedback training
- counterexample replay
- value-model training
- test-time RL / local adaptation

## Factor D: self-evolution

- no evolution
- bounded configuration search
- strategy archive
- code-level mutation in isolated branch
- descendant/metaproductivity scoring

## Required metrics

`verified_rate`, `holdout_rate`, `OOD_rate`, `adversarial_rate`, `HVM_agreement`,
`mean_search_cost`, `p95_latency`, `memory`, `restart_delta`, `negative_transfer`,
`future_cycle_gain`, and `promotion_decision`.

## Promotion

A candidate is promoted only when it improves the target capability without crossing the
regression/resource/restart gates defined by the governance protocol.
