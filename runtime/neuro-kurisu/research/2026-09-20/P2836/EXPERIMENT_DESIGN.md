# P2836 Experimental Design

## A. Reality arbitration ablation

A: simulation-only
B: hybrid
C: external-first

Metrics:
- reward prediction error;
- external evidence rate;
- verified consequence rate;
- independent consequence rate;
- neural learning updates;
- identity continuity;
- replay stability.

Expected direction (hypothesis, not guaranteed gain): external-first should improve reality calibration when the device provides fresh observations; simulation-only should remain cheaper and more deterministic.

## B. Neural causal ablation

Compare:
- full neural substrate;
- lesion recurrent component;
- lesion plasticity;
- lesion action readout;
- lesion grounding input.

A result is considered causal only when the intervention produces a reproducible change beyond matched control.

## C. Fast/slow replay experiment

Variants:
- legacy replay;
- fast-only;
- slow-only;
- fast/slow thermostat;
- thermostat + negative-transfer gate.

Metrics:
- adaptation speed;
- forgetting;
- negative transfer;
- stability;
- mobile CPU/RAM cost.

## D. World-model experiment

Compare compact internal world model vs external world-model adapter in a held-out interaction benchmark. Do not count generated video quality itself as organism intelligence; measure prediction of consequences and action selection instead.

## E. Personality continuity experiment

Run the same organism through different model backends and restarts. Measure whether value/goal/self-memory trajectories remain consistent while language realization changes.
