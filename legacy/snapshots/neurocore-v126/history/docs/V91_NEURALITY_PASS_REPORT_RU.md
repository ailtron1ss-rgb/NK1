# NeuroCore V91 — Sequence-Local Preconditioning / Neurality Pass

## What changed

V91 preserves the proven V90 recurrent cell instead of layering another neural subsystem on top of it.
The substantive change is a learning-boundary correction: the diagonal online preconditioner is reset
at the start of each batched sequence (`forward()`), while token-by-token `step()` remains stateful for
continuous runtime streams.

This removes unintended coupling where the key-energy statistics from one unrelated training episode
could influence the next episode. No second memory owner and no new trainable projection were added.

## Research alignment

- Gated DeltaNet-2 separates channel-wise erase and write gates and uses channel-wise decay.
- Raven uses sparse input-dependent editing over persistent memory slots.
- Preconditioned DeltaNet frames delta recurrences as online least-squares updates and introduces
  curvature-aware/diagonal preconditioning.

NeuroCore uses these as design references, not as a copied implementation.

## Qualification

Controlled episodic key→value recall, 5 seeds × 240 optimization steps, matched model/training budget:

| metric | V90 frozen | V91 | change |
|---|---:|---:|---:|
| mean cosine | 0.433536 | 0.445158 | +2.68% |
| mean top-1 | 0.291667 | 0.319792 | +9.64% |
| mean train time | 2.9698 s | 2.9838 s | +0.47% |
| median train time | 2.9706 s | 2.9449 s | -0.87% |

Cosine improved on all five paired seeds. Top-1 improved on three of five seeds, with two small regressions;
therefore this is a qualified local improvement, not a claim of universal superiority.

## Rejected candidates in this pass

1. Learned surprise-gated plasticity: short qualification was unstable and the optimized version regressed
   relative to V90; not integrated.
2. State-aware router (`router(h) + state_affinity`): small short-horizon effects were inconsistent and the
   longer run did not improve recall; not integrated.
3. Learned output gate: reduced episodic recall while increasing latency; rejected.

Rejected implementations stay outside current runtime. They are evidence, not architecture.

## Integrity checks

- Current suite: 10/10 PASS.
- V86–V88 regression suite: 19/19 PASS.
- Current recurrent owner count: one.
- No `current_spine.*` duplicate state-dict namespace.
- V90 state tensors remain shape-compatible; V91 old experimental plasticity-only tensors are migration-skipped.

## Remaining uncertainty

The result is not yet an external continual-learning qualification. The next gate is a multi-phase stream with
forgetting, forward/backward transfer, recovery, long-horizon recall, and resource measurements.
