# NK1 — Metacognitive Neural Substrate integrity

**Date:** 2026-11-27  
**Canonical base:** `workpass70-source @ c6d27bd95904bf12c2f258c6fbd3cf73acf76bf5`  
**Aspect:** `aspect/metacognitive-neural-integrity-20261125`  
**PR:** #1179  
**Porting note:** the aspect branch has been ancestry-synchronized with the current canonical source; the metacognitive module itself was unchanged between its original base and the new source checkpoint.

## Scope

This change repairs the existing neural self-observation owner. It does not add a second metacognition subsystem and does not claim that a small local neural head makes the organism conscious or improves real-world decision quality.

## Defects reproduced

1. The feature pack is 27-dimensional: 12 central-latent + 6 workspace + 4 self-latent + 5 scalar values. The original state allocated only 24 input slots and discarded the last three.
2. The back-propagation step updated input weights using the previous observation vector even though its hidden activation was computed from the current vector.
3. Introspective error compared six network outputs with the first six elements of the raw input vector. Those values are not semantically paired targets.

The first test-only commit ran in GitHub Actions and failed on the exact expected dimension assertion: actual 24, expected 27. This is the observed RED for the original production code.

## Change

- Version the substrate state as v2 and set the input contract to 27.
- Migrate v1 / 24-dimensional checkpoints without discarding their learned prefix: keep the existing 24 columns, pad the three new columns with zero, and preserve the previous input history.
- Store the six desired outputs alongside the prediction that they supervise.
- Compute introspective prediction error against the paired previous target.
- Apply the input-weight gradient to the exact current input vector that produced the hidden activation.
- Keep recurrent and output weight updates bounded by the existing [-1, 1] limits.

## Tests

- `metacognitive-input-dimension.mjs`: full feature count, new feature slots, v1 restore migration, weight-prefix preservation and neutral target initialization.
- `metacognitive-observation-alignment.mjs`: prediction-to-target pairing and outcome-arrival calibration.
- `metacognitive-gradient-alignment.mjs`: current-sample gradient attribution.
- `big-pass-188-metacognitive-neural.mjs`: existing runtime integration contract.

## Evidence boundary

Passing these tests proves local state alignment and numerical update behavior only. It does not establish an independent improvement in task accuracy, long-horizon transfer, user-level adaptation, or subjective experience.
