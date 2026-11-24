# P2840 — Research Sources — 2026-09-20

## 1. World models for embodied intelligence

Nanjie Yao et al., "World Models for Embodied Intelligence: From Plausible to Controllable to Actionable", arXiv:2609.16697, 15 Sep 2026.

https://arxiv.org/abs/2609.16697

Useful project principle: evaluate a world model by whether its predictions improve planning, action, learning, verification and recovery, not merely whether predictions look plausible. The survey explicitly emphasizes long-horizon consistency, uncertainty calibration, causal intervention, latency and verification.

## 2. Lifting world models for low-dimensional planning

Alex N. Wang et al., "Lifting Embodied World Models for Planning and Control", arXiv:2604.26182, 28 Apr 2026.

https://arxiv.org/abs/2604.26182

Useful project principle: keep high-level action spaces compact and interpretable, then let the lower-level actuator policy execute them. This matches the phone constraint better than exposing many low-level device operations directly to cognition.

## 3. Human-centered embodied cognition

Yuzhen Chen, KC Zhou, "WCM: World-Cognition Model for Generalizable Human-Robot Interaction", arXiv:2607.22999, 25 Jul 2026.

https://arxiv.org/abs/2607.22999

Useful project principle: sensing, reasoning, action and knowledge should be explicit runtime stages with asynchronous execution and continual refinement from interaction.

## 4. Prioritized replay and prediction error

Prior work collected in arXiv reviews repeatedly supports prioritizing replay by surprise / prediction error under limited memory.

Project implementation already combines this with multi-timescale replay; P2840 does not add an unbounded replay engine. Instead, it uses evidence quality to control how strongly externally grounded outcomes are promoted.

## 5. Experiment-design implication for Neuro/Kurisu

The strongest reusable rule is:

`prediction -> intervention -> independently observed consequence -> attribution -> update`

and, when the consequence is not independently established:

`prediction -> action receipt -> hold identity/world promotion -> request additional evidence`
