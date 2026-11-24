# Research index — P2559–P2566

Дата: 2026-09-18

## Направление

Цель: превратить существующую neural branch в замкнутый сенсомоторный контур, где world model оценивается по тому, улучшает ли он действие, а не только по prediction loss.

## Сохранённые источники

1. Yao et al., 2026 — *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*.
2. Kirchner, Purschke, Knoll, 2026 — *A survey of world models for physical AI with uncertainty representation and control*.
3. Garrido et al., 2026 — *Learning Latent Action World Models In The Wild*.
4. Anand et al., 2026 — *World Models Under Asynchronous Sensor Observations*.
5. SAFA-SNN, ICLR 2026 — sparsity-aware on-device continual learning.
6. IEEE TMC 2026 — runtime-efficient sparse test-time adaptation for mobile devices.
7. BoTTA 2026 — device-level evaluation of on-device test-time adaptation.
8. MoW / ICLR 2026 — modular latent world dynamics and parameter-efficient multi-task world models.
9. RWML 2026 — outcome/realized-state consistency for action-conditioned world models.

## Architectural decisions

- Use asynchronous sensor frames with explicit freshness/staleness instead of pretending all modalities are synchronous.
- Keep a compact 16D latent causal state and action-conditioned dynamics.
- Learn a small continuous action embedding so experience can transfer between related discrete actions.
- Use matched-context alternative-action comparisons as causal evidence; comparison counts alone are not accepted as causal proof.
- Gate forecast influence by confidence/disagreement and sensor freshness.
- Dynamically lower active neural/sensor fraction under low urgency and resource pressure.
- Keep the new bridge as a bounded residual inside NeuralExperienceBranch; it is not a second policy owner.
- Feed actual post-action world/embodiment observation back into the learner so the update is state -> action -> measured next state.

## Evidence policy

Published benchmark improvements from external papers are not summed. All project claims must come from matched internal ablations.
