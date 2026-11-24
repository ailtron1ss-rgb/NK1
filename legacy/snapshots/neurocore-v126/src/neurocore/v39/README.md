# NeuroCore V39 — Outcome-Conditioned Conservative Policy Improvement

V39 extends V38 with a bounded policy-improvement loop:

`real outcome -> action credit -> bounded candidate -> world-model utility check -> action`

and, during training:

`candidate weight update -> held-out verifier -> accept/rollback`.

The runtime acceptance comparator is a **model-based proxy**, not an external proof. The stronger weight-update guard is the trainer's held-out harness. A successful optimizer step is not counted as a successful improvement unless the held-out slice remains within the configured regression margin.
