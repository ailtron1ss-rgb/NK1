# NΩ 1.17.0 Research Record

Date: 2026-09-20
Status: research-only, not promoted to canonical release.
Baseline: 1.14.1.

## Purpose

This folder records research that directly changed or rejected implementation choices during the 1.17 development cycle. It is intentionally separated from the canonical governed release so that experimental branches cannot silently become production behavior.

## Implemented research directions

1. Typed ProgramSketch / semantic IR: preserve task semantics separately from register-level code.
2. Execution-aware budgeting: spend execution only where uncertainty/novelty make verification informative.
3. Hash-chained causal evidence: every promotion decision can carry immutable provenance.
4. Paired multi-seed evidence: promotion can require matched effect rather than aggregate averages.
5. Verifier-guided candidate search: proposal and verification are separated into explicit contracts.
6. Semantic-targeted repair: mutate a neural candidate toward semantic operators rather than random mutation only.
7. Active test-time hypothesis filtering: choose high-disagreement tests to eliminate program hypotheses early.
8. Mobile sustained benchmark: collect p50/p95/p99 latency and resource provenance instead of host-only theoretical estimates.

## Rejected or unpromoted directions

### V10 typed-sketch search

Matched short run did not improve over V9 on holdout, adversarial, or HVM metrics. It remains a research branch only.

### Semantic repair V2

Matched short run did not beat the existing V1 repair track. It remains available for future refinement, but is not the canonical repair policy.

### Active retrieval V2

The short three-seed benchmark matched V1 verified rate (0.1667 vs 0.1667), with nearly identical holdout/adversarial/HVM results, while reducing the number of full-candidate evaluations after active filtering. The larger retrieval pool increases retrieval work, so this is a compute-allocation research branch rather than a quality promotion.

## Evidence discipline

Hybrid success must never be reported as pure neural success. Benchmark-family expected outputs are treated as research-only oracles and are recorded explicitly in experiment manifests.
