# WorkPass490 — Hermes self-evolution donor analysis and NK1 adaptation

Research snapshot: 2026-10-24.

## Source examined

- NousResearch/hermes-agent-self-evolution: https://github.com/NousResearch/hermes-agent-self-evolution
- Project plan: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md
- GEPA use cases: https://gepa-ai.github.io/gepa/guides/use-cases/
- Voyager paper: https://arxiv.org/abs/2305.16291

The upstream Hermes project describes a DSPy + GEPA loop that mines real sessions, builds evaluation datasets, uses execution traces for reflective failure analysis, evaluates candidate variants in parallel, applies constraints and benchmark gates, and proposes changes for review. The repository describes Phase 1 skill evolution as implemented while tool-description, prompt, code, and unattended continuous-evolution phases remain planned. Do not treat the roadmap as evidence those phases are already implemented upstream.

## What NK1 should reuse conceptually

1. **Failure-conditioned repair:** attach a classified failure and trace slice to each revision proposal; avoid generic mutation without a causal diagnosis.
2. **Real-use plus curated evaluation:** combine verified runtime outcomes, carefully generated cases, and a small golden set. Synthetic cases are useful for bootstrapping but are not proof of real-world improvement.
3. **Candidate population with bounded selection:** generate multiple small variants, compare on paired tasks, and preserve the best validated parent if no candidate wins.
4. **Separate optimization from release:** proposals must not activate themselves. Independent evaluation and explicit approval remain distinct.
5. **Size, semantic, and regression constraints:** prevent prompt/skill bloat, purpose drift, and local gains that damage other task families.
6. **Trace lineage and rollback:** preserve parent hash, candidate hash, evaluator version, task-manifest fingerprint, per-seed outcomes, rejected candidates, and reason codes.

## NK1-specific adaptation

NK1 already has a stronger typed evidence substrate than a plain skill-text optimizer: P23 verified outcomes, a holdout-aware skill revision gate, an independent candidate evaluator, learning robustness metrics, and runtime causal evidence. The right integration is to bind failure diagnosis and candidate generation to these existing records, not to import a second optimizer-owned database or parallel promotion path.

WorkPass490 adds independent-seed count and per-seed regression checks to the existing `SkillRevisionGate`. This addresses a concrete failure mode: many tasks sampled with one random seed can inflate the paired-task count without demonstrating seed robustness. The gate now defaults to requiring at least three distinct holdout seeds and emits seed-level diagnostic gains. The gate remains proposal-only.

## Import and licensing boundary

This pass adapts the upstream workflow pattern and does not copy Hermes implementation files or add Python/DSPy/GEPA dependencies to NK1. Before importing upstream source code in a later pass, verify the exact LICENSE file and dependency/license compatibility at the pinned commit; do not infer reuse rights from a README badge or secondary summary.

## Remaining implementation work

- Bind verified failure classifications and compact trace slices to P23 revision generation.
- Prove train/validation/holdout separation across candidate generation, repair, threshold selection, and final evaluation.
- Add multi-candidate Pareto selection while retaining hard per-family, per-seed, safety, latency, and forgetting budgets.
- Connect rejected candidates to diagnosis history without promoting their unverified content into trusted memory.
- Run reproducible multi-seed benchmarks and record actual output, not just a planned evaluation.

## Success criterion

A real failure can be traced to evidence, diagnosed, converted to a bounded candidate, independently evaluated against a frozen baseline and holdout, rejected with a stable reason when unsafe or regressive, and promoted only through the existing authorization path.
