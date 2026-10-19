# Release 0.8.0 — NΩ Universal Cognitive Stack

NΩ 0.8 is a research-development stack built on Nullseed. The project goal is a compact, mobile-oriented, general-purpose neuro-symbolic system that can dynamically choose neural, symbolic, programmatic, memory and planning computation; verify suitable results; retain verified skills; and improve without silently destroying previous capabilities.

## Major additions

- Universal latent workspace and modality mixer
- Attention-style latent memory
- Self-model of capability and uncertainty
- Skill compiler for verified programs
- Composite quality/efficiency/calibration objective
- Skill-acquisition research loop
- Hierarchical goals and bounded beam planning
- Mobile runtime policy for latency/thermal/battery pressure
- Advanced telemetry
- Quantization/compression lab
- Multimodal contract benchmark
- Experiment matrix and full evaluation harness
- Research orchestrator and controlled evolution primitives

## Current evidence

The release regression suite used for this development pass contains 44 passing targeted tests. The bounded research evaluation currently reports 5/6 verified main cases and 3/4 verified holdout cases. The numbers are benchmarks for this implementation, not evidence of general intelligence.

Full model parameter counts measured in the current runtime: mobile 100,853; balanced 156,149; full 302,629.

## Research boundaries

The universal latent and multimodal pieces are architectural research interfaces. The current vision/audio adapters are not trained multimodal foundation encoders. NeuralInvent remains strongest on its learned/program-synthesis distribution and can still fail to generalize across unseen task families. Continual-learning code uses explicit promotion/rollback gates rather than unrestricted self-modification.

## Evaluation

`runtime/nomega_0_8_full_evaluation.json` is the bounded reproducible evaluation generated for this release. `NOMEGA_0.8_BUILD_MANIFEST.json` records goals, tested evidence and known limitations.
