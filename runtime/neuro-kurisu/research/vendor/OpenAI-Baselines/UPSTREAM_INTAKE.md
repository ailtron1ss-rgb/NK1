# OpenAI Baselines — prioritized replay intake

- Upstream: https://github.com/openai/baselines
- Inspected source: `baselines/deepq/replay_buffer.py`, `LICENSE`
- License: MIT; upstream copyright/license notice retained in this directory.
- Mechanisms adapted: proportional priority sampling, stratified mass intervals, normalized importance-sampling weights, positive epsilon on absolute TD error.
- Native adaptation: `PrioritizedReplaySampler.ts` is a dependency-free TypeScript sampler over caller-owned candidate records. It does not copy NumPy/segment-tree code or create another persistent memory owner.
- Boundaries: this is not a full Deep Q Network implementation. Sampling is not yet enabled in the production learning path. Priority values must be based on observed prediction error / verified feedback; no performance improvement is claimed until paired held-out tests run.
- Candidate upstream revision: inspected GitHub `master` content on 2026-10-21; pin a commit SHA before any future upstream code vendoring.
