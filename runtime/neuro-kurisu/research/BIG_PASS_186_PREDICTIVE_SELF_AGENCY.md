# BIG PASS 186 — Predictive Self / Agency Brain

Status: VERIFIED FUNCTIONAL, not consciousness proof.

## Research basis

The brain does not appear to have a single localized "consciousness center". Contemporary consciousness work compares recurrent/re-entry, global-workspace, higher-order and integrated-information approaches. A 2025 Nature adversarial collaboration directly compared GNWT and IIT predictions and found a mixed empirical picture rather than a decisive single-center mechanism.

Recent 2026 work on brain-wide cognition emphasizes distributed representations, which supports using a central recurrent substrate as an integration hub while preserving specialized distributed processors.

Predictive self/agency was therefore implemented as a learned computational subsystem, not as a claim of biological equivalence.

## Engineering change

Added `PredictiveSelfAgencySubstrate`.

It maintains a 24-dimensional recurrent self latent state, predicts the next self-state, learns action-conditioned outcome predictions, and estimates ownership/authorship from predicted intention, outcome error and causal-match evidence.

The module is persisted through the canonical cognition facet and is integrated into the decision path with a bounded influence of at most 0.018 utility units per candidate. This prevents an immature model from overriding already-validated policy.

## Evidence

Standalone run: 96 observation cycles and 96 outcome-learning cycles. 192 samples. Prediction error decreased to ~0.043. Agency confidence ~0.794, ownership ~0.652, authorship ~0.678. Snapshot/restore is exact.

Core integration: 3 full observe/feedback cycles. The new substrate accumulated 3 recurrent learning steps and 6 prediction samples without regression of previous brain systems.

Regression suite:
- TYPECHECK PASS
- BIG PASS 181 function reality: 200/200, 0 failed, 0 skipped
- BIG PASS 183 central brain PASS
- BIG PASS 185 hippocampal memory PASS
- P27 learned world PASS
- P27 integration PASS
- brain architecture PASS
- forensics PASS
- source hygiene PASS
- release source PASS

## Remaining limitation

This is a learned self/agency model, not a demonstrated phenomenal self or conscious subject. It also remains compact and partly engineered around curated state vectors rather than learned end-to-end multimodal representations.

## Next target

B5: recurrent global workspace 2.0, with central recurrent latent persistence, learned competition, broadcast, specialist read/write routing and causal lesion tests.
