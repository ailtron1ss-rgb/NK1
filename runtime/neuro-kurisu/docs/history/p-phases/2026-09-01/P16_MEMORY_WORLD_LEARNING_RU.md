# P16 — Memory / World / Learning Integration

P16 is the second large development step after P15.5 device hardening.

## Goal

Move the organism from “stores experience and statistics” toward a closed online learning loop:

`experience -> memory retrieval -> prediction -> action -> outcome -> model update -> policy update -> future action bias`.

## MemoryOS2

The memory subsystem now has a lightweight phone-safe semantic index based on normalized token hashing into compact vectors. Retrieval combines:

- exact phrase match;
- token overlap;
- compact vector similarity;
- recency;
- salience;
- goal/identity relevance;
- prediction error;
- graph-link support.

New memories automatically receive temporal and semantic links. The implementation deliberately does **not** claim to be a neural embedding model; it is a deterministic low-cost retrieval layer suitable for the phone target.

## World model

WorldModel2 remains hybrid/statistical. It continues to learn state-action transition hypotheses, reward distributions, uncertainty and calibration. P16 connects its learned predictions to the learning loop instead of treating the model as a passive research ledger.

## Adaptive policy

`AdaptivePolicyEngine` is a compact contextual TD/Q-style learner. It stores action values by coarse organism-state context and updates the selected action after feedback using reward plus a discounted bootstrap estimate from the next context.

This changes future action scoring. It is therefore a genuine behavior-affecting online learning component, while remaining small enough for ARM/mobile execution.

## State compatibility

State schema: **19**.

Old schema 18 state remains migratable. The new adaptive policy starts empty for old organisms and learns from subsequent experience.

## What P16 does not claim

P16 is still not deep neural lifelong learning, not a learned latent world model, and not evidence of consciousness. It is an integrated, measurable online adaptation layer.
