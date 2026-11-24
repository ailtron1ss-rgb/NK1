# NOMEGA 1.25 — Causal Neurality Research Notes

## Evidence that shaped this release

### AlphaEvolve (Google DeepMind, 2025; 2026 impact update)
The architecture combines model-generated candidate programs with automated evaluators and an evolutionary program archive. The relevant design lesson for NOMEGA is that self-improvement must be tied to objective, executable evaluation rather than self-reported quality.

- https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
- https://deepmind.google/blog/alphaevolve-impact/

### Darwin Godel Machine (2025)
DGM maintains an archive of self-modified agents and explores multiple improvement lineages instead of replacing one canonical agent with every local change. NOMEGA 1.24 already added lineage/metaproductivity; 1.25 extends that philosophy to causal neural interventions.

- https://arxiv.org/abs/2505.22954

### Counterfactual Credit Assignment (2026)
Recent work such as C3 and Counterfactual Shapley Credit Assignment emphasizes replaying counterfactual decisions, using fixed context and leave-one-out or sibling trajectories to isolate contribution. NOMEGA 1.25 implements the simpler execution-grounded version first: neutralizing one program instruction and re-running the verifier.

- https://arxiv.org/abs/2603.06859
- https://arxiv.org/abs/2607.16999

### Continual learning and replay (2025)
Experience replay has evidence for preserving plasticity, but replay is not a universal guarantee and can trade retention against plasticity. NOMEGA keeps holdout/OOD/regression partitions immutable and measures replay effects instead of assuming them.

- https://arxiv.org/abs/2503.20018

## Engineering decision

N1 is awarded only when a neural intervention both changes decisions and has an execution-measured causal parameter effect. N2 additionally requires positive held-out verified-rate gain. Dense reward improvement alone cannot promote N2.
