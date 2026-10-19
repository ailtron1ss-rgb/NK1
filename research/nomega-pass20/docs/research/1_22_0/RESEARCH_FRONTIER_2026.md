# NΩ 1.22.0-dev — Research Frontier / Integration Log

## Implemented directions

### 1. Verifiable dense reward
The project now includes `verifiable_dense_reward_v1.py`, which derives a continuous reward from exact execution evidence: weighted test coverage, exact pass rate, HVM agreement, termination, output closeness, efficiency, and complexity. No learned reward model is used for the reward itself.

This direction is motivated by 2026 work on verifiable dense rewards for code generation. VeRPO reports gains from dense rewards constructed directly from execution outcomes rather than a learned reward model. The project's implementation adapts the principle to the bounded TinyVM/HVM setting; published benchmark numbers are not treated as directly transferable evidence.

### 2. Execution-trace supervision
`execution_trace_v1.py` provides an independent TinyVM trace stream with per-step PC/opcode/register/output state. This enables future stepwise execution rewards and failure-mode classification.

### 3. Contract-checked search
`program_contract_v1.py` now separates structural runnability checks from semantic verification. It catches malformed registers, invalid jumps, unreachable halts and excessive dead code before expensive execution.

This follows the broader 2026 contract-checked verifier-guided search direction: structural gates should certify runnability, while the verifier remains the authority on semantic correctness.

### 4. Semantic-equivalence pruning
`semantic_prune_v1.py` performs bounded behavioral equivalence sampling before expanding expensive search branches. It is explicitly not a formal proof.

### 5. Evidence-gated neural learning
`execution_preference_trainer_v1.py` learns pairwise preferences from verifier-derived rewards, while `neural_execution_learning_lab_v1.py` only promotes a checkpoint when held-out verified coverage improves by a configurable threshold.

## External research reviewed on 2026-09-20

- VeRPO: Verifiable Dense Reward Policy Optimization for Code Generation — https://arxiv.org/abs/2601.03525
- Improving Small Language Models for Code Generation with Reinforcement Learning from Verification Feedback — https://arxiv.org/abs/2605.30478
- ExecVerify: White-Box RL with Verifiable Stepwise Rewards for Code Execution Reasoning — https://arxiv.org/abs/2603.11226
- Reason-Code: Reliable Code Generation via Test-Driven Monte Carlo Tree Search — https://aclanthology.org/2026.acl-industry.30/
- Improving LLM Code Reasoning via Semantic Equivalence Self-Play with Formal Verification — https://aclanthology.org/2026.findings-acl.1615/
- From Trajectories to Graphs: Contract-Checked Editing for Verifier-Guided LLM Reasoning — https://aclanthology.org/2026.acl-long.2004/
- Uncertainty-Aware Test-Time Search for Optimization Problem Solving — https://aclanthology.org/2026.acl-long.1975/

## Interpretation for NΩ

The converging pattern is:

`candidate generation -> cheap structural gate -> execution feedback -> dense verifier reward -> counterexample/repair -> independent verification -> replay -> gated learning`.

The current experiment did **not** demonstrate a generalization gain from pairwise dense-reward preference training. Therefore that checkpoint is not promoted as canonical. The code path is retained as an experiment, and the promotion gate requires measured held-out improvement.
