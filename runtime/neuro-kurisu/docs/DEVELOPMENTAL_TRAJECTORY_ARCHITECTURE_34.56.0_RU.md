# Developmental Trajectory Architecture — 34.56.0 / BIG PASS 83

## Purpose
Close a concrete causal gap between experience consequences and future behavior without introducing another Pxx runtime owner.

## Canonical owner
`IdentityTrajectoryEngine` owns developmental trajectory history. It is not the source of truth for memory, personality, values, goals or identity. Those remain in their existing canonical owners.

## Mechanism
`observeOutcome()` records a bounded action-specific carry-over from consequence quality, uncertainty/surprise and trust. Context tags preserve phase/attractor/motive/goal-family provenance. A gated `actionBias()` feeds the existing OrganismCore candidate scorer only after sufficient outcome evidence.

## Reversibility
Carry-over decays continuously; strong counterevidence reverses a previously positive bias. Bias is numerically bounded and evidence-gated.

## Causal experiment
Two real `OrganismCore` instances start identically. One receives repeated high outcomes, the other repeated low outcomes for the same selected action. They are then exposed to the same future contexts. In the current experiment, decisions diverged in 4/8 future contexts; the high/low action-bias values separated at approximately +0.085 / -0.055 in the stored outcome profile.

## Scientific status
Functional computational mechanism and causal behavior-change evidence. Not proof of phenomenological consciousness or subjective experience.

## Minimal falsification targets
- no divergence under controlled opposite histories;
- bias persists under strong counterevidence;
- behavior changes while the underlying action outcome evidence is absent;
- persistence/reload loses or corrupts trajectory state;
- a simpler stateless heuristic reproduces the same effect at lower cost.
