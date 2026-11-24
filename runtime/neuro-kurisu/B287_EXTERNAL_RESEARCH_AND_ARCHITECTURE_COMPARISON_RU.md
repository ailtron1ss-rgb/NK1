# B287 — External Architecture Comparison and Reusable Neural Ideas

## Purpose
This document records external projects reviewed while choosing B287. No external code is copied into Neuro-Kurisu; the project uses selected architectural ideas and reimplements them in its own TypeScript/runtime constraints.

## 1. Brian2 — event-driven / clock-driven spiking simulation
Brian2 is an open-source simulator for spiking neural networks and emphasizes flexible neuron types, synapses and learning rules. Its examples and synapse design are useful references for making our spike/eligibility implementation more explicit and testable.
Reference: https://github.com/brian-team/brian2
Useful idea adopted in B287: keep relationship-specific recurrent state separate from global state, use activity-dependent traces rather than a single scalar relationship score, and test synaptic influence through ablation.

## 2. Nengo — large-scale neural models
Nengo supports spiking and non-spiking neural simulations, custom neuron types, learning rules, hardware input and multiple backends.
Reference: https://github.com/nengo/nengo
Useful idea: treat a neural area as a composable computational substrate with explicit state and learning rule interfaces rather than a plain data object.

## 3. Lava — neuromorphic event messaging
Lava is an open-source framework for neuromorphic applications built around distributed/event-based computation and heterogeneous hardware targets.
Reference: https://github.com/lava-nc/lava
Useful idea: keep the option of event-driven, area-to-area communication and hardware-friendly sparse execution.

## 4. DreamerV3 — world model + imagined trajectories
DreamerV3 learns a world model and trains policy/value components using imagined trajectories.
Reference: https://github.com/danijar/dreamerv3
Useful idea: when a relationship or self-model proposes a future, evaluate it in a predictive latent space before committing to a costly real action.

## 5. Generative Agents — memory stream, reflection, social planning
The Generative Agents architecture stores experience, forms higher-level reflections and retrieves relevant memories for planning; ablations in the paper show that observation, planning and reflection all matter to believable behavior.
Reference: https://arxiv.org/abs/2304.03442
Useful idea: relationships need both episodic evidence and slower reflections/commitments; B287 therefore separates fast interaction traces from slower relationship-value consolidation.

## 6. Letta / MemGPT lineage — persistent memory and identity continuity
Letta is an actively developed stateful-agent framework with long-term memory and context management. Its current codebase emphasizes memory blocks, external memory and self-managed memory/skills.
Reference: https://github.com/letta-ai/letta
Useful idea: durable identity-relevant information should have explicit persistence semantics and should survive session/restart boundaries. B287 follows the principle but stores learned relationship state inside the neural developmental substrate.

## 7. Why these ideas are not sufficient by themselves
None of these projects alone provides what Neuro-Kurisu is trying to build: a single developmental organism where neural plasticity, self, autobiographical memory, goals, relationships, personality, policy and world modelling form a causal loop. The external systems are therefore used as component references, not architectural authorities.

## B287 design decision
The chosen improvement is a relationship-specific neural value bridge: it predicts social outcomes, maintains person-specific recurrent state, learns value directions with a three-factor update (local activity × outcome/error × importance), produces person-specific action/goal bias, and sends only sufficiently supported evidence into the slower personality layer. This addresses a concrete current bottleneck: the old social system could know about a person without that knowledge becoming a differentiated part of Kurisu's own learned value structure.
