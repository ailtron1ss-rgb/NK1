# WorkPass85 — continual experience replay integration

**Date:** 2026-10-21  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Branch:** `workpass79-learning-input-integrity`  
**PR:** https://github.com/ailtron1ss-rgb/NK1/pull/13  
**Status:** implementation committed to the existing review branch; CI and runtime tests must be checked on the latest commit before this work is considered verified.

## In simple terms

The learner can now keep a bounded sample of past experiences and mix them into later training. This is intended to reduce the chance that learning a new task silently pushes out everything learned on older tasks. When replaying, the sampler tries to spread the batch across the task groups that are still represented in memory.

## Research and adaptation

Inspected the public MIT-licensed [ContinualAI/Avalanche](https://github.com/ContinualAI/avalanche) README, license and `avalanche/training/plugins/replay.py`. The upstream replay plugin maintains a bounded exemplar store, mixes memory examples into current training batches, and can balance batches across task experiences.

Adapted the mechanism natively for Neuro Kurisu's dependency-light TypeScript runtime. The upstream Python/PyTorch framework and data loader were not copied because they are not directly compatible with the current runtime. The upstream MIT license and provenance note are preserved under `runtime/neuro-kurisu/research/vendor/ContinualAI-Avalanche/`.

## Code changes

- Added `ContinualReplayBuffer.ts`: bounded Algorithm-R reservoir sampling; task-balanced replay sampling without replacement; validation of action, feature vector, target and learning rate; all-item preflight for batch intake; detached samples; snapshot/restore; task-level memory counts.
- Added `trainWithExperienceReplay`: samples old experiences before inserting current experiences, trains the existing `ParametricPolicyLearner` on current plus replay examples, and reports replay count, mean loss and per-task memory.
- Added `p26-continual-replay-buffer.mjs`: deterministic regression for capacity, seen count, task diversity, copy isolation, invalid-batch rejection, snapshot restore and learner/replay composition.
- Added the test to `.github/workflows/p26-learning-validation.yml`.
- Recorded the source and adaptation boundary in `docs/RESEARCH_INTAKE_LEDGER.md`.

## Evidence boundaries

This is a functional mechanism addition, not proof of better learning. The new regression has been wired to GitHub Actions but has not been confirmed passing in this report. Do not infer a measured retention improvement from the presence of a replay buffer. Still required: a successful live run, typecheck, multiple-seed/order experiments, and measured comparison against the same learner without replay. A trusted production caller must also supply targets from verified outcomes; the replay buffer itself does not establish reward truth.

## Next integration gates

1. Confirm CI and run the complete P26 learning suite on the latest PR head.
2. Connect the helper at the canonical learning-feedback call site after verifying reward/outcome provenance and avoiding duplicate training owners.
3. Compare replay vs no-replay on held-out task sequences; report old-task retention, new-task performance, reversal/recovery, memory size and task-order sensitivity.
