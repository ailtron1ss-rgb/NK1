# NΩ 1.20.0-dev — Research Frontier and Integration Notes (2026-09-20)

Status: `research_only`.

This document records external research consulted while developing the 1.20 executable
spine. External results are treated as hypotheses and design inputs, not proof that NΩ will
obtain the same gains.

## 1. Highest-value external mechanisms

### 1.1 Darwin Gödel Machine / self-improving agent archive

The 2025 Darwin Gödel Machine (DGM) work frames self-improvement as an open-ended tree of
agent modifications, with empirical validation after each modification. The reported
coding benchmark gains are material, but the experiments depend on a specific foundation
model, benchmark, and safeguarded sandbox. NΩ can borrow the *architecture of the search*
without assuming the reported benchmark delta transfers to our system.

Source: https://arxiv.org/abs/2505.22954

### 1.2 Self-improving coding agent

A 2025 study demonstrated autonomous editing of the coding agent itself, with reported
improvement on subsets of SWE-bench Verified and additional code benchmarks. The important
NΩ design lesson is that the mutation target can be the agent framework/tooling policy, not
only model weights.

Source: https://arxiv.org/abs/2504.15228

### 1.3 Huxley-Gödel Machine

The HGM work argues that raw current benchmark performance can be a poor proxy for future
self-improvement potential and introduces a descendant-based metaproductivity signal. For
NΩ this motivates evaluating candidates not only by immediate task score, but also by how
well the modified system improves *subsequent* development cycles.

Source: https://arxiv.org/abs/2510.21614

### 1.4 AlphaProof / verifier-first search and test-time RL

AlphaProof combines a learned policy/value model, tree search, a formal verifier, and
test-time reinforcement learning. Its strongest transferable design pattern for NΩ is the
closed loop:

`candidate -> executable verifier -> grounded feedback -> search/value update`.

NΩ 1.20's counterexample refinement and execution contract move the architecture toward
this pattern without importing a theorem prover into the whole runtime.

Source: https://www.nature.com/articles/s41586-025-09833-y

### 1.5 VerMCTS

VerMCTS combines a verifier with tree search so partial candidate programs receive feedback
before the whole program is complete. This supports NΩ's decision to use counterexamples as
search state rather than just as a final diagnostic.

Source: https://arxiv.org/abs/2402.08147

### 1.6 Execution feedback for code generation

RLEF and later execution-feedback work support a simple conclusion: passing execution
feedback through the learning/search loop is more useful than treating execution only as a
final binary metric.

Sources:
- https://arxiv.org/abs/2410.02089
- https://openreview.net/pdf?id=zPPy79qKWe

### 1.7 Performance-aware reward

RLPF (2026) extends correctness rewards with staged execution-performance feedback. NΩ can
adopt this after correctness is stable: optimize *verified program quality per unit compute*,
not raw latency before correctness.

Source: https://arxiv.org/abs/2607.27271

### 1.8 Independent test generation / ExecCritic

ExecCritic (2026) separates test construction from source repair and uses a fail-closed
harness. This is directly relevant to NΩ's future self-modifying code loop: the actor that
writes a patch should not be allowed to silently rewrite the test oracle used to accept
that patch.

Source: https://arxiv.org/abs/2609.09133

### 1.9 Test-time instruction search

TipCoder (2026) explores a complementary idea to program sampling: search the instruction
space at inference time to add missing constraints and edge-case reminders before synthesis.
This is attractive for NΩ because it can sit before neural program generation without
requiring immediate weight updates.

Source: https://arxiv.org/abs/2609.03309

### 1.10 Self-evolving coding agents survey

The 2026 survey on self-evolving coding agents highlights executable feedback, repository
context and coding trajectories as central evidence sources, while identifying benchmark
overfitting, feedback reliability, maintainability and safety as key problems.

Source: https://arxiv.org/abs/2608.03392

## 2. Proposed NΩ synthesis

The strongest experimentally reasonable combination is not to stack all ideas blindly.
Use them as orthogonal layers:

1. Prompt / issue grounding.
2. Candidate generation from multiple sources.
3. Cheap execution filtering.
4. Independent verifier / second runtime.
5. Counterexample-guided refinement.
6. Value model trained on execution trajectories.
7. Test-time instruction proposer.
8. Skill/memory retrieval.
9. Bounded self-evolution archive.
10. Multi-objective promotion (quality, verification, OOD, resource, restart).
11. Only later: source-level self-modification in isolated branches.

## 3. Potential improvement: how to interpret it

No additive or multiplicative percentage should be claimed before matched NΩ experiments.
The literature demonstrates that verifier-guided search, self-evolution and execution
feedback can each produce substantial improvements in their own experimental settings,
but those values are not directly portable to NΩ.

The correct NΩ experiment is therefore a factorial matrix where one mechanism is added at
a time and then selected combinations are tested under equal compute budgets.

The expected benefit categories are:

| Mechanism | Expected effect to measure | Failure mode |
|---|---|---|
| Canonical executable spine | verified end-to-end rate | benchmark-family overfit |
| Counterexample search | recovery rate on failed candidates | search cost explosion |
| Value model | verified candidates per unit compute | bad value calibration |
| Test-time instruction proposal | OOD / edge-case robustness | prompt over-conditioning |
| Independent test agent | false-accept reduction | weak generated tests |
| DGM/HGM archive | long-horizon self-improvement | benchmark hill-climbing |
| Performance reward | verified efficiency | optimizing runtime before correctness |
| Memory/skills | transfer | negative transfer / stale skills |

## 4. Guardrails for future experiments

- Never promote a mechanism from routing accuracy alone.
- Never treat synthetic holdout correctness as evidence of broad coding intelligence.
- Preserve an independent verification path.
- Freeze tests before patch acceptance in source-level self-modification.
- Keep a fresh-process restart gate.
- Track resource consumption with real device measurements before claiming mobile gains.
- Use paired multi-seed comparisons and equal-budget ablations.
- Measure future-development value, not only current benchmark value, for self-evolution.
