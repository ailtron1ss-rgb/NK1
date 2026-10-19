# NΩ-Core 0.5 Architecture

## Runtime loop

1. Encode text/image/audio into a shared latent state.
2. Estimate difficulty, uncertainty, novelty and compute budget.
3. Route to top-k specialists.
4. Retrieve memory when useful.
5. Execute symbolic/program tools only inside bounded runtimes.
6. Keep structured evidence attached to candidate answers.
7. Verify before promotion to a final answer.
8. Audit reasoning traces and record reward/cost.
9. Consolidate high-value memory.

## Safety invariants

- retrieved memory is never an answer by itself;
- arbitrary Python is never executed by the tool registry;
- unsupported TinyVM instructions are not silently approximated;
- unverified answers abstain by default;
- continual-learning candidates must pass a promotion gate;
- experimental modules are isolated by config flags.

## Research hypotheses

H1: adaptive routing increases verified capability per compute.
H2: dual-runtime agreement reduces program-execution portability errors.
H3: memory-to-procedure consolidation improves repeated-task latency without increasing hallucination.
H4: hardware-aware routing can preserve quality under thermal/battery pressure.
H5: predictive recurrent workspace can reduce repeated attention/context cost.

None of H1-H5 is presented as established fact; each requires controlled ablations.
