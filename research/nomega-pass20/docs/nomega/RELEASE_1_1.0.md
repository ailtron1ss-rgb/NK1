# NΩ 1.1.0 — Frontier Generalization Stack

## Purpose
NΩ 1.1 extends the 1.0 Adaptive Generalist with an explicit frontier research loop. The goal remains a compact, mobile-first neuro-symbolic system that can learn reusable verified skills, route between neural/symbolic/planning mechanisms, and improve under resource and safety constraints.

## Added
- V3 compositional/adversarial task generator with independent train/holdout/adversarial splits.
- FrontierGeneralist with explicit 14-family vocabulary instead of collapsing new families into the 1.0 vocabulary.
- RuntimeTraceDataset for converting actual NΩ executions into learning material.
- CounterfactualArenaV2 for same-task expert comparison.
- ProgramEquivalenceV2 with bounded counterexamples.
- VersionedSkillRegistry for skill lineage and regression detection.
- TraceReplayV2 for failure/disagreement/novelty prioritization.
- FrontierEvaluator with split and family reports.
- MobileBenchmarkV3 with low/mid/mid-NPU/high synthetic device profiles.
- ProjectAuditV2 separating code inventory, testing and independent evidence.
- CLI commands for frontier cycle, mobile benchmark and audit.

## Measured bounded run
- Full repository tests before release: 74/74 passed.
- Frontier cycle: 56 holdout cases, 28 adversarial cases, 64 runtime traces.
- Holdout verified-rate: 83.9%.
- Adversarial verified-rate: 64.3%.
- Trace verified-rate: 71.9%.
- FrontierGeneralist policy accuracy improved strongly during the local training run, but family accuracy did not improve enough for promotion.
- Promotion result for this run: **not promoted**.

## Important interpretation
The verified-rate numbers above are bounded synthetic/runtime checks. They are not evidence of general intelligence or human-level reasoning. The adversarial split is an engineering stress test, not a real-world benchmark.

## Current research decision
Keep the stable 1.0 promoted Generalist. Retain the 1.1 Frontier checkpoint as research-only candidate until an independent benchmark shows improvement without protected-skill regression.
