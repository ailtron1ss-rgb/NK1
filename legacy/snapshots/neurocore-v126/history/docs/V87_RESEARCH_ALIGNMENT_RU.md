# NeuroCore V87 — Research Alignment

## Model-aware replay selection

Gradient-based sample selection work formulates replay selection through the optimization constraints that samples impose on the model and connects selection quality with diversity in parameter-gradient space. V87 narrows this idea to a cheap current-model error probe; it deliberately does not pretend that a detached loss is a true influence function.

Source: https://arxiv.org/abs/1903.08671

## Influence-aware selection

Influence-function literature for continual learning shows that interactions between successive sample selections can matter, motivating utility criteria beyond raw write-time priority. V87 borrows only the principle that current model state should affect selection; it does not implement a second-order influence calculation.

Source: https://arxiv.org/abs/2304.10177

## Replay strategy sensitivity

Comparative replay studies report strong dependence on the sample-selection strategy and memory budget. This motivates keeping V86 coverage/reuse diagnostics as a hard safety layer around the new model-aware utility.

Sources:
- https://arxiv.org/abs/2208.02660
- https://arxiv.org/abs/2108.06758

## What is deliberately not claimed

`current-model error` is a model-aware utility proxy, not a proof of causal parameter influence. V87 must still be qualified against strong continual-learning baselines on longer external streams.
