# WorkPass95 — continual skill learning research and implementation

**Date:** 2026-10-20  
**Branch:** `workpass79-cognitive-rebuild`  
**Status:** implementation committed; exact-head CI must confirm behavior.

## Research findings that constrain the design

1. **SkillLearnBench (2026):** evaluates generated skill quality, execution trajectory and final outcome separately. It reports that no continual-learning method wins consistently across tasks, and that repeated iterations with external feedback can improve skills while self-feedback alone can drift.
   - Paper: https://arxiv.org/abs/2604.20087
   - Project / benchmark: https://cxcscmu.github.io/SkillLearnBench/
   - Upstream code: https://github.com/cxcscmu/SkillLearnBench
2. **ContinualSkillBench (2026):** reports that sequential task execution can improve capability, but explicit skill maintenance does not guarantee transferable abstraction; transfer varies by model/domain and task structure.
   - Paper: https://arxiv.org/abs/2608.03874
3. **EXIF (2025):** uses environment-grounded exploration and iterative feedback to generate useful skill-learning data rather than relying only on tasks proposed from a model's own assumptions.
   - Paper: https://arxiv.org/abs/2506.04287
4. **Voyager (2023; TMLR 2024):** combines an automatic curriculum, executable skill library and an iterative environment-feedback/self-verification loop; it demonstrates a useful pattern for accumulating compositional skills without requiring fine-tuning.
   - Paper: https://arxiv.org/abs/2305.16291
   - MIT-licensed upstream implementation: https://github.com/MineDojo/Voyager

## Changes implemented through WorkPass96

- `P23LearningEngine.skillBias()` now supports **bounded nearest-context transfer** when no exact context skill exists. Transfer requires a promoted skill, at least four held-out validation examples, validation success of at least 0.70 and confidence of at least 0.4. The source and target must match in at least five of six normalized state buckets.
- Transfer influence is deliberately smaller than exact-context influence and scales with validation support and context similarity. Dissimilar contexts receive no transferred bias. This is a conservative inductive bias, not a claim of universal skill transfer.
- `ParametricPolicyLearner.restore()` now replaces non-finite persisted weights/biases with zero instead of allowing NaN/Infinity to poison future predictions.
- Both parametric training entry points now sanitize non-finite learning rates and sample weights before gradient updates.
- P23 regressions now exercise positive near-context transfer, distant-context rejection, conservative negative transfer, skill aging/forgetting, and rollback after validation deterioration.
- P26's fixed synthetic holdout suite trains on a deterministic state/action dataset and evaluates generalization on a separate deterministic set; the test enforces >90% action accuracy and finite model state after malformed inputs.
- The P23 integration test is wired into CI to cover core feedback, explicit replay, checksums and persistence across restart.
- Exact-context skill influence decays with a 30-day half-life and expires after 180 days without fresh validation; rejected-skill negative transfer remains bounded and returns a true zero when absent.
- Replay now caps large consolidation calls at 64 experiences, first selecting representatives across distinct context/action strata, then filling remaining slots by surprise and age. Small batches are fully replayed.
- P23 rejects non-finite outcome labels before they enter the experience buffer, instead of clamping malformed labels into apparently valid observations.
- Validation deterioration can revoke promotion; tests exercise promotion followed by a poor later validation window.
- A dedicated GitHub Actions workflow runs runtime typecheck, P23/P26 learning regressions, predictive-transfer regression and personal-curriculum regression.

## Deliberate limits / next research steps

- No upstream source code was copied in this pass; the work adapts specific design principles. Any future code import requires file-level license/provenance review.
- The existing P23 reward/validation model is not yet a substitute for an independent real-world task verifier. Future promotion should increasingly depend on trustworthy outcomes, held-out tasks, retention after delay, transfer to new contexts, efficiency/cost and rollback after regressions.
- Still open: externally grounded outcome verification before promotion, balanced/prioritized replay for large queues, and benchmark suites using real environment/tool outcomes. Current holdout tasks are deterministic synthetic tests, not evidence of real-world task success.
- Do not count a skill as a capability improvement merely because it was written, promoted or invoked. Require outcome improvement against a baseline and report uncertainty/sample counts.


## WorkPass97 — retention refresh correctness and Node.js 24 CI (2026-10-20)

A retention bookkeeping defect was found during the broader pass: the learned skill's `updatedAt` was not refreshed when new examples arrived but the validation score stayed within the previous 0.02 update threshold. That could cause a continuously reinforced skill to age out as if it had received no new evidence. Skill records now refresh on evidence-count or validation-window movement, with a regression covering nearly unchanged held-out performance. Repository workflows were migrated to current `actions/checkout@v7` and `actions/setup-node@v7`, with Node.js 24 as the test runtime and `.nvmrc`. The updated CI adds explicit runtime, cognitive ownership and runtime-smoke gates. This is a code-level retention correction and CI modernization; synthetic tests still do not establish external outcome truth or real-world agent learning quality.
