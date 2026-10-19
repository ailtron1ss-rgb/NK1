# NOMEGA Pass 13 — Integrity + Execution-Grounded Skill Layer

Date: 2026-09-24

## Purpose

This pass continues the canonicalization work without adding another neural-program-synthesizer generation. It fixes confirmed runtime/learning-integrity defects, strengthens the existing neural substrate, and makes the verified-skill path execution-grounded.

## Real code changes

### Neural substrate

- Fast plasticity is now represented as a non-negative synaptic magnitude and receives the same E/I source sign as the slow recurrent matrix. Fast plasticity can no longer silently flip an inhibitory source into excitation or vice versa.
- Structural plasticity now recomputes inactive edges after pruning and repairs every target row so that both excitatory and inhibitory source populations remain reachable.
- Added `state_digest()` over the full serialized substrate state. This provides deterministic restart/state-equivalence evidence instead of comparing only configuration signatures.

### Verified skill bank

- Fixed import-time `created_at` defaults by using `default_factory=time.time`.
- Promotion no longer increments execution usage counters. A promoted skill has zero uses until it is actually executed.
- Added stable JSON-backed skill identity derivation instead of relying solely on Python `repr()` ordering.
- Added explicit `active`, `quarantined`, and `retired` lifecycle states with provenance-preserving quarantine/retirement.
- Actual execution can record verifier/runtime evidence separately from promotion.

### Skill compiler

- Fixed import-time `created_at` defaults.
- Uses the same deterministic family/program identity construction.
- Provenance is merged on repeated compilation instead of being discarded.

### Skill expert / verification

- Multi-argument input tapes are accepted from `inputs` and from ordered context fields `a..h`.
- Verification now requires TinyVM/HVM agreement **and**, when an expected result is supplied, agreement with that expected result.
- Dual-runtime agreement is therefore no longer sufficient to label an incorrect result as verified.

## Verification performed

- `python -m compileall -q core tests`: PASS.
- Canonical registry: 38 canonical records, 0 import/symbol failures.
- Targeted substrate + skill + legacy integration suite: **24 passed**.
- Canonical/self-development/evidence/bridge suite: **18 passed**.
- Combined targeted evidence: **42 passing tests**.
- Full pytest collection: **424 tests collected**.
- Full-suite execution is not claimed green; heavy/legacy shards remain a release-gate task.

## Research alignment

The architecture is informed by current self-evolving coding-agent research that emphasizes executable feedback, persistent skills/memory, repository-level context, reversibility, and generalization, rather than merely generating better individual answers. See Zhou et al., *Self-Evolving Coding Agents* (2026): https://arxiv.org/abs/2608.03392 .

For evolutionary search, NOMEGA's verifier-first design is aligned with ShinkaEvolve's executable evaluation, archives, islands, and cross-island knowledge transfer: https://github.com/SakanaAI/ShinkaEvolve . CodeEvolve provides a related open implementation of evolutionary coding with quantifiable evaluation: https://github.com/inter-co/science-codeevolve .

Recent runtime-learning work such as MemRL motivates treating experience as a source of policy change rather than passive retrieval: https://arxiv.org/abs/2601.03192 . This is relevant to the next phase where NOMEGA must demonstrate that reusable experience changes future behavior, not merely that it can be looked up.

A recent security result, SkillJack (2026), shows why persistent skill promotion requires strong provenance, quarantine, and execution verification: https://arxiv.org/abs/2608.03509 .

## Current bottleneck

The strongest unresolved issue is still **causal neural contribution to coding capability**. The substrate is executable and trainable, but the project must prove that neural adaptation produces a durable improvement in unseen coding families, under matched compute and without semantic helper leakage. Until such evidence exists, the neural substrate remains research-only and is not promoted as the primary source of capability.

## Next pass

### Pass 14 — Neural Capability Causality

1. Build a canonical matched-budget baseline matrix (frozen neural, adapted neural, ablations).
2. Add raw-text / ordered-sequence input without typed-sketch leakage.
3. Evaluate continual adaptation, forgetting, negative transfer, restart equivalence, and unseen-family OOD.
4. Attribute gains to specific substrate mechanisms through causal ablations.
5. Promote only mechanisms whose measured effect survives multi-seed and OOD gates.

### Pass 15 — Self-Modification Spine

Move from evolution of candidate programs to controlled source-level modification of the cognitive engine itself, using isolated candidate environments, executable tests, holdout/OOD evaluation, restart verification, provenance, promotion, and rollback.
