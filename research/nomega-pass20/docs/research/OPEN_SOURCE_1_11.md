# NΩ 1.11.0 — Open-Source Research & Baseline Registry

This release explicitly cross-checks NΩ against maintained/open implementations before promoting new mechanisms.

## 1. Avalanche / ContinualAI
Repository: https://github.com/ContinualAI/avalanche
Baselines: https://github.com/ContinualAI/continual-learning-baselines

Why relevant:
- Avalanche provides a reproducible continual-learning framework and explicit baseline strategies.
- The baseline collection includes EWC, SI, GEM, A-GEM, LwF, iCaRL, GDumb and replay-based methods.

NΩ action in 1.11.0:
- added dependency-free EWC-like diagonal Fisher consolidation;
- added dependency-free A-GEM-like gradient projection;
- added naive/replay/ewc/agem/gradient_aligned strategy portfolio;
- added equal-budget sequential benchmark so custom NΩ methods are compared against established strategy families rather than only against previous NΩ versions.

We did **not** add Avalanche as a runtime dependency: mobile/runtime footprint and reproducibility remain priorities.

## 2. OpenEvolve
Repository: https://github.com/carlos-life/OpenEvolve

Relevant ideas:
- LLM mutation/crossover inside an evolutionary loop;
- sandboxed candidate execution;
- weighted evaluator cases;
- elitism and progress callbacks.

NΩ comparison:
- NΩ already has bounded mutation/operator portfolios, isolated execution, weighted/evidence-gated evaluation and archive lineage.
- The next useful import is not another mutation operator but stronger evaluator diversity and population-level parent selection.

## 3. ShinkaEvolve
Repository: https://github.com/kajetankow/ShinkaEvolve

Relevant ideas:
- population-based scientific program evolution;
- multiple LLM mutation operators;
- sample-efficiency emphasis.

NΩ action:
- preserve operator/family lineage separately from final score;
- future work: multi-parent semantic crossover with counterexample-conditioned mutation proposals.

## 4. cl-agent
Repository: https://github.com/dattgoswami/cl-agent

Relevant ideas:
- symbolic continual-learning substrate and parametric learning kept separate;
- episode capture, replay, skill distillation and verifier-driven search;
- explicit distinction between durable symbolic knowledge and parameter updates.

NΩ action:
- reinforce dual substrate separation: verified procedural memory remains inspectable/reversible while parametric learning is evaluated independently.

## 5. ExecuTorch
Repository: https://github.com/pytorch/executorch

Relevant ideas:
- on-device PyTorch runtime;
- Android/mobile deployment and backend selection;
- profiling/debugging and compatibility tooling.

NΩ action:
- keep Termux as development/research plane;
- use real Android artifact benchmarks before claiming mobile readiness;
- future deployment path should benchmark ExecuTorch alongside the current lightweight runtime.

## Evidence policy
No open-source project's reported score is copied into NΩ's capability claims. External projects are used to select algorithms/baselines and define experimental controls; NΩ promotion still requires its own paired, multi-seed, holdout/OOD/restart evidence.
