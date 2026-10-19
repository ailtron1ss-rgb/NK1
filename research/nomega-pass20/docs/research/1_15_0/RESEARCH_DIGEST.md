# NΩ 1.15.0 research digest

Status: `research_only`. These sources inform experiments; none is treated as proof that a method works for NΩ.

## 1. Self-evolving agents: control plane + trajectory evidence

**Next-Generation Agentic Reinforcement Learning Systems Enable Self-Evolving Agents**, July 2026.
The paper identifies three infrastructure requirements for self-evolving deployment: a trajectory protocol that preserves step-level learning signals, governed data from real workloads, and an evolution control plane that decides when policy/harness updates should occur.

Source: https://arxiv.org/abs/2607.01120

**Applied in NΩ 1.15:** `causal_evidence_ledger_v1.py` and `self_evolution_control_plane_v2.py`.

## 2. Self-improvement taxonomy

**Self-Improvements in Modern Agentic Systems: A Survey**, July 2026.
It frames self-improvement as an update operator acting on model parameters or the operational scaffold (prompts, memory, tools and control logic), emphasizing evaluation and controllable evolution.

Source: https://arxiv.org/abs/2607.13104

**Applied in NΩ 1.15:** candidate lifecycle now treats scaffold/algorithm changes as candidates requiring measured evidence instead of automatically promoting new modules.

## 3. Execution feedback and value learning

The program-synthesis literature has long shown the value of executable feedback. **B-Coder** argues that value-based learning is naturally suited to program synthesis because execution outcomes provide cheap rewards and off-policy programs are abundant; it introduces conservative Bellman updates for stability.

Source: https://arxiv.org/abs/2310.03173

**Applied experimentally:** NΩ keeps execution-guided learning as a separate research track. The new execution-budget policy treats execution as information with cost rather than an unconditional reflex.

## 4. Execution budgeting

A 2026 agentic program-repair analysis reports that the marginal value of repeated test executions can diminish for strong, in-distribution coding agents, while weaker agents can remain more dependent on execution feedback.

Source: https://github.com/agentpatterns-ai/website/blob/main/verification/execution-budgeting-program-repair.md

**Applied in NΩ 1.15:** `execution_budget_policy_v1.py`, explicitly parameterized so it can later be replaced by a learned policy.

## 5. On-device sparse experts

**MobileMoE: Scaling On-Device Mixture of Experts**, May 2026, reports that moderate sparsity plus fine-grained/shared experts can improve the Pareto frontier on-device, including smartphone measurements. A complementary June 2026 empirical study found that MoE speedups are strongly device-dependent because total parameter footprint, dispatch and memory bandwidth can erase active-parameter savings.

Sources:
- https://arxiv.org/abs/2605.27358
- https://arxiv.org/abs/2606.21428

**Applied implication:** NΩ should not promote sparse/MoE components from FLOP estimates alone; device measurement and total-memory effects remain mandatory.

## 6. Static mobile quantization

**Quant.npu**, May 2026, investigates fully static integer quantization for mobile NPUs and reports up to 15.1% latency reduction under its experimental setup. The paper emphasizes careful initialization and sensitivity-guided mixed precision.

Source: https://arxiv.org/abs/2605.20295

**Applied implication:** the mobile research track should test a quantization ladder rather than assume INT8/INT4 is automatically beneficial.

## 7. Stronger real-world repair verification

**PatchEval-Verified**, released July 2026, revises vulnerability-repair tests to focus on whether the vulnerability is actually fixed instead of overfitting to a specific patch implementation.

Source: https://github.com/bytedance/PatchEval

**Applied implication:** future NΩ repair benchmarks should prefer behavior/invariant-level tests and counterexample diversity over single implementation-matching tests.

## 8. Continual optimization must control regressions

**Do Agent Optimizers Compound? A Continual-Learning Evaluation on Terminal-Bench 2.0**, July 2026, studies repeated optimization under newly arriving tasks and reports that regression control is essential for optimization gains to compound instead of eroding earlier improvements.

Source: https://arxiv.org/abs/2607.14004

**Applied in NΩ 1.15:** `matched_evidence_v1.py` performs paired multi-seed effect analysis, and the promotion control plane now requires both a valid evidence quorum and an accepted matched-effect artifact.

## 9. Evidence promotion is a security boundary

Two August 2026 studies show that trajectory-driven skill evolution can be manipulated through repeated query patterns. The attacks exploit the fact that untrusted experience can become trusted persistent instruction when inclusion, recurrence and causal attribution are insufficiently controlled.

Sources:
- https://arxiv.org/abs/2608.08303
- https://arxiv.org/abs/2608.05563

**Applied in NΩ 1.15:** multi-seed evidence is no longer represented by a boolean alone. Promotion now requires seed count, independent-run count, multiple trajectory hashes, multiple provenance sources, explicit holdout/OOD identifiers, and paired-effect evidence.

## 10. Mobile inference must be backend-specific

**Is Your NPU Ready for LLMs? Dissecting the Hidden Efficiency Bottlenecks in Mobile LLM Inference**, July 2026, introduces fine-grained backend/energy profiling and reports that NPU/CPU tradeoffs depend strongly on workload shape, operator support and scheduling. The study reports large framework-induced gaps and substantial scheduling/energy waste under poor configurations.

Source: https://arxiv.org/abs/2607.05475

**Applied in NΩ 1.15:** `mobile_runtime_benchmark_v2.py` now captures backend, precision, p50/p95/p99, RSS, thermal, battery percentage and available power/energy telemetry; the Termux runner records Android/ABI/device metadata when available.

## 11. Execution-verified skill retrieval and bounded recovery (2026-09-20)

**Applied:** `neural_skill_retrieval_v1.py` and `grounding_recovery_controller_v1.py`.

The retrieval path is explicitly separated from pure-neural evaluation. Retrieved programs are only candidates; target holdout, adversarial examples, and HVM agreement are required before a candidate is counted as verified. The recovery controller uses the execution-budget policy to bound local repair/retrieval effort.

**Measured matched ablation:** 6 families × 3 seeds, V9 + V5, 8 training epochs. Pure neural verified rate was **0.0**; the retrieval-verification hybrid measured **0.2222** average verified rate. Holdout increased from **0.0694 to 0.3542**, adversarial from **0.0833 to 0.3681**, and HVM from **0.0444 to 0.3111**. This is evidence for the hybrid memory/retrieval mechanism, **not** for pure-neural autonomous synthesis.

The experiment is research-only and is not a promotion candidate without independent multi-seed/OOD/nonregression evidence.
