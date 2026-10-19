# R21 Research Notes

## On-device memory governance

`Forget to Improve: On-Device LLM-Agent Continual Learning via Budget-Curated Memory` (2026) proposes net-value-per-byte memory governance with KEEP/SHARE/TRUST decisions. For Neuro-Kurisu the most relevant transferable idea is to treat memory cost and trust/provenance as first-class constraints rather than add more storage. Future R22 experiment: integrate value-per-byte into MemoryOS2 retention and sharing decisions without introducing a second memory store.

Source: https://arxiv.org/abs/2606.25115

## Correction-aware memory plane

`PLACEMEM: Toward a Compute-Aware Memory Plane for Lifelong Agents` (2026) frames memory as versioned capsules with provenance, validity and correction-aware identity. This supports R21's decision to expose capability/evidence status explicitly and suggests a future memory-capsule API rather than more retrieval wrappers.

Source: https://arxiv.org/abs/2607.04089

## Actionable world models

`World Models for Embodied Intelligence: From Plausible to Controllable to Actionable` (2026) argues that evaluation should focus on whether predictions improve planning, action, learning, verification or recovery rather than visual plausibility alone. This reinforces the current anti-decoration rule: simulation/world-model outputs must be judged by downstream causal utility and evidence class.

Source: https://arxiv.org/abs/2609.16697
