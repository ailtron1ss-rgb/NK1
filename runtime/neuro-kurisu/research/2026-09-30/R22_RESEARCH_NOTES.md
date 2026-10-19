# R22 Research Notes — Updated 2026-09-30

## 1. Budget-curated memory
Forget to Improve proposes net value per byte for on-device memory curation, combining value, harm and provenance. Reported results include lower memory/uplink cost and improved robustness to stale/poisoned memory. R22 implements the KEEP-side principle inside the existing MemoryRetentionEconomy, without creating a second memory store.
Source: https://arxiv.org/abs/2606.25115

## 2. LongMemEval-V2
LongMemEval-V2 evaluates static state recall, dynamic state tracking, workflow knowledge, environment gotchas, and premise awareness over long trajectories. R23 will turn these five abilities into an internal experience battery over the existing MemoryOS instead of adding another memory framework.
Source: https://arxiv.org/abs/2605.12493

## 3. LycheeMemory V2
LycheeMemory V2 argues for semantic segment-level consolidation to reduce construction overhead while preserving evidence structure. R22 extends the existing TemporalMemoryCompressor with typed provenance and correction links rather than adding another store.
Source: https://arxiv.org/abs/2608.12990

## 4. Latent-state sufficiency for world models
Recent work argues that world models should be evaluated by whether their latent state is sufficient for the function required by the agent: prediction, control, planning, causal reasoning, memory and uncertainty. This motivated the R22 action-conditioned reward head and held-out actionability benchmark.
Source: https://arxiv.org/abs/2605.01694

## 5. Coupled actionable world models
J-LAW couples latent world state, action-conditioned prediction and localization/loop closure. R22 does not add a localization graph yet, but R23 should examine whether a lightweight state-correction factor can improve long-horizon world-model drift without a new heavyweight subsystem.
Source: https://arxiv.org/abs/2606.28712

## 6. Source-code references inspected
- state-spaces/mamba: recurrent/state-space sequence modelling and inference-first design.
- letta-ai/letta: stateful agents with persistent memory and identity.
- mem0ai/mem0: hybrid semantic/entity/temporal memory retrieval.
- agiresearch/A-mem: dynamic linked memory organization.
- LvCan926/All-Mem: bounded visible memory, offline topology repair, non-destructive edits and typed recovery.

## Evidence policy
Research is used to select computational mechanisms and experiments. It is not evidence that Neuro-Kurisu has human-like consciousness.
