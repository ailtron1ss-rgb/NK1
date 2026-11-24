# NOMEGA PASS14 — Neural Capability / Self-Modification Integrity

## State

- Version: `1.30.0-dev`
- Status: `research_only`
- Baseline: `NOMEGA_PASS13`
- Source tree files (cache-excluded): **1049**
- Python files: **541**
- `core/nomega` Python files: **304**
- Test Python files: **141**
- Pytest collection: **436 tests**
- Canonical registry: **38/38 targets importable/resolvable**

## Implemented

### 1. Source-level self-modification became an actual governed transaction

`SourcePatchSandboxV1` now binds automatically generated candidate identity to the baseline source-tree hash. A candidate therefore cannot silently represent a different baseline. Source promotion refuses stale canonical trees, stages all changed files before committing, and restores already-promoted files if a later commit operation fails.

The control plane now exposes explicit `rollback_source_promotion(...)`, with a second stale-state guard so rollback cannot overwrite newer source changes.

### 2. Architecture creation is supported by the same path

`SourceEditV1(create_if_missing=True)` permits a candidate to introduce a new Python module inside the sandbox. The same compile/test/provenance/promotion/rollback rules apply.

This closes a previous restriction that made source-level architectural evolution possible only by modifying existing files.

### 3. Structural plasticity no longer has a hidden E/I failure mode

The structural controller now refuses pruning that would remove the last excitatory or inhibitory source from a target neuron. This is enforced at the controller level rather than relying on a downstream substrate invariant.

### 4. Restart verification is stronger

Elastic-substrate restart equivalence now performs a real serialized state round-trip with `torch.save`/`torch.load`, followed by the substrate's deterministic state digest comparison. The test is therefore closer to an actual checkpoint/restart boundary than direct live-tensor copying.

### 5. Removed fake open-ended evaluation hooks

Two open-ended paths previously passed constant evaluators (`lambda _: 0.0`). Those have been replaced. The open-ended benchmark now uses an explicit structural-health evaluator and the smoke path evaluates actual program holdout execution rather than synthesizing drift scores from phase mix. Structural-health is deliberately recorded as structural evidence only; it is never treated as capability evidence.

## Verification

- `python -m compileall -q core tests`: **PASS**
- Critical neural/skills/self-development/evolution/source-governance shard: **85 passed, 1 warning**
- Targeted Pass14 source/architecture tests: **12 passed**
- Full pytest collection: **436 collected**
- Full suite: **not claimed green**; historical heavy/legacy paths still need a dedicated release run.

A real source-level candidate against the NOMEGA tree was attempted. It was correctly **rejected** because its release-version change conflicted with the existing release-version contract; this is treated as a positive fail-closed result, not as a failed pass.

The open-ended smoke path produced real executable feedback and lineage (`11` discovered candidates, `4` verified, `11` lineage events) and accepted one structural-health transaction.

## Neural conclusion

The ordered sequence path, surrogate gradient path, E/I constraints, structural transactions and restart digest are now technically connected. However, the strict raw-language ablation still does **not** demonstrate a robust causal improvement in coding capability. That remains an explicit research limitation. No hybrid/search improvement is being relabeled as pure-neural learning.

## Research alignment

The pass follows the current source-level self-evolution direction represented by MOSS, which uses deterministic staged source rewriting, isolated replay/verification and rollback-gated promotion, and by the 2026 survey of self-evolving coding agents, which highlights executable feedback, maintainability, overfitting, safety and generalization as central concerns. It also reflects recent evidence that uncontrolled skill accumulation can contaminate later skills, motivating pre-commit heterogeneous verification rather than post-hoc deletion.

Useful open-source patterns examined include yoyo-evolve (tests-gated self-evolution plus mutation testing), Ouroboros/self-improving coding agents (source evolution with rollback and reviewed changes), and GEA (experience sharing across evolving agents).

## Remaining bottlenecks

1. Full-suite execution/release verification still has to be localized into fast, slow and isolated shards and made fully reproducible.
2. The neural substrate still needs a genuine capability-level causal effect on raw-language coding tasks.
3. The self-modification spine currently provides the execution/governance machinery; the next major step is connecting it to an autonomous proposal generator and metaproductive feedback without weakening the verifier boundary.
4. Skill admission/retirement needs heterogeneous pre-commit checks and marginal-gain selection to prevent contamination chains.

## Next passes

### PASS15 — Full Self-Modification Spine
Proposal generation → isolated patch → compile → focused regression → full gates → lineage → promotion → restart → rollback → mutation testing.

### PASS16 — Skill Memory Integrity
Canonical skill identity → execution provenance → heterogeneous verification → marginal-gain admission → quarantine/retirement → cross-family transfer.

### PASS17 — Metaproductivity / Open-Ended Evolution
Measure whether NOMEGA becomes better at producing future improvements, not only whether the current artifact scores higher.

### PASS18 — Continual Neural Learning
Learned plasticity gating, replay/consolidation, online adaptation, unlearning and unseen-family causal evaluation.
