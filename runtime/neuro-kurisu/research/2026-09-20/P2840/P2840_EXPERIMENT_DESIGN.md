# P2840 — Experimental Design

## Experiment A — Shadow leakage

Condition 1: predictive transition only.
Condition 2: external outcome available.
Expected invariant: condition 2 must not advance canonical shadow world tick.

## Experiment B — Learning attenuation

Compare:
- simulation fallback
- external receipt without independent effect proof
- independently verified external consequence

Expected ordering:
`identity update strength: verified > receipt-only > simulation`

## Experiment C — Divergence-driven perception

Increase disagreement between shadow prediction and external consequence.
Expected result: next active-perception request rate increases until uncertainty falls.

## Experiment D — Long-horizon retention

Repeat A/B/C over hundreds of cycles and measure:
- prediction error
- replay utility
- memory promotion
- identity drift
- world-model calibration
- CPU/RAM cost

## Acceptance rule

No feature is considered a reality-grounding improvement unless it changes an externally measurable closed-loop metric or removes a verified causal leakage path.

## Experiment E — Evidence return loop

After an external outcome, the next cognitive cycle must contain an `observed`/`derived` perceptual evidence record referencing the outcome. This closes the loop from reality back into grounded world perception without mutating the simulator.
