# P2587–P2598 — design decisions

1. **Transfer before memorization.** Exact memory remains useful, but unknown states should fall back to prototype skills and finally action priors.
2. **Skill representation.** Each procedural skill stores context prototype, action-conditioned delta prototype, successor-feature vector, reward/success/confidence/stability and contradiction statistics.
3. **Intervention before commitment.** Under high uncertainty or prediction error, a bounded probe is allocated to another candidate action.
4. **Recovery is first-class.** Large prediction error raises recovery pressure and biases toward verification/exploration/reflective actions already proven in the learned skill bank.
5. **Long horizon only when worth it.** H8/H16 are selective, not always-on, to preserve phone feasibility.
6. **Causal learning focus.** Latent dimensions with stronger action-caused change receive more learning weight, inspired by CAER but implemented as a lightweight local heuristic.
7. **No fake consciousness claim.** The project still implements functional mechanisms relevant to continuity, self-directed learning, world modelling and memory. This release does not establish subjective consciousness.
8. **Benchmark honesty.** Synthetic holdout and transfer metrics are labeled as architecture tests. They are not equivalent to open-world generalization.
