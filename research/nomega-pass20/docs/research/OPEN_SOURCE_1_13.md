# Open-source research registry — NΩ 1.13.1

## RLEF-Code

Repository: https://github.com/tarunbeerelli/RLEF-Code

Relevant design ideas:

- execution feedback is part of the environment state;
- bounded multi-turn repair;
- held-out execution reward;
- group-standardized advantages / critic-free GRPO.

NΩ adaptation:

- compact program DSL rather than a large code model;
- TinyVM/HVM verification as the primary reward source;
- explicit promotion gates and persistent evidence;
- no assumption that the method is already generally effective for NΩ.

## synth_gen

Repository: https://github.com/facebookresearch/synth_gen

Relevant design ideas:

- synthetic programming data generation;
- verifier-based filtering;
- learning without direct human labels through execution feedback.

NΩ adaptation target:

- verified synthetic curriculum factory;
- counterexample-conditioned view generation;
- only independently verified outputs become training data.

The upstream project is MIT-licensed according to its repository metadata.

## ShinkaEvolve

Repository: https://github.com/SakanaAI/ShinkaEvolve

Relevant design ideas:

- population-based program evolution;
- archive of successful solutions;
- knowledge transfer between evolutionary islands;
- verifier-centered program evaluation.

NΩ already has a bounded island layer. Next step is to connect verified neural feedback trajectories into the island archive without allowing unverified candidates to migrate.

## SkillLearnBench

Repository: https://github.com/cxcscmu/SkillLearnBench

Relevant idea:

- evaluate continual learning through generated/reusable skills on multiple real-world task families rather than single-task score.

NΩ adaptation target:

- long-horizon reusable-skill benchmark;
- task-family holdouts;
- skill retention and transfer as first-class metrics.

## ExecuTorch

Repository: https://github.com/pytorch/executorch

Relevant deployment path:

- Android AAR / C++ runtime;
- XNNPACK CPU backend;
- hardware-specific Android backends.

NΩ adaptation target:

- separate research/control plane from mobile inference plane;
- export an inference-only artifact;
- measure cold start, p50/p95 latency, PSS/RSS, thermal behavior and energy on the actual target phone.

## Adoption rule

Open-source mechanisms are candidates only. NΩ promotion still requires its own before/after, multi-seed, OOD, restart and resource evidence.
