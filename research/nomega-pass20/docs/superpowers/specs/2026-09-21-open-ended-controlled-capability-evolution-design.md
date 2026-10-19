# NΩ 1.29 — Open-Ended Controlled Capability Evolution

## Goal
Extend the existing execution-verified repair/evolution stack so the system can discover, compose, rank, and retain novel repair operators and safely adapt neural substrate structure under gradual distribution drift, without allowing self-generated evidence to promote unsafe changes.

## Architecture
The new layer has three bounded components:

1. `CapabilityEvolverV1` generates operator genomes from a fixed primitive DSL, composes primitive edits, scores novelty, and evaluates candidates through the existing TinyVM/HVM verifier. A deterministic safe baseline is always present in every pool.
2. `GradualDriftBenchmarkV1` creates sequential tasks whose oracle mixture changes gradually, measuring adaptation lag, retention, verified capability, and search cost. Current candidate selection happens before oracle evaluation.
3. `ElasticSubstratePolicyV1` converts measured plasticity/uncertainty/utility signals into bounded grow/prune/no-change plans and delegates mutation to the existing transactional structural controller. External utility and restart gates remain authoritative.

The integrated `OpenEndedCapabilityEvolutionLoopV1` connects the three while writing a provenance/evidence ledger. Neural proposals are advisory; verifier, holdout, OOD, energy and restart gates remain external.

## Safety / Promotion Constraints
- Every candidate batch includes an immutable safe baseline candidate.
- Candidate novelty is computed structurally; semantic uniqueness is verified by execution evidence.
- No self-generated score can satisfy promotion by itself.
- Equal-budget comparisons are mandatory for capability claims.
- Gradual-drift evaluation keeps future phases hidden until selection is complete.
- Elastic structural changes are transactional and revert on failed utility, retention, OOD, energy, or restart criteria.
- Research-only operator families remain non-promoted until multi-seed held-out evidence shows positive verified gain.

## New Interfaces
- `CapabilityEvolverV1.discover(family, seed_code, rows, verifier, budget, generations) -> CapabilityDiscoveryReportV1`
- `CapabilityEvolverV1.apply_operator(code, genome) -> Program`
- `GradualDriftBenchmarkV1.build_stream(family_a, family_b, phases) -> tuple[DriftPhaseV1, ...]`
- `GradualDriftBenchmarkV1.evaluate_strategy(strategy, stream, budget) -> dict`
- `ElasticSubstratePolicyV1.propose(metrics, uncertainty, plasticity) -> ElasticPlanV1`
- `ElasticSubstratePolicyV1.apply(substrate, plan, evaluator) -> ElasticTransactionResultV1`
- `OpenEndedCapabilityEvolutionLoopV1.run(...) -> dict`

## Success Criteria
1. Novel operator compositions can be generated deterministically from a bounded primitive DSL and have stable fingerprints.
2. Safe baseline is never absent from a candidate pool.
3. Discovered candidates are independently verified through both TinyVM and HVM when claiming verified capability.
4. A gradual-drift benchmark produces at least four hidden phases and reports adaptation lag separately from final capability.
5. Elastic substrate proposals can grow, prune, or defer; failed changes restore the exact pre-transaction state.
6. Multi-seed evidence is stored with lineage, budget, verifier status, and promotion decision.
7. Existing 1.25–1.28 regression tests remain green.

## Research Positioning
The design follows recent evidence that growing/elastic networks can preserve plasticity while controlling model size, and that self-evolving coding agents benefit from executable feedback and repository-level trajectories but face benchmark-overfitting and feedback-reliability risks. The architecture therefore treats exploration as research-only until independently verified, matched-budget evidence supports promotion.
