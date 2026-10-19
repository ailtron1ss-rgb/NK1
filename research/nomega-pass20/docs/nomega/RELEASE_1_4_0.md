# NΩ 1.4.0 — Apex Joint Learning & OOD Research Stack

## What changed
- Apex shared brain V4 for joint latent/family/value/uncertainty/routing signals.
- OOD/compositional curriculum V5 with train/holdout/adversarial splits.
- Long-horizon bounded beam planner over WorldModelV3.
- Skill Transfer V4 with compositional skill chains and provenance.
- Mobile Optimizer V6 Pareto selection.
- Joint Learning V4 with consistency/distillation hooks.
- Development Cycle V4 and candidate-only promotion.
- Audit V4 with real test-pass inputs.
- Runtime 1.4 helpers for cycle, mobile Pareto and audit.

## Verification
- pytest: **103/103 PASS**
- compileall: **PASS**

## Learning result
- family accuracy: 0.1250 -> 0.1250
- value MAE: 0.708664 -> 0.093557
- uncertainty MAE: 0.116672 -> 0.116669
- runtime trace verified-rate: 0.0000
- candidate promotion: False

## Independent OOD runtime result
- train verified: 0.000
- holdout verified: 0.000
- adversarial verified: 0.000

This gap is intentionally preserved as a research finding: the current stable runtime has strong verified performance on its existing bounded task language, but does not yet generalize execution to the new V5 compositional language.

## Mobile
Current runtime parameters: **468,243**. Mid target is 350k active params / INT8 / top-k 1. The optimizer therefore points to pruning for true mid-tier deployment.

## Interpretation
Engineering/test completion is not an intelligence score. The new cycle improves internal value and uncertainty prediction, but the core generalization bottleneck remains program execution and representation transfer to genuinely new task languages.
