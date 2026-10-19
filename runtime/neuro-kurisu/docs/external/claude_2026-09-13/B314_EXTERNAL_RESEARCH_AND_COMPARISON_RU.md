# B314 External Research Notes
Дата: 13.09.2026

## Continual learning / memory
Recent continual-learning research emphasizes that continual adaptation does not disappear when parameters stop changing: memory representation and retrieval become a new stability/plasticity bottleneck. One 2026 study reports that abstract procedural memories can transfer more reliably than detailed trajectories and that negative transfer can disproportionately harm hard cases.

Implication for Neuro-Kurisu:
B314 should not create a second raw trajectory store. Instead it reuses B285 autobiographical consolidation and turns a verified negative outcome into a compact action-specific scar plus recoverability signal.

A recent 2026 survey frames agent memory evolution as Storage -> Reflection -> Experience and highlights long-range consistency, dynamic environments and continual learning as core drivers.

Implication:
B314 is intentionally an Experience/Reflection layer over B285 rather than another raw storage branch.

## Brain-inspired continual learning
Earlier lifelong-learning research consistently highlights catastrophic forgetting, replay, structural plasticity and consolidation as central problems.

Implication:
The recovery mechanism must be conservative: it changes influence gradually rather than deleting the previous state after one positive event.

## Research sources
- Hu, Long, Wang (2026), `When Continual Learning Moves to Memory`, arXiv:2604.27003.
- `From Storage to Experience: A Survey on the Evolution of LLM Agent Memory Mechanisms`, ICLR 2026 under-review/OpenReview.
- Parisi et al., review of continual lifelong learning and mechanisms including replay/plasticity/consolidation.

These sources inform design choices; they do not validate Neuro-Kurisu consciousness or human equivalence.
