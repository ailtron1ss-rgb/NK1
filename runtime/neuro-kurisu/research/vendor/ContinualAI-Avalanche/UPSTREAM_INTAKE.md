# ContinualAI Avalanche — upstream intake

- Repository: https://github.com/ContinualAI/avalanche
- Inspected files: `README.md`, `LICENSE`, `avalanche/training/plugins/replay.py`
- Inspected revision: `master` at intake time; pin a commit SHA before any future source-code import.
- License: MIT; upstream license text is preserved in this directory.
- Relevant mechanism: bounded exemplar memory, replaying prior experiences alongside the current task, and balancing replay batches across task/experience groups.
- Adaptation: `ContinualReplayBuffer.ts` implements dependency-free reservoir sampling and task-balanced sampling; `trainWithExperienceReplay` composes replay samples with the current training batch and updates the existing `ParametricPolicyLearner`.
- Not copied: Avalanche's Python/PyTorch plugin, data loader, or training framework. They are not directly runnable in this TypeScript/phone-oriented runtime and would add a large incompatible dependency surface.
- Boundaries: this is a mechanism adaptation, not a claim of Avalanche algorithm parity. The buffer stores feature/target experiences, not raw conversations or personal text. Production integration still needs an explicit caller that supplies independently verified targets and a persistence/retention policy.
- Validation: the deterministic regression is wired into the existing P26 GitHub Actions workflow. Do not call it passed until a live run reports success.
