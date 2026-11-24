# P2843 Research — 2026-09-21

## 1. Continual learning on edge

**BiMemNet / on-device continuous learning (2026)** — multi-scale memory encoding and compressed latent representations target continual learning under resource constraints. Relevant idea adopted: keep fast/slow memory separated and bounded rather than growing an unrestricted replay buffer.

Source: https://www.sciencedirect.com/science/article/abs/pii/S092523122503187X

## 2. Long-term + multiple short-term memories

A 2026 *Neural Networks* paper proposes multiple short-term memory networks plus a long-term memory network to balance plasticity and stability. Relevant architectural principle: one memory channel should not be forced to serve both rapid adaptation and long-term preservation.

Source: https://www.sciencedirect.com/science/article/pii/S0893608026002364

## 3. Behavioral-timescale synaptic plasticity

The 2026 *Nature Neuroscience* review on BTSP describes experience-dependent synaptic plasticity operating over seconds and allowing strong changes from limited experience. We do not claim to reproduce BTSP biologically; P2843 adopts the engineering principle of an eligibility/tag signal separated from slower consolidation.

Source: https://www.nature.com/articles/s41593-026-02214-2

## 4. Stabilizing plasticity

Nature Communications (2026) reports intrinsic top-down stabilization of synaptic plasticity. P2843 implements a lighter engineering analogue: intrinsic excitability/homeostatic control plus slower plasticity and local synaptic stabilization.

Source: https://www.nature.com/articles/s41467-026-70920-3

## 5. Self-organizing continual memory

A 2026 *Neural Networks* study describes a dynamic self-organizing memory network and a memory-correction mechanism for continual learning. Relevant idea adopted conceptually: semantic memory should be able to update prototypes while preserving prior structure.

Source: https://www.sciencedirect.com/science/article/pii/S0893608025012717

## 6. Hebbian episodic → semantic memory

HeLa-Mem (ACL 2026) separates an episodic memory graph from semantic memory and uses learned associations for semantic distillation. P2843 implements a much smaller edge-compatible analogue: episodic traces + associative retrieval + evidence-gated semantic prototypes.

Source: https://aclanthology.org/2026.acl-long.625/

## 7. Spiking continual learning on edge

2026 neuromorphic work continues to explore event-driven spiking networks with continual learning and adaptive thresholds for low-power operation. This supports continued investigation of sparse/event-driven neural substrates, but dedicated neuromorphic hardware is not assumed on the target Android phone.

Sources:
- https://doi.org/10.1088/2634-4386/ae6728
- https://www.nature.com/articles/s41598-026-52643-z
- https://www.sciencedirect.com/science/article/abs/pii/S1383762126001876

## Selection rule

No paper was copied as a black-box dependency. Only mechanisms compatible with the current architecture, persistence model and medium-phone constraints were translated into project code.
