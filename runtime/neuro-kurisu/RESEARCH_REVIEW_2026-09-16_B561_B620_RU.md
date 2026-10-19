# Internet Research Review — B561–B620

## 1. Hierarchical long-term memory
H-MEM (EACL 2026) organizes memory by abstraction level and uses indexed routing to avoid exhaustive similarity search. This supports our hierarchical/bounded retrieval approach.

HiGMem (Findings ACL 2026) reports that event-level semantic anchors can reduce the number of retrieved turns while improving adversarial F1 on LoCoMo10. This motivates event-first retrieval and selective expansion.

## 2. Memory as an evolving cognitive skill
MemSkill (2026) reframes memory operations as learnable/evolvable skills selected by a controller, with periodic skill redesign. This motivates the B561 contextual strategy controller and future learned routing policy.

MetaMem (Findings ACL 2026) explicitly adds a self-evolving meta-memory that learns how to use stored knowledge, not merely how to store it.

## 3. Self-evolving capabilities
Mem²Evolve (ACL 2026) reports gains from co-evolving experience memory and asset/capability memory instead of evolving only one side. This motivates the B561 skill-evolution layer and future asset-memory integration.

SAGE (ACL 2026) uses sequential rollout and reward signals to grow a skill library and reports improvements in goal completion with fewer interaction steps/tokens on AppWorld.

EvA (ACL 2026) uses learned quasi-symbolic abstractions plus controller/perceptor/actor mechanisms to reuse reasoning mechanisms under distribution shifts. This is a strong direction for future B621+ learned meta-policy.

## 4. Adaptive compute
ODAR (2026) uses difficulty-aware adaptive routing between fast and deliberative reasoning. It reports large compute savings on its own evaluation suite. We treat this as evidence for the architectural principle, not as a transferable performance promise.

## 5. World-model planning
Recent action-conditioned world-model work motivates separating prediction of future latent state from direct action scoring, with bounded imagined rollouts used for planning and generalization.

## Interpretation for Neuro-Kurisu
The strongest combined direction is:

experience → typed/provenanced memory → abstraction → skill/asset evolution → world prediction → meta-routing → adaptive compute → action → verified outcome → policy/memory/neural update.

The current B561–B620 implementation is intentionally lightweight and device-aware. It should not be described as a copy of any research system.
