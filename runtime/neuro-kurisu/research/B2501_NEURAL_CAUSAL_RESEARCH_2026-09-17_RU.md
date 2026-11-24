# B2501 Research Context — 17.09.2026

## Research-driven design choices

### 1. World models should be actionable

Recent work on embodied AI argues that a world model is useful when its predictions improve closed-loop behaviour, intervention understanding, planning, learning, verification or recovery—not merely visual plausibility. B2501 therefore receives world context and produces action-conditioned neural pressure rather than a standalone generative display.

### 2. Replay should become compositional

2025 hippocampal research describes compositional state spaces and replay as a mechanism that can combine previously learned building blocks and support generalization to novel configurations. B2501 therefore stores compact primitive vectors and reuses them in action evaluation. The next step is a real holdout benchmark where new task combinations cannot be solved by memorization.

### 3. Consolidation is time-dependent

2025 work on durable memory and sleep/replay indicates that consolidation is not a single instantaneous write: representations can be reorganized over time and replay can participate in that transformation. B2501 currently has the primitive memory substrate; B2507 should connect it to explicit awake-rest-deep consolidation phases.

### 4. Continual learning needs dual-timescale representations

Recent corticohippocampal-inspired hybrid networks motivate combining fast episodic adaptation with slower generalized representations. This aligns with the project's existing multi-timescale memory architecture and suggests that B2505/B2507 should separate fast traces from slow consolidated primitives instead of increasing one monolithic memory.

### 5. Spiking networks need more than a single plasticity rule

Current SNN research continues to explore combinations of STDP, short-term plasticity and post-training adaptation. B2501 intentionally uses a conservative timing-dependent eligibility mechanism rather than claiming biological STDP. B2502 should compare several plasticity families under the same holdout and mobile budget.

## High-value experiments

1. Compare fixed delay vs learned delay.
2. Compare reward-only update vs reward + timing eligibility.
3. Compare replay without composition vs compositional replay.
4. Compare world-only prediction vs world+body+self prediction.
5. Compare full neural gate vs reduced gate.
6. Measure catastrophic forgetting after 5–20 task shifts.
7. Measure identity/personality drift after long sequences.
8. Measure energy/thermal-aware compute depth on Android.
9. Test whether neural lesions alter action, learning rate, prediction calibration and long-horizon development—not just one probability vector.

## Sources

- Fung et al., *Embodied AI Agents: Modeling the World*, 2025.
- Yao et al., *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*, 2026.
- Nature Communications, *Time-dependent consolidation mechanisms of durable memory in spaced learning*, 2025.
- Nature Neuroscience, *Constructing future behavior in the hippocampal formation through composition and replay*, 2025.
- Nature Communications, *Hybrid neural networks for continual learning inspired by corticohippocampal circuits*, 2025.
- Nature Communications, *Post-learning replay of hippocampal-striatal activity is biased by reward-prediction signals*, 2025.
