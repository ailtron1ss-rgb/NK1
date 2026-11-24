# NOMEGA Pass17 — Coalition-Aware Skill Reliability

## Scope
Pass17 extends the canonical reusable-skill lifecycle with measured coalition contribution evidence and target-family masking, while strengthening provenance gating and canonical runtime retrieval.

## Real code changes
- `SkillBank.record_coalition_audit()` persists measured leave-one-out marginal contributions for a target family.
- Repeated measured exclusion improvements can mask a skill for a target family without globally quarantining the skill.
- `SkillBank.coalition_rank()` ranks active skills using measured marginal evidence when available; skills without evidence do not receive synthetic contribution priors.
- `CanonicalSkillLifecycleV1.observe_coalition()` and `.coalition()` make the mechanism part of the canonical skill API.
- `NOmegaCore` now retrieves skills through the canonical coalition-aware lifecycle instead of bypassing it via `SkillBank.match()`.
- Reusable-skill activation requires `provenance_sources >= 2`.
- Governance telemetry failures are retained as explicit in-memory evidence instead of being silently swallowed.
- SkillBank export/load now persists coalition evidence while remaining backward-compatible with the previous flat skill map.

## Research alignment
The design is informed by 2026 work on skill contamination and coalition-aware reliability. Recent contamination results argue for pre-commit filtering because post-hoc removal can fail to reverse inherited contamination, while coalition-aware work reports that bank-level gains can conceal negative individual/coalition contributions and proposes marginal subset selection and transfer-time masking. SkillOS further treats skill curation as a learned decision process over accumulated experience. citeturn903721academia13turn100273view1turn100273view2

CodeEvolve provides a useful open-source reference for executable evaluation, evolutionary archives, islands and migration; NOMEGA adopts the underlying evidence-first ideas without copying its implementation or treating its results as NOMEGA evidence. citeturn100273view0

## Verification
- Pass17 targeted tests: **27 passed**.
- Broad regression set covering Pass13–17, canonical registry, neural substrate, causal/self-improvement loops and transfer/unlearning: **76 passed**.
- `compileall core/nomega tests`: **PASS**.
- Canonical registry resolution: **41/41**, **0 cycles**, **0 import failures**.
- Full pytest collection: **461 tests, 0 collection errors**.
- Full 461-test execution: **not claimed green** because historical/legacy slow paths remain a separate release gate.

## Scientific interpretation
The new coalition mechanism is a real measurement protocol, not a fabricated skill score. A target-family mask is activated only from repeated measured leave-one-out evidence. No target-domain benefit is claimed globally, and no pure-neural uplift is inferred.
