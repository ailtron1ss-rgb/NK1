# NΩ 1.9.7 Architecture Delta

## Goal
Move from a collection of adaptive subsystems toward a bounded self-development control plane that can persist experience, detect developmental bottlenecks, generate diverse repair candidates, and choose the next experiment without mutating source code blindly.

## New control-plane path

`verified baseline / experience`
→ `AdaptiveExperienceMemoryV3`
→ `DevelopmentalBottleneckDetectorV1`
→ `SelfDevelopmentOrchestratorV1`
→ `EvolutionaryRepairPortfolioV1`
→ `execution verification`
→ `EvolutionArchiveV1`
→ `memory consolidation`
→ `next-cycle plan`

## Important separation

Candidate generation is not verification. Verification is not promotion. Replay is not proof of causal improvement. A positive benchmark on one family is not evidence of general intelligence.

## Main data products

- verified procedural memory;
- cross-family transfer evidence;
- evolution archive;
- Pareto front of verified candidates;
- developmental bottleneck history;
- self-development experiment plan;
- host/device runtime benchmark records;
- research memory.

## Current limits

- pure-neural OOD performance is still weak;
- persistent replay A/B did not improve the tiny equal-compute experiment in this release;
- archive parents are available for evolutionary search but are not yet a learned value function;
- real Android/Termux measurements require execution on the target device;
- full historical test-suite completion remains time-budget constrained.
