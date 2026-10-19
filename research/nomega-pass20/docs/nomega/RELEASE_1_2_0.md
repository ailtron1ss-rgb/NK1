# NΩ-Core 1.2.0 — Integrated Generalization & Mobile Research Stack

## Purpose

NΩ remains a compact mobile-first neuro-symbolic generalist. Version 1.2 focuses on acquiring new capabilities from task curricula and real execution traces without replacing the stable runtime automatically.

## Delivered

### Core development loop
- V4 compositional/adversarial curriculum with 20 task families.
- Joint Generalist V2 trained on synthetic tasks plus runtime traces.
- Trace Alignment quality signal.
- Multi-step World Model V2 research module.
- Memory Consolidator V2 for repeated verified experience.
- Multimodal Grounding V2 alignment head.
- Mobile Optimizer V4 with RAM/NPU/latency-aware targets.
- Production Guard V2 with multi-metric promotion gates.
- Experiment Registry V2 for reproducible runs/artifact tracking.
- CLI commands for the 1.2 cycle, architecture profile and promotion gate.

### Research architecture added alongside 1.2
- Sparse MoE V1, top-1 routing.
- Hybrid Reasoner V2, recurrent + lightweight attention mixing.
- Skill Transfer V2 evaluation.
- Uncertainty Suite V2: ECE, Brier, selective/abstention metrics.

## Verification

- Full test tree: **86/86 PASS**.
- Python compileall: **PASS**.
- V4 stable-runtime holdout on final bounded benchmark: **90% verified**.
- V4 adversarial verified: **95%**.
- Final mobile host benchmark p50: approximately **1.67 ms** for the measured bounded suite.
- Mobile configuration: **468,243 parameters**, approximately **1.79 MiB FP32 / 0.45 MiB INT8 weights**. This is model-weight footprint only, not total app RAM.

## Learning result

The bounded 1.2 development cycle collected **40 runtime traces** with a verified rate of **92.5%** and mean reward approximately **0.816**. Joint policy accuracy on the development holdout improved from **0% to 50%** in the short run and value MAE improved from **0.2604 to 0.2317**.

The learned candidate was saved, but the stable runtime was **not automatically replaced**. The production guard passed its protected metrics in the bounded cycle, while the project deliberately keeps the promotion policy candidate-only until larger independent holdouts are used.

## Limits

These results are bounded/synthetic and do not establish general intelligence. Multimodal alignment is currently an adapter-level research component; mobile timing is host-side rather than a physical Android thermal/battery measurement; World Model V2 is a short-horizon research model; and NeuralInvent still requires substantial expansion beyond its current algorithmic families.

## Research direction after 1.2

1. Jointly train latent representation, router, NeuralInvent and world model on real execution traces.
2. Expand program-synthesis curriculum from fixed arithmetic families to compositional algorithm discovery.
3. Add counterexample-driven program repair and verified skill transfer.
4. Train the multimodal stack with real paired data rather than only latent-contract tests.
5. Benchmark the mobile build on physical Android devices with sustained thermal/battery measurements.
6. Evaluate experimental Transformer/SSM/recurrent hybrids and sparse-MoE variants under identical compute budgets.
