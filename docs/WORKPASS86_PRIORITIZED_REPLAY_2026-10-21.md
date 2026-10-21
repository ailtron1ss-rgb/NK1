# WorkPass86 — prioritized replay adaptation (2026-10-21)

## Source chosen
OpenAI Baselines: https://github.com/openai/baselines
Inspected `baselines/deepq/replay_buffer.py` and its MIT `LICENSE`. The source uses proportional prioritization, stratified sampling across priority-mass intervals, and normalized importance weights.

## Implemented
- Added `PrioritizedReplaySampler.ts`, a small dependency-free TypeScript implementation over caller-owned candidates.
- Added absolute TD-error-to-priority conversion with positive epsilon.
- Added proportional sampling with stratified intervals and normalized importance weights.
- Added deterministic RNG injection and validation for malformed priorities, weights, sample count, and RNG output.
- Added a focused sampler regression, an integration regression for the opt-in prioritized strategy in the existing replay trainer, and a workflow step.
- Preserved upstream MIT license and provenance/intake note.

## What improves
Uniform replay treats every remembered example equally. Prioritized replay can spend more updates on examples where the learner's prediction error is higher, while importance weights partially correct the sampling bias. This is a mechanism-level capability, not a measured quality uplift.

## Explicit limits
- The sampler is not wired into the production feedback owner yet; no second memory owner was introduced.
- Priority must come from measured TD/prediction error or verified outcomes, not arbitrary/untrusted reward.
- This adapts a mechanism, not the whole Baselines RL stack; NumPy/segment-tree/Python dependencies were intentionally not imported.
- CI evidence: run 39554673362 on the earlier PR head completed with failure, but GitHub returned no job steps and the log endpoint returned `BlobNotFound`; root cause is unresolved. No run is visible for the final head yet. Treat tests/typecheck as unverified; no pass or learning uplift is claimed.
