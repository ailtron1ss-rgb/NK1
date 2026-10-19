# Research Sources Used in NΩ 1.17.0

## 1. Program synthesis with test-time transduction

Kang-il Lee et al., "Program Synthesis via Test-Time Transduction", arXiv:2509.17393 (2025).
Key idea used: treat synthesis as active elimination over a finite hypothesis set and choose informative test inputs to reduce candidate count.
https://arxiv.org/abs/2509.17393

## 2. Value-based reinforcement learning for program synthesis

Zishun Yu et al., "B-CODER: Value-Based Deep Reinforcement Learning for Program Synthesis", ICLR 2024 / arXiv:2310.03173.
Key idea retained for future work: execution outcomes provide direct non-differentiable rewards, and learned value can be used for post-processing generated programs.
https://arxiv.org/abs/2310.03173

## 3. Trajectory poisoning in self-evolving skill systems

Jialuo Chen et al., "When Experience Becomes Instruction: Trajectory Poisoning in Self-Evolving Agent Skill Systems", arXiv:2608.05563 (2026).
Key idea used: skill/evidence promotion is a security boundary; repeated apparently useful evidence can poison persistent evolution. NΩ therefore keeps provenance, multi-seed evidence, matched effects and promotion gates separate from the learner.
https://arxiv.org/abs/2608.05563

## 4. Sustained mobile inference

Pranay Tummalapalli et al., "LLM Inference at the Edge: Mobile, NPU, and GPU Performance Efficiency Trade-offs Under Sustained Load", arXiv:2603.23640 (2026).
Key idea used: sustained thermal/resource behavior can dominate peak performance; mobile evidence should be measured on the device rather than inferred from host timing.
https://arxiv.org/abs/2603.23640

## 5. Neural sketch learning

Vijayaraghavan Murali et al., "Neural Sketch Learning for Conditional Program Generation", arXiv:1703.05698.
Key idea used: learn an abstract sketch and concretize it under semantic constraints rather than predicting all low-level code details directly.
https://arxiv.org/abs/1703.05698

## 6. Neural-network-guided synthesis and verification

Naoki Kobayashi et al., "Toward Neural-Network-Guided Program Synthesis and Verification", arXiv:2103.09414.
Key idea retained: neural guidance is most useful when coupled to symbolic synthesis/verification rather than treated as proof by itself.
https://arxiv.org/abs/2103.09414
