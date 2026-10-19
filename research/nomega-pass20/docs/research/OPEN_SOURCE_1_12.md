# NΩ 1.12.0 — Open-source research registry

## ShinkaEvolve
Repository: https://github.com/SakanaAI/ShinkaEvolve

Relevant mechanism imported conceptually:
- population-based program evolution;
- archive of successful solutions;
- knowledge transfer between evolutionary islands;
- parallel candidate evaluation;
- verifier-driven optimization.

NΩ adaptation: `EvolutionIslandControllerV1` keeps bounded islands, preserves operator diversity, and migrates verified candidates. Candidate verification remains outside the island controller.

## CORAL
Repository: https://github.com/Human-Agent-Society/CORAL

Relevant mechanisms:
- isolated multi-island runs;
- scoped persistent state;
- migration between islands;
- explicit grader/evaluation loop;
- long-running autoresearch with shared knowledge.

NΩ adaptation: islands are persistent but lightweight, use the existing execution verifier, and do not receive authority to promote unverified candidates.

## SWE-EVO
Repository: https://github.com/SWE-EVO/SWE-EVO

Relevant mechanism:
- long-horizon software evolution benchmark instead of isolated coding tasks;
- repeated adaptation across a versioned software history.

NΩ adaptation: `LongHorizonDevelopmentBenchmarkV1` measures repeated self-development cycles on the same persistent state without resetting the project memory.

## Agent0
Repository: https://github.com/aiming-lab/Agent0

Relevant mechanism:
- explicit separation of a curriculum role from an executor role;
- curriculum proposes increasingly challenging frontier tasks;
- execution/tool feedback becomes the self-generated training signal.

NΩ adaptation: `select_frontier()` in the canonical adaptive curriculum is activated after a measured no-progress cycle. Anchors remain fixed while harder/unseen families are introduced.

Important limitation: Agent0's external benchmark results are not used as NΩ evidence.

## Avalanche / ContinualAI
Repository: https://github.com/ContinualAI/avalanche

Relevant mechanism:
- reproducible continual-learning baselines and metrics;
- comparison against established methods such as EWC, GEM/A-GEM and replay.

NΩ adaptation: the project now contains dependency-free EWC/A-GEM-style baselines and a strategy portfolio so custom replay is not evaluated only against itself.

## OpenEvolve
Repository: https://github.com/zbsnet/openevolve

Relevant mechanism:
- evolutionary coding loop;
- multi-objective candidate selection;
- population and distributed evaluation.

NΩ adaptation: this supports the use of Pareto-front selection and explicit resource/quality objectives in strategy routing and repair search.

## ExecuTorch
Repository: https://github.com/pytorch/executorch

Relevant mechanism:
- PyTorch-native on-device inference;
- Android runtime integration through AAR/C++ APIs;
- target backends and device profiling.

NΩ adaptation: future mobile work should move runtime-plane measurement from host/Termux heuristics to a real Android artifact and actual device benchmark.

## Research discipline
Only mechanisms were imported conceptually. No external benchmark score is presented as an NΩ result. Every NΩ claim remains subject to the master development protocol and local evidence.
