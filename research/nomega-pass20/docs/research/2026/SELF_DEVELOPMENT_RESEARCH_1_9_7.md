# NΩ 1.9.7 — Research Memory / Self-Development

This file is a persistent research memory for later development cycles.

## 1. Darwin Gödel Machine (DGM)
**Source:** Zhang et al., 2025, *Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents*.

Core idea relevant to NΩ: evolve multiple candidate agents/variants, preserve a diverse archive, execute/evaluate candidates, and use the empirical results to drive further search. DGM reports self-modification through code changes with benchmark validation and an archive of diverse agents.

**NΩ mapping:** `EvolutionArchiveV1` + bounded candidate generation + explicit acceptance gates.

**Do not copy blindly:** NΩ keeps source-tree mutation behind a separate promotion layer; archive candidates are not themselves proof of a better system.

## 2. AlphaEvolve
**Sources:** Google DeepMind (2025 announcement, 2026 impact report).

Core idea: combine multiple candidate-generation styles with automated evaluators and evolutionary selection. The system can evolve entire codebases when the evaluator supplies an objective signal.

**NΩ mapping:** `EvolutionaryRepairPortfolioV1` + execution verification + Pareto-style archive.

**Critical requirement:** the evaluator must remain independent and repeatable; hybrid search success must stay separate from pure-neural success.

## 3. Self-Evolving Coding Agents survey (2026)
**Source:** Zhou et al., 2026, *Self-Evolving Coding Agents*.

The survey identifies executable feedback, repository context and coding trajectories as unusually strong evidence for software-agent self-evolution, while highlighting reliability of feedback, benchmark overfitting, cost, maintainability and generalization as major difficulties.

**NΩ mapping:** evidence ledger, repository-aware verification, OOD/restart/resource gates, persistent trajectory/experience memory.

## 4. AdaMEM (2026)
**Source:** Zhang et al., 2026, *AdaMEM: Test-Time Adaptive Memory for Language Agents*.

Key idea: maintain long-term experience while synthesizing short-term strategy memory during inference rather than relying on a static one-shot retrieval step.

**NΩ mapping:** `AdaptiveExperienceMemoryV3`, especially replay selection and later planned short-term strategic memory.

## 5. Agentic Memory / AgeMem (2026)
**Source:** Yu et al., 2026, *Agentic Memory: Learning Unified Long-Term and Short-Term Memory Management for Large Language Model Agents*.

Key idea: memory operations become explicit actions: store, retrieve, update, summarize, discard. This moves memory management into the agent's policy rather than leaving it as a fixed database heuristic.

**NΩ mapping:** memory lifecycle/status fields, provenance, quarantine, consolidation and transfer evidence. A learned operation policy remains future work.

## 6. Continual learning through external memory (2026)
**Source:** Hu, Long & Wang, 2026, *When Continual Learning Moves to Memory: A Study of Experience Reuse in LLM Agents*.

Key result: moving continual learning into memory does not remove the stability-plasticity problem. Retrieval itself can become the bottleneck; procedural abstractions can transfer better than raw trajectories, and negative transfer can be concentrated on hard cases.

**NΩ mapping:** verified procedural memory, transfer table, negative-transfer monitoring, anchor replay and quarantine.

## 7. Nested Learning / Hope (2025)
**Source:** Behrouz et al., 2025, *Nested Learning: The Illusion of Deep Learning Architectures*.

Key idea: learning can be treated as multiple nested optimization/memory timescales rather than one monolithic update process.

**NΩ mapping:** current fast verified replay + medium skill/archive + slow persistent model/anchor layer is the first concrete implementation step. A true learned multi-timescale optimizer remains future research.

## 8. Value-guided program synthesis
**Source:** Yu et al., ICLR 2024, *B-CODER: Value-Based Deep Reinforcement Learning for Program Synthesis*.

Key idea: executable program synthesis has a natural reward signal and can benefit from a learned value function that estimates which candidate programs are worth testing.

**NΩ mapping:** future `candidate_value_model` should rank repair candidates before expensive verification; this is intentionally not yet claimed as implemented in 1.9.7.

## Research priorities extracted from the literature
1. Evolutionary archive with independent evaluator.
2. Dynamic memory operations and procedural memory.
3. Multi-timescale consolidation.
4. Explicit negative-transfer detection.
5. Value-guided candidate selection.
6. Strong OOD and fresh-runtime evaluation.
7. Real device measurement rather than latency formulas.
8. Diversity preservation to reduce benchmark overfitting.
